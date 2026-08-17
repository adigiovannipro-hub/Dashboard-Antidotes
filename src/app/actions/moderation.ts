"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getViewer } from "@/lib/auth";
import { explainMetaError } from "@/lib/connectors/meta/errors";
import { getModerationContext } from "@/lib/moderation/access";
import { can } from "@/lib/moderation/permissions";
import { sendReply } from "@/lib/moderation/send";
import type { Conversation } from "@/lib/moderation/types";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  DeterministicEmbeddings,
  getEmbeddingProvider,
  toPgVector,
} from "@/lib/moderation/embeddings";
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

    // Le fournisseur déterministe permet l'écriture immédiate ; le modèle local
    // ne serait qu'un poids inutile ici, où une seule entrée est vectorisée.
    const provider =
      process.env.MODERATION_EMBEDDINGS === "deterministic"
        ? new DeterministicEmbeddings()
        : getEmbeddingProvider();

    let faqEntryId: string | undefined;

    if (plan.action === "create") {
      const embedding = await provider.embed(plan.embeddingText);
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
          embedding_source: provider.id,
          embedding: toPgVector(embedding) as never,
        } as never)
        .select("id")
        .single();
      faqEntryId = (created as { id: string } | null)?.id;
    } else if (plan.action === "enrich") {
      const patch: Record<string, unknown> = { ...plan.patch };
      if (plan.reembed && plan.embeddingText) {
        patch.embedding = toPgVector(await provider.embed(plan.embeddingText));
        patch.embedding_source = provider.id;
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
