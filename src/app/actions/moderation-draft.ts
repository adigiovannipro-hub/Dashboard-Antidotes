"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getViewer } from "@/lib/auth";
import { getModerationContext } from "@/lib/moderation/access";
import { generateDraft } from "@/lib/moderation/draft-generator";
import { getEmbeddingProvider } from "@/lib/moderation/embeddings";
import type { SearchableEntry } from "@/lib/moderation/faq-search";
import { can } from "@/lib/moderation/permissions";
import type {
  Conversation,
  Draft,
  ModerationChannel,
  ModerationClient,
  ModerationMessage,
  ToneSettings,
} from "@/lib/moderation/types";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * Génération d'un brouillon à la demande.
 *
 * C'est le câble qui manquait : `generateDraft` existait et n'était appelé par
 * personne, si bien que toute conversation réelle arrivait sans brouillon.
 *
 * Deux déclencheurs, un seul chemin : l'ouverture d'un fil sans brouillon, et
 * le bouton « Régénérer ». **Le résultat est écrit en base**, donc le modèle
 * n'est appelé qu'une fois par conversation — rouvrir un fil dix fois ne coûte
 * rien. Seul un clic humain sur « Régénérer » repaie un appel.
 */

export type DraftGenerationResult =
  | { ok: true; draft: Draft }
  | {
      ok: false;
      error: string;
      /**
       * `config` : il manque une clé, rien ne sert de réessayer — l'écran
       * propose d'écrire à la main. `refusal` et `error` sont rejouables.
       */
      cause: "config" | "refusal" | "error";
    };

const input = z.object({
  conversationId: z.uuid(),
  /** Régénérer : le brouillon existant est périmé et un nouvel appel est payé. */
  force: z.boolean().optional(),
});

/** Les cinq derniers échanges, en clair — le modèle a besoin du fil, pas de tout. */
const EXCERPT_MESSAGES = 6;

async function requireOperator(clientId: string) {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Session expirée.");

  const { access } = await getModerationContext();
  if (!access.clientIds.includes(clientId)) {
    // Message volontairement neutre : ne pas confirmer l'existence du client.
    throw new Error("Action indisponible.");
  }
  if (!can(access.role, "conversation.reply")) {
    throw new Error("Votre rôle ne permet pas cette action.");
  }
  return { viewer, access };
}

export async function generateConversationDraft(
  payload: unknown,
): Promise<DraftGenerationResult> {
  const parsed = input.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: "Requête invalide.", cause: "error" };
  }
  const { conversationId, force } = parsed.data;

  try {
    const supabase = await createClient();

    const { data: conversationRow } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conversationRow) {
      return { ok: false, error: "Conversation introuvable.", cause: "error" };
    }
    const conversation = conversationRow as unknown as Conversation;

    const { viewer } = await requireOperator(conversation.client_id);

    // Anti-boucle et anti-dépense : un brouillon déjà écrit est rendu tel quel.
    // Sans cette lecture, chaque ouverture du fil relancerait un appel modèle.
    const { data: existingRows } = await supabase
      .from("drafts")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(1);
    const existing = ((existingRows ?? [])[0] as unknown as Draft) ?? null;
    if (existing && !force) return { ok: true, draft: existing };

    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        ok: false,
        error: "ANTHROPIC_API_KEY absente : aucune réponse ne peut être générée.",
        cause: "config",
      };
    }

    const [{ data: clientRow }, { data: messageRows }, { data: faqRows, error: faqError }] =
      await Promise.all([
        supabase
          .from("moderation_clients")
          .select("*")
          .eq("id", conversation.client_id)
          .maybeSingle(),
        supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("sent_at"),
        supabase
          .from("faq_entries")
          .select(
            "id, question_canonical, variants, answer_fr, answer_en, channels, priority, active, confidence, embedding",
          )
          .eq("client_id", conversation.client_id)
          .is("deleted_at", null),
      ]);

    if (!clientRow) {
      return { ok: false, error: "Client de modération introuvable.", cause: "error" };
    }
    // La FAQ manquante n'empêche pas de répondre — mais une table en erreur ne
    // doit pas se lire comme « ce client n'a pas de FAQ ».
    if (faqError) {
      return {
        ok: false,
        error: `Lecture de la FAQ impossible : ${faqError.message}`,
        cause: "error",
      };
    }

    const client = clientRow as unknown as ModerationClient;
    const messages = (messageRows ?? []) as unknown as ModerationMessage[];
    const lastInbound = [...messages]
      .reverse()
      .find((message) => message.direction === "inbound");

    const question = lastInbound?.body.trim() ?? conversation.excerpt?.trim() ?? "";
    if (!question) {
      return {
        ok: false,
        error: "Ce fil ne porte aucun message entrant à traiter.",
        cause: "error",
      };
    }

    const outcome = await generateDraft({
      question,
      conversationExcerpt: buildExcerpt(messages, client.name),
      channel: conversation.channel,
      kind: conversation.kind,
      locale: conversation.detected_locale ?? client.locale_default ?? "fr",
      clientName: client.name,
      tone: client.tone_settings as ToneSettings,
      entries: toSearchableEntries(faqRows ?? []),
      provider: getEmbeddingProvider(),
    });

    if (outcome.kind === "refused") {
      return { ok: false, error: outcome.reason, cause: "refusal" };
    }

    const admin = createAdminClient();

    // Le brouillon remplacé ne disparaît pas : il passe `expired`, et la
    // lecture prend toujours le plus récent.
    if (existing) {
      await supabase.from("drafts").update({ status: "expired" }).eq("id", existing.id);
    }

    const { data: inserted, error: insertError } = await supabase
      .from("drafts")
      .insert({
        conversation_id: conversation.id,
        client_id: conversation.client_id,
        body: outcome.body,
        locale: outcome.locale,
        confidence: outcome.confidence,
        model: outcome.model,
        prompt_version: outcome.promptVersion,
        status: "proposed",
        sources: outcome.sources,
        translated_from_fr: outcome.translatedFromFr,
      } as never)
      .select("*")
      .single();

    if (insertError || !inserted) {
      return {
        ok: false,
        error: `Le brouillon n'a pas pu être enregistré : ${insertError?.message ?? "écriture refusée"}`,
        cause: "error",
      };
    }

    await admin.from("moderation_audit_log").insert({
      actor_id: viewer.user.id,
      client_id: conversation.client_id,
      conversation_id: conversation.id,
      action: force ? "draft.regenerate" : "draft.generate",
      after: {
        grounded: outcome.grounded,
        faq_method: outcome.faqMethod,
        missing_information: outcome.missingInformation,
      },
    } as never);

    revalidatePath("/moderation");
    return { ok: true, draft: inserted as unknown as Draft };
  } catch (error) {
    return { ok: false, error: (error as Error).message, cause: "error" };
  }
}

/**
 * L'historique récent, une ligne par message. Les noms sont explicites : le
 * modèle doit savoir lequel des deux camps a écrit quoi, sans quoi il répond
 * à sa propre réponse.
 */
function buildExcerpt(
  messages: readonly ModerationMessage[],
  clientName: string,
): string {
  return messages
    .slice(-EXCERPT_MESSAGES)
    .map((message) => {
      const who =
        message.direction === "inbound"
          ? (message.author_handle ?? "la personne")
          : clientName;
      return `${who} : ${message.body}`;
    })
    .join("\n");
}

type FaqSearchRow = {
  id: string;
  question_canonical: string;
  variants: string[] | null;
  answer_fr: string | null;
  answer_en: string | null;
  channels: string[] | null;
  priority: number;
  active: boolean;
  confidence: number;
  embedding: string | number[] | null;
};

function toSearchableEntries(rows: unknown[]): SearchableEntry[] {
  return (rows as unknown as FaqSearchRow[]).map((row) => ({
    id: row.id,
    question_canonical: row.question_canonical,
    variants: row.variants ?? [],
    answer_fr: row.answer_fr,
    answer_en: row.answer_en,
    category_name: null,
    channels: (row.channels ?? []) as ModerationChannel[],
    priority: row.priority,
    active: row.active,
    confidence: row.confidence,
    embedding: parseEmbedding(row.embedding),
  }));
}

/** pgvector arrive en chaîne `[0.1,0.2,…]` à travers PostgREST. */
function parseEmbedding(raw: string | number[] | null): number[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) && parsed.every((value) => typeof value === "number")
      ? parsed
      : null;
  } catch {
    return null;
  }
}
