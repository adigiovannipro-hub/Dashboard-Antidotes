/**
 * L'identité d'une entreprise française, depuis son SIREN, son SIRET ou son
 * numéro de TVA.
 *
 * Source : `recherche-entreprises.api.gouv.fr`, l'API publique de l'annuaire
 * des entreprises. Ni clé, ni compte, ni quota facturé — la donnée est celle
 * de l'INSEE, publique par construction. C'est la raison pour laquelle elle
 * est préférée à un connecteur tiers : rien à brancher, rien à renouveler.
 *
 * Le numéro de TVA français **contient le SIREN** : `FR` + deux caractères de
 * clé + les neuf chiffres du SIREN. On n'a donc qu'une seule recherche à
 * faire, quel que soit ce qu'on a collé.
 *
 * Module pur côté extraction, réseau côté recherche : la première moitié se
 * teste sans rien appeler.
 */

/** Ce qu'on sait extraire d'un identifiant collé, réduit au SIREN. */
export function sirenFrom(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[^0-9A-Z]/g, "");

  /* Numéro de TVA : FR, deux caractères de clé, neuf chiffres de SIREN. */
  const tva = cleaned.match(/^FR[0-9A-Z]{2}(\d{9})$/);
  if (tva) return tva[1]!;

  /* SIRET : les neuf premiers chiffres sont le SIREN, les cinq suivants
     désignent l'établissement — c'est le siège qui nous intéresse. */
  if (/^\d{14}$/.test(cleaned)) return cleaned.slice(0, 9);

  if (/^\d{9}$/.test(cleaned)) return cleaned;

  return null;
}

export type Entreprise = {
  name: string;
  street: string | null;
  postcode: string | null;
  city: string | null;
  /** Le numéro de TVA intracommunautaire, recalculé depuis le SIREN. */
  taxId: string;
  siren: string;
};

/**
 * La clé du numéro de TVA français : `(12 + 3 × (SIREN mod 97)) mod 97`.
 *
 * Calculée et non demandée : on l'a déjà, et faire recopier deux caractères
 * qu'une formule donne est une occasion de faute de frappe sur un document
 * comptable.
 */
function tvaKey(siren: string): string {
  const key = (12 + 3 * (Number(siren) % 97)) % 97;
  return String(key).padStart(2, "0");
}

type ApiResult = {
  results?: {
    siren?: string;
    nom_complet?: string;
    nom_raison_sociale?: string;
    siege?: {
      numero_voie?: string;
      type_voie?: string;
      libelle_voie?: string;
      adresse?: string;
      code_postal?: string;
      libelle_commune?: string;
    };
  }[];
};

/**
 * L'entreprise derrière un identifiant. `null` quand l'annuaire ne la connaît
 * pas — un SIREN radié ou une faute de frappe.
 *
 * L'adresse est reconstruite à partir des composants quand ils existent :
 * `adresse` arrive tout en majuscules et code postal compris, ce qui va mal
 * dans un champ « rue ».
 */
export async function lookupEntreprise(input: string): Promise<Entreprise | null> {
  const siren = sirenFrom(input);
  if (!siren) return null;

  const response = await fetch(
    `https://recherche-entreprises.api.gouv.fr/search?q=${siren}&limite=1`,
    { headers: { accept: "application/json" }, cache: "no-store" },
  );
  if (!response.ok) return null;

  const payload = (await response.json()) as ApiResult;
  const found = payload.results?.[0];
  if (!found?.siren) return null;

  const siege = found.siege ?? {};
  const street =
    [siege.numero_voie, siege.type_voie, siege.libelle_voie]
      .filter(Boolean)
      .join(" ")
      .trim() || null;

  return {
    name: found.nom_complet ?? found.nom_raison_sociale ?? "",
    street,
    postcode: siege.code_postal ?? null,
    city: siege.libelle_commune ?? null,
    taxId: `FR${tvaKey(found.siren)}${found.siren}`,
    siren: found.siren,
  };
}
