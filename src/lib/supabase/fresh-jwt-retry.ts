/**
 * PostgREST refuse parfois un jeton **tout juste émis**.
 *
 * Relevé en production le 7/10/2026 : juste après le rafraîchissement d'une
 * session (une heure d'inactivité, onglet Chrome rechargé au retour), une des
 * trois lectures parallèles de `getViewer` revenait en 401 `PGRST303` — la
 * validation des claims du jeton — alors que les deux autres, portant le même
 * jeton à la même milliseconde, passaient. Le jeton avait 1,7 à 2,4 secondes ;
 * quatre secondes plus tard, tout passait. C'est la date d'émission que l'API
 * juge encore dans le futur, un écart d'horloge de son côté.
 *
 * Le refus ne dure que quelques secondes, mais il coûtait une page entière :
 * la liste des espaces revenait vide, et l'espace demandé répondait 404.
 *
 * On rejoue donc la requête, et **seulement** celle-là : un 401 `PGRST303`
 * portant un jeton émis il y a moins d'une minute. Un jeton expiré ou faux
 * n'est pas rejoué — attendre ne le rendrait pas valide. Le refus arrive
 * avant toute exécution SQL, donc rejouer une écriture ne la double pas.
 */

/** Attentes successives avant de rejouer : 1, 3 puis 6 secondes cumulées. */
export const FRESH_JWT_RETRY_DELAYS_MS: readonly number[] = [1_000, 2_000, 3_000];

/** Âge au-delà duquel un refus du jeton n'est plus un écart d'horloge. */
export const FRESH_JWT_MAX_AGE_MS = 60_000;

const CLAIMS_REJECTED = "PGRST303";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** La date d'émission (`iat`, en secondes) du jeton porté par la requête. */
export function bearerIssuedAt(init?: RequestInit): number | null {
  const authorization = new Headers(init?.headers).get("authorization");
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const payload = token?.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof json?.iat === "number" ? json.iat : null;
  } catch {
    return null;
  }
}

/** Le jeton a-t-il été émis il y a moins d'une minute (ou « dans le futur ») ? */
export function isFreshToken(issuedAt: number | null, now: number): boolean {
  if (issuedAt === null) return false;
  return now - issuedAt * 1_000 < FRESH_JWT_MAX_AGE_MS;
}

/** La réponse est-elle le refus des claims du jeton par PostgREST ? */
export async function isClaimsRejection(response: Response): Promise<boolean> {
  if (response.status !== 401) return false;
  if (response.headers.get("proxy-status")?.includes(CLAIMS_REJECTED)) return true;
  try {
    const body = JSON.parse(await response.clone().text());
    return body?.code === CLAIMS_REJECTED;
  } catch {
    return false;
  }
}

/** Une requête se rejoue telle quelle si son corps n'est pas un flux déjà lu. */
function isReplayable(input: RequestInfo | URL, init?: RequestInit): boolean {
  if (typeof Request !== "undefined" && input instanceof Request) return false;
  const body = init?.body;
  return body === undefined || body === null || typeof body === "string";
}

/**
 * Enveloppe un `fetch` pour rejouer le refus d'un jeton tout juste émis.
 * Toute autre réponse passe telle quelle, au premier essai.
 */
export function withFreshJwtRetry(
  base: FetchLike,
  options: {
    delays?: readonly number[];
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
  } = {},
): FetchLike {
  const delays = options.delays ?? FRESH_JWT_RETRY_DELAYS_MS;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;

  return async (input, init) => {
    let response = await base(input, init);
    if (!isReplayable(input, init)) return response;

    for (const delay of delays) {
      if (!(await isClaimsRejection(response))) return response;
      if (!isFreshToken(bearerIssuedAt(init), now())) return response;
      await sleep(delay);
      response = await base(input, init);
    }
    return response;
  };
}
