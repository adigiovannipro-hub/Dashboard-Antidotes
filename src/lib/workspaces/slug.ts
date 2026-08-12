/**
 * Fabrication d'un identifiant d'URL à partir d'un nom saisi.
 *
 * Fonction pure : le slug voyage dans l'URL et dans la contrainte d'unicité
 * `(org_id, slug)`, il ne doit dépendre de rien d'autre que du texte reçu.
 */

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

/**
 * Le premier slug libre à partir d'une base : `bondet`, puis `bondet-2`.
 *
 * Un nom entièrement composé de caractères non latins donnerait un slug vide,
 * qui casserait l'URL : on retombe alors sur `espace`.
 */
export function uniqueSlug(base: string, taken: Set<string>): string {
  const root = slugify(base) || "espace";
  if (!taken.has(root)) return root;

  for (let suffix = 2; suffix <= 999; suffix += 1) {
    const candidate = `${root}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }

  throw new Error("Trop d'espaces portent déjà ce nom.");
}
