/**
 * L'identité juridique publiée sur les pages légales.
 *
 * Rassemblée ici et nulle part ailleurs : les mentions se répètent d'une page
 * à l'autre, et deux copies divergeraient au premier changement d'adresse.
 *
 * **Les champs vides ne s'affichent pas.** Une page légale qui montre
 * « [à compléter] » est pire qu'une page qui n'affiche pas la ligne : elle est
 * lue par un client, et le jour de la revue TikTok, par un examinateur. Ce
 * fichier est donc le seul endroit à remplir, et la page reste présentable
 * entre-temps.
 */

export const LEGAL_ENTITY = {
  /** Le nom commercial, celui que voient les clients. */
  nom: "Antidotes",
  /** La raison sociale, si elle diffère du nom commercial. */
  raisonSociale: "",
  /** Forme juridique — « EI », « SASU », « SARL »… */
  formeJuridique: "",
  siret: "",
  /** Adresse postale du siège, sur une seule ligne. */
  adresse: "",
  /** Numéro de TVA intracommunautaire, s'il y en a un. */
  tva: "",
  /** L'adresse de contact pour toute question sur les données. */
  email: "a.digiovanni.pro@gmail.com",
  /** Le directeur de la publication. */
  responsable: "Alessandro Di Giovanni",
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
  const { raisonSociale, formeJuridique, siret, adresse, tva } = LEGAL_ENTITY;
  return [
    [raisonSociale, formeJuridique].filter(Boolean).join(" — "),
    adresse,
    siret ? `SIRET ${siret}` : "",
    tva ? `TVA ${tva}` : "",
  ].filter(Boolean);
}
