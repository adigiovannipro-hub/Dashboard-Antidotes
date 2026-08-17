/**
 * Accès à la palette de visualisation.
 *
 * Les couleurs vivent dans `globals.css` sous forme de tokens CSS, ce qui leur
 * permet de basculer clair/sombre sans repasser par React. Ici on ne manipule
 * que des références `var(--series-n)`.
 *
 * Règle non négociable : **une teinte est attribuée dans un ordre fixe, jamais
 * cyclée.** Elle suit l'entité, pas son rang — filtrer une série ne doit jamais
 * repeindre les survivantes, sinon un lecteur qui avait appris « BROAD est en
 * bleu » se retrouve trompé.
 */
export const SERIES_SLOT_COUNT = 8;

/** Nombre maximal de séries simultanées dans un graphique en secteurs ou nuage. */
export const ALL_PAIRS_SERIES_CAP = 3;

export function seriesColor(index: number): string {
  if (index >= SERIES_SLOT_COUNT) {
    throw new Error(
      `Slot de série ${index} hors palette. Au-delà de ${SERIES_SLOT_COUNT} séries, ` +
        "replier la queue dans « Autres » ou passer en petits multiples — " +
        "générer une neuvième teinte casse la sûreté daltonisme.",
    );
  }
  return `var(--series-${index + 1})`;
}

/**
 * Replie une liste de parts en gardant les `cap` plus grandes et en agrégeant
 * le reste sous « Autres ». C'est la réponse à une série trop longue : jamais
 * une couleur générée.
 */
export function foldTail(
  items: readonly { label: string; value: number }[],
  cap: number,
  otherLabel = "Autres",
): { label: string; value: number; isOther: boolean }[] {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  if (sorted.length <= cap) {
    return sorted.map(({ label, value }) => ({ label, value, isOther: false }));
  }

  const kept = sorted
    .slice(0, cap)
    .map(({ label, value }) => ({ label, value, isOther: false }));
  const tail = sorted.slice(cap).reduce((sum, item) => sum + item.value, 0);
  if (tail > 0) kept.push({ label: otherLabel, value: tail, isOther: true });
  return kept;
}

/**
 * Position d'une valeur dans le classement de sa colonne, dans `[-1, 1]`.
 * `1` = meilleure valeur de la colonne, `-1` = la moins bonne, `0` = médiane.
 *
 * Le signe tient compte du sens métier : sur un CPA, la valeur la plus basse
 * est la meilleure. C'est ce qui évite de signaler comme mauvaise une
 * acquisition bon marché.
 */
export function performanceRank(
  value: number,
  values: readonly number[],
  lowerIsBetter: boolean,
): number {
  const finite = values.filter((candidate) => Number.isFinite(candidate));
  if (finite.length < 2) return 0;

  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (max === min) return 0;

  // Rang normalisé plutôt qu'échelle linéaire : une valeur aberrante ne doit
  // pas écraser toute la colonne dans une seule nuance.
  const below = finite.filter((candidate) => candidate < value).length;
  const equal = finite.filter((candidate) => candidate === value).length;
  const percentile = (below + (equal - 1) / 2) / (finite.length - 1);

  const signed = percentile * 2 - 1;
  return lowerIsBetter ? -signed : signed;
}

/**
 * Fond d'une cellule de heatmap : rampe **mono-teinte** menthe → vert, où le
 * vert franc marque la meilleure valeur de la colonne et l'absence de fond la
 * moins bonne.
 *
 * Deux raisons de ne pas reprendre le rouge → blanc → vert du rapport Looker :
 * le rouge/vert est le pire cas de daltonisme — près de 8 % des hommes ne
 * distinguent pas les deux extrêmes — et la charte réserve le rouge au
 * réellement critique.
 *
 * L'opacité plafonne à 32 % : la cellule reste un fond, et le texte garde son
 * propre token d'encre. Une valeur sous la médiane n'est pas peinte du tout —
 * signaler le bon est suffisant, alarmer sur la moitié d'un tableau ne l'est pas.
 */
export function heatmapBackground(rank: number): string | undefined {
  // Échelle **divergente** : les meilleurs en vert, les pires en rouge de la
  // charte, le milieu neutre — deux teintes et un point mort, jamais une
  // rampe continue rouge→vert qui piégerait les daltoniens sur les nuances
  // intermédiaires. Le rouge est un peu plus retenu que le vert : il signale,
  // il ne crie pas sur la moitié du tableau.
  if (Math.abs(rank) <= 0.08) return undefined;
  const magnitude = Math.min(Math.abs(rank), 1);
  /* `--accent` et non `--brand` : ce dernier n'existe pas. `globals.css`
     déclare `--color-brand`, le nom que Tailwind attend pour fabriquer ses
     utilitaires ; la variable CSS brute, celle que `var()` sait lire, reste
     `--accent`. Un `var()` sur un nom inconnu ne rend rien du tout — ici un
     `color-mix` invalide, donc une cellule jamais peinte. */
  return rank > 0
    ? `color-mix(in oklch, var(--accent) ${(magnitude * 32).toFixed(1)}%, transparent)`
    : `color-mix(in oklch, var(--danger) ${(magnitude * 24).toFixed(1)}%, transparent)`;
}
