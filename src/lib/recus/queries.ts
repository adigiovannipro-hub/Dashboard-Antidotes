import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  ACTIONABLE_STATUSES,
  type ReceiptDocument,
  type ReceiptMerchantRule,
  type ReceiptStatus,
} from "./types";

/**
 * Lectures des reçus, pour le panneau de la page Finance.
 *
 * Toutes passent par le client porteur de la session, donc par la RLS : une
 * erreur d'oubli de filtre ici ne peut pas faire fuiter les pièces d'une autre
 * organisation, parce que la base refuserait de les rendre.
 */

export type ReceiptFilters = {
  status?: string;
  kind?: string;
  search?: string;
  /** Ne montrer que ce qui demande une décision. */
  actionableOnly?: boolean;
};

export async function listDocuments(options: {
  orgId: string;
  filters: ReceiptFilters;
  limit?: number;
}): Promise<ReceiptDocument[]> {
  const supabase = await createClient();

  let query = supabase
    .from("receipt_documents")
    .select("*")
    .eq("org_id", options.orgId)
    .order("received_at", { ascending: false })
    .limit(options.limit ?? 100);

  if (options.filters.status) {
    query = query.eq("status", options.filters.status as ReceiptStatus);
  } else if (options.filters.actionableOnly !== false) {
    // Défaut de l'écran : ce qui demande un geste. Le reste est à un filtre
    // de distance, mais n'encombre pas la vue de travail.
    query = query.in("status", ACTIONABLE_STATUSES);
  }

  if (options.filters.kind) query = query.eq("kind", options.filters.kind as never);

  if (options.filters.search) {
    const term = `%${options.filters.search}%`;
    query = query.or(
      `subject.ilike.${term},merchant.ilike.${term},from_email.ilike.${term}`,
    );
  }

  const { data } = await query;
  return (data ?? []) as unknown as ReceiptDocument[];
}

/**
 * L'historique : les pièces réellement parties chez Airwallex.
 *
 * Le critère est `forwarded_at`, et non le statut — c'est la seule chose qui
 * distingue une pièce dont on s'est occupé d'un mail écarté. Une pièce partie
 * seule y figure au même titre qu'une pièce validée à la main : le tri se fait
 * dans la colonne « auto », pas en cachant la moitié de l'histoire.
 */
export async function listForwardedDocuments(options: {
  orgId: string;
  limit?: number;
}): Promise<ReceiptDocument[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("receipt_documents")
    .select("*")
    .eq("org_id", options.orgId)
    .not("forwarded_at", "is", null)
    .order("forwarded_at", { ascending: false })
    .limit(options.limit ?? 100);

  return (data ?? []) as unknown as ReceiptDocument[];
}

export async function listMerchantRules(orgId: string): Promise<ReceiptMerchantRule[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("receipt_merchant_rules")
    .select("*")
    .eq("org_id", orgId)
    .order("approvals", { ascending: false });

  return (data ?? []) as unknown as ReceiptMerchantRule[];
}
