/**
 * Les livrables mensuels : lecture sûre, total, et mise à plat pour les
 * prompts.
 *
 * Fonctions pures, sans import Supabase : la colonne est un `jsonb`, donc
 * rien ne garantit sa forme à l'exécution. Une ligne retouchée à la main dans
 * l'éditeur Supabase ne doit pas faire tomber la page — elle est ramenée à la
 * forme attendue plutôt que crue sur parole.
 */
import { networkKey, type ContextDeliverableLine, type ContextDeliverables } from "./types";

export const EMPTY_DELIVERABLES: ContextDeliverables = {
  intentions: "",
  publications: [],
  reseaux: [],
};

/** Ramène une valeur de base à la forme attendue, quoi qu'elle contienne. */
export function normalizeDeliverables(value: unknown): ContextDeliverables {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return EMPTY_DELIVERABLES;
  }

  const source = value as Partial<ContextDeliverables>;
  const publications = Array.isArray(source.publications) ? source.publications : [];
  const reseaux = Array.isArray(source.reseaux) ? source.reseaux : [];

  return {
    intentions: typeof source.intentions === "string" ? source.intentions.trim() : "",
    publications: publications
      .map(normalizeLine)
      .filter((line): line is ContextDeliverableLine => line !== null),
    reseaux: normalizeNetworks(reseaux),
  };
}

/**
 * Réseaux nettoyés, dédoublonnés sans tenir compte de la casse, dans l'ordre
 * de saisie : « instagram » et « Instagram » désignent le même réseau, et
 * c'est la première orthographe retenue qui s'affiche.
 */
function normalizeNetworks(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") continue;
    const name = value.trim();
    if (name.length === 0) continue;

    const key = networkKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }

  return result;
}

function normalizeLine(value: unknown): ContextDeliverableLine | null {
  if (!value || typeof value !== "object") return null;

  const line = value as Partial<ContextDeliverableLine>;
  const categorie = typeof line.categorie === "string" ? line.categorie.trim() : "";
  if (categorie.length === 0) return null;

  // Une quantité absente vaut zéro, jamais « inconnu » : la ligne existe
  // parce qu'on l'a saisie, c'est le nombre qui reste à remplir.
  const quantite = Number(line.quantite);
  return {
    categorie,
    quantite: Number.isFinite(quantite) ? Math.max(0, Math.round(quantite)) : 0,
  };
}

/** Le nombre de publications dues chaque mois, toutes catégories confondues. */
export function totalPublications(deliverables: ContextDeliverables): number {
  return deliverables.publications.reduce((total, line) => total + line.quantite, 0);
}

/** « 4 post fixe, 2 reels » — la phrase de contexte de la carte de mesure. */
export function summarizeDeliverables(deliverables: ContextDeliverables): string {
  return deliverables.publications
    .filter((line) => line.quantite > 0)
    .map((line) => `${line.quantite} ${line.categorie.toLowerCase()}`)
    .join(", ");
}

/**
 * La forme lue par les prompts de génération. Le volume compte autant que le
 * fond : sans lui, une génération de mois entier ne sait pas combien de
 * publications produire, ni de quelle nature.
 */
export function renderDeliverables(deliverables: ContextDeliverables): string {
  const lines = deliverables.publications
    .filter((line) => line.quantite > 0)
    .map((line) => `- ${line.categorie} : ${line.quantite} par mois`);

  const parts: string[] = [];
  if (deliverables.reseaux.length > 0) {
    // En tête : la génération doit savoir sur quoi elle écrit avant de savoir
    // combien. Un réseau absent de cette liste ne se travaille pas.
    parts.push(`Réseaux du client : ${deliverables.reseaux.join(", ")}.`);
  }
  if (lines.length > 0) {
    const total = totalPublications(deliverables);
    parts.push(
      `Livrables mensuels :\n${lines.join("\n")}\nTotal : ${total} publication${total > 1 ? "s" : ""} par mois.`,
    );
  }
  if (deliverables.intentions.trim().length > 0) {
    parts.push(`Livraison des intentions : ${deliverables.intentions.trim()}.`);
  }

  return parts.join("\n");
}
