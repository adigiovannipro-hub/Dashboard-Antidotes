/**
 * Une phase du cycle de production, lancée depuis une machine GitHub.
 *
 *   pnpm production:generer --espace bondet                       — intentions du mois prochain
 *   pnpm production:generer --espace bondet --mois 2026-10        — d'un mois donné
 *   pnpm production:generer --espace bondet --remplacer           — en refaisant les intentions posées
 *   pnpm production:generer --espace bondet --phase wording
 *
 * Le même chemin que le bouton de la carte — un `generation_job` puis
 * `runGenerationJob` — sans passer par la route : elle vit sur Vercel, et
 * certains environnements de travail ne l'atteignent pas. Étape « Générer une
 * phase de production » de db-admin, où `ANTHROPIC_API_KEY` existe.
 *
 * `--remplacer` (intentions seulement) met à la corbeille, avant de générer,
 * les sujets du mois encore au stade d'intention : statut « — » ou « WORDING À
 * FAIRE », sans visuel. Tout le reste — rédigé, validé, illustré — reste et
 * compte dans le décompte du contrat. Si la génération échoue, les sujets mis
 * à la corbeille en ressortent : un mois ne se vide jamais pour rien.
 *
 * Variables requises : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY.
 */
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ANTHROPIC_API_KEY",
] as const;

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value.trim() : undefined;
}

/** `AAAA-MM` ou `AAAA-MM-JJ` → premier du mois ; rien → le mois prochain (UTC). */
function targetMonth(raw: string | undefined): string | null {
  if (!raw) {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return next.toISOString().slice(0, 10);
  }
  const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(raw);
  return match ? `${match[1]}-${match[2]}-01` : null;
}

async function main() {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    console.error(`Variables absentes : ${missing.join(", ")}.`);
    process.exit(1);
  }

  const slug = argument("--espace");
  const phase = argument("--phase") ?? "intentions";
  const month = targetMonth(argument("--mois"));
  const replace = process.argv.includes("--remplacer");

  const { createAdminClient } = await import("../src/lib/supabase/server");
  const { runGenerationJob } = await import("../src/lib/production/generate");
  const { isProductionPhase } = await import("../src/lib/production/types");
  const { WORDING_PENDING_STATUSES } = await import("../src/lib/production/wording-state");

  if (!slug) {
    console.error("Préciser l'espace : --espace <slug>.");
    process.exit(1);
  }
  if (!isProductionPhase(phase)) {
    console.error(`Phase inconnue : « ${phase} ».`);
    process.exit(1);
  }
  if (!month) {
    console.error("Mois illisible : --mois AAAA-MM.");
    process.exit(1);
  }
  if (replace && phase !== "intentions") {
    console.error("--remplacer ne vaut que pour la phase intentions.");
    process.exit(1);
  }

  const admin = createAdminClient();

  const { data: workspace, error: workspaceError } = await admin
    .from("workspaces")
    .select("id, org_id, name, type")
    .eq("slug", slug)
    .maybeSingle();
  if (workspaceError) throw new Error(workspaceError.message);
  if (!workspace || workspace.type !== "client") {
    console.error(`Aucun espace client « ${slug} ».`);
    process.exit(1);
  }

  const { data: active, error: activeError } = await admin
    .from("generation_jobs")
    .select("id")
    .eq("workspace_id", workspace.id)
    .in("status", ["pending", "running"])
    .gte("updated_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .limit(1);
  if (activeError) throw new Error(activeError.message);
  if ((active ?? []).length > 0) {
    console.error("Une génération est déjà en cours pour cet espace.");
    process.exit(1);
  }

  console.log(`${workspace.name} · ${phase} · ${month}`);

  // --- Les intentions à refaire, mises à la corbeille -----------------------
  let trashed: string[] = [];
  if (replace) {
    const { data: board, error: boardError } = await admin
      .from("planning_boards")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("kind", "editorial")
      .order("position")
      .limit(1)
      .maybeSingle();
    if (boardError) throw new Error(boardError.message);
    if (!board) {
      console.error("Aucun planning éditorial pour cet espace.");
      process.exit(1);
    }

    const { data: months, error: monthsError } = await admin
      .from("planning_months")
      .select("id")
      .eq("board_id", board.id)
      .eq("month", month)
      .is("deleted_at", null);
    if (monthsError) throw new Error(monthsError.message);

    const monthIds = (months ?? []).map((row) => row.id as string);
    if (monthIds.length > 0) {
      const { data: subjects, error: subjectsError } = await admin
        .from("planning_subjects")
        .select("id, name, status, visual_urls")
        .in("month_id", monthIds)
        .is("deleted_at", null)
        .is("archived_at", null);
      if (subjectsError) throw new Error(subjectsError.message);

      const rows = (subjects ?? []) as unknown as {
        id: string;
        name: string;
        status: string;
        visual_urls: string[] | null;
      }[];
      const intentions = rows.filter(
        (row) =>
          (WORDING_PENDING_STATUSES as string[]).includes(row.status) &&
          (row.visual_urls ?? []).length === 0,
      );
      const kept = rows.length - intentions.length;

      if (intentions.length > 0) {
        const { error: trashError } = await admin
          .from("planning_subjects")
          .update({ deleted_at: new Date().toISOString() } as never)
          .in(
            "id",
            intentions.map((row) => row.id),
          );
        if (trashError) throw new Error(trashError.message);
        trashed = intentions.map((row) => row.id);
      }
      console.log(
        `Corbeille : ${intentions.length} intention${intentions.length > 1 ? "s" : ""}` +
          (intentions.length > 0 ? ` (${intentions.map((row) => row.name).join(", ")})` : "") +
          `. Gardés : ${kept}.`,
      );
    }
  }

  const restore = async () => {
    if (trashed.length === 0) return;
    const { error } = await admin
      .from("planning_subjects")
      .update({ deleted_at: null } as never)
      .in("id", trashed);
    console.log(
      error
        ? `Restauration impossible (${error.message}) : les sujets sont dans la corbeille du tableau.`
        : `Les ${trashed.length} sujets mis à la corbeille ont été restaurés.`,
    );
  };

  // --- Le job, par le même chemin que la carte -------------------------------
  const { data: created, error: createError } = await admin
    .from("generation_jobs")
    .insert({
      org_id: workspace.org_id,
      workspace_id: workspace.id,
      phase,
      target_month: month,
    } as never)
    .select("id")
    .single();
  if (createError || !created) {
    await restore();
    throw new Error(createError?.message ?? "Job non créé.");
  }

  const jobId = (created as { id: string }).id;
  const started = Date.now();
  await runGenerationJob(jobId);

  const { data: job, error: jobError } = await admin
    .from("generation_jobs")
    .select("status, result, error_message")
    .eq("id", jobId)
    .single();
  if (jobError) throw new Error(jobError.message);

  const outcome = job as unknown as {
    status: string;
    result: { summary?: string; created_subject_ids?: string[] } | null;
    error_message: string | null;
  };
  console.log(
    `Job ${jobId} : ${outcome.status} en ${Math.round((Date.now() - started) / 1000)} s — ` +
      (outcome.result?.summary ?? outcome.error_message ?? "sans compte rendu"),
  );

  const ids = outcome.result?.created_subject_ids ?? [];
  if (outcome.status === "error" || (replace && ids.length === 0)) {
    await restore();
    process.exit(outcome.status === "error" ? 1 : 0);
  }

  // Ce qui a été posé, relu en base : « ✓ » ne dit pas ce que le modèle a écrit.
  if (ids.length > 0) {
    const { data: posted, error: postedError } = await admin
      .from("planning_subjects")
      .select("name, format, scheduled_on, wording")
      .in("id", ids)
      .order("scheduled_on");
    if (postedError) throw new Error(postedError.message);
    for (const row of (posted ?? []) as unknown as {
      name: string;
      format: string;
      scheduled_on: string | null;
      wording: string | null;
    }[]) {
      console.log(`\n— ${row.scheduled_on ?? "sans date"} · ${row.format} · ${row.name}`);
      console.log(row.wording ?? "(brief vide)");
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
