import { after, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { serverEnv } from "@/lib/env";
import { dispatchPublicationWorkflow } from "@/lib/finance/github-actions";
import { parisStamp, publishOpening } from "@/lib/publishing/readiness";
import { publishSubjectNow, runScheduledPublishing } from "@/lib/publishing/run";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * La publication de 16h00 pile, heure de Bali (10h à Paris l'été, 9h l'hiver).
 *
 * L'horloge est `pg_cron`, dans Supabase (migration 20261007c) : à 08h00 UTC
 * il appelle cette route — Bali n'a pas d'heure d'été, une seule tâche suffit.
 * Ni un cron Vercel (le plan Hobby ne garantit que l'heure, pas la minute,
 * et ses deux créneaux sont pris) ni un `schedule` GitHub (quatre à sept
 * heures de retard) ne tiennent la minute.
 *
 * La réponse part tout de suite et le travail continue dans `after()` :
 * `pg_net` n'attend que quelques secondes, et un appelant qui raccroche ne
 * doit rien interrompre. Le passage a une heure limite sous `maxDuration` ;
 * ce qu'il n'a pas eu le temps de revendiquer part au relais GitHub
 * (`publication.yml`), dans la minute. Rien n'est jamais revendiqué sans le
 * temps de le finir.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Marge sous `maxDuration` : clore les lignes et donner l'ordre du relais. */
const BUDGET_MS = 270_000;

/** Une horloge en avance de quelques secondes reste la bonne. */
const EARLY_TOLERANCE_MS = 2 * 60_000;

function authorized(request: Request): boolean {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;

  const provided = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(serverEnv("PUBLICATION_CRON_SECRET").PUBLICATION_CRON_SECRET);

  // Comparaison à temps constant : un `===` fuiterait, par sa durée, combien de
  // caractères de tête sont corrects.
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const started = Date.now();
  const paris = parisStamp(new Date(started));

  // « Publier » depuis le planning : un sujet, maintenant, quelle que soit
  // l'heure. L'appel vient de l'action serveur, qui a déjà vérifié l'owner.
  const subject = SUBJECT_REQUEST.safeParse(await request.json().catch(() => null));
  if (subject.success) {
    after(() => publishOneNow(subject.data, started + BUDGET_MS));
    return NextResponse.json({ ok: true, subject: subject.data.subjectId }, { status: 202 });
  }

  // Avant l'ouverture du jour, rien ne part — un appel égaré ne publie pas en
  // avance. Après, la fenêtre est ouverte jusqu'à minuit à Paris.
  if (started < publishOpening(paris.date).getTime() - EARLY_TOLERANCE_MS) {
    return NextResponse.json({
      ok: true,
      skipped: `La publication du ${paris.date} n'est pas encore ouverte (16h00 à Bali).`,
    });
  }

  after(async () => {
    const report = await runScheduledPublishing({
      admin: createAdminClient(),
      // La tolérance d'avance ci-dessus : la fenêtre est vérifiée ici.
      force: true,
      deadline: started + BUDGET_MS,
    }).catch((error: unknown) => {
      console.error("[publication 16h]", error);
      return null;
    });
    if (!report) return;

    console.log(
      `[publication 16h] ${report.paris.date} — ${report.published.length} publiée(s), ` +
        `${report.drafted.length} envoyée(s) à TikTok, ${report.errors.length} échec(s), ` +
        `${report.deferred.length} au relais.`,
    );
    for (const failed of report.errors) {
      console.error(`[publication 16h] ✗ ${failed.subject}${failed.target ? ` → ${failed.target}` : ""} — ${failed.error}`);
    }

    if (report.deferred.length > 0) {
      await dispatchPublicationWorkflow().catch((error: unknown) => {
        // Sans relais, le passage du soir de GitHub reprend : en retard, mais
        // rien n'est perdu.
        console.error("[publication 16h] relais GitHub refusé :", error);
      });
    }
  });

  return NextResponse.json({ ok: true, started: paris }, { status: 202 });
}

const SUBJECT_REQUEST = z.object({ subjectId: z.uuid(), workspaceId: z.uuid() });

async function publishOneNow(
  subject: z.infer<typeof SUBJECT_REQUEST>,
  deadline: number,
): Promise<void> {
  const report = await publishSubjectNow({
    admin: createAdminClient(),
    subjectId: subject.subjectId,
    workspaceId: subject.workspaceId,
    deadline,
  }).catch((error: unknown) => {
    console.error("[publication maintenant]", error);
    return null;
  });
  if (!report) return;

  console.log(
    `[publication maintenant] ${subject.subjectId} — ${report.published.length} publiée(s), ` +
      `${report.drafted.length} envoyée(s) à TikTok, ${report.errors.length} échec(s), ` +
      `${report.deferred.length} faute de temps.`,
  );
  for (const failed of report.errors) {
    console.error(`[publication maintenant] ✗ ${failed.subject}${failed.target ? ` → ${failed.target}` : ""} — ${failed.error}`);
  }
}

export const GET = handle;
export const POST = handle;
