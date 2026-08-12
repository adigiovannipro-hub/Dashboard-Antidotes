/**
 * Les livrables mensuels : lecture sûre, totaux, et mise à plat pour les
 * prompts.
 *
 * Fonctions pures, sans import Supabase : la colonne est un `jsonb`, donc
 * rien ne garantit sa forme à l'exécution. Une ligne retouchée à la main dans
 * l'éditeur Supabase ne doit pas faire tomber la page — elle est ramenée à la
 * forme attendue plutôt que crue sur parole. C'est aussi ce qui permet de
 * lire sans broncher la **forme d'avant**, où les réseaux n'étaient qu'une
 * liste de noms et le volume un total global.
 */
import {
  networkKey,
  type ContextDeliverableLine,
  type ContextDeliverables,
  type ContextNetworkDeliverables,
} from "./types";

export const EMPTY_DELIVERABLES: ContextDeliverables = {
  intentions: "",
  reseaux: [],
  publications: [],
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
    reseaux: normalizeNetworks(reseaux),
    publications: normalizeLines(publications),
  };
}

/**
 * Réseaux nettoyés, dédoublonnés sans tenir compte de la casse ni des
 * accents, dans l'ordre de saisie : « instagram » et « Instagram » désignent
 * le même réseau, et c'est la première orthographe retenue qui s'affiche.
 *
 * Un simple nom est accepté : c'est la forme d'avant la répartition par
 * réseau, et elle donne un réseau sans quantités plutôt qu'une erreur.
 */
function normalizeNetworks(values: unknown[]): ContextNetworkDeliverables[] {
  const seen = new Map<string, ContextNetworkDeliverables>();
  const result: ContextNetworkDeliverables[] = [];

  for (const value of values) {
    const entry =
      typeof value === "string"
        ? { nom: value, publications: [] }
        : ((value ?? {}) as Partial<ContextNetworkDeliverables>);

    const nom = typeof entry.nom === "string" ? entry.nom.trim() : "";
    if (nom.length === 0) continue;

    const publications = normalizeLines(
      Array.isArray(entry.publications) ? entry.publications : [],
    );

    // Deux fois le même réseau : les lignes se rejoignent au lieu de se
    // perdre, la première orthographe l'emporte.
    const existing = seen.get(networkKey(nom));
    if (existing) {
      existing.publications.push(...publications);
      continue;
    }

    const network = { nom, publications };
    seen.set(networkKey(nom), network);
    result.push(network);
  }

  return result;
}

function normalizeLines(values: unknown[]): ContextDeliverableLine[] {
  return values
    .map(normalizeLine)
    .filter((line): line is ContextDeliverableLine => line !== null);
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

const sum = (lines: ContextDeliverableLine[]) =>
  lines.reduce((total, line) => total + line.quantite, 0);

/** Ce qui est dû sur un réseau donné. */
export function totalForNetwork(network: ContextNetworkDeliverables): number {
  return sum(network.publications);
}

/** Le nombre de publications dues chaque mois, tous réseaux confondus. */
export function totalPublications(deliverables: ContextDeliverables): number {
  return (
    deliverables.reseaux.reduce((total, network) => total + totalForNetwork(network), 0) +
    sum(deliverables.publications)
  );
}

/**
 * « 14 sur Instagram, 2 sur LinkedIn » — la phrase de contexte de la carte de
 * mesure. Elle dit la répartition, qui est l'information utile ; le détail
 * par catégorie se lit dans le panneau, juste en dessous.
 */
export function summarizeDeliverables(deliverables: ContextDeliverables): string {
  const parts = deliverables.reseaux
    .filter((network) => totalForNetwork(network) > 0)
    .map((network) => `${totalForNetwork(network)} sur ${network.nom}`);

  const orphelins = sum(deliverables.publications);
  if (orphelins > 0) parts.push(`${orphelins} hors réseau`);

  return parts.join(", ");
}

/**
 * La forme lue par les prompts de génération. Le volume compte autant que le
 * fond : sans lui, une génération de mois entier ne sait pas combien de
 * publications produire, ni de quelle nature, ni où.
 */
export function renderDeliverables(deliverables: ContextDeliverables): string {
  const parts: string[] = [];

  if (deliverables.reseaux.length > 0) {
    // En tête : la génération doit savoir sur quoi elle écrit avant de savoir
    // combien. Un réseau absent de cette liste ne se travaille pas.
    parts.push(
      `Réseaux du client : ${deliverables.reseaux.map((network) => network.nom).join(", ")}.`,
    );
  }

  const lines: string[] = [];
  for (const network of deliverables.reseaux) {
    const detail = network.publications
      .filter((line) => line.quantite > 0)
      .map((line) => `${line.quantite} ${line.categorie}`);
    if (detail.length === 0) continue;
    lines.push(
      `- ${network.nom} : ${detail.join(", ")} (${totalForNetwork(network)} par mois)`,
    );
  }

  const orphelins = deliverables.publications.filter((line) => line.quantite > 0);
  if (orphelins.length > 0) {
    lines.push(
      `- Hors réseau : ${orphelins.map((line) => `${line.quantite} ${line.categorie}`).join(", ")}`,
    );
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
