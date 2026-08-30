"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { getViewer } from "@/lib/auth";
import { explainMetaError } from "@/lib/connectors/meta/errors";
import { getModerationContext } from "@/lib/moderation/access";
import { can } from "@/lib/moderation/permissions";
import { markSeenOnPlatform, sendReply } from "@/lib/moderation/send";
import type { Conversation } from "@/lib/moderation/types";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { DeterministicEmbeddings, toPgVector } from "@/lib/moderation/embeddings";
import { planLearning, recordCorrection, recordDirectValidation } from "@/lib/moderation/learning";

export type ModerationResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * Actions de la boucle de validation.
 *
 * Chaque action écrit dans le journal d'audit — c'est une obligation du module,
 * pas une option : envoi, refus, ignorance, mise en attente, modification de
 * FAQ, tout laisse une trace immuable.
 */

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

async function audit(entry: {
  actorId: string;
  clientId: string;
  conversationId?: string;
  faqEntryId?: string;
  action: string;
  before?: unknown;
  after?: unknown;
}) {
  await createAdminClient()
    .from("moderation_audit_log")
    .insert({
      actor_id: entry.actorId,
      client_id: entry.clientId,
      conversation_id: entry.conversationId ?? null,
      faq_entry_id: entry.faqEntryId ?? null,
      action: entry.action,
      before: (entry.before ?? null) as never,
      after: (entry.after ?? null) as never,
    });
}

type DeliveryOutcome =
  | { ok: true; sent: boolean; note: string | null }
  | { ok: false; error: string };

/**
 * Tente l'envoi réel d'une réponse, et écrit tout ce qui en découle.
 *
 * Trois issues :
 *   • parti — le message sortant est en base (origine `antidotes`, preuve
 *     Graph en identifiant externe), la conversation avance ;
 *   • pas de canal branché — rien ne part, la raison remonte en note et la
 *     validation suit son cours ;
 *   • refus de Meta — la conversation passe en échec d'envoi avec la cause en
 *     français, et l'action rend l'erreur.
 *
 * Les écritures de messages passent par le client admin : la RLS ne les ouvre
 * qu'à l'ingestion (`service_role`), et un envoi **est** une ingestion — celle
 * de notre propre réponse, après la garde `requireOperator`.
 */
async function deliverReply(options: {
  admin: ReturnType<typeof createAdminClient>;
  supabase: Awaited<ReturnType<typeof createClient>>;
  conversation: Conversation;
  body: string;
  actorId: string;
  clientId: string;
}): Promise<DeliveryOutcome> {
  const { admin, supabase, conversation, body, actorId, clientId } = options;

  try {
    const outcome = await sendReply({ admin, conversation, body });
    if (!outcome.sent) return { ok: true, sent: false, note: outcome.reason };

    const now = new Date().toISOString();
    await admin.from("messages").insert({
      conversation_id: conversation.id,
      client_id: conversation.client_id,
      direction: "outbound",
      external_message_id: outcome.externalMessageId,
      body,
      origin: "antidotes",
      sent_at: now,
    } as never);

    await supabase
      .from("conversations")
      .update({
        last_message_at: now,
        message_count: conversation.message_count + 1,
      })
      .eq("id", conversation.id);

    return { ok: true, sent: true, note: null };
  } catch (error) {
    const message = explainMetaError((error as Error).message).message;

    await supabase
      .from("conversations")
      .update({ status: "send_failed", unread: false })
      .eq("id", conversation.id);

    await audit({
      actorId,
      clientId,
      conversationId: conversation.id,
      action: "draft.send_failed",
      after: { error: message },
    });

    revalidatePath("/moderation");
    return { ok: false, error: message };
  }
}

const conversationAction = z.object({
  clientId: z.uuid(),
  conversationId: z.uuid(),
  clientSlug: z.string(),
});

/** Validation : envoi immédiat, statut « envoyé », trace au journal. */
export async function validateDraft(
  _previous: ModerationResult | null,
  formData: FormData,
): Promise<ModerationResult> {
  const parsed = conversationAction.safeParse({
    clientId: formData.get("clientId"),
    conversationId: formData.get("conversationId"),
    clientSlug: formData.get("clientSlug"),
  });
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  try {
    const { viewer } = await requireOperator(parsed.data.clientId);
    const supabase = await createClient();

    const { data: draft } = await supabase
      .from("drafts")
      .select("id, body, sources, status")
      .eq("conversation_id", parsed.data.conversationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!draft) return { ok: false, error: "Aucun brouillon à valider." };

    const { data: conversationRow } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", parsed.data.conversationId)
      .maybeSingle();
    if (!conversationRow) return { ok: false, error: "Conversation introuvable." };
    const conversation = conversationRow as unknown as Conversation;

    // L'envoi réel — sous le commentaire, avec le jeton du compte branché.
    // Un canal non branché ne bloque pas la validation : le brouillon est
    // validé et la raison est dite, plutôt que de faire croire à un envoi.
    const admin = createAdminClient();
    const outcome = await deliverReply({
      admin,
      supabase,
      conversation,
      body: draft.body as string,
      actorId: viewer.user.id,
      clientId: parsed.data.clientId,
    });
    if (!outcome.ok) return outcome;
    const { sent, note } = outcome;

    await supabase
      .from("drafts")
      .update({
        status: sent ? "sent" : "validated",
        sent_at: sent ? new Date().toISOString() : null,
        reviewed_by: viewer.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", draft.id);

    await supabase
      .from("conversations")
      .update({ status: sent ? "sent" : "validated", unread: false })
      .eq("id", parsed.data.conversationId);

    // Les entrées FAQ citées gagnent une validation directe.
    for (const source of (draft.sources ?? []) as { faq_entry_id: string }[]) {
      const { data: entry } = await admin
        .from("faq_entries")
        .select("usage_count, direct_validation_count, correction_count, confidence")
        .eq("id", source.faq_entry_id)
        .maybeSingle();
      if (!entry) continue;
      await admin
        .from("faq_entries")
        .update(recordDirectValidation(entry))
        .eq("id", source.faq_entry_id);
    }

    await audit({
      actorId: viewer.user.id,
      clientId: parsed.data.clientId,
      conversationId: parsed.data.conversationId,
      action: "draft.validate",
      after: { draft_id: draft.id, sent },
    });

    revalidatePath("/moderation");
    return {
      ok: true,
      message: sent
        ? "Réponse publiée sous le commentaire."
        : `Brouillon validé, rien n'est parti : ${note}`,
    };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

const statusChange = conversationAction.extend({
  status: z.enum(["ignored", "snoozed", "to_process"]),
});

/** Ignorer, mettre en attente, ou remettre à traiter. */
export async function setConversationStatus(
  _previous: ModerationResult | null,
  formData: FormData,
): Promise<ModerationResult> {
  const parsed = statusChange.safeParse({
    clientId: formData.get("clientId"),
    conversationId: formData.get("conversationId"),
    clientSlug: formData.get("clientSlug"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  try {
    const { viewer } = await requireOperator(parsed.data.clientId);
    const supabase = await createClient();

    const { data: before } = await supabase
      .from("conversations")
      .select("status")
      .eq("id", parsed.data.conversationId)
      .maybeSingle();

    await supabase
      .from("conversations")
      .update({ status: parsed.data.status, unread: false })
      .eq("id", parsed.data.conversationId);

    await audit({
      actorId: viewer.user.id,
      clientId: parsed.data.clientId,
      conversationId: parsed.data.conversationId,
      action: `conversation.${parsed.data.status}`,
      before,
      after: { status: parsed.data.status },
    });

    revalidatePath("/moderation");
    const labels = {
      ignored: "Conversation ignorée. Elle reste consultable et réouvrable.",
      snoozed: "Mise en attente.",
      to_process: "Remise à traiter.",
    };
    return { ok: true, message: labels[parsed.data.status] };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

const correction = z.object({
  clientId: z.uuid(),
  clientSlug: z.string(),
  conversationId: z.uuid(),
  correctedBody: z.string().min(1, "La réponse corrigée ne peut pas être vide."),
  questionCanonical: z.string().min(1, "La question canonique est requise."),
  locale: z.enum(["fr", "en"]),
  categoryId: z.string().optional(),
  updateFaq: z.string().optional(),
  enrichEntryId: z.string().optional(),
  originalQuestion: z.string(),
});

/**
 * Refus + correction.
 *
 * C'est le geste central du produit : la réponse corrigée part au client **et**
 * la FAQ s'enrichit, dans la même action. Si l'enrichissement était une étape
 * séparée, il n'aurait jamais lieu.
 */
export async function submitCorrection(
  _previous: ModerationResult | null,
  formData: FormData,
): Promise<ModerationResult> {
  const parsed = correction.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const input = parsed.data;

  try {
    const { viewer } = await requireOperator(input.clientId);
    const supabase = await createClient();
    const admin = createAdminClient();

    const { data: draft } = await supabase
      .from("drafts")
      .select("id, sources")
      .eq("conversation_id", input.conversationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (draft) {
      await supabase
        .from("drafts")
        .update({
          status: "refused",
          reviewed_by: viewer.user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", draft.id);

      // Les entrées ayant produit la réponse refusée perdent de la confiance.
      for (const source of (draft.sources ?? []) as { faq_entry_id: string }[]) {
        const { data: entry } = await admin
          .from("faq_entries")
          .select("usage_count, direct_validation_count, correction_count, confidence")
          .eq("id", source.faq_entry_id)
          .maybeSingle();
        if (!entry) continue;
        await admin
          .from("faq_entries")
          .update(recordCorrection(entry))
          .eq("id", source.faq_entry_id);
      }
    }

    const enrichEntryId = input.enrichEntryId || null;
    const { data: existing } = enrichEntryId
      ? await supabase
          .from("faq_entries")
          .select("id, question_canonical, variants, answer_fr, answer_en")
          .eq("id", enrichEntryId)
          .maybeSingle()
      : { data: null };

    const plan = planLearning({
      correction: {
        questionCanonical: input.questionCanonical,
        answer: input.correctedBody,
        locale: input.locale,
        categoryId: input.categoryId || null,
        channels: [],
        updateFaq: input.updateFaq === "on",
        enrichEntryId,
      },
      originalQuestion: input.originalQuestion,
      existingEntry: existing as never,
    });

    /* Pas de modèle de langue dans le clic d'un opérateur : le modèle local
       pèse 25 Mo à charger, et son binaire ONNX ne charge pas sur Vercel —
       l'échec emportait la correction entière, réponse comprise. L'entrée
       s'écrit sans vecteur (`embedding_source` null) et `reindexFaqSearch`
       l'indexe au relevé suivant, sur une machine complète. Le fournisseur
       déterministe (démo, tests), lui, est instantané et reste inline. */
    const provider =
      process.env.MODERATION_EMBEDDINGS === "deterministic"
        ? new DeterministicEmbeddings()
        : null;

    let faqEntryId: string | undefined;

    if (plan.action === "create") {
      const embedding = provider ? await provider.embed(plan.embeddingText) : null;
      const { data: created } = await admin
        .from("faq_entries")
        .insert({
          client_id: input.clientId,
          question_canonical: plan.entry.question_canonical,
          variants: plan.entry.variants,
          answer_fr: plan.entry.answer_fr,
          answer_en: plan.entry.answer_en,
          category_id: plan.entry.category_id,
          created_by: viewer.user.id,
          embedding_source: provider && embedding ? provider.id : null,
          embedding: embedding ? (toPgVector(embedding) as never) : null,
        } as never)
        .select("id")
        .single();
      faqEntryId = (created as { id: string } | null)?.id;
    } else if (plan.action === "enrich") {
      const patch: Record<string, unknown> = { ...plan.patch };
      if (plan.reembed && plan.embeddingText) {
        if (provider) {
          patch.embedding = toPgVector(await provider.embed(plan.embeddingText));
          patch.embedding_source = provider.id;
        } else {
          /* Les variantes ont changé : l'ancien vecteur reste une bonne
             approximation, on le garde pour la recherche — mais la source
             passe à null pour que le relevé recalcule le vecteur à jour. */
          patch.embedding_source = null;
        }
      }
      patch.updated_at = new Date().toISOString();
      await admin.from("faq_entries").update(patch as never).eq("id", plan.entryId);
      faqEntryId = plan.entryId;
    }

    // Version d'historique, avec diff et possibilité de rollback.
    if (faqEntryId) {
      const { data: entry } = await admin
        .from("faq_entries")
        .select(
          "question_canonical, variants, answer_fr, answer_en, category_id, channels, priority, active",
        )
        .eq("id", faqEntryId)
        .maybeSingle();

      const { data: versions } = await admin
        .from("faq_entry_versions")
        .select("version")
        .eq("faq_entry_id", faqEntryId)
        .order("version", { ascending: false })
        .limit(1);

      const nextVersion = ((versions ?? [])[0]?.version ?? 0) + 1;
      await admin.from("faq_entry_versions").insert({
        faq_entry_id: faqEntryId,
        client_id: input.clientId,
        version: nextVersion,
        snapshot: entry as never,
        author_id: viewer.user.id,
        reason:
          plan.action === "create"
            ? "Créée depuis une correction"
            : "Enrichie depuis une correction",
      } as never);
    }

    // La réponse corrigée part au client — même chemin que la validation.
    // Si Meta refuse, la FAQ garde ce qu'elle vient d'apprendre : la
    // correction reste juste, seul l'envoi a échoué, et il est visible.
    const { data: conversationRow } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", input.conversationId)
      .maybeSingle();
    if (!conversationRow) return { ok: false, error: "Conversation introuvable." };

    const delivery = await deliverReply({
      admin,
      supabase,
      conversation: conversationRow as unknown as Conversation,
      body: input.correctedBody,
      actorId: viewer.user.id,
      clientId: input.clientId,
    });
    if (!delivery.ok) return delivery;

    await supabase
      .from("conversations")
      .update({ status: delivery.sent ? "sent" : "validated", unread: false })
      .eq("id", input.conversationId);

    await audit({
      actorId: viewer.user.id,
      clientId: input.clientId,
      conversationId: input.conversationId,
      faqEntryId,
      action: "draft.refuse_and_correct",
      after: {
        faq_action: plan.action,
        faq_entry_id: faqEntryId,
        sent: delivery.sent,
      },
    });

    revalidatePath("/moderation");

    const suffix =
      plan.action === "create"
        ? " Nouvelle entrée FAQ créée."
        : plan.action === "enrich"
          ? " Entrée FAQ enrichie."
          : " FAQ inchangée.";
    const lead = delivery.sent
      ? "Réponse corrigée publiée."
      : `Correction enregistrée, rien n'est parti : ${delivery.note}`;
    return { ok: true, message: `${lead}${suffix}` };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

// --- Gestes de l'inbox : lu, archivage, suppression, en lot -------------------

/**
 * Les gestes qui ne changent pas la réponse, seulement le rangement.
 *
 * Le vocabulaire est celui de la Boîte de réception Meta, traduit vers ce que
 * le modèle porte déjà — aucune colonne nouvelle :
 *
 *   `lu` / `non-lu`   `conversations.unread`
 *   `archiver`        statut `ignored` — « rangé », pas « refusé »
 *   `restaurer`       retour à `to_process`
 *   `supprimer`       `deleted_at` : la conversation sort de l'inbox et le
 *                     passage de synchronisation ne la ressuscite pas
 *
 * Rien n'est effacé chez Meta : le commentaire reste en ligne. C'est notre
 * boîte qu'on range, pas la page du client.
 */
export type InboxGesture = "lu" | "non-lu" | "archiver" | "restaurer" | "supprimer";

const GESTURE_LABELS: Record<InboxGesture, { one: string; many: string }> = {
  lu: { one: "Marquée comme lue.", many: "Marquées comme lues." },
  "non-lu": { one: "Marquée comme non lue.", many: "Marquées comme non lues." },
  archiver: { one: "Archivée.", many: "Archivées." },
  restaurer: { one: "Remise à traiter.", many: "Remises à traiter." },
  supprimer: {
    one: "Supprimée de l'inbox. Le commentaire reste en ligne sur Meta.",
    many: "Supprimées de l'inbox. Les commentaires restent en ligne sur Meta.",
  },
};

function patchOfGesture(gesture: InboxGesture): Record<string, unknown> {
  switch (gesture) {
    case "lu":
      return { unread: false };
    case "non-lu":
      return { unread: true };
    case "archiver":
      return { status: "ignored", unread: false };
    case "restaurer":
      return { status: "to_process" };
    case "supprimer":
      return { deleted_at: new Date().toISOString() };
  }
}

const gestureInput = z.object({
  conversationIds: z.array(z.uuid()).min(1).max(200),
  gesture: z.enum(["lu", "non-lu", "archiver", "restaurer", "supprimer"]),
});

/**
 * Un geste appliqué à une ou plusieurs conversations.
 *
 * Une seule action pour l'unité et le lot : la barre de sélection et le bouton
 * d'une ligne font exactement la même chose, et rien ne peut diverger entre
 * les deux. La garde d'opérateur est faite **par client** — une sélection qui
 * traverse deux clients vérifie les deux.
 */
export async function applyInboxGesture(input: {
  conversationIds: string[];
  gesture: InboxGesture;
}): Promise<ModerationResult> {
  const parsed = gestureInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  try {
    const supabase = await createClient();
    const { data: rows } = await supabase
      .from("conversations")
      .select(
        "id, client_id, status, unread, channel, kind, connection_id, participant_external_id",
      )
      .in("id", parsed.data.conversationIds);

    const targets = (rows ?? []) as unknown as {
      id: string;
      client_id: string;
      status: string;
      unread: boolean;
      channel: Conversation["channel"];
      kind: Conversation["kind"];
      connection_id: string | null;
      participant_external_id: string | null;
    }[];
    if (targets.length === 0) return { ok: false, error: "Conversation introuvable." };

    // Un seul contrôle par client, quel que soit le nombre de lignes.
    const viewers = new Map<string, Awaited<ReturnType<typeof requireOperator>>>();
    for (const clientId of new Set(targets.map((row) => row.client_id))) {
      viewers.set(clientId, await requireOperator(clientId));
    }

    const patch = patchOfGesture(parsed.data.gesture);
    const { error } = await supabase
      .from("conversations")
      .update(patch as never)
      .in(
        "id",
        targets.map((row) => row.id),
      );
    if (error) return { ok: false, error: error.message };

    for (const row of targets) {
      await audit({
        actorId: viewers.get(row.client_id)!.viewer.user.id,
        clientId: row.client_id,
        conversationId: row.id,
        action: `conversation.${parsed.data.gesture}`,
        before: { status: row.status, unread: row.unread },
        after: patch,
      });
    }

    // Le miroir vers Meta : un message privé lu ici s'affiche « vu » dans la
    // Boîte de réception Meta. Après la réponse — meilleur effort, jamais
    // bloquant — et seulement pour ce qui vient de passer au lu.
    if (parsed.data.gesture === "lu" || parsed.data.gesture === "archiver") {
      const admin = createAdminClient();
      after(async () => {
        for (const row of targets) {
          if (!row.unread) continue;
          await markSeenOnPlatform({ admin, conversation: row });
        }
      });
    }

    revalidatePath("/moderation");
    const labels = GESTURE_LABELS[parsed.data.gesture];
    return {
      ok: true,
      message:
        targets.length > 1
          ? `${targets.length} conversations — ${labels.many.toLowerCase()}`
          : labels.one,
    };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

const manualReply = z.object({
  conversationId: z.uuid(),
  body: z.string().trim().min(1, "La réponse ne peut pas être vide."),
});

/**
 * La réponse écrite à la main, hors brouillon.
 *
 * Tout ne se répond pas avec la FAQ : une réponse au ton juste, une relance,
 * un remerciement. Elle part par le même chemin que la validation d'un
 * brouillon — publication réelle sous le commentaire, preuve en base, échec
 * dit en français — et laisse la conversation en `sent`.
 */
export async function sendManualReply(input: {
  conversationId: string;
  body: string;
}): Promise<ModerationResult> {
  const parsed = manualReply.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Requête incomplète." };
  }

  try {
    const supabase = await createClient();
    const { data: conversationRow } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", parsed.data.conversationId)
      .maybeSingle();
    if (!conversationRow) return { ok: false, error: "Conversation introuvable." };

    const conversation = conversationRow as unknown as Conversation;
    const { viewer } = await requireOperator(conversation.client_id);

    const delivery = await deliverReply({
      admin: createAdminClient(),
      supabase,
      conversation,
      body: parsed.data.body,
      actorId: viewer.user.id,
      clientId: conversation.client_id,
    });
    if (!delivery.ok) return delivery;

    await supabase
      .from("conversations")
      .update({
        status: delivery.sent ? "sent" : "validated",
        unread: false,
      })
      .eq("id", conversation.id);

    await audit({
      actorId: viewer.user.id,
      clientId: conversation.client_id,
      conversationId: conversation.id,
      action: "conversation.manual_reply",
      after: { sent: delivery.sent, length: parsed.data.body.length },
    });

    revalidatePath("/moderation");
    return {
      ok: true,
      message: delivery.sent
        ? "Réponse publiée sous le commentaire."
        : `Réponse enregistrée, rien n'est parti : ${delivery.note}`,
    };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
