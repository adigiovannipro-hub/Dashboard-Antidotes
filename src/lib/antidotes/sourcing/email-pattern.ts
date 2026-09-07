/**
 * Déduire une adresse depuis un nom et un domaine.
 *
 * Le dernier recours de la cascade, et le seul gratuit. Une adresse déduite
 * n'est **jamais** `valid` : elle sort `risky` — piste LinkedIn — tant qu'un
 * vérificateur ne l'a pas confirmée, parce qu'au-delà de 3 % de rebonds un
 * domaine d'envoi bascule en spam et n'en revient pas.
 *
 * Module pur, testé.
 */

/** Les motifs, du plus courant au plus rare en France. */
export const EMAIL_PATTERNS = [
  "{first}.{last}",
  "{f}{last}",
  "{first}",
  "{f}.{last}",
  "{first}{last}",
  "{last}",
  "{first}_{last}",
  "{last}.{first}",
] as const;

export type EmailPattern = (typeof EMAIL_PATTERNS)[number];

/* Une boîte gratuite n'est pas un domaine de société : on n'y déduit rien. */
const FREE_MAILBOX_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.fr",
  "outlook.com",
  "outlook.fr",
  "live.fr",
  "live.com",
  "yahoo.fr",
  "yahoo.com",
  "orange.fr",
  "wanadoo.fr",
  "free.fr",
  "sfr.fr",
  "laposte.net",
  "bbox.fr",
  "icloud.com",
  "me.com",
  "protonmail.com",
  "proton.me",
]);

/* Un site hébergé chez un tiers n'a pas de domaine à lui. */
const PLATFORM_HOSTS = ["facebook.com", "instagram.com", "linkedin.com", "wixsite.com", "business.site", "google.com"];

/** Le domaine d'un site — `https://www.lunettes-bondet.fr/collection` → `lunettes-bondet.fr`. */
export function domainOf(website: string | null | undefined): string | null {
  if (!website) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(website) ? website : `https://${website}`;
  try {
    const host = new URL(candidate).hostname.toLowerCase().replace(/^www\./, "");
    if (!host.includes(".")) return null;
    if (PLATFORM_HOSTS.some((platform) => host === platform || host.endsWith(`.${platform}`))) {
      return null;
    }
    if (FREE_MAILBOX_DOMAINS.has(host)) return null;
    return host;
  } catch {
    return null;
  }
}

/** « Jean-Pierre » → `jean-pierre`, « Émilie » → `emilie`, « De la Tour » → `delatour`. */
export function emailToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9-]/g, "");
}

export function applyPattern(
  pattern: EmailPattern,
  name: { first_name: string; last_name: string },
  domain: string,
): string | null {
  const first = emailToken(name.first_name);
  const last = emailToken(name.last_name);
  if (!first || !last) return null;
  const local = pattern
    .replace("{first}", first)
    .replace("{last}", last)
    .replace("{f}", first.charAt(0));
  return `${local}@${domain}`;
}

/**
 * Les adresses possibles, dans l'ordre à essayer. Vide sans domaine de
 * société ou sans nom complet — on ne devine pas une adresse à moitié.
 */
export function inferEmails(
  name: { first_name: string | null; last_name: string | null },
  website: string | null,
): string[] {
  const domain = domainOf(website);
  if (!domain || !name.first_name || !name.last_name) return [];
  const full = { first_name: name.first_name, last_name: name.last_name };
  const emails = EMAIL_PATTERNS.map((pattern) => applyPattern(pattern, full, domain)).filter(
    (email): email is string => email !== null,
  );
  return [...new Set(emails)];
}
