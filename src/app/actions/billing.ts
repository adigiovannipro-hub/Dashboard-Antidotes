"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireFinanceAccess } from "@/lib/finance/access";
import {
  installmentsFor,
  issueDateFor,
  lastMonthOf,
  monthsBetween,
} from "@/lib/billing/schedule";
import {
  createEngagementInput,
  deliveryInput,
  ficheColumns,
  ficheFrom,
  firstIssue,
  frenchAmount,
  isoMonth,
} from "@/lib/billing/forms";
import { TEMPLATE_VARIABLES, unknownVariablesIn } from "@/lib/billing/templates";
import { createClient } from "@/lib/supabase/server";

/**
 * Actions du module Échéances de facturation.
 *
 * Même contrat que les autres modules : signature `useActionState`
 * (état précédent, FormData), `safeParse` en entrée avant de toucher quoi que
 * ce soit, client de session — la RLS reste l'autorité, ces actions n'ont
 * aucune raison de la contourner.
 *
 * La garde est celle du module Finance : ces échéances sont l'autre moitié de
 * la même comptabilité, un droit distinct ne protégerait rien de plus.
 *
 * Les statuts, eux, avancent normalement tout seuls — rapprochement Airwallex
 * horaire. Les actions de statut sont le filet manuel quand une facture sort
 * du cadre : montant groupé, client renommé, avoir.
 */

export type BillingActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const BILLING_PATH = "/entreprise/factures";
const FINANCE_PATH = "/entreprise/finance";

function refresh() {
  revalidatePath(BILLING_PATH);
  // Le bloc « Facturation à venir » du dashboard Finance lit les mêmes lignes.
  revalidatePath(FINANCE_PATH);
}

export async function createEngagement(
  _previous: BillingActionResult | null,
  formData: FormData,
): Promise<BillingActionResult> {
  const parsed = createEngagementInput.safeParse({
    clientName: formData.get("clientName"),
    label: formData.get("label"),
    firstMonth: formData.get("firstMonth"),
    lastMonth: formData.get("lastMonth"),
    totalAmount: formData.get("totalAmount") || undefined,
    monthlyAmount: formData.get("monthlyAmount") || undefined,
    vatRate: formData.get("vatRate") || "0",
    notes: formData.get("notes") || undefined,
    ...ficheFrom(formData),
  });
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  for (const template of [
    parsed.data.sendSubject,
    parsed.data.sendTemplate,
    parsed.data.reminder1Subject,
    parsed.data.reminder1Template,
    parsed.data.reminder2Subject,
    parsed.data.reminder2Template,
    parsed.data.reminder3Subject,
    parsed.data.reminder3Template,
  ]) {
    const unknown = unknownVariablesIn(template);
    if (unknown.length > 0) {
      return {
        ok: false,
        error: `Variables inconnues dans un modèle : ${unknown.join(", ")}. Les variables disponibles sont ${Object.keys(TEMPLATE_VARIABLES).join(", ")}.`,
      };
    }
  }

  const monthsCount = monthsBetween(parsed.data.firstMonth, parsed.data.lastMonth);
  if (monthsCount > 60) {
    return { ok: false, error: "Plus de cinq ans : erreur de saisie probable." };
  }

  const totalCents = parsed.data.totalAmount
    ? Math.round(parsed.data.totalAmount * 100)
    : Math.round(parsed.data.monthlyAmount! * 100) * monthsCount;

  const context = await requireFinanceAccess();
  if (!context.canDecide) return { ok: false, error: "Action indisponible." };

  const supabase = await createClient();

  try {
    const { data: engagement, error } = await supabase
      .from("billing_engagements")
      .insert({
        org_id: context.orgId,
        client_name: parsed.data.clientName,
        label: parsed.data.label,
        /* Le mensuel représentatif de l'engagement — les lignes portent la
           division exacte, reste compris. */
        monthly_amount_cents: Math.max(1, Math.round(totalCents / monthsCount)),
        currency: "EUR",
        vat_rate: parsed.data.vatRate,
        first_month: parsed.data.firstMonth,
        months_count: monthsCount,
        notes: parsed.data.notes ?? null,
        /* La fiche, telle qu'elle a été réglée à la saisie. Sans adresse de
           destinataire, le devis se facture à la main — le défaut. */
        ...ficheColumns(parsed.data),
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const engagementId = (engagement as { id: string }).id;
    const lines = installmentsFor({
      first_month: parsed.data.firstMonth,
      months_count: monthsCount,
      total_amount_cents: totalCents,
      vat_rate: parsed.data.vatRate,
      currency: "EUR",
    });

    const { error: linesError } = await supabase.from("billing_installments").insert(
      lines.map((line) => ({
        org_id: context.orgId,
        engagement_id: engagementId,
        ...line,
      })) as never,
    );
    if (linesError) {
      // Un devis sans ses échéances serait un fantôme : on le retire
      // plutôt que de laisser une coquille que rien n'affichera correctement.
      await supabase.from("billing_engagements").delete().eq("id", engagementId);
      throw new Error(linesError.message);
    }

    refresh();
    return {
      ok: true,
      message: `Devis créé : ${lines.length} mensualité${lines.length > 1 ? "s" : ""} générée${lines.length > 1 ? "s" : ""}.`,
    };
  } catch (error) {
    return {
      ok: false,
      error: `Création refusée : ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// --- Ajuster un mois ---------------------------------------------------------

const updateInstallmentInput = z.object({
  installmentId: z.uuid(),
  amount: frenchAmount,
  /* Absent quand la ligne se modifie depuis un écran qui n'offre pas la
     période — le mois reste alors tel qu'il est. */
  serviceMonth: isoMonth.optional(),
  notes: z.string().trim().max(500).optional(),
});

/**
 * Une ligne se retouche entièrement : sa période, son montant, sa note. Un
 * mois offert, une rallonge, une prestation décalée d'un mois — tout cela
 * arrive, et rien n'oblige à reprendre le devis entier pour une ligne.
 *
 * Déplacer le mois de prestation déplace aussi le jour d'émission : la règle
 * du module — on facture le lendemain de la fin du mois — vaut pour une
 * ligne corrigée comme pour une ligne générée.
 */
export async function updateInstallment(
  _previous: BillingActionResult | null,
  formData: FormData,
): Promise<BillingActionResult> {
  const parsed = updateInstallmentInput.safeParse({
    installmentId: formData.get("installmentId"),
    amount: formData.get("amount"),
    serviceMonth: formData.get("serviceMonth") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Montant ou période invalide." };

  const context = await requireFinanceAccess();
  if (!context.canDecide) return { ok: false, error: "Action indisponible." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("billing_installments")
    .update({
      amount_cents: Math.round(parsed.data.amount * 100),
      notes: parsed.data.notes ?? null,
      ...(parsed.data.serviceMonth
        ? {
            service_month: parsed.data.serviceMonth,
            issue_on: issueDateFor(parsed.data.serviceMonth),
          }
        : {}),
    } as never)
    .eq("id", parsed.data.installmentId)
    .eq("org_id", context.orgId)
    .select("id");

  if (error) {
    /* Un devis ne porte qu'une ligne par mois : déplacer une prestation sur
       un mois déjà pris se refuse, et le message doit dire lequel. */
    const message = error.message.includes("billing_installments_engagement_id_service_month")
      ? "Ce devis a déjà une mensualité sur ce mois."
      : error.message;
    return { ok: false, error: `Mise à jour refusée : ${message}` };
  }
  if (!data || data.length === 0) return { ok: false, error: "Échéance introuvable." };

  refresh();
  return { ok: true, message: "Mensualité ajustée." };
}

// --- Faire avancer une échéance ----------------------------------------------

const setStatusInput = z.object({
  installmentId: z.uuid(),
  status: z.enum(["pending", "issued", "paid", "skipped"]),
});

export async function setInstallmentStatus(
  _previous: BillingActionResult | null,
  formData: FormData,
): Promise<BillingActionResult> {
  const parsed = setStatusInput.safeParse({
    installmentId: formData.get("installmentId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  const context = await requireFinanceAccess();
  if (!context.canDecide) return { ok: false, error: "Action indisponible." };

  const supabase = await createClient();

  /* La date d'émission déjà posée se relit avant d'écrire : redescendre une
     ligne payée vers « facturée » ne doit pas la réémettre aujourd'hui. Sans
     cette lecture, une facture partie le 1er juin comptait dans le facturé du
     mois courant, simplement parce qu'on avait corrigé son statut. */
  const { data: current } = await supabase
    .from("billing_installments")
    .select("issued_at")
    .eq("id", parsed.data.installmentId)
    .eq("org_id", context.orgId)
    .maybeSingle();
  const issuedAt = (current as { issued_at: string | null } | null)?.issued_at ?? null;

  /* Les horodatages suivent le statut. Repasser une ligne « à facturer » ou
     la passer retire le lien Airwallex — elle n'a alors plus de facture, par
     définition. « Facturée » le garde au contraire : c'est lui qui porte
     l'échéance de règlement, et sans échéance l'écran ne peut plus dire que
     le client est en retard. */
  const stamps = {
    pending: { issued_at: null, paid_at: null, matched_invoice_id: null },
    issued: { issued_at: issuedAt ?? new Date().toISOString(), paid_at: null },
    paid: { paid_at: new Date().toISOString() },
    skipped: { issued_at: null, paid_at: null, matched_invoice_id: null },
  }[parsed.data.status];

  const { data, error } = await supabase
    .from("billing_installments")
    .update({ status: parsed.data.status, ...stamps } as never)
    .eq("id", parsed.data.installmentId)
    .eq("org_id", context.orgId)
    .select("id");

  if (error) return { ok: false, error: `Mise à jour refusée : ${error.message}` };
  if (!data || data.length === 0) {
    return { ok: false, error: "Échéance introuvable." };
  }

  refresh();
  return { ok: true, message: "Échéance mise à jour." };
}

// --- Supprimer une échéance --------------------------------------------------

const deleteInstallmentInput = z.object({ installmentId: z.uuid() });

/**
 * Suppression réelle d'une seule mensualité — le mois qui n'aurait jamais dû
 * exister, la ligne doublonnée d'une saisie. Pour un mois offert qui garde sa
 * trace, c'est « Passer » depuis « À facturer ».
 *
 * Une ligne rapprochée d'une facture Airwallex peut partir aussi : la facture
 * ne disparaît pas, elle redevient « hors devis » et reste visible dans ses
 * groupes — l'écran montre la facturation réelle, la suppression ne retire
 * que la planification.
 */
export async function deleteInstallment(
  _previous: BillingActionResult | null,
  formData: FormData,
): Promise<BillingActionResult> {
  const parsed = deleteInstallmentInput.safeParse({
    installmentId: formData.get("installmentId"),
  });
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  const context = await requireFinanceAccess();
  if (!context.canDecide) return { ok: false, error: "Action indisponible." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("billing_installments")
    .delete()
    .eq("id", parsed.data.installmentId)
    .eq("org_id", context.orgId)
    .select("id");

  if (error) return { ok: false, error: `Suppression refusée : ${error.message}` };
  if (!data || data.length === 0) return { ok: false, error: "Échéance introuvable." };

  refresh();
  return { ok: true, message: "Mensualité supprimée." };
}

// --- Ajouter une échéance à un devis existant --------------------------------

const addInstallmentInput = z.object({
  engagementId: z.uuid(),
  serviceMonth: isoMonth,
  amount: frenchAmount,
  notes: z.string().trim().max(500).optional(),
});

/**
 * Une mensualité de plus sur un devis en cours — la prolongation d'un mois,
 * la rallonge exceptionnelle. Elle naît « Facture confirmée » et avance ensuite
 * comme les autres : bascule « à facturer » dérivée de la date, rapprochement
 * Airwallex. Un seul endroit de vérité, donc elle apparaît partout d'un coup
 * — groupes du board, prévisionnel, cartes.
 *
 * Si le mois sort de la période affichée du devis, la fenêtre s'étend : un
 * devis « janvier → juin » qui gagne juillet se dit désormais
 * « janvier → juillet », sinon l'en-tête mentirait sur ses propres lignes.
 */
export async function addInstallment(
  _previous: BillingActionResult | null,
  formData: FormData,
): Promise<BillingActionResult> {
  const parsed = addInstallmentInput.safeParse({
    engagementId: formData.get("engagementId"),
    serviceMonth: formData.get("serviceMonth"),
    amount: formData.get("amount"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Mois ou montant invalide." };

  const context = await requireFinanceAccess();
  if (!context.canDecide) return { ok: false, error: "Action indisponible." };

  const supabase = await createClient();

  const { data: engagementRow, error: readError } = await supabase
    .from("billing_engagements")
    .select("first_month, months_count, vat_rate, currency")
    .eq("id", parsed.data.engagementId)
    .eq("org_id", context.orgId)
    .maybeSingle();
  if (readError || !engagementRow) return { ok: false, error: "Devis introuvable." };

  const engagement = engagementRow as {
    first_month: string;
    months_count: number;
    vat_rate: number;
    currency: string;
  };

  const { error } = await supabase.from("billing_installments").insert({
    org_id: context.orgId,
    engagement_id: parsed.data.engagementId,
    service_month: parsed.data.serviceMonth,
    issue_on: issueDateFor(parsed.data.serviceMonth),
    amount_cents: Math.round(parsed.data.amount * 100),
    vat_rate: engagement.vat_rate,
    currency: engagement.currency,
    status: "pending",
    notes: parsed.data.notes ?? null,
  } as never);

  if (error) {
    const message = error.message.includes("billing_installments_engagement_id_service_month")
      ? "Ce devis a déjà une mensualité sur ce mois."
      : error.message;
    return { ok: false, error: `Ajout refusé : ${message}` };
  }

  /* La fenêtre du devis suit ses lignes. `months_count` n'est pas un simple
     affichage : `lastMonthOf` en dérive la période, et la bascule de statut
     du devis s'y réfère. */
  const firstMonth =
    parsed.data.serviceMonth < engagement.first_month
      ? parsed.data.serviceMonth
      : engagement.first_month;
  const lastCurrent = lastMonthOf(engagement);
  const lastMonth =
    parsed.data.serviceMonth > lastCurrent ? parsed.data.serviceMonth : lastCurrent;
  const monthsCount = monthsBetween(firstMonth, lastMonth);
  if (firstMonth !== engagement.first_month || monthsCount !== engagement.months_count) {
    await supabase
      .from("billing_engagements")
      .update({ first_month: firstMonth, months_count: monthsCount } as never)
      .eq("id", parsed.data.engagementId)
      .eq("org_id", context.orgId);
  }

  refresh();
  return { ok: true, message: "Mensualité ajoutée au devis." };
}

// --- Terminer un devis -------------------------------------------------------

const endEngagementInput = z.object({ engagementId: z.uuid() });

/**
 * Clore un devis : résiliation, fin anticipée. Ses échéances encore à
 * émettre passent « passées » — les facturées et payées, elles, sont de
 * l'histoire et ne bougent pas.
 */
export async function endEngagement(
  _previous: BillingActionResult | null,
  formData: FormData,
): Promise<BillingActionResult> {
  const parsed = endEngagementInput.safeParse({
    engagementId: formData.get("engagementId"),
  });
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  const context = await requireFinanceAccess();
  if (!context.canDecide) return { ok: false, error: "Action indisponible." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("billing_engagements")
    .update({ status: "ended" } as never)
    .eq("id", parsed.data.engagementId)
    .eq("org_id", context.orgId);
  if (error) return { ok: false, error: `Clôture refusée : ${error.message}` };

  const { error: linesError } = await supabase
    .from("billing_installments")
    .update({ status: "skipped", matched_invoice_id: null } as never)
    .eq("engagement_id", parsed.data.engagementId)
    .eq("org_id", context.orgId)
    .eq("status", "pending");
  if (linesError) {
    return { ok: false, error: `Clôture partielle : ${linesError.message}` };
  }

  refresh();
  return { ok: true, message: "Devis terminé, échéances restantes passées." };
}

// --- Supprimer un devis ------------------------------------------------------

const deleteEngagementInput = z.object({ engagementId: z.uuid() });

/**
 * Suppression réelle, réservée à l'erreur de saisie : le devis part avec
 * toutes ses échéances, facturées comprises (cascade). Pour une fin de
 * contrat, c'est `endEngagement` — l'historique de ce qui a été facturé se
 * garde.
 */
export async function deleteEngagement(
  _previous: BillingActionResult | null,
  formData: FormData,
): Promise<BillingActionResult> {
  const parsed = deleteEngagementInput.safeParse({
    engagementId: formData.get("engagementId"),
  });
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  const context = await requireFinanceAccess();
  if (!context.canDecide) return { ok: false, error: "Action indisponible." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("billing_engagements")
    .delete()
    .eq("id", parsed.data.engagementId)
    .eq("org_id", context.orgId);
  if (error) return { ok: false, error: `Suppression refusée : ${error.message}` };

  refresh();
  return { ok: true, message: "Devis supprimé avec ses échéances." };
}

// --- Régler l'envoi automatique ----------------------------------------------

/**
 * Ce qu'il faut pour qu'une facture parte toute seule : à qui, avec quel
 * texte, et à partir de quelle facture modèle.
 *
 * Les modèles sont validés ici et pas seulement à l'envoi : une variable mal
 * orthographiée — `[periode]` sans accent — se corrige à la saisie, quand
 * quelqu'un regarde. Découverte au moment où le mail aurait dû partir, elle
 * coûte une facture non envoyée.
 */
export async function updateEngagementDelivery(
  _previous: BillingActionResult | null,
  formData: FormData,
): Promise<BillingActionResult> {
  const parsed = deliveryInput.safeParse({
    engagementId: formData.get("engagementId"),
    ...ficheFrom(formData),
  });
  if (!parsed.success) {
    /* Le champ fautif est nommé : un message générique envoyait chercher
       une adresse invalide là où c'était un modèle trop long. */
    return { ok: false, error: firstIssue(parsed.error) };
  }

  for (const template of [
    parsed.data.sendSubject,
    parsed.data.sendTemplate,
    parsed.data.reminder1Subject,
    parsed.data.reminder1Template,
    parsed.data.reminder2Subject,
    parsed.data.reminder2Template,
    parsed.data.reminder3Subject,
    parsed.data.reminder3Template,
  ]) {
    const unknown = unknownVariablesIn(template);
    if (unknown.length > 0) {
      return {
        ok: false,
        error: `Variables inconnues dans un modèle : ${unknown.join(", ")}. Les variables disponibles sont ${Object.keys(TEMPLATE_VARIABLES).join(", ")}.`,
      };
    }
  }

  const context = await requireFinanceAccess();
  if (!context.canDecide) return { ok: false, error: "Action indisponible." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("billing_engagements")
    .update({
      ...ficheColumns(parsed.data),
    } as never)
    .eq("id", parsed.data.engagementId)
    .eq("org_id", context.orgId);
  if (error) return { ok: false, error: `Enregistrement refusé : ${error.message}` };

  refresh();
  return {
    ok: true,
    message: parsed.data.recipientEmail
      ? `Envoi automatique activé vers ${parsed.data.recipientEmail}.`
      : "Envoi automatique désactivé : ce devis se facture à la main.",
  };
}
