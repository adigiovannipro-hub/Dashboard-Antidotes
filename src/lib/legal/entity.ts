/**
 * L'identité juridique publiée sur les pages légales.
 *
 * Rassemblée ici et nulle part ailleurs : les mentions se répètent d'une page
 * à l'autre, et deux copies divergeraient au premier changement d'adresse.
 *
 * **Les champs vides ne s'affichent pas.** Une page légale qui montre
 * « [à compléter] » est pire qu'une page qui tait la ligne : elle est lue par
 * un client, et le jour de la revue d'une app, par un examinateur. Ce fichier
 * est donc le seul endroit à remplir, et la page reste présentable
 * entre-temps.
 *
 * **Rien d'identifiant à titre personnel n'entre ici.** Le numéro
 * d'immatriculation et l'adresse du siège sont des registres publics ; un
 * numéro de passeport, une date de naissance ou une pièce d'identité n'ont
 * rien à faire sur une page publique, quel que soit le formulaire qui les
 * réclame par ailleurs.
 */

export const LEGAL_ENTITY = {
  /** Le nom commercial, celui que voient les clients. */
  nom: "Antidotes",
  /**
   * La raison sociale exacte telle qu'elle figure au registre.
   *
   * Reste vide tant qu'elle n'est pas confirmée : l'inventer serait pire que
   * de l'omettre — c'est le nom que vérifierait une autorité.
   */
  raisonSociale: "",
  /** Le pays d'immatriculation, quand il n'est pas la France. */
  juridiction: "Hong Kong SAR",
  /** Le numéro au registre du pays d'immatriculation (BRN à Hong Kong). */
  immatriculation: "79686285",
  /** La date d'immatriculation, au format lisible. */
  immatriculeeLe: "26 janvier 2026",
  /** Adresse du siège, sur une seule ligne. */
  adresse: "2301, 23/F Bayfield Building, 99 Hennessy Road, Wanchai, Hong Kong",
  /** L'adresse de contact pour toute question sur les données. */
  email: "a.digiovanni.pro@gmail.com",
  /** Le directeur de la publication. */
  responsable: "Alessandro Di Giovanni",
  /**
   * Le représentant dans l'Union européenne — **article 27 du RGPD**.
   *
   * Un responsable de traitement établi hors de l'Union qui traite des données
   * de personnes qui s'y trouvent doit en désigner un par écrit, et le nommer
   * dans sa politique de confidentialité. L'exemption de l'article 27(2) vise
   * un traitement « occasionnel » et sans risque : la modération de
   * commentaires et de messages privés, en continu, n'y entre pas.
   *
   * Tant que ce champ est vide, la section correspondante ne s'affiche pas —
   * mieux vaut une politique muette sur ce point qu'une politique qui annonce
   * un représentant inexistant.
   */
  representantUE: { nom: "", adresse: "", email: "" },
  /**
   * Le droit qui régit les conditions d'utilisation.
   *
   * Le français, bien que la société soit immatriculée à Hong Kong : les
   * clients et les prestations le sont. Un choix de droit se fait, il ne se
   * déduit pas du lieu d'immatriculation — d'où cette constante plutôt qu'une
   * phrase noyée dans la page.
   */
  droitApplicable: "français",
} as const;

/** L'hébergeur de l'application, à mentionner dans les mentions légales. */
export const HEBERGEURS = [
  { nom: "Vercel Inc.", role: "hébergement de l'application" },
  { nom: "Supabase Inc.", role: "hébergement de la base de données et des fichiers" },
] as const;

/**
 * La date de dernière révision des textes, affichée en tête de page.
 *
 * À la main : une date automatique changerait à chaque déploiement et
 * annoncerait une révision qui n'a pas eu lieu.
 */
export const LEGAL_MAJ = "3 septembre 2026";

/** Les lignes d'identité effectivement renseignées, dans l'ordre d'affichage. */
export function identityLines(): string[] {
  const { raisonSociale, juridiction, immatriculation, immatriculeeLe, adresse } =
    LEGAL_ENTITY;

  const immatriculee = [
    juridiction ? `Société immatriculée à ${juridiction}` : "",
    immatriculeeLe ? `le ${immatriculeeLe}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return [
    raisonSociale,
    immatriculee,
    immatriculation ? `Numéro d'enregistrement ${immatriculation}` : "",
    adresse,
  ].filter(Boolean);
}

/** Le représentant dans l'Union est-il désigné ? */
export function hasEuRepresentative(): boolean {
  return Boolean(LEGAL_ENTITY.representantUE.nom);
}
