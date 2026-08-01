import "server-only";

/**
 * Client Airwallex — lecture seule.
 *
 * Le module n'écrit rien ici, et ce n'est pas un choix de conception : l'API
 * publique Spend expose `List card expenses`, `Get card expense` et un marqueur
 * de synchronisation, mais **aucun endpoint de dépôt de pièce jointe**. Le seul
 * chemin d'écriture est le transfert de mail vers leur boîte de reçus, traité
 * dans `forward.ts`.
 *
 * Ce client sert donc à deux choses : alimenter le rapprochement local, et
 * vérifier après coup qu'une pièce transférée s'est bien accrochée. La seconde
 * est la plus importante — sans elle, on enverrait des mails dans le vide en
 * croyant tenir une comptabilité à jour.
 *
 * Les noms de champs de la réponse ne sont pas figés par un contrat public
 * stable. `normalizeExpense` accepte donc plusieurs orthographes plausibles et
 * conserve la réponse brute : le jour où un champ change de nom, on retraite
 * l'historique sans avoir à resynchroniser douze mois.
 */

export class AirwallexError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "AirwallexError";
  }
}

function credentials() {
  const clientId = process.env.AIRWALLEX_CLIENT_ID;
  const apiKey = process.env.AIRWALLEX_API_KEY;
  if (!clientId || !apiKey) {
    throw new AirwallexError(
      "AIRWALLEX_CLIENT_ID et AIRWALLEX_API_KEY sont requis. Voir docs/recus-setup.md.",
    );
  }
  return { clientId, apiKey };
}

/** Bascule bac à sable : on ne teste pas une chaîne comptable en production. */
function baseUrl(): string {
  return process.env.AIRWALLEX_ENV === "production"
    ? "https://api.airwallex.com"
    : "https://api.sandbox.airwallex.com";
}

/**
 * Jeton d'accès, mis en cache le temps de sa validité.
 *
 * Le cache est au niveau du module : sur un hébergement sans état, chaque
 * instance refera sa propre authentification, ce qui est sans conséquence — le
 * jeton dépend des seules variables d'environnement, jamais d'un utilisateur.
 * Aucune donnée de requête ne doit rejoindre cette variable.
 */
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const { clientId, apiKey } = credentials();
  const response = await fetch(`${baseUrl()}/api/v1/authentication/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-client-id": clientId,
      "x-api-key": apiKey,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new AirwallexError(
      `Authentification Airwallex refusée (${response.status}) — ${detail.slice(0, 200)}`,
      response.status,
      response.status >= 500,
    );
  }

  const payload = (await response.json()) as {
    token: string;
    expires_at?: string;
  };

  cachedToken = {
    value: payload.token,
    // Le jeton vaut trente minutes ; on s'aligne sur la valeur annoncée quand
    // elle est présente, sur une durée prudente sinon.
    expiresAt: payload.expires_at
      ? new Date(payload.expires_at).getTime()
      : Date.now() + 25 * 60 * 1000,
  };
  return cachedToken.value;
}

async function call<T>(path: string): Promise<T> {
  const token = await getToken();
  const response = await fetch(`${baseUrl()}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    // Jeton périmé plus tôt qu'annoncé : on le jette et on retente une fois.
    cachedToken = null;
    const retryToken = await getToken();
    const retry = await fetch(`${baseUrl()}${path}`, {
      headers: { authorization: `Bearer ${retryToken}` },
    });
    if (!retry.ok) {
      throw new AirwallexError(
        `Airwallex ${retry.status} sur ${path}`,
        retry.status,
        retry.status >= 500,
      );
    }
    return (await retry.json()) as T;
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new AirwallexError(
      `Airwallex ${response.status} sur ${path} — ${detail.slice(0, 300)}`,
      response.status,
      response.status === 429 || response.status >= 500,
    );
  }

  return (await response.json()) as T;
}

// --- Normalisation -----------------------------------------------------------

export type NormalizedExpense = {
  external_id: string;
  merchant: string | null;
  amount_cents: number;
  currency: string;
  transaction_date: string | null;
  posted_at: string | null;
  card_last_four: string | null;
  cardholder_name: string | null;
  category: string | null;
  expense_status: string | null;
  attachment_count: number;
  raw: Record<string, unknown>;
};

function pick(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const parts = key.split(".");
    let value: unknown = source;
    for (const part of parts) {
      if (value && typeof value === "object" && part in (value as object)) {
        value = (value as Record<string, unknown>)[part];
      } else {
        value = undefined;
        break;
      }
    }
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

/**
 * Convertit un montant décimal en centimes.
 *
 * Airwallex renvoie des montants décimaux (`24.5`). Multiplier un flottant par
 * cent donne 2449,9999… : l'arrondi n'est pas une précaution, il est nécessaire.
 */
function toCents(value: unknown): number | null {
  if (typeof value === "number") return Math.round(value * 100);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
  }
  return null;
}

function toDateOnly(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function normalizeExpense(
  raw: Record<string, unknown>,
): NormalizedExpense | null {
  const externalId = pick(raw, ["id", "expense_id", "transaction_id"]);
  const amount = toCents(
    pick(raw, ["amount", "billing_amount", "transaction_amount", "total_amount"]),
  );
  const currency = pick(raw, [
    "currency",
    "billing_currency",
    "transaction_currency",
  ]);

  // Sans identifiant, montant ou devise, la ligne n'est bonne à rien : ni à
  // rapprocher, ni à afficher. Mieux vaut la laisser tomber bruyamment.
  if (typeof externalId !== "string" || amount === null || typeof currency !== "string") {
    return null;
  }

  const attachments = pick(raw, ["attachments", "receipts"]);

  return {
    external_id: externalId,
    merchant:
      (pick(raw, [
        "merchant.name",
        "merchant_name",
        "description",
        "vendor",
      ]) as string | undefined) ?? null,
    amount_cents: amount,
    currency: currency.toUpperCase().slice(0, 3),
    transaction_date: toDateOnly(
      pick(raw, ["transaction_date", "transaction_time", "created_at"]),
    ),
    posted_at:
      (pick(raw, ["posted_at", "posted_time", "updated_at"]) as string | undefined) ??
      null,
    card_last_four:
      (pick(raw, ["card.last_four", "card_last_four", "last_four"]) as
        | string
        | undefined) ?? null,
    cardholder_name:
      (pick(raw, ["employee.name", "cardholder_name", "employee_name"]) as
        | string
        | undefined) ?? null,
    category:
      (pick(raw, ["category", "expense_category", "category_name"]) as
        | string
        | undefined) ?? null,
    expense_status:
      (pick(raw, ["status", "expense_status"]) as string | undefined) ?? null,
    attachment_count: Array.isArray(attachments) ? attachments.length : 0,
    raw,
  };
}

// --- Endpoints ---------------------------------------------------------------

type ExpensePage = {
  items?: Record<string, unknown>[];
  page_after?: string;
  has_more?: boolean;
};

/**
 * Dépenses carte, de la plus récente à la plus ancienne.
 *
 * `limit` borne le nombre de pages : une resynchronisation complète ne doit pas
 * pouvoir tourner indéfiniment dans un cron dont le temps d'exécution est
 * plafonné par l'hébergeur.
 */
export async function listExpenses(options: {
  fromDate?: Date;
  limit?: number;
} = {}): Promise<NormalizedExpense[]> {
  const limit = options.limit ?? 500;
  const collected: NormalizedExpense[] = [];
  let pageAfter: string | undefined;

  do {
    const params = new URLSearchParams({ page_size: "100" });
    if (options.fromDate) {
      params.set("from_created_at", options.fromDate.toISOString());
    }
    if (pageAfter) params.set("page_after", pageAfter);

    const page = await call<ExpensePage>(
      `/api/v1/spend/expenses?${params.toString()}`,
    );

    for (const item of page.items ?? []) {
      const normalized = normalizeExpense(item);
      if (normalized) collected.push(normalized);
    }

    pageAfter = page.has_more ? page.page_after : undefined;
  } while (pageAfter && collected.length < limit);

  return collected.slice(0, limit);
}

export async function getExpense(
  externalId: string,
): Promise<NormalizedExpense | null> {
  const raw = await call<Record<string, unknown>>(
    `/api/v1/spend/expenses/${encodeURIComponent(externalId)}`,
  );
  return normalizeExpense(raw);
}

/** Vrai si la connexion aboutit — utilisé par l'écran de configuration. */
export async function checkConnection(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    await getToken();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Connexion impossible.",
    };
  }
}
