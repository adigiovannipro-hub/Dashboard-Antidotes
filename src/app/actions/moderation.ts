"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { getViewer } from "@/lib/auth";
import { explainMetaError } from "@/lib/connectors/meta/errors";
import { getModerationContext } from "@/lib/moderation/access";
import { parseInboxSelection, type InboxQuery } from "@/lib/moderation/filters";
import {
  listUnreadConversations,
  type InboxFilters,
} from "@/lib/moderation/queries";
import { can } from "@/lib/moderation/permissions";
import { markSeenOnPlatform, sendReply } from "@/lib/moderation/send";
import { sendFaqCommentEmails } from "@/lib/moderation/faq-notify";
import { type Conversation } from "@/lib/moderation/types";
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

/**
 * Ce qu'il faut réinvalider après un geste qui change l'état d'une
 * conversation — statut ou lecture.
 *
 * La seconde ligne n'est pas une précaution. La pastille du rail est calculée
 * par `getNavBadges()` dans `AppShell`, monté par le **layout** de la
 * l'Inbox : elle vit donc au-dessus du segment que
 * `revalidatePath("/inbox")` rafraîchit. Sans elle, le compteur gardait sa
 * valeur jusqu'au rechargement complet de la page, et le geste paraissait sans
 * effet — c'est la moitié du « le compteur ne bouge pas ».
 */
function revalidateModeration(): void {
  revalidatePath("/inbox");
  revalidatePath("/", "layout");
}

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

    revalidateModeration();
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

    revalidateModeration();
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

    revalidateModeration();
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

    revalidateModeration();

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
export type InboxGesture =
  | "lu"
  | "non-lu"
  | "traitee"
  | "archiver"
  | "restaurer"
  | "signaler"
  | "ne-plus-signaler"
  | "supprimer";

const GESTURE_LABELS: Record<InboxGesture, { one: string; many: string }> = {
  lu: { one: "Marquée comme lue.", many: "Marquées comme lues." },
  "non-lu": { one: "Marquée comme non lue.", many: "Marquées comme non lues." },
  traitee: { one: "Marquée comme traitée.", many: "Marquées comme traitées." },
  signaler: { one: "Signalée.", many: "Signalées." },
  "ne-plus-signaler": { one: "Signalement retiré.", many: "Signalements retirés." },
  archiver: { one: "Archivée.", many: "Archivées." },
  restaurer: { one: "Remise à traiter.", many: "Remises à traiter." },
  supprimer: {
    one: "Supprimée de l'inbox. Le commentaire reste en ligne sur Meta.",
    many: "Supprimées de l'inbox. Les commentaires restent en ligne sur Meta.",
  },
};

function patchOfGesture(gesture: InboxGesture): Record<string, unknown> {
  switch (gesture) {
    // Les deux gestes de drapeau se calculent ligne à ligne : voir
    // `flagPatchOf`.
    case "signaler":
    case "ne-plus-signaler":
      return {};
    case "lu":
      return { unread: false };
    case "non-lu":
      return { unread: true };
    /* « Traitée » n'est pas « archivée » : le fil a été réglé, ici ou
       ailleurs, et il rejoint les traitées sans passer par la corbeille de
       rangement. `answered_elsewhere` porte exactement ce sens depuis
       l'ingestion, qui l'écrit quand la marque a répondu depuis l'app. */
    case "traitee":
      return { status: "answered_elsewhere", unread: false };
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
  gesture: z.enum([
    "lu",
    "non-lu",
    "traitee",
    "archiver",
    "restaurer",
    "signaler",
    "ne-plus-signaler",
    "supprimer",
  ]),
});

/**
 * Les deux gestes qui touchent aux drapeaux ne se rangent pas dans
 * `patchOfGesture` : la nouvelle valeur dépend de celle de chaque ligne, et un
 * `update` unique ne peut pas porter deux tableaux différents. On regroupe donc
 * les lignes par drapeaux identiques — en pratique un seul lot, la plupart des
 * conversations n'en portant aucun.
 */
function flagPatchOf(gesture: InboxGesture, flags: string[]): string[] | null {
  if (gesture === "signaler") {
    return flags.includes("manual") ? null : [...flags, "manual"];
  }
  if (gesture === "ne-plus-signaler") {
    return flags.includes("manual")
      ? flags.filter((flag) => flag !== "manual")
      : null;
  }
  return null;
}

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
        "id, client_id, status, unread, flags, channel, kind, connection_id, participant_external_id",
      )
      .in("id", parsed.data.conversationIds);

    const targets = (rows ?? []) as unknown as {
      id: string;
      client_id: string;
      status: string;
      unread: boolean;
      flags: string[];
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

    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from("conversations")
        .update(patch as never)
        .in(
          "id",
          targets.map((row) => row.id),
        );
      if (error) return { ok: false, error: error.message };
    } else {
      /* Les drapeaux : la valeur dépend de la ligne, donc un `update` unique
         ne suffit pas. On regroupe par tableau identique — en pratique un
         seul lot, la plupart des conversations n'en portant aucun — plutôt
         qu'une requête par ligne. */
      const lots = new Map<string, { next: string[]; ids: string[] }>();
      for (const row of targets) {
        const next = flagPatchOf(parsed.data.gesture, row.flags ?? []);
        if (!next) continue;
        const key = next.join("|");
        const lot = lots.get(key) ?? { next, ids: [] };
        lot.ids.push(row.id);
        lots.set(key, lot);
      }
      for (const lot of lots.values()) {
        const { error } = await supabase
          .from("conversations")
          .update({ flags: lot.next } as never)
          .in("id", lot.ids);
        if (error) return { ok: false, error: error.message };
      }
      if (lots.size === 0) {
        return {
          ok: true,
          message:
            parsed.data.gesture === "signaler"
              ? "Déjà signalée."
              : "Aucun signalement à retirer.",
        };
      }
    }

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

    revalidateModeration();
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

/**
 * Le miroir « vu » vers la plateforme, plafonné.
 *
 * Meta veut un appel Graph par conversation : le faire pour quatre cents fils
 * d'un coup, en série, prend des minutes et n'apporte rien d'urgent — l'état de
 * lecture d'ici est déjà juste. On en poste donc cinquante par passage, comme
 * le rattrapage d'avatars, et les suivants attendent le prochain geste. Rien
 * n'est perdu : seule la Boîte de réception Meta reste en retard d'un cran.
 */
const MARK_SEEN_CAP = 50;

/** Postgres accepte de longues listes, mais pas infinies : on écrit par lots. */
const READ_BATCH = 500;

const markAllReadInput = z.object({
  clientSlug: z.string().optional(),
  /* Les paramètres de l'URL, tels quels : `parseInboxSelection` en fait la
     même sélection que la page. Deux lectures séparées avaient fini par
     diverger, et le bouton marquait alors des fils qu'on n'avait jamais vus. */
  query: z
    .object({
      reseau: z.string().optional(),
      statut: z.string().optional(),
      nonlus: z.string().optional(),
      signalees: z.string().optional(),
      mp: z.string().optional(),
      q: z.string().optional(),
    })
    .default({}),
});

/**
 * « Tout lire » : toutes les conversations non lues du filtre courant.
 *
 * Pas une variante de `applyInboxGesture` — celui-ci reçoit une liste
 * d'identifiants plafonnée à deux cents, et la case « Tout sélectionner » ne
 * coche de toute façon que les quatre cents lignes affichées. Ici le serveur
 * relit lui-même le filtre et travaille sur **tout** ce qu'il désigne : c'est
 * la seule façon de vider une boîte de plusieurs milliers de messages.
 *
 * Le journal d'audit reçoit une ligne par client et non par conversation : mille
 * lignes d'audit pour un seul clic diraient moins que « a marqué 1 243
 * conversations comme lues ».
 */
export async function markFilterAsRead(input: {
  clientSlug?: string;
  query: InboxQuery;
}): Promise<ModerationResult> {
  const parsed = markAllReadInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  try {
    const { clients } = await getModerationContext();
    if (clients.length === 0) return { ok: false, error: "Action indisponible." };

    const client = parsed.data.clientSlug
      ? clients.find((candidate) => candidate.slug === parsed.data.clientSlug)
      : undefined;
    if (parsed.data.clientSlug && !client) {
      return { ok: false, error: "Action indisponible." };
    }

    const filters: InboxFilters = {
      ...parseInboxSelection(parsed.data.query, client?.id),
      unreadOnly: true,
      search: parsed.data.query.q,
    };

    const targets = await listUnreadConversations({ filters });
    if (targets.length === 0) {
      return { ok: true, message: "Rien à lire — tout est déjà ouvert." };
    }

    // Une garde par client, comme le geste unitaire : une sélection qui
    // traverse deux clients vérifie les deux.
    const viewers = new Map<string, Awaited<ReturnType<typeof requireOperator>>>();
    for (const clientId of new Set(targets.map((row) => row.client_id))) {
      viewers.set(clientId, await requireOperator(clientId));
    }

    const supabase = await createClient();
    for (let start = 0; start < targets.length; start += READ_BATCH) {
      const batch = targets.slice(start, start + READ_BATCH);
      const { error } = await supabase
        .from("conversations")
        .update({ unread: false } as never)
        .in(
          "id",
          batch.map((row) => row.id),
        );
      if (error) return { ok: false, error: error.message };
    }

    for (const [clientId, viewer] of viewers) {
      await audit({
        actorId: viewer.viewer.user.id,
        clientId,
        action: "conversation.tout-lu",
        after: {
          count: targets.filter((row) => row.client_id === clientId).length,
          filtre: { reseaux: filters.networks, statut: filters.statusGroup },
        },
      });
    }

    const admin = createAdminClient();
    after(async () => {
      for (const row of targets.slice(0, MARK_SEEN_CAP)) {
        await markSeenOnPlatform({ admin, conversation: row });
      }
    });

    revalidateModeration();
    return {
      ok: true,
      message:
        targets.length > 1
          ? `${targets.length} conversations marquées comme lues.`
          : "Marquée comme lue.",
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

    revalidateModeration();
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

// --- FAQ : édition et validation client --------------------------------------

/* Les cellules du tableau de la FAQ écrivent un champ à la fois, comme celles
   du planning : le formulaire complet du panneau latéral a disparu avec lui.
   La clé est le nom du champ côté écran, la valeur sa colonne. */
const FAQ_TEXT_COLUMNS = {
  title: "title",
  question: "question_canonical",
  answerFr: "answer_fr",
  answerTiktok: "answer_tiktok",
} as const;

const faqFieldInput = z.object({
  clientId: z.uuid(),
  entryId: z.uuid(),
  field: z.enum(["title", "question", "answerFr", "answerTiktok"]),
  value: z.string().trim().max(6000),
});

/**
 * Écrit une cellule de texte d'un élément de langage.
 *
 * Une question modifiée perd son vecteur : le relevé horaire la réindexe, et
 * d'ici là elle est simplement invisible de la recherche sémantique — jamais
 * un blocage de l'écriture, le modèle d'embeddings ne chargeant pas sur
 * Vercel.
 */
export async function updateFaqEntryField(input: {
  clientId: string;
  entryId: string;
  field: "title" | "question" | "answerFr" | "answerTiktok";
  value: string;
}): Promise<ModerationResult> {
  const parsed = faqFieldInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }

  try {
    await requireOperator(parsed.data.clientId);
    const supabase = await createClient();

    const column = FAQ_TEXT_COLUMNS[parsed.data.field];
    const row: Record<string, unknown> = {
      // `question_canonical` est non nulle ; les trois autres colonnes
      // préfèrent `null` au vide, que l'écran rend « — ».
      [column]:
        parsed.data.field === "question"
          ? parsed.data.value
          : parsed.data.value || null,
      updated_at: new Date().toISOString(),
    };
    if (parsed.data.field === "question") row.embedding_source = null;

    const { error } = await supabase
      .from("faq_entries")
      .update(row as never)
      .eq("id", parsed.data.entryId)
      .eq("client_id", parsed.data.clientId);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/inbox");
    revalidatePath("/espace", "layout");
    return { ok: true, message: "" };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/** Range un élément de langage sous un thème, ou l'en sort. */
export async function setFaqEntryCategory(input: {
  clientId: string;
  entryId: string;
  categoryId: string | null;
}): Promise<ModerationResult> {
  const parsed = z
    .object({
      clientId: z.uuid(),
      entryId: z.uuid(),
      categoryId: z.uuid().nullable(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  try {
    await requireOperator(parsed.data.clientId);
    const supabase = await createClient();
    const { error } = await supabase
      .from("faq_entries")
      .update({
        category_id: parsed.data.categoryId,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", parsed.data.entryId)
      .eq("client_id", parsed.data.clientId);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/espace", "layout");
    return { ok: true, message: "" };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/**
 * Le « + Ajouter un élément » du bas du tableau.
 *
 * La ligne naît vide, comme sur Monday : on la remplit dans ses cellules.
 * `question_canonical` est non nulle, d'où la chaîne vide plutôt qu'un titre
 * inventé qu'il faudrait ensuite effacer.
 */
export async function createFaqEntry(input: {
  clientId: string;
}): Promise<ModerationResult> {
  const parsed = z.object({ clientId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  try {
    const { viewer } = await requireOperator(parsed.data.clientId);
    const supabase = await createClient();
    const { error } = await supabase.from("faq_entries").insert({
      client_id: parsed.data.clientId,
      question_canonical: "",
      variants: [],
      created_by: viewer.user.id,
    } as never);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/espace", "layout");
    return { ok: true, message: "" };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/**
 * Ajoute à la FAQ le sujet d'une conversation qu'aucune entrée ne couvrait.
 *
 * C'est la sortie de l'écran « Aucune source FAQ pour ce sujet » : plutôt que
 * de laisser l'opérateur écrire la même réponse pour la troisième fois, on
 * pose la question telle qu'elle a été reçue et la réponse telle qu'il vient
 * de l'écrire. Le prochain message du même genre trouvera son entrée.
 *
 * L'entrée naît **sans vecteur** (`embedding_source` nul) : le modèle
 * d'embeddings ne charge pas sur Vercel, et `reindexFaqSearch` la rattrape au
 * relevé horaire. Une entrée sans vecteur est invisible de la recherche
 * sémantique jusque-là, jamais un blocage.
 */
export async function addFaqEntryFromConversation(input: {
  clientId: string;
  question: string;
  answer: string;
}): Promise<ModerationResult> {
  const parsed = z
    .object({
      clientId: z.uuid(),
      question: z.string().trim().min(3, "La question est trop courte.").max(2000),
      answer: z.string().trim().min(3, "La réponse est trop courte.").max(4000),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Requête incomplète." };
  }

  try {
    const { viewer } = await requireOperator(parsed.data.clientId);
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("faq_entries")
      .insert({
        client_id: parsed.data.clientId,
        /* Le titre est la question tronquée : la colonne « Sujet » du tableau
           de FAQ est la première qu'on lit, et une ligne sans nom s'y perd.
           Il se réécrit en place, comme toutes les cellules. */
        title: parsed.data.question.slice(0, 80),
        question_canonical: parsed.data.question,
        answer_fr: parsed.data.answer,
        variants: [],
        created_by: viewer.user.id,
      } as never)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };

    await audit({
      actorId: viewer.user.id,
      clientId: parsed.data.clientId,
      faqEntryId: (row as { id?: string } | null)?.id,
      action: "faq.cree-depuis-inbox",
      after: { question: parsed.data.question },
    });

    revalidatePath("/espace", "layout");
    revalidateModeration();
    return { ok: true, message: "Entrée ajoutée à la FAQ du client." };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

// --- Les thèmes ------------------------------------------------------------

const HEX = /^#[0-9a-f]{6}$/i;

export async function createFaqCategory(input: {
  clientId: string;
  name: string;
  color: string;
}): Promise<ModerationResult> {
  const parsed = z
    .object({
      clientId: z.uuid(),
      name: z.string().trim().min(1, "Le thème a besoin d'un nom.").max(80),
      color: z.string().regex(HEX, "Couleur invalide."),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Thème invalide." };
  }

  try {
    await requireOperator(parsed.data.clientId);
    const supabase = await createClient();
    const { error } = await supabase.from("faq_categories").insert({
      client_id: parsed.data.clientId,
      name: parsed.data.name,
      color: parsed.data.color,
    } as never);
    // `unique (client_id, name)` depuis 0004 : le doublon se dit en français
    // plutôt qu'en message Postgres.
    if (error) {
      return {
        ok: false,
        error: error.code === "23505" ? "Ce thème existe déjà." : error.message,
      };
    }

    revalidatePath("/espace", "layout");
    return { ok: true, message: "" };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export async function renameFaqCategory(input: {
  clientId: string;
  categoryId: string;
  name: string;
}): Promise<ModerationResult> {
  const parsed = z
    .object({
      clientId: z.uuid(),
      categoryId: z.uuid(),
      name: z.string().trim().min(1, "Le thème a besoin d'un nom.").max(80),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Thème invalide." };
  }

  try {
    await requireOperator(parsed.data.clientId);
    const supabase = await createClient();
    const { error } = await supabase
      .from("faq_categories")
      .update({ name: parsed.data.name } as never)
      .eq("id", parsed.data.categoryId)
      .eq("client_id", parsed.data.clientId);
    if (error) {
      return {
        ok: false,
        error: error.code === "23505" ? "Ce thème existe déjà." : error.message,
      };
    }

    revalidatePath("/espace", "layout");
    return { ok: true, message: "" };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export async function setFaqCategoryColor(input: {
  clientId: string;
  categoryId: string;
  color: string;
}): Promise<ModerationResult> {
  const parsed = z
    .object({
      clientId: z.uuid(),
      categoryId: z.uuid(),
      color: z.string().regex(HEX, "Couleur invalide."),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Couleur invalide." };
  }

  try {
    await requireOperator(parsed.data.clientId);
    const supabase = await createClient();
    const { error } = await supabase
      .from("faq_categories")
      .update({ color: parsed.data.color } as never)
      .eq("id", parsed.data.categoryId)
      .eq("client_id", parsed.data.clientId);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/espace", "layout");
    return { ok: true, message: "" };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/** Les éléments rangés sous ce thème le perdent — `on delete set null`. */
export async function deleteFaqCategory(input: {
  clientId: string;
  categoryId: string;
}): Promise<ModerationResult> {
  const parsed = z
    .object({ clientId: z.uuid(), categoryId: z.uuid() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  try {
    await requireOperator(parsed.data.clientId);
    const supabase = await createClient();
    const { error } = await supabase
      .from("faq_categories")
      .delete()
      .eq("id", parsed.data.categoryId)
      .eq("client_id", parsed.data.clientId);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/espace", "layout");
    return { ok: true, message: "Thème supprimé." };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

// --- Le fil d'un élément de langage ----------------------------------------

/**
 * Poste un message dans le fil d'un élément de langage.
 *
 * L'agence y informe le client d'une formule et lui en demande
 * l'autorisation ; le client répond au même endroit. L'action est donc ouverte
 * aux deux, et suit pour cela le modèle de `setFaqClientReview` : client admin
 * **après** une vérification applicative d'appartenance à l'espace rattaché.
 * La RLS filtre des lignes et non des colonnes — ouvrir l'écriture de la table
 * au rôle client lui ouvrirait la réponse elle-même.
 */
export async function addFaqComment(input: {
  entryId: string;
  body: string;
  mentions: string[];
}): Promise<ModerationResult> {
  const parsed = z
    .object({
      entryId: z.uuid(),
      body: z.string().trim().min(1, "Le message est vide.").max(4000),
      mentions: z.array(z.email()).max(10),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Message invalide." };
  }

  try {
    const viewer = await getViewer();
    if (!viewer) return { ok: false, error: "Session expirée." };

    const admin = createAdminClient();
    const { data: entryRow, error: entryError } = await admin
      .from("faq_entries")
      .select("id, client_id, title, question_canonical")
      .eq("id", parsed.data.entryId)
      .maybeSingle();
    if (entryError) return { ok: false, error: entryError.message };
    if (!entryRow) return { ok: false, error: "Entrée introuvable." };

    const entry = entryRow as unknown as {
      client_id: string;
      title: string | null;
      question_canonical: string;
    };

    const { data: clientRow } = await admin
      .from("moderation_clients")
      .select("workspace_id")
      .eq("id", entry.client_id)
      .maybeSingle();
    const workspaceId = (clientRow as { workspace_id?: string | null } | null)
      ?.workspace_id;
    const workspace = workspaceId
      ? viewer.workspaces.find((candidate) => candidate.id === workspaceId)
      : undefined;
    // Message identique à celui d'une entrée absente : rien ne doit confirmer
    // l'existence de la FAQ d'un autre client.
    if (!workspace) return { ok: false, error: "Entrée introuvable." };

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", viewer.user.id)
      .maybeSingle();
    const authorName =
      (profile as { full_name?: string | null } | null)?.full_name ?? viewer.email;

    const { error } = await admin.from("faq_comments").insert({
      client_id: entry.client_id,
      entry_id: parsed.data.entryId,
      author_id: viewer.user.id,
      author_name: authorName,
      body: parsed.data.body,
      mentions: parsed.data.mentions,
    } as never);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/espace", "layout");

    // L'e-mail part après l'écriture, jamais à sa place : une boîte en panne
    // laisse le message dans le fil, avec une phrase qui dit ce qui n'est pas
    // parti.
    if (parsed.data.mentions.length === 0) return { ok: true, message: "" };

    const outcome = await sendFaqCommentEmails({
      recipients: parsed.data.mentions,
      workspaceSlug: workspace.slug,
      workspaceName: workspace.name,
      entryId: parsed.data.entryId,
      entryTitle: entry.title || entry.question_canonical,
      authorName,
      body: parsed.data.body,
    });

    if (outcome.sent.length > 0 && outcome.failed.length === 0) {
      return { ok: true, message: `Message envoyé à ${outcome.sent.join(", ")}.` };
    }
    if (outcome.sent.length > 0) {
      return {
        ok: true,
        message: `Message envoyé à ${outcome.sent.join(", ")} — échec pour ${outcome.failed.join(", ")}.`,
      };
    }
    return {
      ok: true,
      message: `Message enregistré, e-mail non parti : ${outcome.reason ?? "envoi refusé"}`,
    };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/** Suppression douce d'un élément de langage — la boucle d'apprentissage garde l'historique. */
export async function deleteFaqEntry(input: {
  clientId: string;
  entryId: string;
}): Promise<ModerationResult> {
  const parsed = z
    .object({ clientId: z.uuid(), entryId: z.uuid() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  try {
    await requireOperator(parsed.data.clientId);
    const supabase = await createClient();
    const { error } = await supabase
      .from("faq_entries")
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", parsed.data.entryId)
      .eq("client_id", parsed.data.clientId);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/inbox");
    revalidatePath("/espace", "layout");
    return { ok: true, message: "Entrée supprimée." };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/**
 * Le verdict du client sur un élément de langage, depuis son espace.
 *
 * Client admin après une garde applicative — le quatrième cas assumé à côté
 * des trois canoniques : la RLS filtre des lignes, pas des colonnes, et
 * ouvrir l'update de la table au rôle client lui ouvrirait la réponse
 * elle-même. La garde vérifie que l'utilisateur est membre de l'espace
 * rattaché au client de modération, et l'écriture ne touche que le verdict.
 */
export async function setFaqClientReview(input: {
  entryId: string;
  verdict: "approved" | "rejected" | "pending";
}): Promise<ModerationResult> {
  const parsed = z
    .object({ entryId: z.uuid(), verdict: z.enum(["approved", "rejected", "pending"]) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  try {
    const viewer = await getViewer();
    if (!viewer) return { ok: false, error: "Session expirée." };

    const admin = createAdminClient();
    const { data: entryRow, error: entryError } = await admin
      .from("faq_entries")
      .select("id, client_id")
      .eq("id", parsed.data.entryId)
      .maybeSingle();
    if (entryError) return { ok: false, error: entryError.message };
    if (!entryRow) return { ok: false, error: "Entrée introuvable." };

    const { data: clientRow } = await admin
      .from("moderation_clients")
      .select("workspace_id")
      .eq("id", (entryRow as { client_id: string }).client_id)
      .maybeSingle();
    const workspaceId = (clientRow as { workspace_id?: string | null } | null)
      ?.workspace_id;
    const member =
      workspaceId &&
      viewer.workspaces.some((workspace) => workspace.id === workspaceId);
    if (!member) return { ok: false, error: "Entrée introuvable." };

    const { error } = await admin
      .from("faq_entries")
      .update({
        client_review: parsed.data.verdict,
        // Revenir à « À valider » efface la date : elle daterait un verdict
        // qui n'existe plus.
        client_reviewed_at:
          parsed.data.verdict === "pending" ? null : new Date().toISOString(),
      } as never)
      .eq("id", parsed.data.entryId);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/espace", "layout");
    return {
      ok: true,
      message:
        parsed.data.verdict === "approved"
          ? "Élément de langage validé."
          : parsed.data.verdict === "rejected"
            ? "Élément de langage refusé — l'agence le retravaille."
            : "Élément de langage remis à valider.",
    };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
