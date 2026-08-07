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
  /** Statuts à retenir. Absent : tous. */
  statuses?: BillingInstallment["status"][];
  /** Ne garder que ce qui s'émet jusqu'à cette date incluse, `AAAA-MM-JJ`. */
  issuedUpTo?: string;
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

  if (options.filters?.statuses) {
    query = query.in("status", options.filters.statuses);
  }
  if (options.filters?.issuedUpTo) {
    query = query.lte("issue_on", options.filters.issuedUpTo);
  }

  const { data } = await query
    .order("issue_on")
    .order("service_month")
    .limit(options.limit ?? 200);

  return (data ?? []) as unknown as BillingInstallment[];
}

/**
 * Les dernières lignes émises ou payées — l'historique court de bas de page.
 * Triées du plus récent au plus ancien, contrairement au planning.
 */
export async function listRecentIssued(options: {
  orgId: string;
  limit?: number;
}): Promise<BillingInstallment[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("billing_installments")
    .select("*")
    .eq("org_id", options.orgId)
    .in("status", ["issued", "paid"])
    .order("issue_on", { ascending: false })
    .limit(options.limit ?? 20);

  return (data ?? []) as unknown as BillingInstallment[];
}
