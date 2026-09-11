import { NextResponse } from "next/server";
import { z } from "zod";

import { getViewer } from "@/lib/auth";
import { missingServerEnv } from "@/lib/env";
import {
  dispatchModerationWorkflow,
  readWorkflowState,
  syncDispatchUnavailable,
} from "@/lib/finance/github-actions";
import {
  decideSync,
  FRESH_WINDOW_MINUTES,
  minutesSince,
  type SyncSnapshot,
} from "@/lib/finance/sync-state";
import { parseSyncScope, type SyncScope } from "@/lib/moderation/sync-scope";
import { reindexFaqSearch, syncModerationInbox } from "@/lib/moderation/sync";
import { createAdminClient } from "@/lib/supabase/server";
import { COMPOSIO_TRANSITION_NOTE } from "@/lib/social/direct-connect";

/**
 * Le relevé de l'Inbox à la demande — ouverture de l'écran et boutons.
 *
 * Deux chemins, parce qu'il y a deux relevés.
 *
 *   • **`jour`** — ce que l'ouverture de l'écran déclenche, exécuté **ici** et
 *     tout de suite. Deux jours de conversations, les commentaires des seules
 *     publications dont le compteur a bougé, aucun rattrapage de profil :
 *     quelques appels par compte. Le chemin synchrone n'était intenable que
 *     parce que le relevé rattrapait toute la vie du compte à chaque passage —
 *     ce n'est plus le cas, et rien ne vaut de voir sa boîte à jour au moment
 *     où on ouvre l'écran.
 *   • **`complet`** — la passe de réparation. Elle dure des minutes et n'a
 *     donc rien à faire dans une fonction qui vit soixante secondes : la route
 *     donne l'ordre à GitHub (`portee: moderation-complet`) et rend la main,
 *     exactement comme `/api/finance/sync`. Elle tourne aussi seule la nuit,
 *     sur son propre créneau cron. Sans `GITHUB_SYNC_TOKEN`, elle retombe sur
 *     l'exécution locale — imparfaite, elle peut être coupée, mais elle vaut
 *     mieux qu'un bouton mort, et l'écran dit lequel des deux tourne.
 *
 * Deux fenêtres de fraîcheur distinctes, et c'est la clé : le `jour` se juge
 * sur le journal des canaux — ce que les données ont reçu — le `complet` sur
 * la dernière exécution GitHub. Un relevé du jour tout frais ne doit jamais
 * empêcher de lancer un relevé complet.
 *
 * Module interne : 404 pour qui n'est pas propriétaire, jamais 403.
 */

export const dynamic = "force-dynamic";
/* Le plafond réel du plan Hobby. Le déclaré valait 300 : Vercel ne l'accorde
   pas, et une valeur qu'on n'obtient pas ne protège de rien. */
export const maxDuration = 60;

const bodySchema = z.object({
  /** Le bouton : passe outre la fenêtre de fraîcheur, jamais une course en cours. */
  force: z.boolean().default(false),
  /** `jour` (défaut) ou `complet` — voir `moderation/sync-scope.ts`. */
  portee: z.string().optional(),
});

export async function GET() {
  const viewer = await getViewer();
  if (!viewer?.isOwner) return new NextResponse(null, { status: 404 });

  return NextResponse.json(await snapshot());
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer?.isOwner) return new NextResponse(null, { status: 404 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const scope: SyncScope = parseSyncScope(parsed.data.portee) ?? "jour";
  const state = await snapshot();

  /* Le relevé du jour s'exécute **ici**, tout de suite.
     Deux jours de conversations, les commentaires des seules publications dont
     le compteur a bougé, aucun rattrapage de profil : quelques appels par
     compte, loin sous les soixante secondes du plan Hobby. Passer par GitHub
     lui coûterait une minute d'installation de dépendances pour un travail qui
     en dure dix secondes — et l'utilisateur veut voir sa boîte à jour au
     moment où il ouvre l'écran, pas deux minutes après. */
  if (scope === "jour") {
    /* La fraîcheur du jour se juge sur le **journal des canaux** — ce que les
       données ont réellement reçu — et non sur la dernière exécution GitHub.
       Deux compteurs distincts, et c'est voulu : un relevé du jour tout frais
       ne doit jamais empêcher de lancer un relevé complet. */
    const age = minutesSince(state.lastRunAt, new Date());
    if (!parsed.data.force && age !== null && age < FRESH_WINDOW_MINUTES) {
      return NextResponse.json({
        decision: "skip",
        reason: "fraiche",
        message: "Relevé déjà à jour.",
        snapshot: state,
      });
    }
    return runHere(state, "jour");
  }

  /* Sans jeton GitHub, on relève ici même — mais seulement sur demande
     explicite. Déclencher plusieurs minutes de travail au simple chargement
     d'une page, sur une fonction qui sera coupée avant la fin, ne rendrait
     service à personne. */
  if (state.unavailable) {
    if (!parsed.data.force) {
      return NextResponse.json({
        decision: "skip",
        reason: "indisponible",
        message: state.unavailable,
        snapshot: state,
      });
    }
    return runHere(state, "complet");
  }

  const decision = decideSync({ now: new Date(), snapshot: state, forced: parsed.data.force });
  if (decision.action !== "dispatch") {
    return NextResponse.json({
      decision: decision.action,
      reason: "reason" in decision ? decision.reason : null,
      message:
        decision.action === "wait" ? "Relevé déjà en cours." : "Relevé déjà à jour.",
      snapshot: state,
    });
  }

  try {
    await dispatchModerationWorkflow("complet");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        decision: "skip",
        reason: "indisponible",
        message,
        snapshot: { ...state, unavailable: message },
      },
      { status: 502 },
    );
  }

  /* `running` est affirmé sans relire GitHub : l'exécution vient d'être
     acceptée et met quelques secondes à apparaître dans la liste. Rendre
     `false` ici ferait relancer une deuxième exécution au sondage suivant. */
  return NextResponse.json({
    decision: "dispatch",
    reason: null,
    message: "Relevé lancé.",
    snapshot: { ...state, running: true },
  });
}

/**
 * Le relevé exécuté sur l'hébergeur — le repli, pas le chemin nominal.
 *
 * Il peut être coupé par le plafond de soixante secondes : ce qui a été écrit
 * avant la coupure reste en base (chaque compte est traité et clôturé à part),
 * le reste attendra le passage suivant.
 */
async function runHere(state: SyncSnapshot, scope: SyncScope) {
  const missing = missingServerEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "CREDENTIALS_ENCRYPTION_KEY",
  );
  if (missing.length > 0) {
    return NextResponse.json(
      {
        decision: "skip",
        reason: "indisponible",
        message: `Variables absentes : ${missing.join(", ")}.`,
        snapshot: state,
      },
      { status: 500 },
    );
  }

  // `createAdminClient` : la synchronisation écrit pour le compte du cron,
  // après une garde d'owner explicite.
  const admin = createAdminClient();
  const reports = await syncModerationInbox({ admin, scope });
  // Les entrées FAQ en attente d'indexation. Souvent muet ici : sur Vercel le
  // modèle d'embeddings ne charge pas, et le passage horaire s'en charge.
  const faq = await reindexFaqSearch({ admin });

  const failed = reports.filter((report) => report.error);
  const warned = reports.filter((report) => report.messagesWarning);
  const threads = reports.reduce((sum, report) => sum + report.threads, 0);

  return NextResponse.json({
    decision: "direct",
    reason: null,
    message:
      reports.length === 0
        ? `Aucun compte Instagram ou Page affecté. ${COMPOSIO_TRANSITION_NOTE}`
        : failed.length > 0
          ? `${failed[0]?.account} : ${failed[0]?.error}`
          : warned.length > 0
            ? `${warned[0]?.account} : ${warned[0]?.messagesWarning}`
            : `Relevé terminé — ${threads} fil(s) à jour.`,
    ok: failed.length === 0,
    reports,
    faq,
    snapshot: { ...state, running: false, lastAttemptAt: new Date().toISOString() },
  });
}

/**
 * L'état de la chaîne : le journal des canaux pour ce que l'inbox a reçu,
 * GitHub pour ce qui tourne en ce moment.
 *
 * Un refus de GitHub ne fait pas tomber la route : il devient le message
 * `unavailable`, que l'écran montre — et qui bascule le bouton sur le relevé
 * direct.
 */
async function snapshot(): Promise<SyncSnapshot> {
  const admin = createAdminClient();
  /* L'`error` est lu, pas seulement le `data` : une table absente rendrait une
     liste vide, donc « jamais relevé », donc un relevé relancé à chaque
     chargement de page sans que rien ne le signale. */
  const { data, error } = await admin
    .from("channel_connections")
    .select("last_polled_at, status")
    .order("last_polled_at", { ascending: false })
    .limit(50);

  const rows = (data ?? []) as unknown as {
    last_polled_at: string | null;
    status: string;
  }[];

  const base: SyncSnapshot = {
    lastRunAt: rows.find((row) => row.last_polled_at)?.last_polled_at ?? null,
    lastRunStatus: error
      ? "error"
      : rows.length === 0
        ? null
        : rows.some((row) => row.status !== "connected")
          ? "error"
          : "success",
    lastAttemptAt: null,
    running: false,
    unavailable: error ? `Journal des canaux illisible : ${error.message}` : syncDispatchUnavailable(),
  };

  if (base.unavailable) return base;

  try {
    const workflow = await readWorkflowState();
    return { ...base, running: workflow.running, lastAttemptAt: workflow.lastAttemptAt };
  } catch (workflowError) {
    return {
      ...base,
      unavailable:
        workflowError instanceof Error ? workflowError.message : String(workflowError),
    };
  }
}
