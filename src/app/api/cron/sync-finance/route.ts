import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { missingServerEnv, serverEnv } from "@/lib/env";
import { runFinanceSync } from "@/lib/finance/sync";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Le passage régulier du module Finance : soldes, dépenses, factures.
 *
 * Appelé toutes les heures par un `schedule` GitHub Actions — pas par Vercel
 * Cron, dont le plan Hobby rejette tout déploiement demandant mieux que le
 * quotidien. Le chemin `/api/cron` est public côté proxy ; la route se protège
 * elle-même par `CRON_SECRET`, comparé à temps constant.
 *
 * La cadence horaire n'est pas un luxe : l'API Airwallex ne rend aucun
 * historique de solde, la courbe de trésorerie n'existe que par les
 * instantanés que chaque passage dépose. Rater une heure, c'est un trou dans
 * la courbe — le report du dernier solde connu le comble à l'affichage, mais
 * l'information est perdue.
 */

export const dynamic = "force-dynamic";
// Le plan Hobby plafonne les fonctions à 60 s. Trois lectures paginées et des
// upserts tiennent largement dedans ; déclarer plus serait ignoré ou refusé.
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;

  const provided = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(serverEnv().CRON_SECRET);

  // Comparaison à temps constant : un `===` fuiterait, par sa durée, combien
  // de caractères de tête sont corrects.
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export async function GET(request: Request) {
  /* La configuration se vérifie avant l'autorisation, et c'est délibéré :
     `authorized()` lit `serverEnv()`, qui lève sur une variable absente. La
     route rendrait alors un 500 au corps vide, indiscernable d'un bug. On
     nomme donc ce qui manque — des noms de variables, jamais leurs valeurs. */
  const missing = missingServerEnv();
  if (missing.length > 0) {
    return NextResponse.json({
      ok: false,
      errors: [
        `Configuration incomplète — variables absentes de l'environnement de déploiement : ${missing.join(", ")}.`,
      ],
    });
  }

  if (!authorized(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  if (!process.env.AIRWALLEX_API_KEY || !process.env.AIRWALLEX_CLIENT_ID) {
    // Réponse 200 : un secret manquant se corrige dans Vercel, pas en faisant
    // rejouer l'ordonnanceur. Le corps dit ce qui manque.
    return NextResponse.json({
      ok: false,
      errors: ["AIRWALLEX_CLIENT_ID et AIRWALLEX_API_KEY absents — synchronisation impossible."],
    });
  }

  // La comptabilité est celle d'Antidotes : l'organisation la plus ancienne
  // est la bonne. Tester l'`error` et non le seul `data` — une table absente
  // rendrait un « rien à faire » parfaitement rassurant.
  const { data: orgs, error } = await createAdminClient()
    .from("organizations")
    .select("id")
    .order("created_at")
    .limit(1);
  if (error) {
    return NextResponse.json({
      ok: false,
      errors: [`Lecture des organisations : ${error.message}`],
    });
  }
  const orgId = (orgs as { id: string }[] | null)?.[0]?.id;
  if (!orgId) {
    return NextResponse.json({
      ok: false,
      errors: ["Aucune organisation en base — migrations non appliquées ?"],
    });
  }

  const report = await runFinanceSync({ orgId, triggeredVia: "cron" });
  const errors = report
    .filter((step) => step.status === "error")
    .map((step) => `${step.kind} : ${step.error}`);

  // 200 même en échec partiel : un 500 ferait rejouer par l'ordonnanceur ce
  // qui a déjà réussi.
  return NextResponse.json({ ok: errors.length === 0, report, errors });
}
