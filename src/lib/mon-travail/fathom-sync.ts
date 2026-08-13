import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { addDays } from "./dates";
import { fetchFathomMeetings } from "./fathom-api";
import {
  FATHOM_SKIP_LABELS,
  planFathomTasks,
  type FathomAssignee,
  type FathomWorkspace,
} from "./fathom";

/**
 * L'étape Fathom du passage quotidien.
 *
 * Elle se greffe sur le cron existant plutôt que d'en réclamer un second : le
 * plan Hobby n'en autorise que deux, un seul créneau reste libre, et une
 * réunion dont les tâches arrivent le lendemain matin est très exactement ce
 * qui a été demandé.
 *
 * Sans `FATHOM_API_KEY`, l'étape ne s'exécute pas et le dit. La dégradation
 * est prévue, pas subie : le reste du cron — ligne quotidienne, cycles
 * clients — continue de tourner.
 */

/**
 * Combien de jours en arrière regarder, au premier passage comme aux suivants.
 *
 * Trente jours par défaut. `FATHOM_IMPORT_SINCE` (une date `YYYY-MM-DD`) force
 * un point de départ fixe, ce qui sert à reprendre l'historique une fois :
 * l'idempotence par `dedupe_key` fait qu'un second passage sur les mêmes
 * réunions n'écrit rien.
 */
const DEFAULT_WINDOW_DAYS = 30;

export type FathomReport = {
  ok: boolean;
  raison?: string;
  /** Les variables `FATHOM*` visibles de la fonction — noms seuls. */
  variablesVues?: string[];
  /** Longueur de la clé telle que reçue. Zéro = elle n'est pas arrivée. */
  longueurCle?: number;
  /** L'adresse d'API qui a répondu, parmi les candidates essayées. */
  adresse?: string;
  /** Depuis quand les réunions ont été demandées : la cause la plus fréquente
      d'un « zéro réunion » parfaitement silencieux. */
  depuis?: string;
  reunions?: number;
  planifiees?: number;
  creees?: number;
  ecartees?: Record<string, number>;
  sansClient?: string[];
  illisibles?: string[];
};

/**
 * Efface les tâches déjà importées de Fathom, avant de réimporter.
 *
 * Sert quand la **source** change, pas quand les données changent : un import
 * précédent avait pris la liste exhaustive des `action_items` au lieu de la
 * section « Prochaines étapes », et les quarante-sept lignes qu'il avait
 * posées ne seraient jamais rattrapées par un nouveau passage — leurs clés
 * d'idempotence ne correspondent à rien de ce que la nouvelle source produit.
 *
 * Ne touche que `source = 'fathom'` : rien de saisi à la main, rien de
 * récurrent, aucune publication. Déclenché uniquement par `?purge=fathom`,
 * jamais par le cron.
 */
export async function purgeFathomTasks(options: {
  admin: SupabaseClient;
  orgId: string;
}): Promise<number> {
  const { data, error } = await options.admin
    .from("work_tasks")
    .delete()
    .eq("org_id", options.orgId)
    .eq("source", "fathom")
    .select("id");
  if (error) throw new Error(`Purge des tâches Fathom : ${error.message}`);
  return data?.length ?? 0;
}

export async function syncFathomTasks(options: {
  admin: SupabaseClient;
  orgId: string;
  today: string;
}): Promise<FathomReport> {
  /* Lue en direct plutôt que déclarée dans `serverSchema` : ce bloc-là est
     celui des secrets sans lesquels l'application ne démarre pas, et Fathom
     n'en fait pas partie. Même traitement qu'Airwallex et Anthropic. */
  const apiKey = process.env.FATHOM_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: true,
      raison: "FATHOM_API_KEY absente — étape ignorée.",
      /* Ce que la fonction voit réellement, pour trancher entre « la variable
         n'est pas dans ce déploiement » et « elle y est mais vide ». Les
         **noms** seulement, plus une longueur : la valeur d'un secret n'a rien
         à faire dans une réponse HTTP, fût-ce pour un diagnostic. */
      variablesVues: Object.keys(process.env)
        .filter((name) => name.startsWith("FATHOM"))
        .sort(),
      longueurCle: process.env.FATHOM_API_KEY?.length ?? 0,
    };
  }

  const since =
    process.env.FATHOM_IMPORT_SINCE?.trim() ||
    addDays(options.today, -DEFAULT_WINDOW_DAYS);

  const { meetings, unreadable, base } = await fetchFathomMeetings({ apiKey, since });

  // Les espaces clients de l'organisation : ce sont les seuls auxquels une
  // réunion peut être rattachée. L'erreur est testée — une table illisible
  // rendrait une liste vide, donc zéro rattachement, sans rien signaler.
  const { data: workspaceRows, error: workspacesError } = await options.admin
    .from("workspaces")
    .select("id, slug, name")
    .eq("org_id", options.orgId)
    .eq("type", "client");
  if (workspacesError) {
    throw new Error(`Lecture des espaces : ${workspacesError.message}`);
  }

  const owner = ownerFromEnv();
  const plan = planFathomTasks({
    orgId: options.orgId,
    today: options.today,
    meetings,
    workspaces: (workspaceRows ?? []) as unknown as FathomWorkspace[],
    ...(owner ? { owner } : {}),
  });

  let created = 0;
  if (plan.tasks.length > 0) {
    const { data, error } = await options.admin
      .from("work_tasks")
      .upsert(plan.tasks as never, {
        onConflict: "org_id,dedupe_key",
        // Une tâche déjà cochée, replanifiée ou supprimée ne doit pas
        // ressusciter au passage suivant : on insère, on ne réécrit jamais.
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) throw new Error(`Écriture des tâches : ${error.message}`);
    created = data?.length ?? 0;
  }

  return {
    ok: true,
    adresse: base,
    depuis: since,
    reunions: meetings.length,
    planifiees: plan.tasks.length,
    creees: created,
    ecartees: labelled(plan.skipped),
    sansClient: plan.withoutClient,
    ...(unreadable.length > 0 ? { illisibles: unreadable } : {}),
  };
}

/**
 * Le propriétaire des tâches, s'il est forcé par configuration.
 *
 * Sans réglage, c'est **celui qui a enregistré la réunion** — dans un compte
 * solo, toujours la bonne personne, et zéro configuration. `FATHOM_OWNER_EMAIL`
 * sert le jour où quelqu'un d'autre enregistre pour le compte.
 */
function ownerFromEnv(): FathomAssignee | null {
  const email = process.env.FATHOM_OWNER_EMAIL?.trim();
  const name = process.env.FATHOM_OWNER_NAME?.trim();
  if (!email && !name) return null;
  return { email: email ?? null, name: name ?? null };
}

/** Les compteurs d'écart, en français, et sans les zéros. */
function labelled(skipped: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [reason, count] of Object.entries(skipped)) {
    if (count === 0) continue;
    out[FATHOM_SKIP_LABELS[reason as keyof typeof FATHOM_SKIP_LABELS] ?? reason] = count;
  }
  return out;
}
