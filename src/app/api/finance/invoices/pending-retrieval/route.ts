import { NextResponse } from "next/server";

import { currentUtcMonth, isDueForRetrieval } from "@/lib/finance/retrieval";
import { authorizedRetrievalJob } from "@/lib/finance/retrieval-job";
import type { FinanceRetrievalSource } from "@/lib/finance/types";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * La liste de travail du passage extérieur : les fournisseurs dont la facture
 * du mois n'est pas encore arrivée.
 *
 * Consommée par un script qui tourne **hors** du dashboard — sur une machine
 * qui garde ses sessions de navigateur — jamais par l'écran. Le dashboard ne
 * télécharge rien : une fonction Vercel n'a pas de profil de navigateur qui
 * survive d'une exécution à l'autre, et c'est la session qui ouvre la porte.
 *
 * Le chemin est déclaré public dans le proxy, comme `/api/cron` : ce n'est
 * pas une exception à l'authentification, c'en est une autre forme — voir
 * `retrieval-job.ts`. Le tri « à faire / déjà fait » vit dans `retrieval.ts`,
 * le même code que la cellule de l'écran : les deux ne peuvent pas se
 * contredire.
 */

export const dynamic = "force-dynamic";

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
  const sources = ((data ?? []) as unknown as FinanceRetrievalSource[])
    .filter((source) => isDueForRetrieval(source, now))
    .map((source) => ({
      id: source.id,
      org_id: source.org_id,
      merchant: source.merchant_label,
      merchant_key: source.merchant_key,
      source_link: source.source_link,
      retrieval_status: source.retrieval_status,
      auto_retrieved_at: source.auto_retrieved_at,
      last_error: source.last_error,
    }));

  return NextResponse.json({ ok: true, month: currentUtcMonth(now), sources });
}
