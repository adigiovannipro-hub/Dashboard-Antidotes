/**
 * Le registre légal français — l'API Recherche d'entreprises
 * (`recherche-entreprises.api.gouv.fr`), gratuite et sans clé.
 *
 * Pour une petite structure sans LinkedIn, c'est la source la plus sûre : les
 * dirigeants y sont nommés avec leur qualité (gérant, président), et la
 * tranche d'effectif de l'INSEE donne un ordre de grandeur d'employés — ce
 * qui décide si l'on vise le dirigeant ou le marketing.
 *
 * On ne garde que la fiche dont le nom ressemble à celui de la société et,
 * quand on le connaît, dont le siège est au bon code postal : « Optique
 * Saint-Jean » existe dans dix villes.
 */

import type { PersonCandidate } from "../decision-maker";
import { companyNamesMatch, fetchJson, type Fetcher, type PeopleFinder } from "../providers";

export const REGISTRY_API = "https://recherche-entreprises.api.gouv.fr/search";

export type RegistryDirigeant = {
  nom?: string | null;
  prenoms?: string | null;
  qualite?: string | null;
  type_dirigeant?: string | null;
};

export type RegistryResult = {
  siren?: string;
  nom_complet?: string;
  nom_raison_sociale?: string | null;
  tranche_effectif_salarie?: string | null;
  siege?: { code_postal?: string | null; libelle_commune?: string | null } | null;
  dirigeants?: RegistryDirigeant[];
};

/**
 * Les tranches d'effectif de l'INSEE, ramenées à un point : le milieu de la
 * tranche, ce qui suffit à un seuil de vingt salariés.
 */
export const EMPLOYEE_BRACKETS: Record<string, number> = {
  "00": 0,
  "01": 1,
  "02": 4,
  "03": 7,
  "11": 15,
  "12": 35,
  "21": 75,
  "22": 150,
  "31": 225,
  "32": 375,
  "41": 750,
  "42": 1500,
  "51": 3500,
  "52": 7500,
  "53": 10000,
};

export function employeesFromBracket(code: string | null | undefined): number | null {
  if (!code) return null;
  return EMPLOYEE_BRACKETS[code] ?? null;
}

/** Le meilleur résultat pour une société : nom ressemblant, siège au bon endroit si on le sait. */
export function pickRegistryResult(
  results: RegistryResult[],
  input: { company_name: string; postal_code: string | null; city: string | null },
): RegistryResult | null {
  const named = results.filter((result) => {
    const candidates = [result.nom_complet, result.nom_raison_sociale].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    return candidates.some((name) => companyNamesMatch(name, input.company_name));
  });
  if (named.length === 0) return null;

  const cityKey = input.city?.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() ?? null;
  const located = named.find((result) => {
    if (input.postal_code && result.siege?.code_postal === input.postal_code) return true;
    if (cityKey && result.siege?.libelle_commune) {
      return result.siege.libelle_commune.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() === cityKey;
    }
    return false;
  });
  // Sans ville ni code postal connus, le premier nom qui ressemble suffit ;
  // avec, une fiche ailleurs n'est pas la bonne société.
  if (!located && (input.postal_code || input.city)) return null;
  return located ?? named[0] ?? null;
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((part) => (part.trim() && part !== "-" ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join("");
}

export function registryPeople(result: RegistryResult): PersonCandidate[] {
  return (result.dirigeants ?? [])
    .filter((dirigeant) => (dirigeant.type_dirigeant ?? "personne physique") === "personne physique")
    .filter((dirigeant) => dirigeant.nom || dirigeant.prenoms)
    .map((dirigeant) => ({
      first_name: dirigeant.prenoms ? titleCase(dirigeant.prenoms.split(/[\s,]+/)[0] ?? "") || null : null,
      last_name: dirigeant.nom ? titleCase(dirigeant.nom) : null,
      role: dirigeant.qualite?.trim() || null,
      source: "legal_registry" as const,
    }));
}

export function createLegalRegistryFinder(options: { fetcher?: Fetcher } = {}): PeopleFinder {
  const fetcher = options.fetcher ?? fetch;
  return async (input) => {
    const params = new URLSearchParams({ q: input.company_name, per_page: "10", page: "1" });
    if (input.postal_code) params.set("code_postal", input.postal_code);
    const payload = await fetchJson<{ results?: RegistryResult[] }>(
      fetcher,
      "Registre légal",
      `${REGISTRY_API}?${params.toString()}`,
      { headers: { Accept: "application/json" }, timeoutMs: 15_000 },
    );
    const result = pickRegistryResult(payload.results ?? [], input);
    if (!result) return { people: [] };
    return {
      people: registryPeople(result),
      employees: employeesFromBracket(result.tranche_effectif_salarie),
      siren: result.siren ?? null,
    };
  };
}
