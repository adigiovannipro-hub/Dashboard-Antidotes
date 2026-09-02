import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { SocialAccountRow } from "@/lib/social/types";
import type { Database } from "@/lib/supabase/database.types";
import {
  findLinkedinConnectedAccount,
  linkedinTransport,
  NETWORK_SIZE,
  ORG_ACLS,
  SHARE_STATS,
} from "./composio";
import { explainLinkedinError } from "./errors";
import {
  followersFromNetworkSize,
  lifetimeFromShareStats,
  pagesFromOrganizations,
} from "./mapping";
import type { LinkedinPage, LinkedinTransport } from "./types";

/**
 * Collecte LinkedIn organique d'un espace.
 *
 * Le chemin est celui de tout le projet : service → base → lecture locale.
 * Ce que LinkedIn sert est plus maigre qu'ailleurs, et c'est dit ici une
 * fois pour toutes :
 *
 *   • **les abonnés du jour** — un instantané, comme Meta ;
 *   • **les compteurs cumulés de publications** — impressions, portée,
 *     clics, réactions, commentaires, partages, depuis la création de la
 *     page.
 *
 * Il n'y a **pas** de liste des publications d'une page : aucun outil de la
 * passerelle ne l'expose, et le tableau « Performance par publication » de
 * l'onglet reste donc vide, ce que l'écran dit. Il n'y a pas non plus de
 * découpage temporel : les trois formes d'intervalle documentées sont
 * refusées (sondées le 2 septembre 2026 sur ANMF, grains jour et mois).
 * D'où le stockage cumulé et la différence à la lecture — voir la migration
 * `20260902d`.
 *
 * Règle des crons appliquée partout : **chaque `error` Supabase est testé**.
 */

type Admin = SupabaseClient<Database>;

export type LinkedinSyncReport = {
  account: string;
  rows: number;
  error: string | null;
  warning?: string | null;
};

function fail(message: string): never {
  throw new Error(message);
}

/**
 * La date d'un relevé : **la veille du passage**.
 *
 * Même règle que Meta (`connectors/meta/sync.ts`) et pour la même raison :
 * ce qu'on lit le matin du 1er est le chiffre au sortir du 31. Daté du jour
 * du passage, il tomberait dans le mois suivant et chaque courbe prendrait
 * un mois d'avance.
 */
function closingDate(now = new Date()): string {
  return new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
}

/**
 * Les pages entreprise que le compte connecté administre.
 *
 * Rang par rang, et non `count: 100` : la passerelle **résout** une seule
 * organisation par appel et rend sa fiche, si bien qu'une demande de cent
 * pages en rendait une. Six pages sortaient comme une seule — ce qui se
 * lirait « ce compte n'administre qu'une page ». Plafond à 50 : au-delà,
 * c'est une boucle, pas un client.
 */
export async function fetchLinkedinPages(
  transport: LinkedinTransport,
): Promise<LinkedinPage[]> {
  const pages: LinkedinPage[] = [];
  const seen = new Set<string>();

  for (let start = 0; start < 50; start += 1) {
    let payload: unknown;
    try {
      payload = await transport(ORG_ACLS, {
        role: "ADMINISTRATOR",
        state: "APPROVED",
        count: 1,
        start,
      });
    } catch (error) {
      // Un refus au premier rang est une vraie erreur ; aux suivants, c'est
      // la fin de la liste — LinkedIn ne rend pas 200 sur un rang vide.
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
  const account = await findLinkedinConnectedAccount(options.workspaceId);
  if ("error" in account) return { error: account.error };

  let pages: LinkedinPage[];
  try {
    pages = await fetchLinkedinPages(linkedinTransport(account));
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
      avatar_url: page.logoUrl,
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

/** La collecte d'un espace : abonnés et compteurs cumulés de sa page. */
export async function syncWorkspaceLinkedin(options: {
  admin: Admin;
  workspaceId: string;
  now?: Date;
}): Promise<LinkedinSyncReport | null> {
  const { admin, workspaceId } = options;

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

    const connected = await findLinkedinConnectedAccount(workspaceId);
    if ("error" in connected) fail(connected.error);
    const transport = linkedinTransport(connected);

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
      .select("id")
      .single();
    if (sourceError) fail(`Source de données : ${sourceError.message}`);
    const dataSourceId = (source as unknown as { id: string }).id;

    const date = closingDate(options.now);
    const { data: run, error: runError } = await admin
      .from("sync_runs")
      .insert({
        data_source_id: dataSourceId,
        workspace_id: workspaceId,
        status: "running",
        date_from: date,
        date_to: date,
      } as never)
      .select("id")
      .single();
    if (runError) fail(`Journal de passage : ${runError.message}`);
    const runId = (run as unknown as { id: string }).id;

    try {
      const warning = await collect({
        admin,
        transport,
        workspaceId,
        dataSourceId,
        account,
        date,
        report,
      });
      report.warning = warning;

      const now = new Date().toISOString();
      const { error: doneError } = await admin
        .from("sync_runs")
        .update({
          status: "success",
          finished_at: now,
          rows_ingested: report.rows,
          error: warning,
        } as never)
        .eq("id", runId);
      if (doneError) fail(`Clôture du passage : ${doneError.message}`);

      const { error: sourceDone } = await admin
        .from("data_sources")
        .update({ status: "connected", last_sync_at: now, last_error: warning } as never)
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
  transport: LinkedinTransport;
  workspaceId: string;
  dataSourceId: string;
  account: SocialAccountRow;
  date: string;
  report: LinkedinSyncReport;
}): Promise<string | null> {
  const { admin, transport, workspaceId, dataSourceId, account, date, report } = context;
  const now = new Date().toISOString();
  let warning: string | null = null;

  const followers = followersFromNetworkSize(
    await transport(NETWORK_SIZE, { organization_id: account.external_id }),
  );

  if (followers !== null) {
    const { error } = await admin.from("social_followers").upsert(
      {
        data_source_id: dataSourceId,
        workspace_id: workspaceId,
        platform: "linkedin",
        date,
        followers_count: followers,
        source: "api",
        updated_at: now,
      } as never,
      { onConflict: "data_source_id,platform,date" },
    );
    if (error) fail(`Abonnés : ${error.message}`);
    report.rows += 1;

    const { error: vitrineError } = await admin
      .from("social_accounts")
      .update({ followers_count: followers, last_synced_at: now } as never)
      .eq("id", account.id);
    if (vitrineError) fail(`Vitrine du compte : ${vitrineError.message}`);
  }

  /* Les compteurs cumulés ne doivent pas faire tomber les abonnés : une page
     qui n'a jamais rien publié n'a pas de statistiques, et c'est une absence
     de matière, pas une panne. */
  try {
    const totals = lifetimeFromShareStats(
      await transport(SHARE_STATS, {
        organizational_entity: `urn:li:organization:${account.external_id}`,
      }),
    );

    if (totals) {
      const { error } = await admin.from("social_lifetime_totals").upsert(
        {
          data_source_id: dataSourceId,
          workspace_id: workspaceId,
          platform: "linkedin",
          date,
          ...totals,
          updated_at: now,
        } as never,
        { onConflict: "data_source_id,platform,date" },
      );
      if (error) fail(`Compteurs cumulés : ${error.message}`);
      report.rows += 1;
    }
  } catch (error) {
    warning = `Statistiques de publications non lues : ${explainLinkedinError((error as Error).message)}`;
  }

  return warning;
}
