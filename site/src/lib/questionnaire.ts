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

export type QuestionId =
  | "role"
  | "sector"
  | "revenue"
  | "budget"
  | "networks"
  | "frequency"
  | "management"
  | "goal"
  | "blocker"
  | "ads"
  | "reporting"
  | "ai"
  | "timing";

export type QuestionKind = "single" | "multi";

export type Question = {
  id: QuestionId;
  kind: QuestionKind;
  options: readonly string[];
};

export const QUESTIONS: readonly Question[] = [
  { id: "role", kind: "single", options: ["dirigeant", "marketing", "fondateur", "freelance", "autre"] },
  { id: "sector", kind: "single", options: ["commerce", "loisirs", "b2b", "mode", "food", "services", "autre"] },
  { id: "revenue", kind: "single", options: ["moins_10k", "10k_50k", "50k_200k", "plus_200k", "secret"] },
  { id: "budget", kind: "single", options: ["moins_1k", "1k_3k", "3k_8k", "plus_8k", "indefini"] },
  { id: "networks", kind: "multi", options: ["instagram", "facebook", "tiktok", "linkedin", "youtube", "x", "aucun"] },
  { id: "frequency", kind: "single", options: ["rarement", "hebdo", "plusieurs", "quotidien"] },
  { id: "management", kind: "single", options: ["personne", "moi", "interne", "freelance", "agence"] },
  { id: "goal", kind: "single", options: ["notoriete", "ventes", "recrutement", "fidelisation", "structurer"] },
  { id: "blocker", kind: "single", options: ["temps", "idees", "resultats", "mesure", "budget"] },
  { id: "ads", kind: "single", options: ["non", "moins_500", "500_2000", "plus_2000"] },
  { id: "reporting", kind: "single", options: ["aucun", "natif", "tableau"] },
  { id: "ai", kind: "single", options: ["non", "parfois", "oui"] },
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
  /** Le total de qualification (budget, chiffre d'affaires, délai, rôle). */
  heat: number;
};

const SCORE_POINTS: Partial<Record<QuestionId, Record<string, number>>> = {
  frequency: { rarement: 0, hebdo: 0.8, plusieurs: 1.5, quotidien: 2 },
  management: { personne: 0, moi: 0.4, interne: 1, freelance: 1.3, agence: 1.5 },
  reporting: { aucun: 0, natif: 0.6, tableau: 1.5 },
  ads: { non: 0, moins_500: 0.4, "500_2000": 0.8, plus_2000: 1 },
  ai: { non: 0, parfois: 0.5, oui: 1 },
  budget: { moins_1k: 0.2, "1k_3k": 0.5, "3k_8k": 0.8, plus_8k: 1, indefini: 0 },
  goal: { notoriete: 0.5, ventes: 0.5, recrutement: 0.5, fidelisation: 0.5, structurer: 0.2 },
};

const HEAT_POINTS: Partial<Record<QuestionId, Record<string, number>>> = {
  budget: { moins_1k: 0, "1k_3k": 2, "3k_8k": 3, plus_8k: 4, indefini: 1 },
  revenue: { moins_10k: 0, "10k_50k": 1, "50k_200k": 2, plus_200k: 3, secret: 1 },
  timing: { maintenant: 3, trimestre: 2, plus_tard: 0.5, curiosite: 0 },
  role: { dirigeant: 1, marketing: 1, fondateur: 1, freelance: 0, autre: 0.5 },
  ads: { non: 0, moins_500: 0.5, "500_2000": 1, plus_2000: 1.5 },
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
  // Les réseaux : 0,5 point par réseau réellement tenu, plafonné à 1,5.
  const networks = multi(answers.networks).filter((n) => n !== "aucun");
  const networkPoints = Math.min(1.5, networks.length * 0.5);
  breakdown.networks = networkPoints;
  total += networkPoints;
  // Le maximum théorique : 2 + 1,5 + 1,5 + 1 + 1 + 1 + 0,5 + 1,5 = 10.
  const score = Math.max(1, Math.min(10, Math.round(total * 10) / 10));

  let heat = 0;
  for (const [id, table] of Object.entries(HEAT_POINTS) as [QuestionId, Record<string, number>][]) {
    const choice = single(answers[id]);
    heat += choice ? (table[choice] ?? 0) : 0;
  }
  // Sur 12,5 points : chaud dès 7, tiède dès 3,5.
  const temperature: Temperature = heat >= 7 ? "chaud" : heat >= 3.5 ? "tiede" : "froid";
  return { score, temperature, breakdown, heat };
}
