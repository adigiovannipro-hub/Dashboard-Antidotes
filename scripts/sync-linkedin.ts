/**
 * Collecte LinkedIn à la main — le rattrapage, quand on ne veut pas
 * attendre le cron.
 *
 *   pnpm sync:linkedin [--espace <slug>] [--depuis 2025-09-01]
 *
 * Sans `--espace`, tous les espaces qui ont une page LinkedIn affectée.
 * Étape du workflow « Base de données ».
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

import { syncWorkspaceLinkedin } from "../src/lib/connectors/linkedin/sync";
import type { Database } from "../src/lib/supabase/database.types";

dotenv.config({ path: ".env.local", quiet: true });

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
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

  const slug = argValue("espace");
  const atLeastSince = argValue("depuis");

  const { data: links, error } = await admin
    .from("workspace_social_accounts")
    .select("workspace_id")
    .eq("kind", "linkedin");
  if (error) {
    console.error(`Lecture des affectations : ${error.message}`);
    process.exit(1);
  }

  let ids = [
    ...new Set(((links ?? []) as { workspace_id: string }[]).map((l) => l.workspace_id)),
  ];

  if (slug) {
    const { data: workspace } = await admin
      .from("workspaces")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    const id = (workspace as { id?: string } | null)?.id;
    if (!id) {
      console.error(`Espace « ${slug} » introuvable.`);
      process.exit(1);
    }
    ids = ids.filter((candidate) => candidate === id);
    if (ids.length === 0) {
      console.error(`Aucune page LinkedIn affectée à « ${slug} ».`);
      process.exit(1);
    }
  }

  if (ids.length === 0) {
    console.log("Aucun espace n'a de page LinkedIn affectée — rien à collecter.");
    return;
  }

  console.log(`${ids.length} espace(s) à collecter.`);
  let echecs = 0;

  for (const workspaceId of ids) {
    const report = await syncWorkspaceLinkedin({ admin, workspaceId, atLeastSince });
    if (!report) continue;
    if (report.error) {
      echecs += 1;
      console.log(`  ✗ ${report.account} — ${report.error}`);
    } else {
      console.log(
        `  ✓ ${report.account} — ${report.rows} ligne(s)${report.warning ? ` — ${report.warning}` : ""}`,
      );
    }
  }

  /* La preuve, pas la promesse : ce que la base porte vraiment, mois par
     mois, tel que l'écran le lira. Un « ✓ 54 lignes » ne dit pas si août
     est là. */
  for (const workspaceId of ids) {
    const [{ data: jours }, { data: posts }, { data: abonnes }] = await Promise.all([
      admin
        .from("social_page_daily")
        .select("date, impressions, reach, clicks, likes, comments, shares, page_views, jobs_page_views")
        .eq("workspace_id", workspaceId)
        .eq("platform", "linkedin")
        .order("date"),
      admin
        .from("social_posts")
        .select("published_at, impressions, likes, thumbnail_url")
        .eq("workspace_id", workspaceId)
        .eq("platform", "linkedin"),
      admin
        .from("social_followers")
        .select("date, followers_count")
        .eq("workspace_id", workspaceId)
        .eq("platform", "linkedin")
        .order("date"),
    ]);

    const parMois = new Map<
      string,
      {
        impressions: number;
        reach: number;
        clics: number;
        gestes: number;
        vues: number;
        emplois: number;
        posts: number;
        vignettes: number;
      }
    >();
    for (const jour of jours ?? []) {
      const mois = String(jour.date).slice(0, 7);
      const bloc = parMois.get(mois) ?? {
        impressions: 0,
        reach: 0,
        clics: 0,
        gestes: 0,
        vues: 0,
        emplois: 0,
        posts: 0,
        vignettes: 0,
      };
      bloc.impressions += Number(jour.impressions);
      bloc.reach += Number(jour.reach);
      bloc.clics += Number(jour.clicks);
      bloc.gestes += Number(jour.likes) + Number(jour.comments) + Number(jour.shares);
      bloc.vues += Number(jour.page_views ?? 0);
      bloc.emplois += Number(jour.jobs_page_views ?? 0);
      parMois.set(mois, bloc);
    }
    for (const post of posts ?? []) {
      const mois = String(post.published_at).slice(0, 7);
      const bloc = parMois.get(mois);
      if (bloc) {
        bloc.posts += 1;
        if (post.thumbnail_url) bloc.vignettes += 1;
      }
    }

    console.log("");
    console.log("  Ce que la base porte, mois par mois :");
    for (const [mois, bloc] of [...parMois].sort()) {
      console.log(
        `    ${mois} — ${bloc.impressions} impressions, ${bloc.reach} portée, ${bloc.clics} clics, ${bloc.gestes} interactions, ${bloc.vues} vues de page (dont ${bloc.emplois} emplois), ${bloc.posts} publication(s) dont ${bloc.vignettes} avec vignette`,
      );
    }
    const courbe = (abonnes ?? []).map((point) => `${point.date}=${point.followers_count}`);
    console.log(`  Abonnés (${courbe.length} points) : ${courbe.join(" ")}`);
  }

  /* Un échec doit faire rougir le job : un passage qui n'a rien collecté et
     finit vert, c'est une perte silencieuse — la leçon de l'import des
     abonnés, qui avait jeté les trois quarts des données sans broncher. */
  if (echecs > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
