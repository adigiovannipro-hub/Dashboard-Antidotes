import { NextResponse } from "next/server";
import { z } from "zod";

import { getFinanceContext } from "@/lib/finance/access";
import {
  dispatchSyncWorkflow,
  readWorkflowState,
  syncDispatchUnavailable,
} from "@/lib/finance/github-actions";
import { getLastSyncRun } from "@/lib/finance/queries";
import { decideSync, type SyncDecision, type SyncSnapshot } from "@/lib/finance/sync-state";

/**
 * La synchronisation Airwallex à la demande — Finance et Échéances.
 *
 * Les deux écrans lisent la même collecte : le workflow rafraîchit les
 * soldes, les dépenses, les factures, le grand livre, **puis** rapproche les
 * mensualités des Échéances — son étape `billing` — et relève les Reçus, que
 * le même écran affiche. Une seule commande met donc les deux pages à jour,
 * d'où une seule route pour les deux. Le déclenchement est borné à cette
 * portée (`portee: finance`) : publication, émission de factures et Inbox
 * appartiennent aux deux passages programmés du fond de tâche — ouvrir une
 * page ne doit rien envoyer à personne, et la chaîne entière prenait
 * plusieurs minutes que l'écran passait à afficher « en cours ».
 *
 * Le travail ne part pas d'ici : Airwallex refuse les adresses IP de
 * l'hébergeur. Cette route ne fait que donner l'ordre à GitHub, qui l'exécute
 * sur une machine acceptée — voir `lib/finance/github-actions.ts`.
 *
 * Module interne : 404 pour qui n'y a pas droit, jamais 403. Lire l'état est
 * ouvert à qui lit la Finance ; déclencher demande de pouvoir décider.
 */

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** Le bouton « Synchroniser » : passe outre la fenêtre de fraîcheur. */
  force: z.boolean().default(false),
});

export async function GET() {
  const context = await getFinanceContext();
  if (!context) return new NextResponse(null, { status: 404 });

  return NextResponse.json(await snapshot(context.orgId));
}

export async function POST(request: Request) {
  const context = await getFinanceContext();
  if (!context?.canDecide) return new NextResponse(null, { status: 404 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const state = await snapshot(context.orgId);
  const decision = decideSync({
    now: new Date(),
    snapshot: state,
    forced: parsed.data.force,
  });

  if (decision.action !== "dispatch") {
    return NextResponse.json({
      decision: decision.action,
      reason: "reason" in decision ? decision.reason : null,
      message: explain(decision, state),
      snapshot: state,
    });
  }

  try {
    await dispatchSyncWorkflow();
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
     acceptée, mais elle met quelques secondes à apparaître dans la liste des
     exécutions. Rendre `false` ici ferait clignoter le badge, et un second
     chargement de page en lancerait une deuxième. */
  return NextResponse.json({
    decision: "dispatch",
    reason: null,
    message: "Synchronisation lancée.",
    snapshot: { ...state, running: true },
  });
}

/**
 * L'état de la chaîne : le journal en base pour ce que les données ont reçu,
 * GitHub pour ce qui tourne en ce moment.
 *
 * Un refus de GitHub — jeton absent, sans droit, service en panne — ne fait
 * pas tomber la route : il devient le message `unavailable`, que l'écran
 * affiche à la place du bouton. Une page qui plante en dit moins qu'une page
 * qui nomme ce qui manque.
 */
async function snapshot(orgId: string): Promise<SyncSnapshot> {
  const lastRun = await getLastSyncRun(orgId);
  const base: SyncSnapshot = {
    lastRunAt: lastRun?.started_at ?? null,
    lastRunStatus: lastRun?.status ?? null,
    lastAttemptAt: null,
    running: false,
    unavailable: syncDispatchUnavailable(),
  };

  if (base.unavailable) return base;

  try {
    const workflow = await readWorkflowState();
    return { ...base, running: workflow.running, lastAttemptAt: workflow.lastAttemptAt };
  } catch (error) {
    return {
      ...base,
      unavailable: error instanceof Error ? error.message : String(error),
    };
  }
}

function explain(decision: SyncDecision, state: SyncSnapshot): string {
  if (decision.action === "wait") return "Synchronisation déjà en cours.";
  if (decision.action === "skip" && decision.reason === "indisponible") {
    return state.unavailable ?? "Synchronisation indisponible.";
  }
  return "Données déjà à jour.";
}
