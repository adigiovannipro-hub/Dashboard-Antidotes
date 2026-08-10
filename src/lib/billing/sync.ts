import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import {
  aliasesFrom,
  reconcile,
  type ReconcilableInstallment,
  type ReconcilableInvoice,
} from "./reconcile";

/**
 * L'application du rapprochement : lit l'état, laisse `reconcile` décider,
 * écrit les décisions. Branchée comme étape `billing` du passage de
 * synchronisation Finance — elle tourne donc toutes les heures depuis le
 * runner GitHub, juste après la resynchronisation des factures qu'elle
 * consomme.
 *
 * Client admin : un ordonnanceur n'a pas de session, donc pas de RLS. Et
 * comme dans tout cron, chaque `error` de Supabase est testé — une table
 * absente rendrait un `data` nul, donc une liste vide, donc un « rien à
 * rapprocher » parfaitement rassurant et faux.
 */

type InstallmentRow = Omit<ReconcilableInstallment, "client_name"> & {
  billing_engagements: { client_name: string };
};

export async function reconcileBillingInstallments(orgId: string): Promise<number> {
  const admin = createAdminClient();

  /* Les archivées sont de l'histoire : rien ne les fait plus bouger, inutile
     de les relire à chaque passage. */
  const { data: lines, error: linesError } = await admin
    .from("billing_installments")
    .select(
      "id, status, amount_cents, vat_rate, currency, issue_on, matched_invoice_id, archived_at, issued_at, paid_at, billing_engagements!inner(client_name)",
    )
    .eq("org_id", orgId)
    .is("archived_at", null)
    .limit(2000);
  if (linesError) {
    throw new Error(`Lecture des échéances : ${linesError.message}`);
  }

  const installments = ((lines ?? []) as unknown as InstallmentRow[]).map(
    ({ billing_engagements, ...line }) => ({
      ...line,
      client_name: billing_engagements.client_name,
    }),
  );
  if (installments.length === 0) return 0;

  const [{ data: invoices, error: invoicesError }, { data: aliasRows, error: aliasError }] =
    await Promise.all([
      admin
        .from("finance_invoices")
        .select("id, client_name, amount_cents, currency, status, issued_on, paid_at")
        .eq("org_id", orgId)
        .order("issued_on", { ascending: false })
        .limit(1000),
      admin
        .from("billing_client_aliases")
        .select("alias, client_name")
        .eq("org_id", orgId)
        .limit(500),
    ]);
  if (invoicesError) {
    throw new Error(`Lecture des factures : ${invoicesError.message}`);
  }
  if (aliasError) {
    throw new Error(`Lecture des correspondances de clients : ${aliasError.message}`);
  }

  const decisions = reconcile({
    installments,
    invoices: (invoices ?? []) as unknown as ReconcilableInvoice[],
    aliases: aliasesFrom(
      aliasRows as unknown as { alias: string; client_name: string | null }[] | null,
    ),
  });

  for (const decision of decisions) {
    const { error } = await admin
      .from("billing_installments")
      .update(decision.set as never)
      .eq("id", decision.installment_id)
      .eq("org_id", orgId);
    if (error) {
      throw new Error(`Écriture du rapprochement : ${error.message}`);
    }
  }

  return decisions.length;
}
