import { NextResponse } from "next/server";
import { z } from "zod";

import { getViewer } from "@/lib/auth";
import { missingServerEnv } from "@/lib/env";
import {
  dispatchModerationWorkflow,
  readWorkflowState,
  syncDispatchUnavailable,
} from "@/lib/finance/github-actions";
import { decideSync, type SyncSnapshot } from "@/lib/finance/sync-state";
import { reindexFaqSearch, syncModerationInbox } from "@/lib/moderation/sync";
import { createAdminClient } from "@/lib/supabase/server";
import { COMPOSIO_TRANSITION_NOTE } from "@/lib/social/direct-connect";

/**
 * Le relevé de la Modération à la demande — ouverture de l'inbox et bouton
 * « Relever maintenant ».
 *
 * Il ne s'exécute plus ici. Trois raisons, dans cet ordre :
 *
 *   • le passage programmé est l'étape « Modération » d'un cron GitHub, et
 *     GitHub en laisse tomber près d'une exécution horaire sur deux ;
 *   • le seul déclencheur fréquent et fiable qui restait — l'ouverture de
 *     Finance — envoie `portee: finance`, qui **saute explicitement** la
 *     Modération. Autrement dit, rien ne la relevait de façon fiable ;
 *   • ce relevé appelle Meta compte par compte et dure plusieurs minutes,
 *     quand une fonction du plan Hobby vit soixante secondes. L'ancien
 *     `maxDuration = 300` était une intention que l'hébergeur ne tient pas :
 *     la fonction se faisait couper en vol, sans rien dire.
 *
 * La route donne donc l'ordre à GitHub (`portee: moderation`) et rend la main,
 * exactement comme `/api/finance/sync`. Le chemin synchrone reste en repli
 * quand `GITHUB_SYNC_TOKEN` manque : il est imparfait — il peut être coupé —
 * mais il vaut mieux qu'un bouton mort, et l'écran dit lequel des deux tourne.
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

  const state = await snapshot();

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
    return runHere(state);
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
    await dispatchModerationWorkflow();
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
async function runHere(state: SyncSnapshot) {
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
  const reports = await syncModerationInbox({ admin });
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
