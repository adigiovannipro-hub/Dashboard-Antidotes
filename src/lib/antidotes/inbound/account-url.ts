import type { PostPlatform } from "../types";

/**
 * Reconnaître un compte à veiller depuis une adresse collée.
 *
 * Le geste demandé est celui-ci : on colle un lien, et c'est tout — pas de
 * liste déroulante de réseau à choisir, pas d'identifiant à retaper. Le
 * réseau se lit dans le domaine, l'identifiant dans le chemin.
 *
 * Pur et testé : c'est la seule façon de couvrir les formes réelles — sans
 * protocole, avec `www.`, avec la sous-locale de LinkedIn (`fr.linkedin.com`),
 * avec les paramètres de suivi que collent les applications mobiles.
 */

export type ParsedAccount = {
  platform: PostPlatform;
  /** L'identifiant tel qu'on l'écrit — `@` retiré, jamais l'URL entière. */
  handle: string;
  /** L'adresse normalisée du profil, ou nulle si on n'a reçu qu'un pseudo. */
  url: string | null;
};

/** Le domaine, sans `www.` ni sous-domaine de langue ou de mobile. */
function hostOf(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).hostname.toLowerCase().replace(/^(www|m|mobile|[a-z]{2})\./, "");
  } catch {
    return null;
  }
}

function segmentsOf(raw: string): string[] {
  const withScheme = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
  try {
    return new URL(withScheme).pathname.split("/").filter((part) => part !== "");
  } catch {
    return [];
  }
}

/** `@pseudo` et `pseudo` désignent la même personne. */
function clean(handle: string): string {
  return decodeURIComponent(handle).replace(/^@/, "").trim();
}

/**
 * Ce que le domaine dit du réseau. Séparé du chemin : un domaine reconnu dont
 * le chemin est vide reste une reconnaissance utile — on saura quoi demander.
 */
const HOSTS: { suffix: string; platform: PostPlatform }[] = [
  { suffix: "linkedin.com", platform: "linkedin" },
  { suffix: "instagram.com", platform: "instagram" },
  { suffix: "youtube.com", platform: "youtube" },
  { suffix: "youtu.be", platform: "youtube" },
  { suffix: "tiktok.com", platform: "tiktok" },
  { suffix: "x.com", platform: "x" },
  { suffix: "twitter.com", platform: "x" },
];

/* Les segments qui ne sont pas un identifiant : sans eux,
   `linkedin.com/in/moi` rendrait « in » comme pseudo. */
const IGNORED: Record<string, Set<string>> = {
  linkedin: new Set(["in", "company", "school", "showcase", "pub"]),
  youtube: new Set(["c", "channel", "user"]),
  instagram: new Set([]),
  tiktok: new Set([]),
  x: new Set(["i"]),
};

export function parseAccountUrl(raw: string): ParsedAccount | null {
  const input = raw.trim();
  if (input === "") return null;

  const host = hostOf(input);
  const entry = host
    ? (HOSTS.find(({ suffix }) => host === suffix || host.endsWith(`.${suffix}`)) ?? null)
    : null;

  if (!entry) return null;

  const segments = segmentsOf(input);
  const ignored = IGNORED[entry.platform] ?? new Set<string>();
  const handle = segments.map(clean).find((segment) => segment !== "" && !ignored.has(segment.toLowerCase()));
  if (!handle) return null;

  return { platform: entry.platform, handle, url: canonicalUrl(entry.platform, handle) };
}

/**
 * L'adresse qu'on garde en base : reconstruite, jamais celle qui a été
 * collée — un lien d'application mobile porte des paramètres de suivi qui
 * périment et qui n'ont rien à faire dans une fiche.
 */
export function canonicalUrl(platform: PostPlatform, handle: string): string {
  const name = clean(handle);
  switch (platform) {
    case "linkedin":
      return `https://www.linkedin.com/in/${name}`;
    case "instagram":
      return `https://www.instagram.com/${name}`;
    case "youtube":
      return `https://www.youtube.com/@${name}`;
    case "tiktok":
      return `https://www.tiktok.com/@${name}`;
    case "x":
      return `https://x.com/${name}`;
  }
}

/**
 * L'adresse d'une **page** LinkedIn, quand le lien collé en désignait une :
 * `parseAccountUrl` range tout en `/in/`, ce qui est juste pour une personne
 * et faux pour une entreprise. Le relevé n'en dépend pas — il travaille sur
 * l'identifiant — mais le lien affiché à l'écran doit ouvrir la bonne page.
 */
export function isCompanyUrl(raw: string): boolean {
  return segmentsOf(raw).some((segment) => segment.toLowerCase() === "company");
}
