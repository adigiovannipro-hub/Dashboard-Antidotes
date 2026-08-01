import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { ingestSource, syncExpenses, verifyAttachments } from "@/lib/recus/pipeline";
import type { ReceiptSource } from "@/lib/recus/types";

/**
 * Le passage régulier du module Reçus.
 *
 * Trois étapes dans l'ordre, et l'ordre compte : les dépenses d'abord, pour que
 * les mails lus juste après aient de quoi se rapprocher ; l'ingestion ensuite ;
 * la vérification en dernier, sur ce qui a été transféré aux passages
 * précédents — l'OCR d'Airwallex met quelques minutes, jamais quelques
 * secondes.
 *
 * Une étape en échec n'annule pas les autres. Perdre la synchronisation
 * Airwallex ne doit pas empêcher de lire la boîte : les pièces attendront un
 * rapprochement plutôt que de ne pas être détectées du tout.
 *
 * Cadence conseillée : toutes les quinze minutes. Plus souvent ne sert à rien —
 * une facture n'est jamais urgente — et consomme du quota Gmail pour rien.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request): boolean {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;

  const provided = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(serverEnv().CRON_SECRET);

  // Comparaison à temps constant : un `===` fuiterait, par sa durée, combien de
  // caractères de tête sont corrects.
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: sourceRows } = await admin
    .from("receipt_sources")
    .select("*")
    .eq("status", "connected");

  const sources = (sourceRows ?? []) as unknown as ReceiptSource[];
  if (sources.length === 0) {
    return NextResponse.json({ ok: true, note: "Aucune boîte connectée." });
  }

  const orgIds = [...new Set(sources.map((source) => source.org_id))];
  const report: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const orgId of orgIds) {
    try {
      report[`expenses:${orgId}`] = await syncExpenses(orgId);
    } catch (error) {
      errors.push(
        `dépenses ${orgId} : ${error instanceof Error ? error.message : "erreur"}`,
      );
    }
  }

  for (const source of sources) {
    try {
      report[`ingest:${source.email_address}`] = await ingestSource(source.id);
    } catch (error) {
      errors.push(
        `boîte ${source.email_address} : ${error instanceof Error ? error.message : "erreur"}`,
      );
    }
  }

  for (const orgId of orgIds) {
    try {
      report[`verify:${orgId}`] = await verifyAttachments(orgId);
    } catch (error) {
      errors.push(
        `vérification ${orgId} : ${error instanceof Error ? error.message : "erreur"}`,
      );
    }
  }

  /* 200 même en cas d'erreur partielle : renvoyer un 500 ferait rejouer par
     l'ordonnanceur ce qui a déjà réussi. Les erreurs sont dans le corps, et
     dans `receipt_sources.last_error` pour l'écran. */
  return NextResponse.json({ ok: errors.length === 0, report, errors });
}
