"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getViewer } from "@/lib/auth";
import { getModerationContext } from "@/lib/moderation/access";
import { can } from "@/lib/moderation/permissions";
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

    // Sans connexion active à la plateforme, l'envoi réel n'a pas lieu : on
    // enregistre l'intention et on le dit, plutôt que de faire croire à un envoi.
    const sent = false;

    await supabase
      .from("drafts")
      .update({
        status: sent ? "sent" : "validated",
        reviewed_by: viewer.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", draft.id);

    await supabase
      .from("conversations")
      .update({ status: sent ? "sent" : "validated", unread: false })
      .eq("id", parsed.data.conversationId);

    // Les entrées FAQ citées gagnent une validation directe.
    const admin = createAdminClient();
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

    revalidatePath(`/moderation/${parsed.data.clientSlug}`);
    return {
      ok: true,
      message: sent
        ? "Réponse envoyée."
        : "Brouillon validé. L'envoi réel attend la connexion du canal.",
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

    revalidatePath(`/moderation/${parsed.data.clientSlug}`);
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

    await supabase
      .from("conversations")
      .update({ status: "validated", unread: false })
      .eq("id", input.conversationId);

    await audit({
      actorId: viewer.user.id,
      clientId: input.clientId,
      conversationId: input.conversationId,
      faqEntryId,
      action: "draft.refuse_and_correct",
      after: { faq_action: plan.action, faq_entry_id: faqEntryId },
    });

    revalidatePath(`/moderation/${input.clientSlug}`);

    const suffix =
      plan.action === "create"
        ? " Nouvelle entrée FAQ créée."
        : plan.action === "enrich"
          ? " Entrée FAQ enrichie."
          : " FAQ inchangée.";
    return { ok: true, message: `Correction enregistrée.${suffix}` };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
