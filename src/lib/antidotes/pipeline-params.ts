import { isProspectStatus, type ProspectStatus } from "./types";

/**
 * Les paramètres d'URL du pipeline.
 *
 * Les filtres vivent dans l'URL, en français, comme partout : une vue se
 * met en signet, se partage par lien et survit au rechargement. Tout
 * paramètre illisible retombe sur le défaut plutôt que d'échouer — une URL
 * bricolée à la main doit dégrader l'affichage, pas le casser.
 *
 *   ?secteur=Opticien      secteur exact
 *   ?pays=FR               code pays
 *   ?pubs=1                publicités actives seulement
 *   ?score=50              score minimum
 *   ?reference=Bondet      client de référence (case study miroir)
 *   ?campagne=<uuid>       campagne d'origine
 *   ?statut=contacted      une seule colonne (vue tableau)
 *   ?prospect=<uuid>       le panneau ouvert
 */

export type PipelineFilters = {
  sector: string | null;
  country: string | null;
  adsActive: boolean;
  minScore: number | null;
  referenceClient: string | null;
  campaignId: string | null;
  status: ProspectStatus | null;
};

export type PipelineParams = {
  filters: PipelineFilters;
  /** Le prospect dont le panneau est ouvert. */
  prospectId: string | null;
};

export const PIPELINE_PARAM_KEYS = {
  sector: "secteur",
  country: "pays",
  adsActive: "pubs",
  minScore: "score",
  referenceClient: "reference",
  campaignId: "campagne",
  status: "statut",
  prospect: "prospect",
} as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed.slice(0, 200) : null;
}

function uuid(value: string | undefined): string | null {
  return value && UUID_PATTERN.test(value) ? value.toLowerCase() : null;
}

export function parsePipelineParams(
  query: Record<string, string | string[] | undefined>,
): PipelineParams {
  const first = (key: string): string | undefined => {
    const raw = query[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };

  const country = text(first(PIPELINE_PARAM_KEYS.country))?.toUpperCase() ?? null;
  const scoreRaw = Number.parseInt(first(PIPELINE_PARAM_KEYS.minScore) ?? "", 10);
  const statusRaw = first(PIPELINE_PARAM_KEYS.status) ?? "";

  return {
    filters: {
      sector: text(first(PIPELINE_PARAM_KEYS.sector)),
      country: country && /^[A-Z]{2}$/.test(country) ? country : null,
      adsActive: first(PIPELINE_PARAM_KEYS.adsActive) === "1",
      minScore:
        Number.isFinite(scoreRaw) && scoreRaw > 0 ? Math.min(100, scoreRaw) : null,
      referenceClient: text(first(PIPELINE_PARAM_KEYS.referenceClient)),
      campaignId: uuid(first(PIPELINE_PARAM_KEYS.campaignId)),
      status: isProspectStatus(statusRaw) ? statusRaw : null,
    },
    prospectId: uuid(first(PIPELINE_PARAM_KEYS.prospect)),
  };
}

/**
 * La chaîne de requête après un changement de paramètres : `null` retire la
 * clé. Sert aux filtres comme au panneau — une seule façon d'écrire l'URL.
 */
export function withPipelineParams(
  current: URLSearchParams | string,
  changes: Record<string, string | null>,
): string {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
  }
  const query = next.toString();
  return query.length > 0 ? `?${query}` : "";
}

/** Vrai dès qu'un filtre restreint la liste. */
export function hasActiveFilters(filters: PipelineFilters): boolean {
  return (
    filters.sector !== null ||
    filters.country !== null ||
    filters.adsActive ||
    filters.minScore !== null ||
    filters.referenceClient !== null ||
    filters.campaignId !== null ||
    filters.status !== null
  );
}

/**
 * Applique les filtres en mémoire.
 *
 * Le pipeline d'une organisation se lit entier — quelques centaines de
 * lignes au plus — et se filtre ici plutôt qu'en base : les deux vues, les
 * compteurs de colonnes et la barre de filtres partagent ainsi la même liste,
 * sans qu'un badge promette ce qu'un clic ne montre pas.
 */
export function applyPipelineFilters<
  T extends {
    sector: string | null;
    country: string | null;
    ads_active: boolean;
    score: number;
    reference_client: string | null;
    campaign_id: string | null;
    status: ProspectStatus;
  },
>(rows: T[], filters: PipelineFilters): T[] {
  return rows.filter((row) => {
    if (filters.sector !== null && (row.sector ?? "") !== filters.sector) return false;
    if (filters.country !== null && (row.country ?? "") !== filters.country) return false;
    if (filters.adsActive && !row.ads_active) return false;
    if (filters.minScore !== null && row.score < filters.minScore) return false;
    if (
      filters.referenceClient !== null &&
      (row.reference_client ?? "") !== filters.referenceClient
    ) {
      return false;
    }
    if (filters.campaignId !== null && row.campaign_id !== filters.campaignId) return false;
    if (filters.status !== null && row.status !== filters.status) return false;
    return true;
  });
}
