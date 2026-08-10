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

/* Les reçus se traitent dans la page Finance : c'est elle qu'il faut
   rafraîchir après une décision, la page dédiée n'existant plus. */
const RECEIPTS_PATH = "/entreprise/finance";

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

/**
 * Archivage : la pièce sort de la liste de travail.
 *
 * Un seul bouton, deux sens, que distingue ce qui s'est déjà passé :
 *
 * — une pièce **jamais partie** qu'on archive, c'est un refus. Le fournisseur
 *   perd son automatisme, parce que le cas n'était pas aussi routinier qu'il
 *   en avait l'air et que continuer à envoyer tout seul après un désaccord
 *   serait le contraire d'apprendre.
 * — une pièce **déjà transférée** qu'on archive, c'est du rangement : Airwallex
 *   n'a pas su l'accrocher, on l'a fait à la main dans leur interface. Rien à
 *   reprocher à personne, le compteur du fournisseur ne bouge pas.
 *
 * C'est la distinction qui interdisait de réutiliser « ignoré » pour les deux.
 */
export async function archiveDocument(
  _previous: ReceiptResult | null,
  formData: FormData,
): Promise<ReceiptResult> {
  const parsed = documentAction.safeParse({ documentId: formData.get("documentId") });
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  try {
    const { viewer, document } = await requireDecider(parsed.data.documentId);
    const sent = document.forwarded_at !== null;

    await createAdminClient()
      .from("receipt_documents")
      .update({
        status: sent ? "archived" : "ignored",
        decided_by: viewer.user.id,
        decided_at: new Date().toISOString(),
        auto_decided: false,
      })
      .eq("id", document.id);

    if (!sent) await bumpRule(document, { rejections: 1, disableAuto: true });

    await audit({
      orgId: document.org_id,
      documentId: document.id,
      actorId: viewer.user.id,
      action: "document.archived",
      before: { status: document.status },
      after: { status: sent ? "archived" : "ignored" },
    });

    revalidatePath(RECEIPTS_PATH);
    return {
      ok: true,
      message: sent ? "Pièce archivée." : "Pièce écartée.",
    };
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

/**
 * Ouvre ou referme l'auto-transfert, globalement.
 *
 * Deux verrous et non un : celui-ci ouvre la porte, la règle de chaque
 * fournisseur dit qui peut la franchir. Ouvrir ici ne déclenche donc rien
 * pour un marchand qu'on n'a pas approuvé — c'est ce qui permet de
 * n'automatiser qu'un fournisseur à la fois.
 *
 * Distinct de l'arrêt d'urgence, qui coupe sans défaire le réglage : celui-là
 * se lève d'un clic, celui-ci se repense.
 */
export async function toggleAutoForward(
  _previous: ReceiptResult | null,
  formData: FormData,
): Promise<ReceiptResult> {
  const enabled = formData.get("enabled") === "true";

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
            auto_forward: { ...source.settings.auto_forward, enabled },
          } as never,
        })
        .eq("id", source.id);
    }

    await admin.from("receipt_events").insert({
      org_id: context.orgId,
      actor_id: viewer.user.id,
      action: enabled ? "automation.enabled" : "automation.disabled",
    });

    revalidatePath(RECEIPTS_PATH);
    return {
      ok: true,
      message: enabled
        ? "Auto-transfert ouvert. Seuls les fournisseurs que vous avez approuvés partiront seuls ; les autres continuent de passer par vous."
        : "Auto-transfert refermé. Toutes les pièces passent par vous.",
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
