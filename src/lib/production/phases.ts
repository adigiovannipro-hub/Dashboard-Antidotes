/**
 * Calcul du cycle de production mensuel — fonctions pures, zéro import
 * Supabase. L'état vient de la base (`client_phases`), le contexte du
 * planning ; tout entre par les options, rien n'est lu ici.
 *
 * ── Le modèle temporel ────────────────────────────────────────────────────
 *
 * Le cycle est décalé : les intentions de septembre se font mi-août. Pendant
 * le mois civil M, la barre suit donc quatre phases qui ne visent pas le même
 * mois :
 *
 *   intentions      → M+1   (fenêtre : du 10 au 20 de M)
 *   wording         → M+1   (dans les 5 jours suivant la fin des intentions)
 *   programmation   → M+1   (bouclée au moins 3 jours avant la 1re publication)
 *   reporting       → M−1   (du 1er au 5 de M)
 *
 * Le cahier des charges fait cibler « le mois courant » à wording et
 * programmation ; c'est incompatible avec ses propres fenêtres — les captions
 * d'un mois déjà en ligne sont écrites depuis longtemps, et le bouton
 * « Rédiger les N wordings restants » compterait toujours zéro. Wording et
 * programmation prolongent les intentions qu'on vient de générer : même mois
 * cible qu'elles.
 *
 * Le passage de reporting à intentions se déclenche quand le reporting de M−1
 * est généré, ou automatiquement le 15 du mois s'il ne l'a pas été — il reste
 * alors affiché en retard, mais ne bloque plus le reste du cycle.
 */

import {
  PHASE_DISPLAY_ORDER,
  PHASE_LABELS,
  PHASE_ORDER,
  type ClientPhase,
  type ProductionPhase,
  type ProductionPhaseStatus,
} from "./types";

/** Ce que le calcul lit d'une ligne `client_phases` — le reste ne compte pas. */
export type PhaseSlice = Pick<
  ClientPhase,
  "phase" | "target_month" | "status" | "completed_at" | "due_start" | "due_end"
>;

export type PhaseCycleInput = {
  /** Jour civil de Paris, `YYYY-MM-DD` — la convention du module Mon travail. */
  today: string;
  /** Lignes existantes pour cet espace ; une phase sans ligne est `pending`. */
  rows: PhaseSlice[];
  /**
   * Première date de publication planifiée du mois cible (M+1), `YYYY-MM-DD`.
   * `null` tant que le planning du mois n'a pas de date : la programmation
   * reste alors sans fenêtre, donc sans urgence.
   */
  firstPublicationOfTarget: string | null;
};

/**
 * La couleur d'un segment, sémantique et non picturale :
 *   ok      terminée, passée ou en cours — le vert de marque
 *   urgent  à faire et la fenêtre est ouverte ou dépassée — l'ambre
 *   idle    à venir, pas encore urgente — le gris de bordure
 */
export type SegmentTone = "ok" | "urgent" | "idle";

export type PhaseSegment = {
  phase: ProductionPhase;
  /** Premier jour du mois visé, `YYYY-MM-01`. */
  targetMonth: string;
  status: ProductionPhaseStatus;
  tone: SegmentTone;
  isCurrent: boolean;
  /** Fenêtre dépassée sans que la phase soit finie. */
  late: boolean;
  dueStart: string | null;
  dueEnd: string | null;
};

export type PhaseCycleView = {
  /** « Août » — le mois civil du jour, pas un mois cible. */
  monthLabel: string;
  currentPhase: ProductionPhase | null;
  /** « Août · Content », ou « Août · Cycle bouclé ». */
  subtitle: string;
  /** Toujours les quatre phases, dans l'ordre de `PHASE_DISPLAY_ORDER`. */
  segments: PhaseSegment[];
  /** « Reporting en retard » — la plus ancienne phase en retard, ou rien. */
  lateBadge: string | null;
};

// --- Dates -------------------------------------------------------------------

/** `2026-08` + 1 → `2026-09` ; gère les changements d'année. */
export function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

function addDays(day: string, count: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function dayOfMonth(day: string): number {
  return Number(day.slice(8, 10));
}

const MONTH_LABEL = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  timeZone: "UTC",
});

/** « août » capitalisé — le sous-titre de la carte commence par lui. */
export function monthLabel(monthKey: string): string {
  const label = MONTH_LABEL.format(new Date(`${monthKey}-01T00:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** « septembre », en minuscules — pour un libellé de bouton en milieu de phrase. */
export function monthLabelLower(monthKey: string): string {
  return MONTH_LABEL.format(new Date(`${monthKey}-01T00:00:00Z`));
}

/**
 * « de septembre », « d'octobre » — l'élision devant une voyelle.
 *
 * Trois mois sur douze commencent par une voyelle : avril, août, octobre.
 * Sans ça, un bouton sur quatre affiche « Générer les intentions de octobre ».
 */
export function ofMonth(monthKey: string): string {
  const label = monthLabelLower(monthKey);
  return /^[aeiouâêîôûàéèù]/.test(label) ? `d'${label}` : `de ${label}`;
}

/**
 * Le mois visé par une phase pendant le mois civil de `today`.
 *
 * C'est la même fonction qui sert la carte et les routes de génération : le
 * bouton et le job ne peuvent pas diverger sur le mois qu'ils traitent.
 */
export function targetMonthFor(phase: ProductionPhase, today: string): string {
  const month = today.slice(0, 7);
  const target = phase === "reporting" ? shiftMonth(month, -1) : shiftMonth(month, 1);
  return `${target}-01`;
}

// --- Fenêtres d'échéance -------------------------------------------------------

/**
 * Fenêtre par défaut d'une phase, quand la ligne n'en fixe pas.
 *
 * `null` signifie « pas encore calculable » — wording avant la fin des
 * intentions, programmation sans date de publication — et vaut « pas urgent ».
 */
export function defaultDueWindow(
  phase: ProductionPhase,
  today: string,
  context: {
    /** Jour (`YYYY-MM-DD`) où les intentions ont été terminées, s'il y a lieu. */
    intentionsCompletedOn: string | null;
    firstPublicationOfTarget: string | null;
  },
): { start: string; end: string } | null {
  const month = today.slice(0, 7);

  switch (phase) {
    case "reporting":
      return { start: `${month}-01`, end: `${month}-05` };
    case "intentions":
      return { start: `${month}-10`, end: `${month}-20` };
    case "wording":
      return context.intentionsCompletedOn
        ? {
            start: context.intentionsCompletedOn,
            end: addDays(context.intentionsCompletedOn, 5),
          }
        : null;
    case "programmation":
      // Bouclée au moins 3 jours avant la première publication ; l'ambre
      // s'allume une semaine avant pour laisser le temps de s'y mettre.
      return context.firstPublicationOfTarget
        ? {
            start: addDays(context.firstPublicationOfTarget, -7),
            end: addDays(context.firstPublicationOfTarget, -3),
          }
        : null;
  }
}

// --- Évaluation ----------------------------------------------------------------

const SETTLED: ProductionPhaseStatus[] = ["done", "skipped"];

function isSettled(status: ProductionPhaseStatus): boolean {
  return SETTLED.includes(status);
}

/**
 * L'état complet de la barre de phases d'un espace, au jour donné.
 *
 * Toute la règle vit ici, testée à part : la carte ne fait qu'afficher.
 */
export function evaluateCycle(input: PhaseCycleInput): PhaseCycleView {
  const { today } = input;
  const month = today.slice(0, 7);

  const rowFor = (phase: ProductionPhase): PhaseSlice | null =>
    input.rows.find(
      (row) => row.phase === phase && row.target_month === targetMonthFor(phase, today),
    ) ?? null;

  const intentionsRow = rowFor("intentions");
  const intentionsCompletedOn =
    intentionsRow?.status === "done" && intentionsRow.completed_at
      ? intentionsRow.completed_at.slice(0, 10)
      : null;

  // --- Statuts et fenêtres, phase par phase --------------------------------
  const draft = PHASE_ORDER.map((phase) => {
    const row = rowFor(phase);
    const status: ProductionPhaseStatus = row?.status ?? "pending";
    const fallback = defaultDueWindow(phase, today, {
      intentionsCompletedOn,
      firstPublicationOfTarget: input.firstPublicationOfTarget,
    });
    const dueStart = row?.due_start ?? fallback?.start ?? null;
    const dueEnd = row?.due_end ?? fallback?.end ?? null;
    const late = !isSettled(status) && dueEnd !== null && today > dueEnd;

    return { phase, targetMonth: targetMonthFor(phase, today), status, dueStart, dueEnd, late };
  });

  // --- Phase courante -------------------------------------------------------
  // Le reporting de M−1 ouvre le mois ; le 15, la main passe aux intentions
  // même s'il n'est pas fait. La chaîne intentions → wording → programmation
  // avance ensuite au premier maillon non réglé.
  const byPhase = new Map(draft.map((entry) => [entry.phase, entry]));
  const reporting = byPhase.get("reporting")!;
  const chain = (["intentions", "wording", "programmation"] as const).map(
    (phase) => byPhase.get(phase)!,
  );

  const reportingOpen = !isSettled(reporting.status);
  let currentPhase: ProductionPhase | null = null;

  if (reportingOpen && dayOfMonth(today) <= 15) {
    currentPhase = "reporting";
  } else {
    const nextInChain = chain.find((entry) => !isSettled(entry.status));
    if (nextInChain) currentPhase = nextInChain.phase;
    else if (reportingOpen) currentPhase = "reporting";
  }

  // --- Tons ------------------------------------------------------------------
  // La barre s'affiche dans l'ordre chronologique du mois de travail :
  // le Reporting du mois écoulé d'abord.
  const displayed = PHASE_DISPLAY_ORDER.map((phase) => byPhase.get(phase)!);
  const segments: PhaseSegment[] = displayed.map((entry) => {
    let tone: SegmentTone;
    if (isSettled(entry.status) || entry.status === "in_progress") tone = "ok";
    else if (entry.dueStart !== null && today >= entry.dueStart) tone = "urgent";
    else tone = "idle";

    // Une phase entamée mais dont la fenêtre est dépassée redevient ambre :
    // « en cours » ne blanchit pas un retard.
    if (entry.late) tone = "urgent";

    return { ...entry, tone, isCurrent: entry.phase === currentPhase };
  });

  // Le badge désigne le retard le plus ancien — celui dont l'échéance est
  // passée depuis le plus longtemps — pas le premier dans l'ordre d'affichage.
  const firstLate = segments
    .filter((segment) => segment.late && segment.dueEnd !== null)
    .sort((a, b) => a.dueEnd!.localeCompare(b.dueEnd!))[0];

  return {
    monthLabel: monthLabel(month),
    currentPhase,
    subtitle: `${monthLabel(month)} · ${
      currentPhase ? PHASE_LABELS[currentPhase] : "Cycle bouclé"
    }`,
    segments,
    lateBadge: firstLate ? `${PHASE_LABELS[firstLate.phase]} en retard` : null,
  };
}
