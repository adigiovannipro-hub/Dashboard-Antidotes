import { NextResponse } from "next/server";

import { merchantKey } from "@/lib/finance/merchant-logo";
import {
  currentUtcMonth,
  decideRetrieval,
  RETRIEVAL_REASON_LABELS,
} from "@/lib/finance/retrieval";
import { authorizedRetrievalJob } from "@/lib/finance/retrieval-job";
import type { FinanceRetrievalSource } from "@/lib/finance/types";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * La liste de travail du passage extérieur : les fournisseurs dont la facture
 * du mois est à aller chercher **aujourd'hui** — le lendemain de leur
 * prélèvement, tel que la synchronisation Airwallex l'a vu.
 *
 * Consommée par un script qui tourne **hors** du dashboard — sur une machine
 * qui garde ses sessions de navigateur — jamais par l'écran. Le dashboard ne
 * télécharge rien : une fonction Vercel n'a pas de profil de navigateur qui
 * survive d'une exécution à l'autre, et c'est la session qui ouvre la porte.
 *
 * Le chemin est déclaré public dans le proxy, comme `/api/cron` : ce n'est
 * pas une exception à l'authentification, c'en est une autre forme — voir
 * `retrieval-job.ts`. La décision vit dans `retrieval.ts`, le même code que
 * la cellule de l'écran : les deux ne peuvent pas se contredire.
 *
 * `schedule` liste **toutes** les fiches avec leur raison, pour que le journal
 * du passage dise pourquoi il n'a rien fait plutôt que de se taire.
 */

export const dynamic = "force-dynamic";

/* Deux mois de prélèvements suffisent : on ne cherche que celui du mois. */
const CHARGE_WINDOW_DAYS = 62;

export async function GET(request: Request) {
  if (!authorizedRetrievalJob(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("finance_retrieval_sources")
    .select("*")
    .not("source_link", "is", null)
    .order("merchant_label", { ascending: true });

  /* L'erreur se teste, pas seulement la donnée : une table absente rendrait
     une liste vide, donc un « rien à faire » parfaitement rassurant. */
  if (error) {
    return NextResponse.json(
      { ok: false, error: `Lecture des fiches : ${error.message}` },
      { status: 500 },
    );
  }

  const now = new Date();
  const sources = (data ?? []) as unknown as FinanceRetrievalSource[];
  const lastCharges = await lastChargeByMerchant(
    admin,
    [...new Set(sources.map((source) => source.org_id))],
    now,
  );

  const schedule = sources.map((source) => {
    const lastChargeAt = lastCharges[`${source.org_id}:${source.merchant_key}`] ?? null;
    const decision = decideRetrieval({ source, lastChargeAt, now });
    return {
      id: source.id,
      org_id: source.org_id,
      merchant: source.merchant_label,
      merchant_key: source.merchant_key,
      source_link: source.source_link,
      retrieval_status: source.retrieval_status,
      auto_retrieved_at: source.auto_retrieved_at,
      last_error: source.last_error,
      last_charge_at: lastChargeAt,
      due: decision.due,
      due_on: decision.dueOn,
      reason: decision.reason,
      reason_label: RETRIEVAL_REASON_LABELS[decision.reason],
    };
  });

  return NextResponse.json({
    ok: true,
    month: currentUtcMonth(now),
    sources: schedule.filter((entry) => entry.due),
    schedule,
  });
}

/**
 * Le dernier prélèvement carte de chaque marchand, par clé — la même clé que
 * les fiches et les logos, calculée depuis le nom. Un virement n'est pas un
 * prélèvement : la source `ledger` est écartée.
 */
async function lastChargeByMerchant(
  admin: ReturnType<typeof createAdminClient>,
  orgIds: string[],
  now: Date,
): Promise<Record<string, string>> {
  if (orgIds.length === 0) return {};

  const since = new Date(now.getTime() - CHARGE_WINDOW_DAYS * 86_400_000).toISOString();
  const { data, error } = await admin
    .from("finance_transactions")
    .select("org_id, merchant, merchant_raw, occurred_at")
    .in("org_id", orgIds)
    .neq("source", "ledger")
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(`Lecture des prélèvements : ${error.message}`);

  const rows = (data ?? []) as unknown as {
    org_id: string;
    merchant: string | null;
    merchant_raw: string | null;
    occurred_at: string;
  }[];

  const latest: Record<string, string> = {};
  for (const row of rows) {
    const key = `${row.org_id}:${merchantKey(row.merchant ?? row.merchant_raw)}`;
    // Trié du plus récent au plus ancien : la première occurrence gagne.
    if (!(key in latest)) latest[key] = row.occurred_at;
  }
  return latest;
}
