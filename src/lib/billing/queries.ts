import "server-only";

import { createClient } from "@/lib/supabase/server";
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

export type InstallmentFilters = {
  /** `true` : seulement les archivées ; `false` (défaut) : tout le vivant. */
  archived?: boolean;
};

export async function listInstallments(options: {
  orgId: string;
  filters?: InstallmentFilters;
  limit?: number;
}): Promise<BillingInstallment[]> {
  const supabase = await createClient();

  let query = supabase
    .from("billing_installments")
    .select("*")
    .eq("org_id", options.orgId);

  /* L'archivé se lit à part, du plus récent au plus ancien — c'est un bas de
     page, pas un flux. Le vivant se lit dans l'ordre du calendrier. */
  if (options.filters?.archived) {
    query = query
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false });
  } else {
    query = query
      .is("archived_at", null)
      .order("issue_on")
      .order("service_month");
  }

  const { data } = await query.limit(options.limit ?? 500);

  return (data ?? []) as unknown as BillingInstallment[];
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
