import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { FinanceInvoice } from "@/lib/finance/types";
import { aliasesFrom, normalizeClientName, resolveClient } from "./reconcile";
import type { BillingEngagement, BillingInstallment } from "./types";

/**
 * Lectures du module Échéances de facturation.
 *
 * Toutes passent par le client porteur de la session, donc par la RLS : un
 * oubli de filtre ici ne peut pas faire fuiter la facturation, la base
 * refuserait de la rendre.
 */

export async function listEngagements(options: {
  orgId: string;
  limit?: number;
}): Promise<BillingEngagement[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("billing_engagements")
    .select("*")
    .eq("org_id", options.orgId)
    .order("status")
    .order("client_name")
    .limit(options.limit ?? 100);

  return (data ?? []) as unknown as BillingEngagement[];
}

export async function listInstallments(options: {
  orgId: string;
  limit?: number;
}): Promise<BillingInstallment[]> {
  const supabase = await createClient();

  /* L'échéance de règlement vient de la facture rapprochée : une mensualité
     n'en porte pas, mais une fois reliée, c'est elle qui dit si le client a
     dépassé le délai. */
  let query = supabase
    .from("billing_installments")
    .select("*, finance_invoices(due_on)")
    .eq("org_id", options.orgId);

  /* Tout se lit d'un coup, dans l'ordre du calendrier : il n'y a plus de
     seconde liste où l'ancien irait se ranger. */
  query = query.order("issue_on").order("service_month");

  const { data } = await query.limit(options.limit ?? 1000);

  /* La jointure remonte un objet imbriqué ; la ligne reste plate, comme
     partout ailleurs dans le module. */
  return ((data ?? []) as unknown as (BillingInstallment & {
    finance_invoices: { due_on: string | null } | null;
  })[]).map(({ finance_invoices, ...line }) => ({
    ...line,
    invoice_due_on: finance_invoices?.due_on ?? null,
  }));
}

/** Ce que le board sait montrer d'une facture Airwallex sans devis. */
export type UnmatchedInvoice = Pick<
  FinanceInvoice,
  "id" | "client_name" | "amount_cents" | "currency" | "status" | "issued_on" | "due_on" | "paid_at"
>;

/**
 * Les factures Airwallex qui ne correspondent à aucune mensualité — celles
 * que le module Finance connaît déjà et que l'écran affiche telles quelles :
 * il reflète la facturation réelle, pas seulement ce qui a été planifié.
 *
 * Trois familles sont écartées, et chacune pour une raison différente :
 *
 *   • les **rapprochées** — elles vivent sur la ligne de leur mensualité ;
 *   • les **internes** — notre propre facturation, déclarée sans client dans
 *     `billing_client_aliases` : elle appartient à Finance, pas à un écran
 *     d'échéances client ;
 *   • les **jumelles** — même client (alias résolu) et même mois d'émission
 *     qu'une mensualité encore sans lien. C'est la même prestation ; tant
 *     que le rapprochement n'a pas posé le lien, l'afficher en plus la
 *     compterait deux fois. L'appariement est un pour un : deux factures le
 *     même mois pour le même client n'en masquent qu'une.
 */
export async function listUnmatchedInvoices(options: {
  orgId: string;
}): Promise<UnmatchedInvoice[]> {
  const supabase = await createClient();

  const [{ data: lines }, { data: invoices }, { data: aliasRows }] = await Promise.all([
    supabase
      .from("billing_installments")
      .select("matched_invoice_id, issue_on, status, billing_engagements!inner(client_name)")
      .eq("org_id", options.orgId)
      .limit(3000),
    supabase
      .from("finance_invoices")
      .select("id, client_name, amount_cents, currency, status, issued_on, due_on, paid_at")
      .eq("org_id", options.orgId)
      .in("status", ["sent", "paid"])
      .order("issued_on", { ascending: false })
      .limit(500),
    supabase
      .from("billing_client_aliases")
      .select("alias, client_name")
      .eq("org_id", options.orgId)
      .limit(500),
  ]);

  const installments = (lines ?? []) as unknown as {
    matched_invoice_id: string | null;
    issue_on: string;
    status: string;
    billing_engagements: { client_name: string };
  }[];
  const aliases = aliasesFrom(
    aliasRows as unknown as { alias: string; client_name: string | null }[] | null,
  );

  const matchedIds = new Set(
    installments
      .map((line) => line.matched_invoice_id)
      .filter((id): id is string => id !== null),
  );

  /* Un compteur par (client, mois) : autant de factures masquées que de
     mensualités encore sans lien, pas une de plus. */
  const twins = new Map<string, number>();
  for (const line of installments) {
    if (line.matched_invoice_id || line.status === "skipped") continue;
    const key = `${normalizeClientName(line.billing_engagements.client_name)}|${line.issue_on.slice(0, 7)}`;
    twins.set(key, (twins.get(key) ?? 0) + 1);
  }

  return ((invoices ?? []) as unknown as UnmatchedInvoice[]).filter((invoice) => {
    if (matchedIds.has(invoice.id)) return false;

    const client = resolveClient(invoice.client_name, aliases);
    if (client === null) return false;

    const key = `${client}|${invoice.issued_on?.slice(0, 7) ?? ""}`;
    const remaining = twins.get(key);
    if (remaining) {
      twins.set(key, remaining - 1);
      return false;
    }
    return true;
  });
}

/**
 * Les clients connus d'Airwallex, pour la liste de suggestions du formulaire.
 * Le rapprochement se fait sur le nom : le saisir à l'identique, c'est le
 * brancher du premier coup.
 */
export async function listKnownClients(options: {
  orgId: string;
}): Promise<string[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("finance_invoices")
    .select("client_name")
    .eq("org_id", options.orgId)
    .order("client_name")
    .limit(1000);

  const names = ((data ?? []) as unknown as { client_name: string }[]).map(
    (row) => row.client_name,
  );
  return [...new Set(names)].filter((name) => name && name !== "Client inconnu");
}
