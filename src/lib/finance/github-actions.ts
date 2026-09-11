import "server-only";

import { missingServerEnv, serverEnv } from "@/lib/env";

/**
 * Le déclencheur de la synchronisation Airwallex, vu depuis l'application.
 *
 * Airwallex refuse les adresses IP de Vercel — établi par sonde, mêmes clés,
 * « 403 Forbidden » d'un côté et un jeton de l'autre. L'hébergeur ne peut donc
 * pas synchroniser lui-même, et c'est pour cela que tout passe par un runner
 * GitHub. Ce que l'hébergeur peut faire, en revanche, c'est **appeler
 * l'API GitHub** : ce module lance le workflow `airwallex-sync.yml` et lit son
 * état. Le travail se fait toujours là où il peut se faire ; seule la
 * commande change de point de départ.
 *
 * Ce qui règle le vrai problème du passage programmé : `cron: "17 * * * *"`
 * est une intention, pas une garantie. GitHub laisse tomber près d'une
 * exécution horaire sur deux et creuse des trous de plusieurs heures — les
 * chiffres de l'écran dataient de six heures un matin de semaine. Le
 * chargement d'une page devient donc le déclencheur principal, et le passage
 * horaire le filet de sécurité.
 */

/**
 * Le workflow qui porte la chaîne horaire : Finance, Planning, Modération,
 * Reçus. L'écran, lui, ne déclenche que la portée `finance` — voir
 * `dispatchSyncWorkflow`.
 */
export const SYNC_WORKFLOW_FILE = "airwallex-sync.yml";

/** Le dépôt, surchargeable — un fork ou un miroir n'a pas à toucher au code. */
const DEFAULT_REPO = "adigiovannipro-hub/dashboard-antidotes";

/**
 * `workflow_dispatch` exige une référence, et une exécution programmée ne part
 * que de la branche par défaut : les deux chemins doivent viser la même.
 */
const DEFAULT_REF = "main";

/* Surchargeable pour rejouer le cycle complet — déclenchement, sondage,
   rafraîchissement — contre une façade locale, sans consommer de quota
   Actions ni dépendre du réseau. Absente en production, où seule l'API
   publique est visée. */
const API = process.env.GITHUB_API_BASE ?? "https://api.github.com";

export type WorkflowState = {
  /** Une exécution est en file, en attente ou en cours. */
  running: boolean;
  /** Lancement de la dernière exécution connue, quel qu'en soit le sort. */
  lastAttemptAt: string | null;
};

/**
 * Ce qui manque pour pouvoir déclencher, en clair — `null` quand tout est là.
 *
 * Sans jeton, l'écran dit quoi renseigner plutôt que d'offrir un bouton mort :
 * même règle que la boîte de connexion Meta sans `META_APP_ID`.
 */
export function syncDispatchUnavailable(): string | null {
  const missing = missingServerEnv("GITHUB_SYNC_TOKEN");
  if (missing.length === 0) return null;
  return "Synchronisation à la demande indisponible : le jeton GITHUB_SYNC_TOKEN n'est pas renseigné sur l'hébergeur.";
}

function repo(): string {
  return process.env.GITHUB_SYNC_REPO?.trim() || DEFAULT_REPO;
}

function ref(): string {
  return process.env.GITHUB_SYNC_REF?.trim() || DEFAULT_REF;
}

function headers(): Record<string, string> {
  const { GITHUB_SYNC_TOKEN } = serverEnv("GITHUB_SYNC_TOKEN");
  return {
    Authorization: `Bearer ${GITHUB_SYNC_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

type RunsPage = {
  workflow_runs?: { status: string | null; created_at: string }[];
};

/**
 * L'état du workflow, lu chez GitHub et non en base.
 *
 * La distinction compte : une exécution met une bonne minute à installer ses
 * dépendances avant d'écrire sa première ligne dans `finance_sync_runs`. Se
 * fier au journal pendant cette minute reviendrait à croire que rien ne
 * tourne, et à en lancer une deuxième — puis une troisième au rechargement
 * suivant.
 *
 * Cinq exécutions suffisent : on cherche « y en a-t-il une qui n'est pas
 * terminée » et « quand la dernière est-elle partie ».
 */
export async function readWorkflowState(): Promise<WorkflowState> {
  const response = await fetch(
    `${API}/repos/${repo()}/actions/workflows/${SYNC_WORKFLOW_FILE}/runs?per_page=5&exclude_pull_requests=true`,
    { headers: headers(), cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(
      `GitHub a refusé la lecture des exécutions (${response.status}) — jeton sans droit « Actions » sur ${repo()} ?`,
    );
  }

  const page = (await response.json()) as RunsPage;
  const runs = page.workflow_runs ?? [];

  return {
    running: runs.some((run) => run.status !== null && run.status !== "completed"),
    lastAttemptAt: runs[0]?.created_at ?? null,
  };
}

/**
 * Lance une exécution. Rend la main dès que GitHub a accepté l'ordre — la
 * synchronisation, elle, dure environ une minute.
 *
 * `portee: finance` : l'écran n'attend que la collecte Airwallex — soldes,
 * dépenses, factures, et le rapprochement des Échéances, qui en est l'étape
 * `billing`. La chaîne complète (navigateur de rendu, Planning, Modération,
 * Reçus) prenait 4 à 6 min 30, ce qui est une cadence de fond, pas une
 * attente d'écran : elle reste au passage horaire et au déclenchement manuel
 * depuis GitHub, dont le défaut est `tout`.
 */
export async function dispatchSyncWorkflow(): Promise<void> {
  await dispatchWorkflow(SYNC_WORKFLOW_FILE, { portee: "finance" });
}

/**
 * Le relevé de la Modération, à la demande — même workflow, autre portée.
 *
 * `portee: moderation` saute Finance, les Reçus et les envois : ouvrir l'inbox
 * ne doit ni écrire à un prospect ni publier un planning. Ce qui reste est
 * `pnpm sync:moderation`, quelques secondes par compte branché.
 *
 * Le travail ne part pas de l'hébergeur, et cette fois ce n'est pas Meta qui
 * refuse — c'est le plafond de Vercel : le relevé complet dépasse la minute
 * qu'une fonction Hobby a le droit de vivre, et se faisait couper en vol.
 */
export async function dispatchModerationWorkflow(): Promise<void> {
  await dispatchWorkflow(SYNC_WORKFLOW_FILE, { portee: "moderation" });
}

/**
 * Le workflow des passages de sourcing du pôle Antidotes : « Lancer » depuis
 * l'écran de campagne pose un passage en file puis donne cet ordre — même
 * jeton, même mécanique que Finance, une autre file d'attente.
 */
export const SOURCING_WORKFLOW_FILE = "sourcing.yml";
export const RADAR_WORKFLOW_FILE = "radar.yml";

export async function dispatchSourcingWorkflow(): Promise<void> {
  await dispatchWorkflow(SOURCING_WORKFLOW_FILE, {});
}

async function dispatchWorkflow(file: string, inputs: Record<string, string>): Promise<void> {
  const response = await fetch(
    `${API}/repos/${repo()}/actions/workflows/${file}/dispatches`,
    {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ ref: ref(), inputs }),
      cache: "no-store",
    },
  );

  // 204 en cas de succès : GitHub ne rend aucun corps, pas même l'identifiant
  // de l'exécution créée. C'est `readWorkflowState()` qui la verra apparaître.
  if (response.status === 204) return;

  const detail = await response.text().catch(() => "");
  throw new Error(
    `GitHub a refusé le déclenchement (${response.status})${detail ? ` — ${detail.slice(0, 200)}` : ""}`,
  );
}

/** Le relevé du radar inbound, à la demande — même jeton, même refus s'il manque. */
export async function dispatchRadarWorkflow(): Promise<void> {
  await dispatchWorkflow(RADAR_WORKFLOW_FILE, {});
}
