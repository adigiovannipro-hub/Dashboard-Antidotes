/**
 * L'année vide d'un nouveau client : douze mois, et un couloir par réseau.
 *
 * Ouvrir un client se faisait jusqu'ici en trois temps — dupliquer, puis créer
 * les mois un par un, puis ajouter les réseaux dans chacun. Douze mois par
 * quatre réseaux, c'est quarante-huit gestes pour arriver à un tableau qui est
 * toujours vide. Le voici en une fois.
 *
 * Pur, sans base : ce module dit **quoi** écrire, l'action dit où.
 */
import { platformForNetwork } from "@/lib/social/networks";
import type { PlanningPlatform } from "@/lib/planning/types";

/** Les libellés des mois, tels que le planning les affiche : en capitales. */
const MONTH_LABELS = [
  "JANVIER",
  "FÉVRIER",
  "MARS",
  "AVRIL",
  "MAI",
  "JUIN",
  "JUILLET",
  "AOÛT",
  "SEPTEMBRE",
  "OCTOBRE",
  "NOVEMBRE",
  "DÉCEMBRE",
] as const;

export type PlannedMonth = {
  label: string;
  /** Premier jour du mois, `YYYY-MM-DD`. C'est cette colonne qui trie. */
  month: string;
  position: number;
};

export type PlannedLane = {
  /** Rang du mois dans l'année, pour rattacher le couloir après insertion. */
  monthPosition: number;
  name: string;
  platform: PlanningPlatform;
  position: number;
};

/**
 * Les douze mois d'une année.
 *
 * La date est composée à la main plutôt que par un `Date` : `toISOString()`
 * sur un `Date` construit en heure locale rendrait le 31 décembre pour un
 * 1ᵉʳ janvier à Paris, et tout le tableau glisserait d'un mois. Le reste du
 * repo calcule en UTC pour la même raison ; ici on n'a même pas besoin d'un
 * `Date`.
 */
export function planYearMonths(year: number): PlannedMonth[] {
  return MONTH_LABELS.map((label, index) => ({
    label,
    month: `${year}-${String(index + 1).padStart(2, "0")}-01`,
    position: index,
  }));
}

/**
 * Un couloir par réseau et par mois.
 *
 * Le couloir garde le **nom déclaré** — « Instagram », tel que saisi — et non
 * le libellé de l'enum : c'est ce nom qu'on lit dans le tableau, et le client
 * qui a écrit « Insta » doit retrouver « Insta ». Seule la catégorie technique
 * passe par l'enum, et retombe sur « autre » pour ce qu'il ne connaît pas.
 *
 * Aucun réseau déclaré ⇒ aucun couloir. Les mois existent quand même : un
 * tableau à douze mois vides se remplit, un tableau sans mois ne s'ouvre même
 * pas.
 */
export function planYearLanes(options: {
  months: PlannedMonth[];
  networks: string[];
}): PlannedLane[] {
  const names = options.networks
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  const lanes: PlannedLane[] = [];
  for (const month of options.months) {
    names.forEach((name, index) => {
      lanes.push({
        monthPosition: month.position,
        name,
        platform: platformForNetwork(name),
        position: index,
      });
    });
  }

  return lanes;
}
