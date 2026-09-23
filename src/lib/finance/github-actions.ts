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
 * Ce qui règle le vrai problème du passage programmé : un `cron` GitHub est
 * une intention, pas une garantie. GitHub laisse tomber près d'une exécution
 * sur deux et creuse des trous de plusieurs heures — les chiffres de l'écran
 * dataient de six heures un matin de semaine. Le chargement d'une page est
 * donc le déclencheur principal, et le fond de tâche le filet de sécurité.
 *
 * Ce fond de tâche n'est plus horaire depuis le 16/09/2026 : un cron horaire
 * dont chaque passage avait grimpé de 2 à 13 minutes valait 4,7 fois le
 * quota mensuel d'Actions à cadence nominale. Depuis le 23/09 il ne reste que
 * **deux passages par jour** : le soir (`0 15 * * *` UTC, portée `quotidien` :
 * Finance, publication du Planning, Factures, Reçus) et le matin
 * (`40 16 * * *` UTC, portée `matin` : Finance, Reçus, Inbox complète,
 * récupération des factures, seconde chance de publication) — heures choisies
 * pour le retard de quatre à sept heures avec lequel GitHub lance les
 * schedules de ce dépôt (voir l'en-tête du workflow). Tout ce qui doit être
 * frais à l'ouverture d'un écran se relève depuis l'écran.
 */

/**
 * Le workflow qui porte le fond de tâche — Finance, Reçus, Planning, Factures,
 * Inbox — et que les écrans déclenchent par portée : `finance` (Finance et
 * Factures), `moderation` / `moderation-complet` (Inbox). Le nom du fichier
 * est un contrat : l'API GitHub le cherche sur la branche par défaut, et le
 * renommer rendrait 404 à tous les écrans jusqu'à la fusion.
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
 * `portee: finance` : ce que l'écran Finance montre, et rien de plus — la
 * collecte Airwallex (soldes, dépenses, factures, le rapprochement des
 * Échéances qui en est l'étape `billing`) **et les Reçus**, puisqu'une pièce
 * en attente de transfert s'affiche sur le même écran. Ni publication, ni
 * émission de facture, ni Inbox : ouvrir une page ne doit rien envoyer à
 * personne. Ces étapes-là appartiennent aux deux passages programmés du
 * fond de tâche, et à « Run workflow » depuis GitHub.
 */
export async function dispatchSyncWorkflow(): Promise<void> {
  await dispatchWorkflow(SYNC_WORKFLOW_FILE, { portee: "finance" });
}

/**
 * Le relevé de l'Inbox, à la demande — même workflow, autre portée.
 *
 * `portee: moderation` et `moderation-complet` sautent Finance, les Reçus et
 * les envois : ouvrir l'inbox ne doit ni écrire à un prospect ni publier un
 * planning. Ce qui reste est `pnpm sync:moderation`.
 *
 * Les deux portées désignent la même étape et diffèrent par ce qu'elle
 * redemande : `moderation` relève le jour, `moderation-complet` la passe de
 * réparation — celle que le passage du matin joue seul et que « Tout
 * relever » rejoue sans attendre le matin. C'est elle qui a besoin d'un
 * runner : elle
 * dure des minutes, quand une fonction Hobby vit soixante secondes et se
 * faisait couper en vol. Le relevé du jour, lui, ne passe par ici que si la
 * route ne peut pas l'exécuter elle-même.
 *
 * Les deux valeurs existent sur `main` : plus de fenêtre de 422 à attendre.
 * La traduction du refus reste dans `dispatchWorkflow`, pour la prochaine
 * portée ajoutée sur une branche.
 */
export async function dispatchModerationWorkflow(
  scope: "jour" | "complet" = "jour",
): Promise<void> {
  await dispatchWorkflow(SYNC_WORKFLOW_FILE, {
    portee: scope === "complet" ? "moderation-complet" : "moderation",
  });
}

/**
 * Les workflows du pôle Antidotes : « Lancer » depuis l'écran de campagne pose
 * un passage en file puis donne cet ordre — même jeton, même mécanique que
 * Finance, une autre file d'attente ; « Relever maintenant » du radar, idem.
 *
 * Ni l'un ni l'autre n'a plus de `schedule` : dix-huit tours de sourcing à
 * vide et un radar qui relevait des comptes de démonstration chaque nuit
 * coûtaient des minutes d'Actions pour rien. Sans jeton, ou si l'ordre est
 * refusé, un passage en file **attend** un lancement depuis l'onglet Actions
 * de GitHub — aucun filet ne le ramasse tout seul, et les écrans le disent.
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

  /* GitHub valide les `inputs` d'un `workflow_dispatch` contre la version du
     fichier de la **branche par défaut**, jamais contre celle qu'on cible. Une
     portée ajoutée sur une branche est donc refusée en 422 tant qu'elle n'est
     pas fusionnée — et le message brut, en anglais et en JSON, ne dit rien de
     tout ça à qui lit l'écran. Payé deux fois ; les portées envoyées
     aujourd'hui (`finance`, `moderation`, `moderation-complet`) sont toutes
     sur `main`, la garde sert à la suivante. */
  if (response.status === 422 && detail.includes("not in the list of allowed values")) {
    throw new Error(
      "Cette portée n'existe pas encore sur la branche par défaut : GitHub lit la liste des valeurs autorisées là-bas, pas sur la branche déployée. Elle marchera au prochain merge.",
    );
  }

  throw new Error(
    `GitHub a refusé le déclenchement (${response.status})${detail ? ` — ${detail.slice(0, 200)}` : ""}`,
  );
}

/** Le relevé du radar inbound, à la demande — même jeton, même refus s'il manque. */
export async function dispatchRadarWorkflow(): Promise<void> {
  await dispatchWorkflow(RADAR_WORKFLOW_FILE, {});
}
