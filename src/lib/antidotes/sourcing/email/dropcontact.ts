/**
 * Dropcontact — le premier de la cascade sur une cible française.
 *
 * L'API est asynchrone : on dépose un lot, on relit son résultat jusqu'à ce
 * qu'il soit prêt. La qualification de l'adresse est ce qui compte :
 * `nominative@pro` est une adresse nominative vérifiée — la seule qui
 * autorise une séquence —, `catch_all@pro` un domaine qui accepte tout, donc
 * invérifiable : piste LinkedIn.
 */

import { fetchJson, type EmailFinder, type Fetcher } from "../providers";
import { domainOf } from "../email-pattern";
import type { EmailStatus } from "../../types";

export const DROPCONTACT_API = "https://api.dropcontact.io";

export type DropcontactEmail = { email?: string; qualification?: string };
export type DropcontactRow = { email?: DropcontactEmail[] };
export type DropcontactBatch = {
  success?: boolean;
  reason?: string;
  error?: boolean;
  request_id?: string;
  data?: DropcontactRow[];
};

export function statusFromQualification(qualification: string | undefined): EmailStatus {
  if (!qualification) return "unknown";
  if (qualification === "nominative@pro") return "valid";
  if (qualification.startsWith("catch_all")) return "risky";
  if (qualification.endsWith("@perso")) return "risky";
  return "unknown";
}

/** La meilleure adresse d'une ligne : nominative d'abord, catch-all ensuite. */
export function pickDropcontactEmail(row: DropcontactRow | undefined): { email: string; status: EmailStatus } | null {
  const rank: Record<EmailStatus, number> = { valid: 3, risky: 2, unknown: 1, invalid: 0 };
  let best: { email: string; status: EmailStatus } | null = null;
  for (const entry of row?.email ?? []) {
    if (!entry.email) continue;
    const status = statusFromQualification(entry.qualification);
    if (!best || rank[status] > rank[best.status]) best = { email: entry.email.toLowerCase(), status };
  }
  return best;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createDropcontactFinder(options: {
  apiKey: string;
  fetcher?: Fetcher;
  /** Sondage du résultat : intervalle et nombre d'essais. */
  pollMs?: number;
  attempts?: number;
}): EmailFinder {
  const fetcher = options.fetcher ?? fetch;
  const headers = { "X-Access-Token": options.apiKey, "Content-Type": "application/json" };
  return async (input) => {
    const website = domainOf(input.website);
    const submitted = await fetchJson<DropcontactBatch>(fetcher, "Dropcontact", `${DROPCONTACT_API}/batch`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: [
          {
            first_name: input.first_name,
            last_name: input.last_name,
            company: input.company_name,
            ...(website ? { website } : {}),
          },
        ],
        siren: false,
        language: "fr",
      }),
      timeoutMs: 20_000,
    });
    if (!submitted.request_id) return null;

    const attempts = options.attempts ?? 12;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      await sleep(options.pollMs ?? 5_000);
      const batch = await fetchJson<DropcontactBatch>(
        fetcher,
        "Dropcontact",
        `${DROPCONTACT_API}/batch/${submitted.request_id}`,
        { headers, timeoutMs: 20_000 },
      );
      if (batch.success === false && !batch.error) continue;
      const picked = pickDropcontactEmail(batch.data?.[0]);
      return picked ? { ...picked, provider: "dropcontact" } : null;
    }
    return null;
  };
}
