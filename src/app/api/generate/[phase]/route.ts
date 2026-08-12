import { NextResponse, after } from "next/server";
import { z } from "zod";

import { getViewer } from "@/lib/auth";
import { toJobPayload } from "@/lib/production/card-model";
import { runGenerationJob } from "@/lib/production/generate";
import { isProductionPhase, type GenerationJob } from "@/lib/production/types";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Lancement d'une action IA du cycle de production.
 *
 * Le flux du cahier des charges : la route crée un `generation_job` en
 * `pending`, répond immédiatement avec son id, et le traitement part en
 * arrière-plan — `after()` garde la fonction en vie après la réponse, ce qui
 * évite un second créneau cron sur un plan qui n'en a plus qu'un. La carte
 * suit ensuite l'avancement par `/api/jobs/[id]`.
 */

export const dynamic = "force-dynamic";
// Le wording enchaîne un appel par sujet : la fonction doit survivre au-delà
// de la réponse. Même plafond, même incertitude Hobby que le cron des Reçus.
export const maxDuration = 300;

const BodySchema = z.object({
  workspace_id: z.uuid(),
  target_month: z
    .string()
    .regex(/^\d{4}-\d{2}-01$/, "Premier jour du mois attendu."),
});

/** Un job silencieux depuis dix minutes est considéré mort, pas actif. */
const STALE_AFTER_MS = 10 * 60 * 1000;

/**
 * Nommer la cause plutôt que de renvoyer « impossible ».
 *
 * Le cas de très loin le plus fréquent au démarrage du module est la table
 * absente : les migrations s'appliquent à la main, et rien ne les applique au
 * déploiement. Le dire économise une demi-heure de recherche.
 */
function describeReadFailure(
  error: { code?: string; message?: string } | null,
): string {
  const missing =
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    /does not exist|schema cache/i.test(error?.message ?? "");
  return missing
    ? "Les tables du module ne sont pas en base : appliquer les migrations 0032 et 0033."
    : "Lecture des jobs impossible.";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ phase: string }> },
) {
  // Contrôle d'accès d'abord : module interne, 404 et jamais 403.
  const viewer = await getViewer();
  if (!viewer?.isOwner) return new NextResponse(null, { status: 404 });

  const { phase } = await params;
  if (!isProductionPhase(phase)) return new NextResponse(null, { status: 404 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Requête invalide." },
      { status: 400 },
    );
  }

  const workspace = viewer.workspaces.find(
    (candidate) =>
      candidate.id === parsed.data.workspace_id &&
      candidate.role === "owner" &&
      candidate.type === "client",
  );
  if (!workspace) return new NextResponse(null, { status: 404 });

  const supabase = createAdminClient();

  // Un seul job à la fois par espace. Un job resté « actif » sans battement
  // depuis dix minutes a été coupé en vol : il est soldé en erreur plutôt que
  // de bloquer le bouton pour toujours.
  const { data: activeRows, error: activeError } = await supabase
    .from("generation_jobs")
    .select("id, status, updated_at")
    .eq("workspace_id", workspace.id)
    .in("status", ["pending", "running"])
    .limit(5);
  if (activeError) {
    return NextResponse.json(
      { ok: false, error: describeReadFailure(activeError) },
      { status: 500 },
    );
  }

  for (const active of activeRows ?? []) {
    const fresh =
      Date.now() - new Date(active.updated_at as string).getTime() < STALE_AFTER_MS;
    if (fresh) {
      return NextResponse.json(
        { ok: false, error: "Une génération est déjà en cours pour cet espace." },
        { status: 409 },
      );
    }
    await supabase
      .from("generation_jobs")
      .update({
        status: "error",
        error_message: "Interrompu sans verdict — relancé depuis la carte.",
        finished_at: new Date().toISOString(),
      } as never)
      .eq("id", active.id);
  }

  const { data: created, error: createError } = await supabase
    .from("generation_jobs")
    .insert({
      org_id: workspace.org_id,
      workspace_id: workspace.id,
      phase,
      target_month: parsed.data.target_month,
    } as never)
    .select("*")
    .single();
  if (createError || !created) {
    return NextResponse.json(
      { ok: false, error: describeReadFailure(createError) },
      { status: 500 },
    );
  }

  const job = created as unknown as GenerationJob;
  after(() => runGenerationJob(job.id));

  return NextResponse.json({ ok: true, job: toJobPayload(job) });
}
