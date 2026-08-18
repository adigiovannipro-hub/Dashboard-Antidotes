/**
 * Découper une fenêtre de collecte en tranches.
 *
 * Meta refuse une demande trop large par « Please reduce the amount of data
 * you're asking for, then retry your request ». Le déclencheur n'est pas la
 * durée seule : c'est **durée × ventilation**. Les Insights ventilés par
 * région, au grain jour, rendent une ligne par région et par jour — plusieurs
 * milliers pour un mois, et le rattrapage initial en demande douze d'un coup.
 * Le compte publicitaire d'I-WAY est tombé dessus au premier passage.
 *
 * Découper est la seule réponse : Meta ne propose pas de pagination pour ce
 * refus-là, il refuse la requête entière avant de la calculer.
 *
 * Pur, sans réseau : les bornes se rejouent sur des chaînes.
 */

export type Window = { since: string; until: string };

/** Un jour en millisecondes — les bornes sont des jours, jamais des instants. */
const DAY = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` → millisecondes UTC. Tout le repo calcule les dates en UTC. */
function toUtc(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, date ?? 1);
}

function toDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * La fenêtre découpée en tranches d'au plus `days` jours, dans l'ordre.
 *
 * Les bornes sont **inclusives des deux côtés**, comme le `time_range` de
 * Graph : une tranche de 31 jours va du 1er au 31. Sans cette inclusion, un
 * jour tomberait entre deux tranches à chaque coupe, et le trou ne se verrait
 * que sur la courbe, des semaines plus tard.
 *
 * Une fenêtre à l'envers ou vide ne rend rien plutôt qu'une tranche absurde.
 */
export function splitWindow(window: Window, days: number): Window[] {
  const start = toUtc(window.since);
  const end = toUtc(window.until);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];

  const span = Math.max(1, Math.floor(days));
  const chunks: Window[] = [];

  for (let cursor = start; cursor <= end; cursor += span * DAY) {
    const last = Math.min(cursor + (span - 1) * DAY, end);
    chunks.push({ since: toDay(cursor), until: toDay(last) });
  }

  return chunks;
}

/**
 * Ce refus-là se corrige en demandant moins, pas en rebranchant.
 *
 * Il ne porte pas de numéro d'erreur stable — Meta le rend tantôt en code 1,
 * tantôt en 100 — d'où la reconnaissance sur la phrase, qui, elle, ne bouge
 * pas.
 */
export function isTooMuchData(message: string): boolean {
  return message.toLowerCase().includes("reduce the amount of data");
}

/**
 * Appelle `run` sur la fenêtre, en la découpant de plus en plus fin tant que
 * Meta la trouve trop large.
 *
 * Les paliers descendent jusqu'à la journée : un compte qui dépense beaucoup
 * sur des centaines de régions peut refuser un mois entier, et il n'y a rien
 * en dessous du jour à tenter. Toute autre erreur remonte telle quelle — se
 * découper devant un jeton expiré ferait 365 appels pour le même refus.
 */
export async function collectByChunks<T>(
  window: Window,
  run: (chunk: Window) => Promise<T[]>,
  steps: number[] = [Infinity, 31, 7, 1],
): Promise<T[]> {
  let lastError: unknown = null;

  for (const days of steps) {
    const chunks =
      days === Infinity ? [window] : splitWindow(window, days);
    if (chunks.length === 0) return [];

    try {
      const results: T[] = [];
      // En série, pas en parallèle : découper parce que Meta trouve la
      // demande trop lourde puis lui envoyer douze requêtes d'un coup
      // reviendrait à échanger un refus de volume contre un refus de débit.
      for (const chunk of chunks) results.push(...(await run(chunk)));
      return results;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!isTooMuchData(message)) throw error;
      lastError = error;
    }
  }

  throw lastError ?? new Error("Fenêtre indécoupable.");
}
