import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { SocialAccountRow } from "@/lib/social/types";
import type { Database } from "@/lib/supabase/database.types";
import { explainLinkedinError } from "./errors";
import {
  dailyFromShareStats,
  followerGains,
  followersHistory,
  pagesFromOrganizations,
  permalinkOf,
  postsFromRest,
  statsByPost,
} from "./mapping";
import {
  fetchFollowersCount,
  findLinkedinAccount,
  linkedinRest,
  timeInterval,
} from "./rest";
import type { LinkedinPage, LinkedinPost, LinkedinTransport } from "./types";

/**
 * Collecte LinkedIn organique d'un espace.
 *
 * Le chemin est celui de tout le projet : service → base → lecture locale,
 * et LinkedIn se range dans les **mêmes tables** qu'Instagram et Facebook —
 * `social_posts`, `social_page_daily`, `social_followers`. Quatre lectures,
 * toutes sondées sur pièce le 2 septembre 2026 :
 *
 *   • les statistiques de la page au grain jour ;
 *   • la liste des publications ;
 *   • les statistiques par publication, par lots ;
 *   • les gains d'abonnés mensuels, qui **reconstruisent** la courbe.
 *
 * Règle des crons appliquée partout : chaque `error` Supabase est testé.
 */

type Admin = SupabaseClient<Database>;

export type LinkedinSyncReport = {
  account: string;
  rows: number;
  error: string | null;
  warning?: string | null;
};

/** Le rattrapage du premier passage : un an, ce que LinkedIn garde au jour. */
const PREMIER_PASSAGE_JOURS = 365;

/** Les passages suivants : de quoi rattraper une semaine de trous. */
const PASSAGE_COURANT_JOURS = 35;

/**
 * Les publications lues par appel, et les statistiques demandées par lot.
 *
 * Vingt : au-delà, l'URL d'un `List(...)` de vingt URN dépasse ce que
 * LinkedIn accepte sur une requête GET.
 */
const LOT_STATISTIQUES = 20;

function fail(message: string): never {
  throw new Error(message);
}

/**
 * La date d'un relevé d'abonnés : **la veille du passage**.
 *
 * Même règle que Meta, et pour la même raison : ce qu'on lit le matin du
 * 1er est le chiffre au sortir du 31. Daté du jour du passage, il tomberait
 * dans le mois suivant et la courbe prendrait un mois d'avance.
 */
function closingDate(now: Date): string {
  return new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
}

function daysBefore(now: Date, days: number): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
}

const entityUrn = (id: string) => `urn:li:organization:${id}`;
const encoded = (id: string) => encodeURIComponent(entityUrn(id));

/**
 * Les pages entreprise que le compte connecté administre.
 *
 * Rang par rang, et non `count: 100` : la passerelle **résout** une seule
 * organisation par appel et rend sa fiche, si bien qu'une demande de cent
 * pages en rendait une. Six pages sortaient comme une seule.
 */
export async function fetchLinkedinPages(
  rest: LinkedinTransport,
): Promise<LinkedinPage[]> {
  const pages: LinkedinPage[] = [];
  const seen = new Set<string>();

  for (let start = 0; start < 50; start += 1) {
    let payload: unknown;
    try {
      payload = await rest(
        `/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&count=1&start=${start}&projection=(elements*(organization~(id,localizedName,vanityName)))`,
        { version: null },
      );
    } catch (error) {
      if (start === 0) throw error;
      break;
    }

    const fresh = pagesFromOrganizations(payload).filter((page) => !seen.has(page.id));
    if (fresh.length === 0) break;
    for (const page of fresh) {
      seen.add(page.id);
      pages.push(page);
    }
  }

  return pages;
}

/**
 * L'inventaire de l'agence, mis à jour depuis LinkedIn.
 *
 * Rien n'est affecté au passage : « Lunettes BONDET » a beau ressembler à
 * l'espace Bondet, l'affectation reste un geste explicite dans Connexions —
 * même règle que Meta.
 */
export async function importLinkedinInventory(options: {
  admin: Admin;
  orgId: string;
  workspaceId: string;
  connectedBy: string | null;
}): Promise<{ pages: number } | { error: string }> {
  const account = await findLinkedinAccount(options.workspaceId);
  if ("error" in account) return { error: account.error };

  let pages: LinkedinPage[];
  try {
    pages = await fetchLinkedinPages(linkedinRest(account.id));
  } catch (error) {
    return { error: explainLinkedinError((error as Error).message) };
  }

  if (pages.length === 0) {
    return {
      error:
        "Le compte LinkedIn connecté n'administre aucune page entreprise. Se faire ajouter comme administrateur sur la page du client, puis relancer.",
    };
  }

  const now = new Date().toISOString();
  const { error } = await options.admin.from("social_accounts").upsert(
    pages.map((page) => ({
      org_id: options.orgId,
      kind: "linkedin",
      external_id: page.id,
      username: page.vanityName,
      display_name: page.name,
      status: "connected",
      last_error: null,
      connected_by: options.connectedBy,
      updated_at: now,
    })) as never,
    { onConflict: "org_id,kind,external_id" },
  );
  if (error) return { error: `Inventaire LinkedIn : ${error.message}` };

  return { pages: pages.length };
}

/** La collecte d'un espace. `null` si aucune page LinkedIn n'y est affectée. */
export async function syncWorkspaceLinkedin(options: {
  admin: Admin;
  workspaceId: string;
  now?: Date;
  /** Borne basse demandée par l'écran — étend la fenêtre, jamais ne la réduit. */
  atLeastSince?: string;
}): Promise<LinkedinSyncReport | null> {
  const { admin, workspaceId } = options;
  const now = options.now ?? new Date();

  const { data: link, error: linkError } = await admin
    .from("workspace_social_accounts")
    .select("account_id")
    .eq("workspace_id", workspaceId)
    .eq("kind", "linkedin")
    .maybeSingle();
  if (linkError) fail(`Lecture de l'affectation LinkedIn : ${linkError.message}`);

  const accountId = (link as { account_id?: string } | null)?.account_id;
  if (!accountId) return null;

  const report: LinkedinSyncReport = { account: accountId, rows: 0, error: null };

  try {
    const { data: row, error: accountError } = await admin
      .from("social_accounts")
      .select("*")
      .eq("id", accountId)
      .single();
    if (accountError) fail(`Compte introuvable : ${accountError.message}`);

    const account = row as unknown as SocialAccountRow;
    report.account = account.display_name ?? account.external_id;

    const connected = await findLinkedinAccount(workspaceId);
    if ("error" in connected) fail(connected.error);
    const rest = linkedinRest(connected.id);

    const { data: source, error: sourceError } = await admin
      .from("data_sources")
      .upsert(
        {
          workspace_id: workspaceId,
          provider: "linkedin_organic",
          external_account_id: account.external_id,
          display_name: report.account,
          status: "connected",
        } as never,
        { onConflict: "workspace_id,provider,external_account_id" },
      )
      .select("id, last_sync_at")
      .single();
    if (sourceError) fail(`Source de données : ${sourceError.message}`);
    const { id: dataSourceId, last_sync_at } = source as unknown as {
      id: string;
      last_sync_at: string | null;
    };

    /* Un an au premier passage — c'est ce que LinkedIn garde au grain jour —
       puis 35 jours glissants. Une borne demandée par l'écran étend la
       fenêtre sans jamais la raccourcir. */
    const since = [
      daysBefore(now, last_sync_at ? PASSAGE_COURANT_JOURS : PREMIER_PASSAGE_JOURS),
      options.atLeastSince,
    ]
      .filter((value): value is string => Boolean(value))
      .sort()[0]!;
    const until = closingDate(now);

    const { data: run, error: runError } = await admin
      .from("sync_runs")
      .insert({
        data_source_id: dataSourceId,
        workspace_id: workspaceId,
        status: "running",
        date_from: since,
        date_to: until,
      } as never)
      .select("id")
      .single();
    if (runError) fail(`Journal de passage : ${runError.message}`);
    const runId = (run as unknown as { id: string }).id;

    try {
      const warning = await collect({
        admin,
        rest,
        connectedAccountId: connected.id,
        workspaceId,
        dataSourceId,
        account,
        since,
        until,
        report,
      });
      report.warning = warning;

      const stamp = new Date().toISOString();
      const { error: doneError } = await admin
        .from("sync_runs")
        .update({
          status: "success",
          finished_at: stamp,
          rows_ingested: report.rows,
          error: warning,
        } as never)
        .eq("id", runId);
      if (doneError) fail(`Clôture du passage : ${doneError.message}`);

      const { error: sourceDone } = await admin
        .from("data_sources")
        .update({ status: "connected", last_sync_at: stamp, last_error: warning } as never)
        .eq("id", dataSourceId);
      if (sourceDone) fail(`Mise à jour de la source : ${sourceDone.message}`);
    } catch (error) {
      const message = explainLinkedinError((error as Error).message);
      await admin
        .from("sync_runs")
        .update({
          status: "error",
          finished_at: new Date().toISOString(),
          rows_ingested: report.rows,
          error: message,
        } as never)
        .eq("id", runId);
      await admin
        .from("data_sources")
        .update({ status: "error", last_error: message } as never)
        .eq("id", dataSourceId);
      throw error;
    }
  } catch (error) {
    report.error = explainLinkedinError((error as Error).message);
  }

  return report;
}

async function collect(context: {
  admin: Admin;
  rest: LinkedinTransport;
  connectedAccountId: string;
  workspaceId: string;
  dataSourceId: string;
  account: SocialAccountRow;
  since: string;
  until: string;
  report: LinkedinSyncReport;
}): Promise<string | null> {
  const { admin, rest, workspaceId, dataSourceId, account, since, until, report } =
    context;
  const org = account.external_id;
  const stamp = new Date().toISOString();
  const warnings: string[] = [];

  // --- La page, jour par jour --------------------------------------------
  /* `/v2` et non `/rest` : les deux servent la même chose, et la v2 n'a pas
     d'en-tête de version — elle survit aux péremptions annuelles de
     LinkedIn, qui tuent une route `/rest` sans prévenir. */
  const daily = dailyFromShareStats(
    await rest(
      `/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encoded(org)}&timeIntervals=${timeInterval(since, until, "DAY")}&count=400`,
      { version: null },
    ),
  );

  if (daily.length > 0) {
    const { error } = await admin.from("social_page_daily").upsert(
      daily.map((day) => ({
        data_source_id: dataSourceId,
        workspace_id: workspaceId,
        platform: "linkedin",
        date: day.date,
        impressions: day.impressions,
        reach: day.reach,
        clicks: day.clicks,
        likes: day.likes,
        comments: day.comments,
        shares: day.shares,
        // Ce que Meta appelle `page_post_engagements` : la somme des gestes.
        engagements: day.likes + day.comments + day.shares + day.clicks,
        updated_at: stamp,
      })) as never,
      { onConflict: "data_source_id,platform,date" },
    );
    if (error) fail(`Statistiques de page : ${error.message}`);
    report.rows += daily.length;
  }

  // --- Les publications ---------------------------------------------------
  try {
    const posts = await fetchPosts({ rest, org, since });
    if (posts.length > 0) {
      const stats = await fetchPostStats({ rest, org, urns: posts.map((p) => p.urn) });
      const rows = posts.map((post) => {
        const measure = stats.get(post.urn);
        return {
          data_source_id: dataSourceId,
          workspace_id: workspaceId,
          platform: "linkedin",
          external_id: post.urn,
          published_at: post.publishedAt,
          caption: post.commentary,
          permalink: permalinkOf(post.urn),
          media_kind: post.mediaKind,
          impressions: measure?.impressions ?? 0,
          reach: measure?.reach ?? 0,
          clicks: measure?.clicks ?? 0,
          likes: measure?.likes ?? 0,
          comments: measure?.comments ?? 0,
          shares: measure?.shares ?? 0,
          // LinkedIn n'a pas d'enregistrement : la colonne reste à zéro.
          saves: 0,
          updated_at: stamp,
        };
      });

      const { error } = await admin
        .from("social_posts")
        .upsert(rows as never, { onConflict: "data_source_id,external_id" });
      if (error) fail(`Publications : ${error.message}`);
      report.rows += rows.length;
    }
  } catch (error) {
    /* Un refus sur les publications ne doit pas priver le client de ses
       chiffres de page ni de sa courbe : il devient un avertissement. */
    warnings.push(
      `Publications non lues : ${explainLinkedinError((error as Error).message)}`,
    );
  }

  // --- Les abonnés --------------------------------------------------------
  const followers = await fetchFollowersCount({
    connectedAccountId: context.connectedAccountId,
    organizationId: org,
  });

  if (followers !== null) {
    const points = [{ date: until, followers }];

    /* L'antériorité, reconstruite depuis les gains mensuels : treize mois de
       courbe dès le premier passage, là où Meta repart de zéro. Un refus ici
       ne coûte que l'historique — le point du jour est déjà acquis. */
    try {
      const gains = followerGains(
        await rest(
          `/v2/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${encoded(org)}&timeIntervals=${timeInterval(since, until, "MONTH")}&count=50`,
          { version: null },
        ),
      );
      points.push(
        ...followersHistory(gains, followers).map((point) => ({
          date: point.date,
          followers: point.followers,
        })),
      );
    } catch (error) {
      warnings.push(
        `Antériorité des abonnés non lue : ${explainLinkedinError((error as Error).message)}`,
      );
    }

    const { error } = await admin.from("social_followers").upsert(
      points.map((point) => ({
        data_source_id: dataSourceId,
        workspace_id: workspaceId,
        platform: "linkedin",
        date: point.date,
        followers_count: point.followers,
        source: "api",
        updated_at: stamp,
      })) as never,
      { onConflict: "data_source_id,platform,date" },
    );
    if (error) fail(`Abonnés : ${error.message}`);
    report.rows += points.length;

    const { error: vitrineError } = await admin
      .from("social_accounts")
      .update({ followers_count: followers, last_synced_at: stamp } as never)
      .eq("id", account.id);
    if (vitrineError) fail(`Vitrine du compte : ${vitrineError.message}`);
  }

  return warnings.length > 0 ? warnings.join(" — ") : null;
}

/** Les publications parues depuis `since`, page par page. */
async function fetchPosts(options: {
  rest: LinkedinTransport;
  org: string;
  since: string;
}): Promise<LinkedinPost[]> {
  const borne = `${options.since}T00:00:00.000Z`;
  const posts: LinkedinPost[] = [];

  /* `/rest/posts` est la seule route qui liste les publications d'une page,
     et elle exige un en-tête de version. Elle est triée du plus récent au
     plus ancien : on s'arrête dès qu'on passe sous la borne, plutôt que de
     dérouler les 627 publications d'ANMF à chaque passage. */
  for (let start = 0; start < 500; start += 50) {
    const payload = await options.rest(
      `/rest/posts?q=author&author=${encoded(options.org)}&count=50&start=${start}&sortBy=LAST_MODIFIED`,
    );
    const page = postsFromRest(payload);
    if (page.length === 0) break;

    posts.push(...page.filter((post) => post.publishedAt >= borne));
    if (page.some((post) => post.publishedAt < borne)) break;
  }

  return posts;
}

/**
 * Les statistiques de chaque publication, par lots.
 *
 * **Deux paramètres, pas un.** LinkedIn mêle deux types d'URN dans le même
 * fil : `urn:li:ugcPost:` pour ce qui est publié par l'API, `urn:li:share:`
 * pour ce qui l'est autrement — et chacun a son paramètre. Passer un
 * `share` dans `ugcPosts` fait échouer **le lot entier** en 400, ce qui
 * privait de statistiques des publications parfaitement lisibles (vécu au
 * premier passage réel sur ANMF). On trie donc avant d'appeler.
 */
async function fetchPostStats(options: {
  rest: LinkedinTransport;
  org: string;
  urns: readonly string[];
}) {
  const stats = new Map<string, ReturnType<typeof statsByPost> extends Map<string, infer V> ? V : never>();

  const familles: [string, string[]][] = [
    ["ugcPosts", options.urns.filter((urn) => urn.startsWith("urn:li:ugcPost:"))],
    ["shares", options.urns.filter((urn) => urn.startsWith("urn:li:share:"))],
  ];

  for (const [parametre, urns] of familles) {
    for (let index = 0; index < urns.length; index += LOT_STATISTIQUES) {
      const lot = urns.slice(index, index + LOT_STATISTIQUES);
      const liste = lot.map((urn) => encodeURIComponent(urn)).join(",");
      const payload = await options.rest(
        `/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encoded(options.org)}&${parametre}=List(${liste})`,
      );
      for (const [urn, mesure] of statsByPost(payload)) stats.set(urn, mesure);
    }
  }

  return stats;
}
