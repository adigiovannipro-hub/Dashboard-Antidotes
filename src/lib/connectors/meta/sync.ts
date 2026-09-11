import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptSecret } from "@/lib/moderation/crypto";
import {
  fetchInstagramProfile,
  fetchPagePicture,
  MetaError,
} from "@/lib/social/meta";
import type { SocialAccountKind, SocialAccountRow } from "@/lib/social/types";
import type { Database } from "@/lib/supabase/database.types";
import {
  fetchAdBreakdowns,
  fetchAdInsights,
  fetchFollowersCount,
  fetchInstagramMedia,
  fetchPageAccessToken,
  fetchPagePosts,
  fetchPageInsights,
} from "./graph";
import { explainMetaError } from "./errors";
import { customEvents } from "./mapping";
import { collectByChunks } from "./windows";
import {
  aggregateBreakdown,
  syncWindow,
  toDailyMetricsColumns,
  type MetaInsightRow,
} from "./mapping";
import {
  mediaToPost,
  PAGE_DAILY_METRICS,
  pageInsightsToDaily,
  pagePostToPost,
  type OrganicPostColumns,
} from "./organic";

/**
 * Orchestration de la synchronisation Meta d'un espace.
 *
 * Le chemin est celui de tout le projet : régie → base → lecture locale.
 * Chaque compte affecté dans Connexions devient une `data_source`, chaque
 * passage un `sync_run`, et toutes les écritures sont des upserts par
 * identifiant externe — rejouer un passage ne duplique rien.
 *
 * Règle des crons appliquée partout : **chaque `error` Supabase est testé**.
 * Une table absente rendrait un « rien à faire » parfaitement rassurant, et
 * un connecteur muet pendant des semaines.
 */

type Admin = SupabaseClient<Database>;

export type SourceSyncReport = {
  kind: SocialAccountKind;
  account: string;
  rows: number;
  /** Le passage a échoué : rien n'est entré pour cette source. */
  error: string | null;
  /** Le passage a abouti, mais une partie manque — permission refusée. */
  warning?: string | null;
};

type SourceContext = {
  admin: Admin;
  workspaceId: string;
  dataSourceId: string;
  accessToken: string;
  window: { since: string; until: string };
};

function fail(message: string): never {
  throw new Error(message);
}

/** Aujourd'hui en UTC — le grain de tous les instantanés d'abonnés. */
/**
 * La date d'un relevé d'abonnés : **la veille du passage**.
 *
 * Le cron lit le compte à 5 h UTC. Ce qu'il lit, c'est le nombre d'abonnés
 * tel qu'il est au sortir de la veille — le relevé du 1er septembre est le
 * point de clôture du 31 août. Daté du jour du passage, il tombait sous
 * « septembre » et chaque courbe avait un mois d'avance : le reporting
 * d'août ne portait pas son propre chiffre. Migration 0067 pour l'existant.
 */
function closingDate(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

/** `since` au format que Graph accepte partout : secondes Unix. */
function unixSince(date: string): string {
  return String(Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000));
}

export async function syncWorkspaceReporting(options: {
  admin: Admin;
  workspaceId: string;
  /** Borne basse demandée par l'écran — étend la fenêtre, jamais ne la
      raccourcit. C'est ce qui permet à une plage ancienne du sélecteur de
      déclencher le rattrapage qui la couvrira. */
  atLeastSince?: string;
}): Promise<SourceSyncReport[]> {
  const { admin, workspaceId } = options;
  const reports: SourceSyncReport[] = [];

  const { data: links, error: linksError } = await admin
    .from("workspace_social_accounts")
    .select("kind, account_id")
    .eq("workspace_id", workspaceId)
    .in("kind", ["meta_ad_account", "instagram", "facebook_page"]);

  if (linksError) fail(`Lecture des affectations : ${linksError.message}`);

  for (const link of (links ?? []) as { kind: SocialAccountKind; account_id: string }[]) {
    const report: SourceSyncReport = {
      kind: link.kind,
      account: link.account_id,
      rows: 0,
      error: null,
    };
    reports.push(report);

    try {
      const { data: account, error: accountError } = await admin
        .from("social_accounts")
        .select("*")
        .eq("id", link.account_id)
        .single();
      if (accountError) fail(`Compte introuvable : ${accountError.message}`);

      const row = account as unknown as SocialAccountRow;
      report.account = row.display_name ?? row.username ?? row.external_id;

      const { data: secret, error: secretError } = await admin
        .from("social_account_secrets")
        .select("credentials_encrypted")
        .eq("account_id", link.account_id)
        .maybeSingle();
      if (secretError) fail(`Lecture du jeton : ${secretError.message}`);
      const blob = (secret as { credentials_encrypted?: string } | null)
        ?.credentials_encrypted;
      if (!blob) fail("Aucun jeton enregistré — rebrancher Meta depuis Connexions.");

      const accessToken = decryptSecret(blob);

      // Une source par (espace, fournisseur, compte externe) — la clé
      // d'unicité de 0001. L'upsert rend la ligne, ancienne ou neuve.
      const provider = link.kind === "meta_ad_account" ? "meta_ads" : "meta_organic";
      const { data: source, error: sourceError } = await admin
        .from("data_sources")
        .upsert(
          {
            workspace_id: workspaceId,
            provider,
            external_account_id: row.external_id,
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

      const window = syncWindow({
        lastSyncAt: last_sync_at,
        now: new Date(),
        atLeastSince: options.atLeastSince,
      });

      /* Le rattrapage initial se trace une fois : `backfill_from` garde la
         date atteinte, et `last_sync_at` fait que les passages suivants se
         contentent des 35 jours glissants. Sans cette trace, on ne saurait
         plus jusqu'où l'historique est fiable. */
      if (!last_sync_at) {
        const { error: backfillError } = await admin
          .from("data_sources")
          .update({ backfill_from: window.since } as never)
          .eq("id", dataSourceId);
        if (backfillError) fail(`Trace du rattrapage : ${backfillError.message}`);
      }

      const { data: run, error: runError } = await admin
        .from("sync_runs")
        .insert({
          data_source_id: dataSourceId,
          workspace_id: workspaceId,
          status: "running",
          date_from: window.since,
          date_to: window.until,
        } as never)
        .select("id")
        .single();
      if (runError) fail(`Journal de passage : ${runError.message}`);
      const runId = (run as unknown as { id: string }).id;

      const context: SourceContext = {
        admin,
        workspaceId,
        dataSourceId,
        accessToken,
        window,
      };

      try {
        let warning: string | null = null;
        if (link.kind === "meta_ad_account") {
          const outcome = await syncAds(context, row.external_id);
          report.rows = outcome.rows;
          warning = outcome.warning;
        } else {
          const outcome = await syncOrganic(context, row);
          report.rows = outcome.rows;
          warning = outcome.warning;
        }
        report.warning = warning;

        const now = new Date().toISOString();
        const { error: doneError } = await admin
          .from("sync_runs")
          .update({
            status: "success",
            finished_at: now,
            rows_ingested: report.rows,
            // Le passage a abouti — l'avertissement dit ce qui manquait.
            error: warning,
          } as never)
          .eq("id", runId);
        if (doneError) fail(`Clôture du passage : ${doneError.message}`);

        const { error: sourceDone } = await admin
          .from("data_sources")
          .update({
            status: "connected",
            last_sync_at: now,
            last_error: warning,
          } as never)
          .eq("id", dataSourceId);
        if (sourceDone) fail(`Mise à jour de la source : ${sourceDone.message}`);
      } catch (error) {
        // Le passage échoue mais reste tracé : le `sync_run` porte la cause,
        // la source aussi — c'est ce que l'écran lira pour le dire.
        const message = explainMetaError((error as Error).message).message;
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
      report.error = explainMetaError((error as Error).message).message;
    }
  }

  return reports;
}

// --- Publicitaire -------------------------------------------------------------

async function syncAds(
  context: SourceContext,
  adAccountId: string,
): Promise<{ rows: number; warning: string | null }> {
  const { admin, workspaceId, dataSourceId, accessToken, window } = context;
  /* Ce qui a manqué sans faire échouer le passage — une table pas encore
     migrée, typiquement. Même principe que pour l'organique : un morceau
     absent devient un avertissement, pas une panne. */
  const warnings: string[] = [];

  /* Découpé, et pas demandé d'un bloc : le refus « Please reduce the amount
     of data you're asking for » ne vient pas de la durée seule mais de
     durée × ventilation. Les Insights par région au grain jour rendent une
     ligne par région et par jour ; le rattrapage initial en demande douze
     mois, et le compte publicitaire d'I-WAY a refusé au premier passage.
     `collectByChunks` n'essaie la fenêtre entière qu'en premier — le cas
     courant reste donc un seul appel. */
  const [rows, ageGender, regions] = await Promise.all([
    collectByChunks(window, (chunk) =>
      fetchAdInsights({ adAccountId, accessToken, ...chunk }),
    ),
    collectByChunks(window, (chunk) =>
      fetchAdBreakdowns({
        adAccountId,
        accessToken,
        ...chunk,
        breakdowns: "age,gender",
      }),
    ),
    collectByChunks(window, (chunk) =>
      fetchAdBreakdowns({ adAccountId, accessToken, ...chunk, breakdowns: "region" }),
    ),
  ]);

  // Les entités se déduisent des lignes : Meta ne rend que ce qui a dépensé,
  // et c'est exactement ce que le tableau doit montrer.
  const entities = new Map<
    string,
    { level: "campaign" | "adset"; name: string; parent: string | null }
  >();
  for (const row of rows) {
    if (row.campaign_id) {
      entities.set(row.campaign_id, {
        level: "campaign",
        name: row.campaign_name ?? row.campaign_id,
        parent: null,
      });
    }
    if (row.adset_id) {
      entities.set(row.adset_id, {
        level: "adset",
        name: row.adset_name ?? row.adset_id,
        parent: row.campaign_id ?? null,
      });
    }
  }

  let ingested = 0;

  if (entities.size > 0) {
    const now = new Date().toISOString();
    const { data: saved, error } = await admin
      .from("ad_entities")
      .upsert(
        [...entities.entries()].map(([externalId, entity]) => ({
          data_source_id: dataSourceId,
          workspace_id: workspaceId,
          level: entity.level,
          external_id: externalId,
          parent_external_id: entity.parent,
          name: entity.name,
          updated_at: now,
        })) as never,
        { onConflict: "data_source_id,external_id" },
      )
      .select("id, external_id");
    if (error) fail(`Entités publicitaires : ${error.message}`);

    const entityIds = new Map(
      ((saved ?? []) as unknown as { id: string; external_id: string }[]).map(
        (entity) => [entity.external_id, entity.id],
      ),
    );

    const metricRows = rows.flatMap((row: MetaInsightRow) => {
      const entityId = row.adset_id ? entityIds.get(row.adset_id) : undefined;
      const columns = toDailyMetricsColumns(row);
      if (!entityId || !columns.date) return [];
      return [
        {
          data_source_id: dataSourceId,
          workspace_id: workspaceId,
          entity_id: entityId,
          ...columns,
          updated_at: now,
        },
      ];
    });

    if (metricRows.length > 0) {
      const { error: metricsError } = await admin
        .from("ad_metrics_daily")
        .upsert(metricRows as never, { onConflict: "entity_id,date" });
      if (metricsError) fail(`Métriques journalières : ${metricsError.message}`);
      ingested += metricRows.length;
    }

    /* Les événements pixel personnalisés, à part et sous leur nom. Tous les
       clients ne vendent pas en ligne : I-WAY optimise sur « Validation Shop
       Lyon », que rien de standard ne sait attraper. Les verser dans
       `purchases` fabriquerait un ROAS depuis un événement sans montant. */
    const customRows = rows.flatMap((row: MetaInsightRow) => {
      const entityId = row.adset_id ? entityIds.get(row.adset_id) : undefined;
      const date = row.date_start;
      if (!entityId || !date) return [];
      return customEvents(row).map((event) => ({
        data_source_id: dataSourceId,
        workspace_id: workspaceId,
        entity_id: entityId,
        date,
        event_name: event.name,
        count: event.count,
        value: event.value,
        updated_at: now,
      }));
    });

    /* La fenêtre se **remplace**, elle ne s'accumule pas. Le nom d'événement
       fait partie de la clé : un upsert seul laisserait vivre pour toujours
       les lignes dont le nom a changé de forme — l'agrégat
       `offsite_conversion.fb_pixel_custom` d'hier à côté des noms détaillés
       de demain, et le fold compterait les deux. Effacer la fenêtre qu'on
       vient de relire rend le passage idempotent par période, comme partout
       ailleurs. Une table absente (0051 pas passée) suit le même repli. */
    const { error: purgeError } = await admin
      .from("ad_custom_events_daily")
      .delete()
      .eq("data_source_id", dataSourceId)
      .gte("date", window.since)
      .lte("date", window.until);
    if (purgeError) {
      warnings.push(
        `Événements personnalisés non rafraîchis (${purgeError.message}) — migration 0051 en attente ?`,
      );
    } else if (customRows.length > 0) {
      const { error: customError } = await admin
        .from("ad_custom_events_daily")
        .upsert(customRows as never, {
          onConflict: "data_source_id,entity_id,date,event_name",
        });
      if (customError) {
        warnings.push(
          `Événements personnalisés non enregistrés (${customError.message}) — migration 0051 en attente ?`,
        );
      } else {
        ingested += customRows.length;
      }
    }
  }

  const breakdownRows = [
    ...aggregateBreakdown(ageGender, "age").map((cell) => ({ type: "age", ...cell })),
    ...aggregateBreakdown(ageGender, "gender").map((cell) => ({ type: "gender", ...cell })),
    ...aggregateBreakdown(regions, "region").map((cell) => ({ type: "region", ...cell })),
  ].map((cell) => ({
    data_source_id: dataSourceId,
    workspace_id: workspaceId,
    date: cell.date,
    type: cell.type,
    value: cell.value,
    spend: cell.spend,
    impressions: cell.impressions,
    clicks: cell.clicks,
    updated_at: new Date().toISOString(),
  }));

  if (breakdownRows.length > 0) {
    const { error } = await admin
      .from("ad_breakdowns_daily")
      .upsert(breakdownRows as never, { onConflict: "data_source_id,date,type,value" });
    if (error) fail(`Ventilations : ${error.message}`);
    ingested += breakdownRows.length;
  }

  return { rows: ingested, warning: warnings.join(" ") || null };
}

// --- Organique ----------------------------------------------------------------

/**
 * Colonnes de `social_posts` arrivées après coup, et dont l'absence ne doit
 * pas coûter la collecte entière.
 *
 * Les migrations de ce dépôt s'appliquent à la main : entre un déploiement
 * et le passage de db-admin, le code connaît des colonnes que la base n'a
 * pas encore. Perdre tout un mois d'impressions pour un « type de média »
 * manquant serait un mauvais échange — d'autant que l'écriture échoue en
 * bloc, sans rien enregistrer du tout.
 */
const OPTIONAL_POST_COLUMNS = ["media_kind", "video_views"] as const;

/**
 * Enregistre les publications, quitte à laisser de côté les colonnes que la
 * base ne connaît pas encore. Rend la liste de celles qui ont manqué.
 */
async function upsertPosts(
  admin: Admin,
  rows: Record<string, unknown>[],
): Promise<string[]> {
  const { error } = await admin
    .from("social_posts")
    .upsert(rows as never, { onConflict: "data_source_id,external_id" });
  if (!error) return [];

  // PostgREST nomme la colonne inconnue dans son message : c'est le seul
  // moyen de distinguer une migration en retard d'une vraie panne.
  const missing = OPTIONAL_POST_COLUMNS.filter((column) =>
    error.message.includes(`'${column}'`),
  );
  if (missing.length === 0) fail(`Publications : ${error.message}`);

  const trimmed = rows.map((row) => {
    const copy = { ...row };
    for (const column of missing) delete copy[column];
    return copy;
  });

  const { error: retryError } = await admin
    .from("social_posts")
    .upsert(trimmed as never, { onConflict: "data_source_id,external_id" });
  if (retryError) fail(`Publications : ${retryError.message}`);

  return [...missing];
}

async function syncOrganic(
  context: SourceContext,
  account: SocialAccountRow,
): Promise<{ rows: number; warning: string | null }> {
  const { admin, workspaceId, dataSourceId, window } = context;
  const platform = account.kind === "instagram" ? "instagram" : "facebook";

  /* La nouvelle expérience Pages exige un jeton **de Page** pour les
     insights : avec le jeton du branchement, Meta rendait les posts sans
     leurs statistiques et l'écran affichait des zéros. L'échange est
     idempotent et sans effet sur Instagram. */
  const accessToken =
    account.kind === "facebook_page"
      ? await fetchPageAccessToken({
          pageId: account.external_id,
          accessToken: context.accessToken,
        })
      : context.accessToken;

  /*
   * Les publications d'abord, mais **sans faire tomber le reste** : la
   * lecture du feed d'une Page dépend d'une permission que Meta n'accorde
   * qu'après App Review, alors que les abonnés se lisent avec le simple
   * branchement. Un refus sur les posts ne doit pas priver le client de sa
   * courbe d'abonnés — il devient un avertissement, pas une panne.
   */
  let posts: OrganicPostColumns[] = [];
  let warning: string | null = null;

  try {
    if (account.kind === "instagram") {
      // Le listing des médias se borne côté client, en date ISO — voir graph.ts.
      const media = await fetchInstagramMedia({
        igUserId: account.external_id,
        accessToken,
        since: window.since,
      });
      posts = media
        // Une story disparaît en 24 h : elle n'a pas sa place dans une table
        // de publications qu'on compare de mois en mois.
        .filter((item) => item.media_product_type !== "STORY")
        .flatMap((item) => mediaToPost(item) ?? []);
    } else {
      const pagePosts = await fetchPagePosts({
        pageId: account.external_id,
        accessToken,
        since: unixSince(window.since),
      });
      posts = pagePosts.flatMap((post) => pagePostToPost(post) ?? []);
    }
  } catch (error) {
    warning = explainMetaError((error as Error).message).message;
  }

  let ingested = 0;

  if (posts.length > 0) {
    const now = new Date().toISOString();
    const rows = posts.map((post) => ({
      data_source_id: dataSourceId,
      workspace_id: workspaceId,
      platform,
      ...post,
      updated_at: now,
    }));

    const missingColumns = await upsertPosts(admin, rows);
    if (missingColumns.length > 0) {
      warning = [
        warning,
        `Migration en attente : ${missingColumns
          .map((column) => `« ${column} »`)
          .join(" et ")} ${missingColumns.length > 1 ? "manquent" : "manque"} à la table des publications (0047-0048). Les chiffres sont enregistrés, ces colonnes-là restent vides jusqu'au prochain passage de db-admin.`,
      ]
        .filter(Boolean)
        .join(" — ");
    }
    ingested += posts.length;
  }

  /* Les statistiques **de Page** au grain jour, pour Facebook seulement :
     c'est le chemin qui rend encore impressions et portée quand Meta les
     refuse par publication. Un refus ici ne fait pas tomber la source non
     plus — il s'ajoute à l'avertissement. */
  if (account.kind === "facebook_page") {
    try {
      const daily = pageInsightsToDaily(
        await fetchPageInsights({
          pageId: account.external_id,
          accessToken,
          metrics: PAGE_DAILY_METRICS,
          since: window.since,
          until: window.until,
        }),
      );
      if (daily.length > 0) {
        const now = new Date().toISOString();
        const { error } = await admin.from("social_page_daily").upsert(
          daily.map((line) => ({
            data_source_id: dataSourceId,
            workspace_id: workspaceId,
            platform,
            ...line,
            updated_at: now,
          })) as never,
          { onConflict: "data_source_id,platform,date" },
        );
        if (error) fail(`Statistiques de Page : ${error.message}`);
        ingested += daily.length;
      }
    } catch (error) {
      if (error instanceof MetaError && error.retryable) throw error;
      const cause = explainMetaError((error as Error).message).message;
      warning = [warning, `Statistiques de Page non lues : ${cause}`]
        .filter(Boolean)
        .join(" — ");
    }
  }

  /* La photo de profil, **relue à chaque passage**.
     Elle n'était écrite qu'au branchement, et les URL du CDN Meta sont
     signées et datées : elles meurent en quelques jours, l'écran montrait
     alors un cadre vide. Même mécanique que les vignettes LinkedIn — la
     fenêtre glissante réécrit ce qui périme.

     Un refus ne fait jamais tomber la synchronisation : l'avatar est de la
     vitrine, pas de la mesure. */
  let avatarUrl: string | null = null;
  try {
    avatarUrl =
      account.kind === "instagram"
        ? (
            await fetchInstagramProfile({
              igUserId: account.external_id,
              accessToken,
            })
          ).profilePictureUrl
        : await fetchPagePicture({ pageId: account.external_id, accessToken });
  } catch (error) {
    if (error instanceof MetaError && error.retryable) throw error;
    warning = [warning, "Photo de profil non relue."].filter(Boolean).join(" — ");
  }

  if (avatarUrl !== null) {
    const { error: avatarError } = await admin
      .from("social_accounts")
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", account.id);
    if (avatarError) fail(`Photo de profil : ${avatarError.message}`);
  }

  const followers = await fetchFollowersCount({
    nodeId: account.external_id,
    accessToken,
  });

  if (followers !== null) {
    const { error } = await admin.from("social_followers").upsert(
      {
        data_source_id: dataSourceId,
        workspace_id: workspaceId,
        platform,
        date: closingDate(),
        followers_count: followers,
        source: "api",
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "data_source_id,platform,date" },
    );
    if (error) fail(`Abonnés : ${error.message}`);
    ingested += 1;

    // La vitrine de l'inventaire suit — c'est elle que l'en-tête du feed lit.
    const { error: vitrineError } = await admin
      .from("social_accounts")
      .update({
        followers_count: followers,
        last_synced_at: new Date().toISOString(),
      } as never)
      .eq("id", account.id);
    if (vitrineError) fail(`Vitrine du compte : ${vitrineError.message}`);
  }

  return { rows: ingested, warning };
}
