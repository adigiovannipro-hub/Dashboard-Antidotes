"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getViewer } from "@/lib/auth";
import { getReceiptsContext } from "@/lib/recus/access";
import { forwardDocument } from "@/lib/recus/pipeline";
import { senderDomain } from "@/lib/recus/heuristics";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { ReceiptDocument } from "@/lib/recus/types";

/**
 * Actions de la boucle de validation des reçus.
 *
 * Chaque action écrit au journal — un module qui envoie des mails en votre nom
 * et touche à la comptabilité doit pouvoir répondre, des mois après, à
 * « pourquoi cette pièce est-elle partie ? ».
 *
 * Chaque action revalide l'écran plutôt que de renvoyer l'état mis à jour :
 * l'inbox est rendue côté serveur, et un aller-retour complet garantit qu'on
 * regarde la base plutôt qu'une copie optimiste qui aurait divergé.
 */

export type ReceiptResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const RECEIPTS_PATH = "/entreprise/recus";

async function requireDecider(documentId: string) {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Session expirée.");

  const context = await getReceiptsContext();
  // Message volontairement neutre : ne pas confirmer l'existence de la pièce.
  if (!context?.canDecide) throw new Error("Action indisponible.");

  const supabase = await createClient();
  const { data } = await supabase
    .from("receipt_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();
  if (!data) throw new Error("Action indisponible.");

  return { viewer, context, document: data as unknown as ReceiptDocument };
}

async function audit(entry: {
  orgId: string;
  documentId: string;
  actorId: string;
  action: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  await createAdminClient()
    .from("receipt_events")
    .insert({
      org_id: entry.orgId,
      document_id: entry.documentId,
      actor_id: entry.actorId,
      action: entry.action,
      before: (entry.before ?? null) as never,
      after: (entry.after ?? null) as never,
    });
}

const documentAction = z.object({ documentId: z.uuid() });

/** Validation : la pièce part vers Airwallex, et le fournisseur gagne un point. */
export async function approveDocument(
  _previous: ReceiptResult | null,
  formData: FormData,
): Promise<ReceiptResult> {
  const parsed = documentAction.safeParse({ documentId: formData.get("documentId") });
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  try {
    const { viewer, document } = await requireDecider(parsed.data.documentId);

    const result = await forwardDocument({
      documentId: document.id,
      actorId: viewer.user.id,
      auto: false,
    });
    if (!result.ok) return { ok: false, error: result.error };

    /* Le compteur d'approbations n'est incrémenté que sur validation manuelle.
       Un transfert automatique qui s'auto-crédite finirait par justifier sa
       propre confiance — le compteur doit mesurer votre accord, pas le sien. */
    await bumpRule(document, { approvals: 1 });

    await audit({
      orgId: document.org_id,
      documentId: document.id,
      actorId: viewer.user.id,
      action: "document.approved",
      before: { status: document.status },
      after: { status: "forwarded" },
    });

    revalidatePath(RECEIPTS_PATH);
    return { ok: true, message: "Pièce transférée à Airwallex." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Action impossible.",
    };
  }
}

/** Refus : la pièce est écartée, et le fournisseur perd son automatisme. */
export async function ignoreDocument(
  _previous: ReceiptResult | null,
  formData: FormData,
): Promise<ReceiptResult> {
  const parsed = documentAction.safeParse({ documentId: formData.get("documentId") });
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  try {
    const { viewer, document } = await requireDecider(parsed.data.documentId);

    await createAdminClient()
      .from("receipt_documents")
      .update({
        status: "ignored",
        decided_by: viewer.user.id,
        decided_at: new Date().toISOString(),
        auto_decided: false,
      })
      .eq("id", document.id);

    /* Un refus retire l'automatisme du fournisseur, en plus de compter. Le cas
       n'est pas aussi routinier qu'il en avait l'air, et continuer à envoyer
       tout seul après un désaccord serait le contraire d'apprendre. */
    await bumpRule(document, { rejections: 1, disableAuto: true });

    await audit({
      orgId: document.org_id,
      documentId: document.id,
      actorId: viewer.user.id,
      action: "document.ignored",
      before: { status: document.status },
      after: { status: "ignored" },
    });

    revalidatePath(RECEIPTS_PATH);
    return { ok: true, message: "Pièce écartée." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Action impossible.",
    };
  }
}

const relinkAction = z.object({
  documentId: z.uuid(),
  expenseId: z.uuid(),
});

/** Corrige la ligne de frais pressentie avant transfert. */
export async function relinkDocument(
  _previous: ReceiptResult | null,
  formData: FormData,
): Promise<ReceiptResult> {
  const parsed = relinkAction.safeParse({
    documentId: formData.get("documentId"),
    expenseId: formData.get("expenseId"),
  });
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  try {
    const { viewer, document, context } = await requireDecider(parsed.data.documentId);

    const admin = createAdminClient();

    // La dépense doit appartenir à la même organisation : sans cette
    // vérification, un identifiant deviné rattacherait une pièce ailleurs.
    const { data: expense } = await admin
      .from("receipt_expenses")
      .select("id")
      .eq("id", parsed.data.expenseId)
      .eq("org_id", context.orgId)
      .maybeSingle();
    if (!expense) return { ok: false, error: "Ligne de frais introuvable." };

    await admin
      .from("receipt_documents")
      .update({
        expense_id: parsed.data.expenseId,
        match_method: "manual",
        // Un choix humain vaut mieux qu'un score : la confiance est portée au
        // maximum, et c'est bien ce qu'on veut dire.
        match_confidence: 1,
      })
      .eq("id", document.id);

    await audit({
      orgId: document.org_id,
      documentId: document.id,
      actorId: viewer.user.id,
      action: "document.relinked",
      before: { expense_id: document.expense_id },
      after: { expense_id: parsed.data.expenseId },
    });

    revalidatePath(RECEIPTS_PATH);
    return { ok: true, message: "Ligne de frais corrigée." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Action impossible.",
    };
  }
}

const automationAction = z.object({
  domain: z.string().min(1),
  enabled: z.enum(["true", "false"]),
});

/** Active ou coupe l'automatisme pour un fournisseur. */
export async function setMerchantAutomation(
  _previous: ReceiptResult | null,
  formData: FormData,
): Promise<ReceiptResult> {
  const parsed = automationAction.safeParse({
    domain: formData.get("domain"),
    enabled: formData.get("enabled"),
  });
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  try {
    const viewer = await getViewer();
    const context = await getReceiptsContext();
    if (!viewer || !context?.canDecide) {
      return { ok: false, error: "Action indisponible." };
    }

    const enabled = parsed.data.enabled === "true";

    await createAdminClient()
      .from("receipt_merchant_rules")
      .update({ auto_forward: enabled })
      .eq("org_id", context.orgId)
      .eq("sender_domain", parsed.data.domain);

    await createAdminClient()
      .from("receipt_events")
      .insert({
        org_id: context.orgId,
        actor_id: viewer.user.id,
        action: enabled ? "merchant.automated" : "merchant.manual",
        after: { domain: parsed.data.domain } as never,
      });

    revalidatePath(RECEIPTS_PATH);
    return {
      ok: true,
      message: enabled
        ? `Les factures de ${parsed.data.domain} partiront désormais toutes seules.`
        : `Les factures de ${parsed.data.domain} repasseront par vous.`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Action impossible.",
    };
  }
}

/** Coupe tous les transferts automatiques, sans défaire le reste du réglage. */
export async function toggleEmergencyStop(
  _previous: ReceiptResult | null,
  formData: FormData,
): Promise<ReceiptResult> {
  const stop = formData.get("stop") === "true";

  try {
    const viewer = await getViewer();
    const context = await getReceiptsContext();
    if (!viewer || !context?.canDecide) {
      return { ok: false, error: "Action indisponible." };
    }

    const admin = createAdminClient();

    for (const source of context.sources) {
      await admin
        .from("receipt_sources")
        .update({
          settings: {
            ...source.settings,
            auto_forward: { ...source.settings.auto_forward, emergency_stop: stop },
          } as never,
        })
        .eq("id", source.id);
    }

    await admin.from("receipt_events").insert({
      org_id: context.orgId,
      actor_id: viewer.user.id,
      action: stop ? "automation.stopped" : "automation.resumed",
    });

    revalidatePath(RECEIPTS_PATH);
    return {
      ok: true,
      message: stop
        ? "Transferts automatiques coupés. Tout passe désormais par vous."
        : "Transferts automatiques réactivés.",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Action impossible.",
    };
  }
}

async function bumpRule(
  document: ReceiptDocument,
  change: { approvals?: number; rejections?: number; disableAuto?: boolean },
): Promise<void> {
  const admin = createAdminClient();
  const domain = senderDomain(document.from_email);

  const { data } = await admin
    .from("receipt_merchant_rules")
    .select("approvals, rejections")
    .eq("org_id", document.org_id)
    .eq("sender_domain", domain)
    .maybeSingle();

  const current = (data as { approvals: number; rejections: number } | null) ?? {
    approvals: 0,
    rejections: 0,
  };

  await admin.from("receipt_merchant_rules").upsert(
    {
      org_id: document.org_id,
      sender_domain: domain,
      merchant: document.merchant,
      approvals: current.approvals + (change.approvals ?? 0),
      rejections: current.rejections + (change.rejections ?? 0),
      ...(change.disableAuto ? { auto_forward: false } : {}),
      last_seen_at: new Date().toISOString(),
    } as never,
    { onConflict: "org_id,sender_domain" },
  );
}
