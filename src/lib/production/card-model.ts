/**
 * Assemblage du modèle d'une carte client — fonction pure, zéro import
 * Supabase : les lectures viennent de `queries.ts`, la règle du cycle de
 * `phases.ts`, et tout ce qui sort d'ici est sérialisable tel quel vers le
 * composant client.
 */

import { shortDate } from "@/lib/mon-travail/dates";
import {
  evaluateCycle,
  monthLabelLower,
  shiftMonth,
  targetMonthFor,
  type PhaseSegment,
  type PhaseSlice,
} from "./phases";
import {
  ACTIVE_JOB_STATUSES,
  type GenerationJob,
  type GenerationJobStatus,
  type ProductionPhase,
} from "./types";

/** Ce que le planning des deux mois pertinents raconte, lu par `queries.ts`. */
export type ProductionSnapshot = {
  workspace_id: string;
  /** Lignes `client_phases` des deux mois cibles pertinents. */
  phases: PhaseSlice[];
  /** Le mois cible, M+1 : ce que les actions vont traiter. */
  target: {
    /** Publications hors « non retenu ». */
    total: number;
    withWording: number;
    /** `validated` : validées client, prêtes à programmer. */
    validated: number;
    /** `scheduled` ou déjà `published`. */
    scheduled: number;
    firstPublication: string | null;
  };
  /** Le mois écoulé, M−1 : la matière du reporting. */
  previous: {
    published: number;
    total: number;
  };
  /** Jobs récents de l'espace, du plus neuf au plus ancien. */
  jobs: GenerationJob[];
};

export type CardMetric = {
  label: string;
  value: string;
};

export type CardAction = {
  phase: ProductionPhase;
  /** `YYYY-MM-01` — le mois que la route de génération recevra. */
  targetMonth: string;
  label: string;
  /** `resume` : relance des unités en échec, rendue en ton danger. */
  kind: "generate" | "resume";
  disabled: boolean;
  /** Pourquoi le bouton est inerte, montré en infobulle. */
  reason: string | null;
};

export type CardJob = {
  id: string;
  phase: ProductionPhase;
  status: GenerationJobStatus;
  current: number;
  total: number;
};

export type ProductionCardModel = {
  subtitle: string;
  segments: PhaseSegment[];
  lateBadge: string | null;
  currentPhase: ProductionPhase | null;
  metrics: CardMetric[];
  /** Avancement chiffré de la phase courante, quand elle en a un. */
  progress: { done: number; total: number } | null;
  /** Encart contextuel — alerte ou manque qui explique l'état du bouton. */
  info: string | null;
  action: CardAction | null;
  /** Job `pending`/`running` à suivre — le bouton devient son témoin. */
  activeJob: CardJob | null;
};

/** Libellé du bouton pendant qu'un job tourne ; le compteur s'y accroche. */
export const RUNNING_LABELS: Record<ProductionPhase, string> = {
  intentions: "Génération en cours",
  wording: "Rédaction en cours",
  programmation: "Programmation en cours",
  reporting: "Analyse en cours",
};

const asCardJob = (job: GenerationJob): CardJob => ({
  id: job.id,
  phase: job.phase,
  status: job.status,
  current: job.progress_current,
  total: job.progress_total,
});

/** Ce que les routes `/api/generate/*` et `/api/jobs/*` renvoient au front. */
export type JobPayload = CardJob & {
  summary: string | null;
  error: string | null;
};

export function toJobPayload(job: GenerationJob): JobPayload {
  return {
    ...asCardJob(job),
    summary: job.result?.summary ?? null,
    error: job.error_message,
  };
}

export function buildCardModel(options: {
  today: string;
  snapshot: ProductionSnapshot;
  /** Publications à venir sous 7 jours — la mesure existante de la carte. */
  upcoming: number;
  /** Conversations en attente, `null` si l'espace n'a pas de modération. */
  moderation: number | null;
}): ProductionCardModel {
  const { today, snapshot, upcoming, moderation } = options;
  const monthKey = today.slice(0, 7);
  const nextLabel = monthLabelLower(shiftMonth(monthKey, 1));
  const previousLabel = monthLabelLower(shiftMonth(monthKey, -1));

  const view = evaluateCycle({
    today,
    rows: snapshot.phases,
    firstPublicationOfTarget: snapshot.target.firstPublication,
  });
  const current = view.currentPhase;

  const reportingRow = snapshot.phases.find(
    (row) =>
      row.phase === "reporting" &&
      row.target_month === targetMonthFor("reporting", today),
  );
  const reportingDone = reportingRow?.status === "done";

  // --- Mesures, contextuelles à la phase ------------------------------------
  const moderationMetric: CardMetric[] =
    moderation === null
      ? []
      : [{ label: "Messages en attente", value: String(moderation) }];

  let metrics: CardMetric[];
  switch (current) {
    case "wording":
      metrics = [
        { label: "À publier sous 7 jours", value: String(upcoming) },
        ...moderationMetric,
        {
          label: "Wordings rédigés",
          value: `${snapshot.target.withWording} sur ${snapshot.target.total}`,
        },
      ];
      break;
    case "programmation":
      metrics = [
        { label: "Posts validés client", value: String(snapshot.target.validated) },
        {
          label: "Posts programmés",
          value: `${snapshot.target.scheduled} sur ${snapshot.target.total}`,
        },
        {
          label: "Première publication le",
          value: snapshot.target.firstPublication
            ? shortDate(snapshot.target.firstPublication)
            : "—",
        },
      ];
      break;
    case "reporting":
      metrics = [
        {
          label: "Posts publiés le mois dernier",
          value: String(snapshot.previous.published),
        },
        ...moderationMetric,
        {
          label: "Reporting",
          value:
            reportingDone && reportingRow?.completed_at
              ? `Généré le ${shortDate(reportingRow.completed_at.slice(0, 10))}`
              : "À générer",
        },
      ];
      break;
    // Intentions — et le cycle bouclé, qui garde les mesures de veille.
    default:
      metrics = [
        { label: "À publier sous 7 jours", value: String(upcoming) },
        ...moderationMetric,
        { label: "Mois précédent clôturé", value: reportingDone ? "Oui" : "Non" },
      ];
      break;
  }
  metrics = metrics.slice(0, 3);

  // --- Job actif et dernier job de la phase courante ------------------------
  const activeJob =
    snapshot.jobs.find((job) => ACTIVE_JOB_STATUSES.includes(job.status)) ?? null;
  const lastForCurrent = current
    ? (snapshot.jobs.find(
        (job) =>
          job.phase === current && job.target_month === targetMonthFor(current, today),
      ) ?? null)
    : null;

  // --- Avancement chiffré ----------------------------------------------------
  let progress: { done: number; total: number } | null = null;
  if (activeJob && activeJob.progress_total > 0) {
    progress = { done: activeJob.progress_current, total: activeJob.progress_total };
  } else if (current === "wording" && snapshot.target.total > 0) {
    progress = { done: snapshot.target.withWording, total: snapshot.target.total };
  } else if (current === "programmation" && snapshot.target.total > 0) {
    progress = { done: snapshot.target.scheduled, total: snapshot.target.total };
  }

  // --- Encart contextuel -----------------------------------------------------
  let info: string | null = null;
  if (
    (current === "wording" || current === "programmation") &&
    snapshot.target.total === 0
  ) {
    info = `Aucune intention pour ${nextLabel} pour l'instant : générer d'abord les intentions.`;
  } else if (
    current === "programmation" &&
    snapshot.target.firstPublication === null
  ) {
    info = `Les publications de ${nextLabel} n'ont pas encore de date.`;
  }

  // --- Bouton principal ------------------------------------------------------
  let action: CardAction | null = null;
  if (current) {
    const base = { phase: current, targetMonth: targetMonthFor(current, today) };

    if (lastForCurrent && (lastForCurrent.status === "error" || lastForCurrent.status === "partial")) {
      const failed =
        lastForCurrent.result?.failed_subject_ids?.length ??
        Math.max(lastForCurrent.progress_total - lastForCurrent.progress_current, 1);
      action = {
        ...base,
        kind: "resume",
        label:
          lastForCurrent.progress_total > 0
            ? `Reprendre · ${failed}/${lastForCurrent.progress_total} échoués`
            : "Reprendre la génération",
        disabled: false,
        reason: null,
      };
    } else {
      switch (current) {
        case "intentions":
          action = {
            ...base,
            kind: "generate",
            label: `Générer les intentions de ${nextLabel}`,
            disabled: false,
            reason: null,
          };
          break;
        case "wording": {
          const remaining = Math.max(
            snapshot.target.total - snapshot.target.withWording,
            0,
          );
          action = {
            ...base,
            kind: "generate",
            label:
              remaining === 1
                ? "Rédiger le wording restant"
                : `Rédiger les ${remaining} wordings restants`,
            disabled: remaining === 0,
            reason:
              remaining === 0
                ? snapshot.target.total === 0
                  ? `Aucune intention pour ${nextLabel}`
                  : "Tous les wordings sont rédigés"
                : null,
          };
          break;
        }
        case "programmation": {
          const count = snapshot.target.validated;
          action = {
            ...base,
            kind: "generate",
            label:
              count === 1
                ? "Programmer le post validé"
                : `Programmer les ${count} posts validés`,
            disabled: count === 0,
            reason: count === 0 ? "Aucun post validé à programmer" : null,
          };
          break;
        }
        case "reporting":
          action = {
            ...base,
            kind: "generate",
            label: `Générer le reporting de ${previousLabel}`,
            disabled: snapshot.previous.total === 0,
            reason:
              snapshot.previous.total === 0
                ? `Aucune publication en ${previousLabel} à analyser`
                : null,
          };
          break;
      }
    }
  }

  return {
    subtitle: view.subtitle,
    segments: view.segments,
    lateBadge: view.lateBadge,
    currentPhase: current,
    metrics,
    progress,
    info,
    action,
    activeJob: activeJob ? asCardJob(activeJob) : null,
  };
}
