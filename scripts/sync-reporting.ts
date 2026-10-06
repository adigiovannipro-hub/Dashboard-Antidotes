/**
 * Collecte du Reporting d'un espace, à la main — et relecture de ce qui est
 * écrit.
 *
 *   pnpm sync:reporting --espace andrea-de-luca [--depuis 2026-09-01]
 *   pnpm sync:reporting --espace tout
 *
 * Joue les mêmes collectes que le bouton « Synchroniser » — Meta (Instagram,
 * Page, compte publicitaire), LinkedIn, TikTok Ads, Site Web — par le code du
 * produit, puis **relit la base** mois par mois, telle que l'écran la lira.
 * C'est l'outil de la vérification en boucle : on compare cette sortie aux
 * chiffres que le réseau affiche, et on corrige jusqu'à ce qu'ils
 * concordent. Un « ✓ 54 lignes » ne dit pas si les vues sont justes.
 *
 * Étape « Collecte » de « Sondes et diagnostics » (champ `sync_linkedin`,
 * dont le nom est resté : un `workflow_dispatch` se valide contre `main`).
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

import { syncWorkspaceWebAnalytics } from "../src/lib/connectors/google-analytics/sync";
import { syncWorkspaceLinkedin } from "../src/lib/connectors/linkedin/sync";
import { syncWorkspaceReporting } from "../src/lib/connectors/meta/sync";
import { syncWorkspaceTiktokAds } from "../src/lib/connectors/tiktok-ads/sync";
import type { Database } from "../src/lib/supabase/database.types";

dotenv.config({ path: ".env.local", quiet: true });

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  const value = index === -1 ? undefined : process.argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

type Report = { account?: string; property?: string; rows: number; error: string | null; warning?: string | null };

function print(label: string, report: Report): boolean {
  const name = report.account ?? report.property ?? "?";
  if (report.error) {
    console.log(`  ✗ ${label} · ${name} — ${report.error}`);
    return false;
  }
  console.log(
    `  ✓ ${label} · ${name} — ${report.rows} ligne(s)${report.warning ? ` — ⚠ ${report.warning}` : ""}`,
  );
  return true;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");
    process.exit(1);
  }
  const admin = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const slug = argValue("espace") ?? "tout";
  const atLeastSince = argValue("depuis");

  const { data: workspaces, error } = await admin
    .from("workspaces")
    .select("id, slug, name")
    .order("slug");
  if (error) {
    console.error(`Lecture des espaces : ${error.message}`);
    process.exit(1);
  }
  const all = (workspaces ?? []) as unknown as { id: string; slug: string; name: string }[];
  const targets = slug === "tout" ? all : all.filter((w) => w.slug === slug);
  if (targets.length === 0) {
    console.error(`Espace « ${slug} » introuvable. Connus : ${all.map((w) => w.slug).join(", ")}.`);
    process.exit(1);
  }

  let echecs = 0;
  for (const workspace of targets) {
    console.log(`\n=== ${workspace.name} (${workspace.slug}) ===`);

    try {
      for (const report of await syncWorkspaceReporting({
        admin,
        workspaceId: workspace.id,
        atLeastSince,
      })) {
        if (!print(`Meta ${report.kind}`, report)) echecs += 1;
      }
    } catch (failure) {
      echecs += 1;
      console.log(`  ✗ Meta — ${(failure as Error).message}`);
    }

    for (const [label, run] of [
      ["LinkedIn", () => syncWorkspaceLinkedin({ admin, workspaceId: workspace.id, atLeastSince })],
      ["TikTok Ads", () => syncWorkspaceTiktokAds({ admin, workspaceId: workspace.id, atLeastSince })],
    ] as const) {
      try {
        const report = await run();
        if (report && !print(label, report)) echecs += 1;
      } catch (failure) {
        echecs += 1;
        console.log(`  ✗ ${label} — ${(failure as Error).message}`);
      }
    }

    try {
      for (const report of await syncWorkspaceWebAnalytics({
        admin,
        workspaceId: workspace.id,
        atLeastSince,
      })) {
        if (!print("Site Web", report)) echecs += 1;
      }
    } catch (failure) {
      echecs += 1;
      console.log(`  ✗ Site Web — ${(failure as Error).message}`);
    }

    await recap(admin, workspace.id);
  }

  if (echecs > 0) {
    console.log(`\n${echecs} collecte(s) en échec.`);
    process.exit(1);
  }
}

/** Ce que la base porte, réseau par réseau et mois par mois — trois derniers mois. */
async function recap(
  admin: ReturnType<typeof createClient<Database>>,
  workspaceId: string,
): Promise<void> {
  const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 2, 1))
    .toISOString()
    .slice(0, 10);

  const [{ data: posts }, { data: days }, { data: followers }, { data: ads }] = await Promise.all([
    admin
      .from("social_posts")
      .select("platform, published_at, impressions, reach, video_views, likes, comments, shares, saves")
      .eq("workspace_id", workspaceId)
      .gte("published_at", `${since}T00:00:00Z`),
    admin
      .from("social_page_daily")
      .select("platform, date, impressions, reach, engagements, video_views")
      .eq("workspace_id", workspaceId)
      .gte("date", since),
    admin
      .from("social_followers")
      .select("platform, date, followers_count")
      .eq("workspace_id", workspaceId)
      .gte("date", since)
      .order("date"),
    admin
      .from("ad_metrics_daily")
      .select("data_source_id, date, spend, impressions, clicks")
      .eq("workspace_id", workspaceId)
      .gte("date", since),
  ]);

  type Bloc = Record<string, number>;
  const add = (map: Map<string, Bloc>, key: string, values: Bloc) => {
    const bloc = map.get(key) ?? {};
    for (const [name, value] of Object.entries(values)) {
      bloc[name] = (bloc[name] ?? 0) + Number(value ?? 0);
    }
    map.set(key, bloc);
  };

  const parPost = new Map<string, Bloc>();
  for (const post of (posts ?? []) as unknown as Record<string, unknown>[]) {
    add(parPost, `${post.platform} ${String(post.published_at).slice(0, 7)}`, {
      publications: 1,
      vues: Number(post.impressions),
      portee: Number(post.reach),
      vuesVideo: Number(post.video_views ?? 0),
      jaime: Number(post.likes),
      commentaires: Number(post.comments),
      partages: Number(post.shares),
      enregistrements: Number(post.saves),
    });
  }
  const parJour = new Map<string, Bloc>();
  for (const day of (days ?? []) as unknown as Record<string, unknown>[]) {
    add(parJour, `${day.platform} ${String(day.date).slice(0, 7)}`, {
      jours: 1,
      vues: Number(day.impressions),
      portee: Number(day.reach),
      gestes: Number(day.engagements),
      vuesVideo3s: Number(day.video_views),
    });
  }
  const dernierAbonne = new Map<string, number>();
  for (const point of (followers ?? []) as unknown as Record<string, unknown>[]) {
    dernierAbonne.set(`${point.platform} ${String(point.date).slice(0, 7)}`, Number(point.followers_count));
  }
  const parPub = new Map<string, Bloc>();
  for (const row of (ads ?? []) as unknown as Record<string, unknown>[]) {
    add(parPub, `${String(row.data_source_id).slice(0, 8)} ${String(row.date).slice(0, 7)}`, {
      depense: Number(row.spend),
      impressions: Number(row.impressions),
      clics: Number(row.clicks),
    });
  }

  const show = (title: string, map: Map<string, Bloc>) => {
    if (map.size === 0) return;
    console.log(`  — ${title}`);
    for (const key of [...map.keys()].sort()) {
      const bloc = map.get(key)!;
      console.log(
        `    ${key} · ${Object.entries(bloc)
          .map(([name, value]) => `${name} ${Math.round(value * 100) / 100}`)
          .join(" · ")}`,
      );
    }
  };
  show("Publications parues dans le mois (base)", parPost);
  show("Statistiques de Page / de compte au grain jour (base)", parJour);
  if (dernierAbonne.size > 0) {
    console.log("  — Abonnés, dernier relevé du mois (base)");
    for (const key of [...dernierAbonne.keys()].sort()) {
      console.log(`    ${key} · ${dernierAbonne.get(key)}`);
    }
  }
  show("Publicité, par source (base)", parPub);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
