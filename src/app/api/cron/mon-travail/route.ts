import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { getViewer } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { monthKeyOf, todayInParis } from "@/lib/mon-travail/dates";
import { syncFathomTasks } from "@/lib/mon-travail/fathom-sync";
import {
  planCycleTasks,
  planDailyTask,
  type CycleForPlanning,
  type PlannedTask,
} from "@/lib/mon-travail/recurrence";
import type { WorkCycle, WorkCycleStep } from "@/lib/mon-travail/types";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Le passage quotidien de « Mon travail » : matérialiser les récurrences.
 *
 * Deux générations, toutes deux idempotentes par `dedupe_key` — l'insertion
 * ignore ce qui existe, y compris une occurrence déjà cochée ou supprimée :
 *
 *   • la ligne quotidienne fixe du jour, une par organisation ;
 *   • les occurrences du cycle mensuel de chaque client actif, pour le mois
 *     en cours. Rejouées chaque jour et pas seulement le 1er : un passage
 *     manqué se rattrape tout seul, et un client activé en cours de mois
 *     reçoit ses tâches dès le lendemain.
 *
 * Le passage en retard, lui, n'a pas besoin de cron : il se calcule à la
 * lecture — une tâche en attente d'avant aujourd'hui est un retard.
 */

export const dynamic = "force-dynamic";
// Quelques dizaines d'upserts : la limite Hobby est très loin.
export const maxDuration = 60;

function fromScheduler(request: Request): boolean {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;

  const provided = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(serverEnv("CRON_SECRET").CRON_SECRET);

  // Comparaison à temps constant : un `===` fuiterait, par sa durée, combien
  // de caractères de tête sont corrects.
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

/**
 * Deux entrées : l'ordonnanceur, et le propriétaire depuis son navigateur.
 *
 * La seconde existe parce que le plan Hobby n'garde les logs d'exécution
 * qu'une heure : un passage de 4 h du matin est effacé avant qu'on pense à
 * aller le lire, et le rapport que cette route construit — combien de
 * réunions, combien d'items écartés et pourquoi, quelle erreur exactement —
 * devenait invisible au moment précis où il sert. Ouvrir l'URL suffit
 * désormais à le voir, et à relancer la synchronisation sans attendre demain.
 *
 * Le passage est idempotent : le rejouer n'écrit rien de plus.
 */
async function authorized(request: Request): Promise<boolean> {
  if (fromScheduler(request)) return true;
  const viewer = await getViewer();
  return viewer?.isOwner === true;
}

export async function GET(request: Request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = todayInParis();
  const monthKey = monthKeyOf(today);

  const { data: orgRows, error: orgsError } = await admin
    .from("organizations")
    .select("id");

  /* Sans ce test, une table absente rendrait un `data` nul, donc une liste
     vide, donc un « rien à générer » parfaitement rassurant — et une page
     d'accueil sans ligne quotidienne pendant des semaines. */
  if (orgsError) {
    return NextResponse.json(
      {
        ok: false,
        error: `Lecture des organisations impossible : ${orgsError.message}. Les migrations ont-elles été appliquées ?`,
      },
      { status: 500 },
    );
  }

  const report: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const org of orgRows ?? []) {
    const planned: PlannedTask[] = [planDailyTask(org.id, today)];

    try {
      const [{ data: cycleRows, error: cyclesError }, { data: stepRows, error: stepsError }] =
        await Promise.all([
          admin.from("work_cycles").select("*").eq("org_id", org.id).eq("active", true),
          admin.from("work_cycle_steps").select("*").eq("org_id", org.id),
        ]);
      if (cyclesError) throw new Error(cyclesError.message);
      if (stepsError) throw new Error(stepsError.message);

      const cycles = (cycleRows ?? []) as unknown as WorkCycle[];
      const steps = (stepRows ?? []) as unknown as WorkCycleStep[];

      const forPlanning: CycleForPlanning[] = cycles.map((cycle) => ({
        workspace_id: cycle.workspace_id,
        steps: steps
          .filter((step) => step.cycle_id === cycle.id)
          .sort((a, b) => a.position - b.position),
      }));

      planned.push(
        ...planCycleTasks({ orgId: org.id, monthKey, cycles: forPlanning }),
      );

      const { data: inserted, error: upsertError } = await admin
        .from("work_tasks")
        .upsert(planned, {
          onConflict: "org_id,dedupe_key",
          ignoreDuplicates: true,
        })
        .select("id");
      if (upsertError) throw new Error(upsertError.message);

      report[`org:${org.id}`] = {
        planifiees: planned.length,
        creees: inserted?.length ?? 0,
      };
    } catch (error) {
      errors.push(
        `organisation ${org.id} : ${error instanceof Error ? error.message : "erreur"}`,
      );
    }

    /* Fathom dans son propre `try` : une API tierce en panne ne doit pas
       emporter les récurrences, qui, elles, ne dépendent de personne. */
    try {
      report[`fathom:${org.id}`] = await syncFathomTasks({
        admin,
        orgId: org.id,
        today,
      });
    } catch (error) {
      errors.push(
        `Fathom, organisation ${org.id} : ${error instanceof Error ? error.message : "erreur"}`,
      );
    }
  }

  /* 200 même en cas d'erreur partielle : renvoyer un 500 ferait rejouer par
     l'ordonnanceur ce qui a déjà réussi. */
  return NextResponse.json({ ok: errors.length === 0, jour: today, report, errors });
}
