/**
 * Les précédents wordings d'un client — la matière de l'anti-répétition.
 *
 * Deux sources, dans cet ordre : `wording_history` (les captions passées par
 * la génération, accroche extraite), puis les cellules Wording des mois
 * antérieurs du board aux statuts validés — c'est là que vit l'historique
 * repris de Monday pendant la transition, wordings compris. Un client sans
 * aucun précédent avance sur son seul brief : le prompt le prévoit.
 *
 * Module pur : la sélection et le rendu se testent sans base.
 */

export type PreviousWordingEntry = {
  text: string;
  /** Date de publication, pour trier et dater le rendu. */
  publishedOn: string | null;
};

/**
 * Statuts du board dont la cellule Wording porte un texte **validé** — le
 * registre du client, pas un brouillon. `to_validate` reste dehors : un texte
 * que le client n'a pas vu ne fait pas référence.
 */
export const VALIDATED_WORDING_STATUSES = [
  "validated",
  "programmed",
  "published",
] as const;

/**
 * Retire d'une cellule les sections de créa que l'ancienne génération
 * empilait derrière la caption (`---\nContenu de la créa : …`, slides…) :
 * seuls les textes publiés font référence, pas les consignes de production.
 */
export function stripCreaSections(text: string): string {
  return text.split(/\n\n-{3,}\n/)[0]!.trim();
}

/**
 * Fusionne les deux sources : l'historique d'abord (déjà trié du plus récent
 * au plus ancien), puis le board par date décroissante, dédoublonnés par
 * texte — la même caption vit souvent aux deux endroits.
 */
export function pickPreviousWordings(
  history: PreviousWordingEntry[],
  boardRows: PreviousWordingEntry[],
  limit = 8,
): PreviousWordingEntry[] {
  const seen = new Set<string>();
  const picked: PreviousWordingEntry[] = [];

  const sortedBoard = [...boardRows].sort((a, b) =>
    (b.publishedOn ?? "").localeCompare(a.publishedOn ?? ""),
  );

  for (const entry of [...history, ...sortedBoard]) {
    const text = stripCreaSections(entry.text);
    if (text === "") continue;
    const key = text.replace(/\s+/g, " ").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push({ text, publishedOn: entry.publishedOn });
    if (picked.length >= limit) break;
  }
  return picked;
}

/** Chaque wording est borné : huit textes complets non bornés doubleraient
    le prompt pour des fins de caption qui n'apprennent plus rien. */
const MAX_RENDERED_LENGTH = 700;

export function renderPreviousWordings(entries: PreviousWordingEntry[]): string {
  return entries
    .map((entry, index) => {
      const dated = entry.publishedOn ? ` (${entry.publishedOn})` : "";
      const text =
        entry.text.length > MAX_RENDERED_LENGTH
          ? `${entry.text.slice(0, MAX_RENDERED_LENGTH)}…`
          : entry.text;
      return `--- Wording ${index + 1}${dated} ---\n${text}`;
    })
    .join("\n\n");
}
