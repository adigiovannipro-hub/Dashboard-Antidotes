import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  ACTIONABLE_STATUSES,
  AUTO_FORWARD_SUGGESTION_THRESHOLD,
  type MatchCandidate,
  type ReceiptDocument,
  type ReceiptExpense,
  type ReceiptMerchantRule,
  type ReceiptStatus,
} from "./types";
import { shouldSuggestAutomation } from "./auto-forward";
import { senderDomain } from "./heuristics";

/**
 * Lectures de l'écran Reçus.
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

export type Counters = {
  toValidate: number;
  forwarded: number;
  unmatched: number;
  failed: number;
  attachedThisMonth: number;
};

export async function getCounters(orgId: string): Promise<Counters> {
  const supabase = await createClient();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const countOf = async (build: (query: ReturnType<typeof base>) => unknown) => {
    const query = base();
    const { count } = (await build(query)) as { count: number | null };
    return count ?? 0;
  };

  function base() {
    return supabase
      .from("receipt_documents")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId);
  }

  const [toValidate, forwarded, unmatched, failed, attachedThisMonth] =
    await Promise.all([
      countOf((query) => query.eq("status", "awaiting_validation")),
      countOf((query) => query.eq("status", "forwarded")),
      countOf((query) => query.eq("status", "unmatched")),
      countOf((query) => query.eq("status", "failed")),
      countOf((query) =>
        query.eq("status", "attached").gte("attached_at", monthStart.toISOString()),
      ),
    ]);

  return { toValidate, forwarded, unmatched, failed, attachedThisMonth };
}

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

export type DocumentDetail = {
  document: ReceiptDocument;
  /** Ligne de frais pressentie, si elle existe encore. */
  expense: ReceiptExpense | null;
  /** Alternatives proposées, résolues en dépenses affichables. */
  alternatives: { candidate: MatchCandidate; expense: ReceiptExpense }[];
  rule: ReceiptMerchantRule | null;
  /** Vrai quand ce fournisseur a assez d'antécédents pour être automatisé. */
  suggestAutomation: boolean;
};

export async function getDocumentDetail(
  documentId: string,
): Promise<DocumentDetail | null> {
  const supabase = await createClient();

  const { data: documentRow } = await supabase
    .from("receipt_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();
  if (!documentRow) return null;

  const document = documentRow as unknown as ReceiptDocument;
  const candidates = Array.isArray(document.match_candidates)
    ? document.match_candidates
    : [];

  const expenseIds = [
    ...new Set(
      [document.expense_id, ...candidates.map((candidate) => candidate.expense_id)].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  ];

  const { data: expenseRows } = expenseIds.length
    ? await supabase.from("receipt_expenses").select("*").in("id", expenseIds)
    : { data: [] };

  const byId = new Map(
    ((expenseRows ?? []) as unknown as ReceiptExpense[]).map((expense) => [
      expense.id,
      expense,
    ]),
  );

  const { data: ruleRow } = await supabase
    .from("receipt_merchant_rules")
    .select("*")
    .eq("org_id", document.org_id)
    .eq("sender_domain", senderDomain(document.from_email))
    .maybeSingle();

  const rule = (ruleRow as unknown as ReceiptMerchantRule | null) ?? null;

  return {
    document,
    expense: document.expense_id ? (byId.get(document.expense_id) ?? null) : null,
    alternatives: candidates
      .filter((candidate) => candidate.expense_id !== document.expense_id)
      .map((candidate) => ({ candidate, expense: byId.get(candidate.expense_id) }))
      .filter(
        (entry): entry is { candidate: MatchCandidate; expense: ReceiptExpense } =>
          entry.expense !== undefined,
      ),
    rule,
    suggestAutomation: rule
      ? shouldSuggestAutomation(rule, AUTO_FORWARD_SUGGESTION_THRESHOLD)
      : false,
  };
}

/**
 * Dépenses carte sans justificatif, du plus récent au plus ancien.
 *
 * C'est la vue miroir de l'inbox : non plus « quelles pièces attendent une
 * ligne » mais « quelles lignes attendent une pièce ». Les deux ensemble disent
 * ce qui manque réellement à la comptabilité du mois.
 */
export async function listUnattachedExpenses(options: {
  orgId: string;
  limit?: number;
}): Promise<ReceiptExpense[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("receipt_expenses")
    .select("*")
    .eq("org_id", options.orgId)
    .eq("attachment_count", 0)
    .order("transaction_date", { ascending: false })
    .limit(options.limit ?? 25);

  return (data ?? []) as unknown as ReceiptExpense[];
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
