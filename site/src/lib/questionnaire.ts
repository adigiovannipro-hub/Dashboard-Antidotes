/**
 * Le questionnaire du lead magnet — le modèle, pas les textes (ils vivent
 * dans les dictionnaires FR/EN, indexés par identifiant).
 *
 * Deux calculs, purs et testés :
 *   • la **note de présence et de gestion social media**, de 1 à 10 — elle
 *     se calcule ici et n'est jamais rendue au navigateur ni par courriel :
 *     elle se dévoile en rendez-vous ;
 *   • la **température** du lead (chaud / tiède / froid), qui décide de la
 *     suite du parcours et de ce que lit le propriétaire dans sa notification.
 */

export type QuestionId = "goal" | "frequency" | "management" | "reporting" | "budget" | "timing";

export type QuestionKind = "single" | "multi";

export type Question = {
  id: QuestionId;
  kind: QuestionKind;
  options: readonly string[];
};

/**
 * Six questions, pas une de plus (demande du 8/10/2026 : « max 6 »).
 * Quatre nourrissent la note (régularité, pilotage, mesure, moyens), deux
 * la qualification (moyens, délai) ; l'objectif sert surtout la
 * conversation du rendez-vous.
 */
export const QUESTIONS: readonly Question[] = [
  { id: "goal", kind: "single", options: ["notoriete", "ventes", "recrutement", "fidelisation", "structurer"] },
  { id: "frequency", kind: "single", options: ["rarement", "hebdo", "plusieurs", "quotidien"] },
  { id: "management", kind: "single", options: ["personne", "moi", "interne", "freelance", "agence"] },
  { id: "reporting", kind: "single", options: ["aucun", "natif", "tableau"] },
  { id: "budget", kind: "single", options: ["moins_1k", "1k_3k", "3k_8k", "plus_8k", "indefini"] },
  { id: "timing", kind: "single", options: ["maintenant", "trimestre", "plus_tard", "curiosite"] },
] as const;

export type Answers = Partial<Record<QuestionId, string | string[]>>;

export type Temperature = "chaud" | "tiede" | "froid";

export type Scoring = {
  /** La note, de 1 à 10, un chiffre après la virgule. */
  score: number;
  temperature: Temperature;
  /** Les points obtenus, par question, pour expliquer la note en rendez-vous. */
  breakdown: Partial<Record<QuestionId, number>>;
  /** Le total de qualification (moyens, délai, pilotage actuel). */
  heat: number;
};

const SCORE_POINTS: Partial<Record<QuestionId, Record<string, number>>> = {
  frequency: { rarement: 0, hebdo: 1, plusieurs: 2, quotidien: 2.5 },
  // Une personne dédiée, en interne ou à l'extérieur, c'est un pilotage ;
  // freelance et agence valent la même chose : les agences sont aussi nos clientes.
  management: { personne: 0, moi: 0.5, interne: 1.5, freelance: 2.5, agence: 2.5 },
  reporting: { aucun: 0, natif: 1, tableau: 2.5 },
  budget: { moins_1k: 0.5, "1k_3k": 1, "3k_8k": 1.5, plus_8k: 2, indefini: 0 },
  goal: { notoriete: 0.5, ventes: 0.5, recrutement: 0.5, fidelisation: 0.5, structurer: 0.2 },
};

const HEAT_POINTS: Partial<Record<QuestionId, Record<string, number>>> = {
  budget: { moins_1k: 0, "1k_3k": 2, "3k_8k": 3, plus_8k: 4, indefini: 1 },
  timing: { maintenant: 3, trimestre: 2, plus_tard: 0.5, curiosite: 0 },
  management: { personne: 0, moi: 0.5, interne: 0.5, freelance: 1, agence: 1 },
};

function single(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  return null;
}

function multi(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return [value];
  return [];
}

/** Les réponses sont-elles complètes et valides pour chaque question ? */
export function validateAnswers(answers: Answers): { ok: true } | { ok: false; missing: QuestionId[] } {
  const missing: QuestionId[] = [];
  for (const question of QUESTIONS) {
    const value = answers[question.id];
    if (question.kind === "single") {
      const choice = single(value);
      if (!choice || !question.options.includes(choice)) missing.push(question.id);
    } else {
      const choices = multi(value);
      if (choices.length === 0 || choices.some((c) => !question.options.includes(c))) missing.push(question.id);
    }
  }
  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}

export function computeScoring(answers: Answers): Scoring {
  const breakdown: Partial<Record<QuestionId, number>> = {};
  let total = 0;
  for (const [id, table] of Object.entries(SCORE_POINTS) as [QuestionId, Record<string, number>][]) {
    const choice = single(answers[id]);
    const points = choice ? (table[choice] ?? 0) : 0;
    breakdown[id] = points;
    total += points;
  }
  // Le maximum théorique : 2,5 + 2,5 + 2,5 + 2 + 0,5 = 10.
  const score = Math.max(1, Math.min(10, Math.round(total * 10) / 10));

  let heat = 0;
  for (const [id, table] of Object.entries(HEAT_POINTS) as [QuestionId, Record<string, number>][]) {
    const choice = single(answers[id]);
    heat += choice ? (table[choice] ?? 0) : 0;
  }
  // Sur 8 points : chaud dès 5, tiède dès 2,5.
  const temperature: Temperature = heat >= 5 ? "chaud" : heat >= 2.5 ? "tiede" : "froid";
  return { score, temperature, breakdown, heat };
}
