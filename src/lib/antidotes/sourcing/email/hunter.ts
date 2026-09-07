/**
 * Hunter — le fournisseur international, et le vérificateur des adresses
 * déduites. Son plan gratuit couvre quelques dizaines de recherches et de
 * vérifications par mois : assez pour un pipeline de freelance, et c'est
 * pour cela qu'il vient après Dropcontact sur une cible française.
 */

import { fetchJson, type EmailFinder, type EmailVerifier, type Fetcher } from "../providers";
import { domainOf } from "../email-pattern";
import type { EmailStatus } from "../../types";

export const HUNTER_API = "https://api.hunter.io/v2";

export type HunterFinderPayload = {
  data?: { email?: string | null; score?: number | null; verification?: { status?: string | null } | null };
};

export type HunterVerifierPayload = { data?: { status?: string | null; result?: string | null } };

/** Les statuts de Hunter, ramenés aux quatre de la maison. */
export function statusFromHunter(status: string | null | undefined, score?: number | null): EmailStatus {
  switch (status) {
    case "valid":
    case "deliverable":
      return "valid";
    case "accept_all":
    case "risky":
    case "webmail":
      return "risky";
    case "invalid":
    case "undeliverable":
    case "disposable":
      return "invalid";
    default:
      // Sans vérification, un score élevé vaut « incertain », jamais « valide ».
      return typeof score === "number" && score >= 70 ? "risky" : "unknown";
  }
}

export function createHunterFinder(options: { apiKey: string; fetcher?: Fetcher }): EmailFinder {
  const fetcher = options.fetcher ?? fetch;
  return async (input) => {
    const domain = domainOf(input.website);
    if (!domain) return null;
    const params = new URLSearchParams({
      domain,
      first_name: input.first_name,
      last_name: input.last_name,
      api_key: options.apiKey,
    });
    const payload = await fetchJson<HunterFinderPayload>(
      fetcher,
      "Hunter",
      `${HUNTER_API}/email-finder?${params.toString()}`,
      { timeoutMs: 20_000 },
    );
    const email = payload.data?.email;
    if (!email) return null;
    return {
      email: email.toLowerCase(),
      status: statusFromHunter(payload.data?.verification?.status, payload.data?.score),
      provider: "hunter",
    };
  };
}

export function createHunterVerifier(options: { apiKey: string; fetcher?: Fetcher }): EmailVerifier {
  const fetcher = options.fetcher ?? fetch;
  return async (email) => {
    const params = new URLSearchParams({ email, api_key: options.apiKey });
    const payload = await fetchJson<HunterVerifierPayload>(
      fetcher,
      "Hunter",
      `${HUNTER_API}/email-verifier?${params.toString()}`,
      { timeoutMs: 25_000 },
    );
    return statusFromHunter(payload.data?.status ?? payload.data?.result);
  };
}
