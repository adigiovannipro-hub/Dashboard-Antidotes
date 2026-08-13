/**
 * Assemblage du modèle d'une carte client — fonction pure, zéro import
 * Supabase : les lectures viennent de `queries.ts`, la règle du cycle de
 * `phases.ts`, et tout ce qui sort d'ici est sérialisable tel quel vers le
 * composant client.
 */

import { shortDate } from "@/lib/mon-travail/dates";
import {
  evaluateCycle,
  monthLabel,
  monthLabelLower,
  ofMonth,
  shiftMonth,
  targetMonthFor,
  type PhaseSegment,
  type PhaseSlice,
} from "./phases";
import {
  ACTIVE_JOB_STATUSES,
  PHASE_LABELS,
  PHASE_ORDER,
  type GenerationJob,
  type GenerationJobStatus,
  type ProductionPhase,
} from "./types";

/** Ce que le planning des deux mois pertinents raconte, lu par `queries.ts`. */
export type ProductionSnapshot = {
  workspace_id: string;
  /**
   * `false` quand les tables du module sont absentes de la base.
   *
   * Sans ce drapeau, une table manquante rend une liste vide, donc « aucune
   * phase faite », donc une barre qui affirme paisiblement que le reporting
   * est en retard chez tous les clients à la fois. Un état faux est pire
   * qu'un état absent : la carte doit dire qu'elle ne sait pas.
   */
  moduleReady: boolean;
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
  /**
   * Les mois d'après — M+2, M+3 — pour travailler en avance.
   *
   * Clé `YYYY-MM-01`. Un mois absent de cette carte est un mois vide : le
   * planning n'a pas encore de groupe à ce nom. Volontairement plus pauvre
   * que `target` : on ne calcule pas de fenêtre d'échéance pour un mois qui
   * n'est pas encore dû, et un mois à venir ne peut pas être en retard.
   */
  ahead: Record<string, AheadStats>;
  /** Jobs récents de l'espace, du plus neuf au plus ancien. */
  jobs: GenerationJob[];
};

/** Ce qu'on sait d'un mois qu'on prend en avance. */
export type AheadStats = {
  total: number;
  withWording: number;
  validated: number;
};

export const EMPTY_AHEAD: AheadStats = { total: 0, withWording: 0, validated: 0 };

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

/**
 * Une vue de la carte pour un mois donné.
 *
 * La première est le mois par défaut, celle que la carte ouvre — le cycle
 * complet, ses fenêtres et ses retards. Les suivantes sont les mois d'avance :
 * mêmes gestes, mais aucune échéance et donc aucun retard possible.
 */
export type CardMonthView = {
  /** `YYYY-MM-01` du mois travaillé par les actions de cette vue. */
  targetMonth: string;
  /** « Septembre ». */
  monthLabel: string;
  /** Pastille du sélecteur : « En avance », ou rien pour le mois par défaut. */
  badge: string | null;
  subtitle: string;
  segments: PhaseSegment[];
  lateBadge: string | null;
  currentPhase: ProductionPhase | null;
  metrics: CardMetric[];
  info: string | null;
  action: CardAction | null;
};

export type ProductionCardModel = {
  /**
   * Les mois sélectionnables, du mois par défaut aux deux suivants. La carte
   * s'ouvre toujours sur le premier : un choix mémorisé cacherait un retard.
   */
  views: CardMonthView[];
  subtitle: string;
  segments: PhaseSegment[];
  lateBadge: string | null;
  currentPhase: ProductionPhase | null;
  metrics: CardMetric[];
  /**
   * La barre chiffrée sous les mesures.
   *
   * Par défaut, l'avancement des publications du mois en cours, tous réseaux
   * confondus. Pendant un job, la carte substitue l'avancement du job — une
   * seule barre à l'écran, jamais deux qui se disputent le regard.
   */
  progress: { done: number; total: number; label: string } | null;
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
  /** Publié sur planifié pour le mois en cours, tous réseaux confondus. */
  monthProgress: { done: number; total: number } | null;
}): ProductionCardModel {
  const { today, snapshot, upcoming, moderation } = options;
  const monthProgress =
    options.monthProgress && options.monthProgress.total > 0
      ? { ...options.monthProgress, label: "Publié ce mois-ci" }
      : null;
  const monthKey = today.slice(0, 7);
  const nextLabel = monthLabelLower(shiftMonth(monthKey, 1));
  const previousLabel = monthLabelLower(shiftMonth(monthKey, -1));
  const nextOf = ofMonth(shiftMonth(monthKey, 1));
  const previousOf = ofMonth(shiftMonth(monthKey, -1));

  // Module absent de la base : on montre ce qu'on sait vraiment — les mesures
  // du planning — et on se tait sur le cycle plutôt que d'en inventer un.
  if (!snapshot.moduleReady) {
    return buildUnavailableModel({ monthKey, upcoming, moderation, monthProgress });
  }

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
          label: "Contenus rédigés",
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
        { label: "À publier sous 7 jours", value: String(upcoming) },
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
  // La barre du mois est la vue de fond, celle qu'on veut voir en permanence :
  // ce qui est parti sur ce qui était prévu, tous réseaux confondus. Un job en
  // cours la remplace le temps de tourner — les compteurs de phase, eux,
  // restent lisibles dans les mesures juste au-dessus.
  const progress =
    activeJob && activeJob.progress_total > 0
      ? {
          done: activeJob.progress_current,
          total: activeJob.progress_total,
          label: RUNNING_LABELS[activeJob.phase],
        }
      : monthProgress;

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
            label: `Générer les intentions ${nextOf}`,
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
                ? "Rédiger le contenu restant"
                : `Rédiger les ${remaining} contenus restants`,
            disabled: remaining === 0,
            reason:
              remaining === 0
                ? snapshot.target.total === 0
                  ? `Aucune intention pour ${nextLabel}`
                  : "Tous les contenus sont rédigés"
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
            label: `Générer le reporting ${previousOf}`,
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

  // --- Les mois d'avance -----------------------------------------------------
  // Le mois par défaut d'abord : la carte s'ouvre toujours dessus, un choix
  // mémorisé cacherait un retard.
  const defaultView: CardMonthView = {
    targetMonth: targetMonthFor(current ?? "intentions", today),
    monthLabel: monthLabel(shiftMonth(monthKey, 1)),
    badge: current === "reporting" ? "Bilan" : null,
    subtitle: view.subtitle,
    segments: view.segments,
    lateBadge: view.lateBadge,
    currentPhase: current,
    metrics,
    info,
    action,
  };

  const views: CardMonthView[] = [defaultView];
  for (let ahead = 1; ahead <= AHEAD_MONTHS; ahead += 1) {
    const key = shiftMonth(monthKey, 1 + ahead);
    views.push(
      buildAheadView({
        monthKey: key,
        phases: snapshot.phases,
        stats: snapshot.ahead[`${key}-01`] ?? EMPTY_AHEAD,
      }),
    );
  }

  return {
    views,
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

/** Combien de mois d'avance la carte propose au-delà du mois par défaut. */
export const AHEAD_MONTHS = 2;

/**
 * La carte pour un mois qu'on prend en avance.
 *
 * Délibérément plus pauvre que la vue par défaut : pas de fenêtre d'échéance,
 * donc **jamais de retard**. Un mois qui n'est pas encore dû ne peut pas être
 * en retard, et une barre toute grise se lirait comme un reproche si on ne le
 * disait pas.
 */
function buildAheadView(options: {
  /** `YYYY-MM` du mois travaillé. */
  monthKey: string;
  phases: PhaseSlice[];
  stats: AheadStats;
}): CardMonthView {
  const targetMonth = `${options.monthKey}-01`;
  const label = monthLabel(options.monthKey);
  const de = ofMonth(options.monthKey);

  const statusOf = (phase: ProductionPhase) =>
    options.phases.find(
      (row) => row.phase === phase && row.target_month === targetMonth,
    )?.status ?? "pending";

  const settled = (phase: ProductionPhase) => {
    const status = statusOf(phase);
    return status === "done" || status === "skipped";
  };

  const segments: PhaseSegment[] = PHASE_ORDER.map((phase) => ({
    phase,
    targetMonth,
    status: statusOf(phase),
    tone: settled(phase) || statusOf(phase) === "in_progress" ? "ok" : "idle",
    isCurrent: false,
    late: false,
    dueStart: null,
    dueEnd: null,
  }));

  // Le reporting ne se prend pas en avance : il analyse un mois écoulé.
  const chain: ProductionPhase[] = ["intentions", "wording", "programmation"];
  const current = chain.find((phase) => !settled(phase)) ?? null;

  const remaining = Math.max(options.stats.total - options.stats.withWording, 0);
  const metrics: CardMetric[] = [
    { label: "Publications au planning", value: String(options.stats.total) },
    { label: "Contenus rédigés", value: `${options.stats.withWording} sur ${options.stats.total}` },
    { label: "Posts validés client", value: String(options.stats.validated) },
  ];

  let action: CardAction | null = null;
  if (current) {
    const base = { phase: current, targetMonth, kind: "generate" as const };
    switch (current) {
      case "intentions":
        action = {
          ...base,
          label: `Générer les intentions ${de}`,
          disabled: false,
          reason: null,
        };
        break;
      case "wording":
        action = {
          ...base,
          label:
            remaining === 1
              ? "Rédiger le contenu restant"
              : `Rédiger les ${remaining} contenus restants`,
          disabled: remaining === 0,
          reason: remaining === 0 ? "Tous les contenus sont rédigés" : null,
        };
        break;
      case "programmation":
        action = {
          ...base,
          label:
            options.stats.validated === 1
              ? "Programmer le post validé"
              : `Programmer les ${options.stats.validated} posts validés`,
          disabled: options.stats.validated === 0,
          reason: options.stats.validated === 0 ? "Aucun post validé à programmer" : null,
        };
        break;
    }
  }

  return {
    targetMonth,
    monthLabel: label,
    badge: "En avance",
    subtitle: `${label} · ${current ? PHASE_LABELS[current] : "Cycle bouclé"}`,
    segments,
    lateBadge: null,
    currentPhase: current,
    metrics,
    info: current
      ? `${label} n'est pas encore dans la fenêtre. Rien n'est en retard.`
      : `${label} est bouclé.`,
    action,
  };
}

/** Le message que porte une carte dont le module n'est pas en base. */
export const MODULE_MISSING_NOTICE =
  "Cycle indisponible : les tables du module ne sont pas encore en base. Appliquer les migrations 0032 et 0033.";

/**
 * La carte quand le module n'est pas installé.
 *
 * Les mesures qui viennent du planning restent affichées — elles sont vraies.
 * Le cycle, lui, est gris et muet, et il n'y a pas de bouton : proposer une
 * action qui répondrait 500 serait mentir deux fois.
 */
function buildUnavailableModel(options: {
  monthKey: string;
  upcoming: number;
  moderation: number | null;
  monthProgress: { done: number; total: number; label: string } | null;
}): ProductionCardModel {
  const segments: PhaseSegment[] = PHASE_ORDER.map((phase) => ({
    phase,
    targetMonth: `${options.monthKey}-01`,
    status: "pending",
    tone: "idle",
    isCurrent: false,
    late: false,
    dueStart: null,
    dueEnd: null,
  }));

  const subtitle = `${monthLabel(options.monthKey)} · Cycle indisponible`;

  return {
    // Une seule vue : sans les tables du module, il n'y a pas de mois à
    // parcourir — le sélecteur n'aurait rien à montrer.
    views: [
      {
        targetMonth: `${options.monthKey}-01`,
        monthLabel: monthLabel(options.monthKey),
        badge: null,
        subtitle,
        segments,
        lateBadge: null,
        currentPhase: null,
        metrics: [],
        info: MODULE_MISSING_NOTICE,
        action: null,
      },
    ],
    subtitle,
    segments,
    lateBadge: null,
    currentPhase: null,
    metrics: [
      { label: "À publier sous 7 jours", value: String(options.upcoming) },
      ...(options.moderation === null
        ? []
        : [{ label: "Messages en attente", value: String(options.moderation) }]),
    ],
    // Le planning reste lisible même sans le module : la barre du mois est
    // vraie, elle ne dépend d'aucune des tables manquantes.
    progress: options.monthProgress,
    info: MODULE_MISSING_NOTICE,
    action: null,
    activeJob: null,
  };
}
