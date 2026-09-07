/**
 * La cascade d'adresses : les fournisseurs de la campagne, dans son ordre,
 * jusqu'à une adresse **valide**. Une adresse `risky` est gardée en attendant
 * mieux ; une déduction de motif n'est vérifiée que si un vérificateur est
 * branché, et n'est jamais `valid` sans lui.
 *
 * Module pur : les fournisseurs sont injectés, ce qui le rend testable et
 * indépendant des clés.
 */

import { inferEmails } from "../email-pattern";
import type { EmailFinder, EmailInput, EmailResult, EmailVerifier } from "../providers";
import type { EmailProviderKey, EmailStatus } from "../../types";

const RANK: Record<EmailStatus, number> = { valid: 3, risky: 2, unknown: 1, invalid: 0 };

/** Au plus trois vérifications par contact : le quota du vérificateur est mensuel. */
export const MAX_PATTERN_VERIFICATIONS = 3;

export type CascadeOptions = {
  waterfall: { provider: EmailProviderKey; enabled: boolean }[];
  finders: Partial<Record<EmailProviderKey, EmailFinder>>;
  verifier: EmailVerifier | null;
  /** Reçoit chaque échec d'un fournisseur, pour le journal du passage. */
  onError?: (provider: EmailProviderKey, error: unknown) => void;
};

export async function patternFinder(
  input: EmailInput,
  verifier: EmailVerifier | null,
  onError?: (error: unknown) => void,
): Promise<EmailResult | null> {
  const candidates = inferEmails(input, input.website);
  if (candidates.length === 0) return null;
  if (!verifier) return { email: candidates[0]!, status: "risky", provider: "pattern" };

  let fallback: EmailResult | null = null;
  for (const email of candidates.slice(0, MAX_PATTERN_VERIFICATIONS)) {
    try {
      const status = await verifier(email);
      if (status === "valid") return { email, status, provider: "pattern" };
      if (status === "risky" && !fallback) fallback = { email, status, provider: "pattern" };
    } catch (error) {
      onError?.(error);
      break;
    }
  }
  return fallback ?? { email: candidates[0]!, status: "risky", provider: "pattern" };
}

export async function findEmail(input: EmailInput, options: CascadeOptions): Promise<EmailResult | null> {
  let best: EmailResult | null = null;

  for (const step of options.waterfall) {
    if (!step.enabled) continue;
    try {
      const result =
        step.provider === "pattern"
          ? await patternFinder(input, options.verifier, (error) => options.onError?.("pattern", error))
          : await options.finders[step.provider]?.(input);
      if (!result) continue;
      if (result.status === "valid") return result;
      if (!best || RANK[result.status] > RANK[best.status]) best = result;
    } catch (error) {
      options.onError?.(step.provider, error);
    }
  }

  return best;
}
