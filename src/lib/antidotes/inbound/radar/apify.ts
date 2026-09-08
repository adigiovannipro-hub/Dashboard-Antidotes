import { fetchJson, type Fetcher } from "../../sourcing/providers";

/**
 * L'appel synchrone d'un acteur Apify — le même passage que le sourcing :
 * `run-sync-get-dataset-items` rend le jeu de résultats, borné à cinq
 * minutes. Trente posts d'un profil tiennent largement dedans.
 */
export async function runApifyActor<T>(options: {
  fetcher: Fetcher;
  token: string;
  actor: string;
  label: string;
  input: Record<string, unknown>;
}): Promise<T[]> {
  const url = `https://api.apify.com/v2/acts/${options.actor}/run-sync-get-dataset-items?token=${encodeURIComponent(options.token)}&timeout=300&format=json&clean=true`;
  return fetchJson<T[]>(options.fetcher, options.label, url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options.input),
    timeoutMs: 310_000,
  });
}
