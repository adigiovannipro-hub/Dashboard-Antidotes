/**
 * Le bloc texte d'une publication dans `lire_planning`.
 *
 * Sorti de l'outil pour être testé : le format est un contrat avec les
 * conversations qui le lisent, et l'ajout des lignes de visuels (7/10/2026)
 * ne devait rien déplacer d'autre. Sans visuel, le bloc est exactement celui
 * d'avant.
 */
export function formatSubjectBlock(input: {
  id: string;
  name: string;
  statusLabel: string;
  formatLabel: string;
  scheduledOn: string | null;
  sponsoring: number | null;
  visualCount: number;
  commentCount: number;
  blockers: string;
  wording: string | null;
  visualLines: string[];
}): string {
  return [
    `### ${input.name || "(sans sujet)"}`,
    `id : ${input.id}`,
    `statut : ${input.statusLabel} · type : ${input.formatLabel} · date : ${input.scheduledOn ?? "—"}` +
      (input.sponsoring ? ` · sponso : ${input.sponsoring} €` : ""),
    `visuels : ${input.visualCount} · retours : ${input.commentCount} · ${input.blockers}`,
    ...input.visualLines,
    `wording : ${input.wording?.trim() || "—"}`,
  ].join("\n");
}
