/**
 * Retrouver un espace à partir de ce qu'un humain a écrit.
 *
 * Un fichier de reprise nomme ses clients comme on les nomme à l'oral —
 * « I-WAY », « Bondet ». Le slug, lui, est dérivé une fois à la création et
 * personne ne le connaît par cœur : `i-way`, `iway`, `i-way-2` selon ce qui
 * était déjà pris. Deviner le slug d'après le nom a fait tomber 28 relevés
 * sur 32, sans que le passage échoue.
 *
 * On rapproche donc sur **le slug ou le nom**, tous deux normalisés. Pur :
 * la comparaison se rejoue sur des chaînes.
 */

/** Minuscules, sans accents, ponctuation et espaces réduits à rien. */
export function foldWorkspaceKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export type WorkspaceIdentity = { id: string; slug: string; name: string };

/**
 * L'espace désigné par un libellé, ou `null`.
 *
 * Le slug l'emporte sur le nom : deux clients peuvent porter le même nom
 * affiché le temps d'une duplication, jamais le même slug.
 */
export function findWorkspaceByLabel(
  label: string,
  workspaces: readonly WorkspaceIdentity[],
): WorkspaceIdentity | null {
  const wanted = foldWorkspaceKey(label);
  if (wanted.length === 0) return null;

  return (
    workspaces.find((w) => foldWorkspaceKey(w.slug) === wanted) ??
    workspaces.find((w) => foldWorkspaceKey(w.name) === wanted) ??
    null
  );
}
