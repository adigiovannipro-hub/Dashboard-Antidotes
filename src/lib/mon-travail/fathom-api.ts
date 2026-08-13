import "server-only";

import { z } from "zod";

import type { FathomAssignee, FathomMeeting } from "./fathom";

/**
 * Le client HTTP de l'API externe Fathom.
 *
 * Le schéma est **tolérant par conception**. L'API n'a pas pu être appelée
 * depuis l'environnement de développement — le proxy sortant la refuse — et un
 * parseur strict écrit sur une forme supposée se serait cassé au premier vrai
 * passage, sans dire pourquoi. Ici : chaque champ accepte ses variantes
 * plausibles, tout ce qui est inconnu est ignoré, et un objet illisible est
 * rendu avec **les clés qu'il portait** dans le rapport du cron. Le premier
 * passage réel diagnostique donc lui-même ce qu'il faut corriger.
 */

/**
 * L'adresse de l'API, **confirmée par un vrai passage** : 12 réunions lues,
 * 47 tâches créées.
 *
 * Elle a été un pari le temps du développement — la politique de sortie de
 * l'environnement refuse cet hôte, l'appel n'y était donc pas vérifiable — et
 * le client essayait alors plusieurs candidates en rapportant celle qui
 * répondait. Maintenant qu'elle est connue, une seconde adresse ne serait plus
 * une sécurité mais un risque : sur une panne DNS passagère, le client
 * basculerait en silence vers un hôte qui n'est pas celui de Fathom.
 *
 * `FATHOM_API_BASE` reste, pour rejouer la chaîne contre un serveur local.
 */
const FATHOM_BASES = [
  process.env.FATHOM_API_BASE?.trim() || "https://api.fathom.ai/external/v1",
];

/** Une personne : les deux champs qu'on lit, sous leurs noms possibles. */
const personSchema = z
  .object({
    name: z.string().nullish(),
    display_name: z.string().nullish(),
    email: z.string().nullish(),
  })
  .partial()
  .passthrough();

/** Le compte rendu : un objet à plusieurs rendus, ou déjà une chaîne. */
const summarySchema = z.union([
  z.string(),
  z
    .object({
      markdown_formatted: z.string().nullish(),
      markdown: z.string().nullish(),
      text: z.string().nullish(),
      formatted: z.string().nullish(),
    })
    .partial()
    .passthrough(),
]);

const meetingSchema = z
  .object({
    id: z.union([z.string(), z.number()]).nullish(),
    recording_id: z.union([z.string(), z.number()]).nullish(),
    title: z.string().nullish(),
    meeting_title: z.string().nullish(),
    url: z.string().nullish(),
    share_url: z.string().nullish(),
    recording_url: z.string().nullish(),
    created_at: z.string().nullish(),
    scheduled_start_time: z.string().nullish(),
    recording_start_time: z.string().nullish(),
    meeting_start_time: z.string().nullish(),
    recorded_by: personSchema.nullish(),
    default_summary: summarySchema.nullish(),
    summary: summarySchema.nullish(),
    ai_summary: summarySchema.nullish(),
  })
  .partial()
  .passthrough();

const pageSchema = z
  .object({
    items: z.array(meetingSchema).nullish(),
    data: z.array(meetingSchema).nullish(),
    meetings: z.array(meetingSchema).nullish(),
    next_cursor: z.string().nullish(),
    cursor: z.string().nullish(),
  })
  .partial()
  .passthrough();

type RawMeeting = z.infer<typeof meetingSchema>;

/** Première valeur non vide — le champ existe sous plusieurs noms selon l'endpoint. */
function first(...values: (string | number | null | undefined)[]): string | null {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text.length > 0) return text;
  }
  return null;
}

function toAssignee(raw: unknown): FathomAssignee | null {
  const parsed = personSchema.safeParse(raw);
  if (!parsed.success) return null;
  const name = first(parsed.data.name, parsed.data.display_name);
  const email = first(parsed.data.email);
  return name || email ? { name, email } : null;
}

/** Le markdown du compte rendu, quelle que soit la forme rendue. */
function toSummary(raw: unknown): string | null {
  if (typeof raw === "string") return raw.trim() || null;
  const parsed = summarySchema.safeParse(raw);
  if (!parsed.success || typeof parsed.data === "string") return null;
  return first(
    parsed.data.markdown_formatted,
    parsed.data.markdown,
    parsed.data.formatted,
    parsed.data.text,
  );
}

function toMeeting(raw: RawMeeting): FathomMeeting | null {
  const id = first(raw.recording_id, raw.id);
  const title = first(raw.title, raw.meeting_title);
  const startedAt = first(
    raw.recording_start_time,
    raw.scheduled_start_time,
    raw.meeting_start_time,
    raw.created_at,
  );
  if (!id || !title || !startedAt) return null;

  return {
    id,
    title,
    url: first(raw.url, raw.share_url, raw.recording_url),
    startedAt,
    recordedBy: toAssignee(raw.recorded_by),
    summary: toSummary(raw.default_summary ?? raw.summary ?? raw.ai_summary),
  };
}

export type FathomFetch = {
  meetings: FathomMeeting[];
  /** Objets rendus par l'API mais illisibles, avec leurs clés — pour le rapport. */
  unreadable: string[];
  /** L'adresse qui a effectivement répondu — pour le rapport. */
  base: string;
};

/**
 * Appelle une page, en essayant les adresses candidates dans l'ordre.
 *
 * Une erreur réseau ou un 404 disqualifient l'adresse et font passer à la
 * suivante. Un 401 ou un 403 l'accréditent au contraire : l'hôte existe et
 * discute, le problème est la clé — et remonte donc tel quel.
 */
async function fetchPage(
  bases: string[],
  path: string,
  options: { apiKey: string; signal?: AbortSignal },
): Promise<{ response: Response; base: string }> {
  const tried: string[] = [];

  for (const base of bases) {
    const url = new URL(`${base}${path}`);
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { "X-Api-Key": options.apiKey, accept: "application/json" },
        signal: options.signal,
        cache: "no-store",
      });
    } catch (cause) {
      // `fetch` jette un « fetch failed » sans contexte quand le nom est
      // inconnu : on note l'adresse, sans quoi le rapport ne dirait rien.
      tried.push(
        `${url.origin} → ${cause instanceof Error ? cause.message : "erreur réseau"}`,
      );
      continue;
    }

    if (response.status === 404) {
      tried.push(`${url.origin}${url.pathname} → 404`);
      continue;
    }

    return { response, base };
  }

  throw new Error(`Aucune adresse Fathom n'a répondu — ${tried.join(" ; ")}`);
}

/**
 * Les réunions enregistrées depuis une date, tâches de fin comprises.
 *
 * Pagination suivie jusqu'au bout, avec un plafond de pages : un curseur qui
 * ne se termine jamais boucle sans fin, et un cron qui boucle sans fin est un
 * cron qui expire à mi-chemin sans rien écrire.
 */
export async function fetchFathomMeetings(options: {
  apiKey: string;
  since: string;
  maxPages?: number;
  signal?: AbortSignal;
}): Promise<FathomFetch> {
  const meetings: FathomMeeting[] = [];
  const unreadable: string[] = [];
  let cursor: string | null = null;
  // Une fois une adresse retenue, les pages suivantes n'en changent plus.
  let bases = FATHOM_BASES;
  let base = bases[0]!;

  for (let page = 0; page < (options.maxPages ?? 10); page += 1) {
    const query = new URLSearchParams({
      created_after: `${options.since}T00:00:00Z`,
      include_summary: "true",
    });
    if (cursor) query.set("cursor", cursor);

    const attempt = await fetchPage(bases, `/meetings?${query}`, options);
    const response = attempt.response;
    base = attempt.base;
    bases = [base];

    if (!response.ok) {
      const body = (await response.text()).slice(0, 300);
      throw new Error(`Fathom (${base}) a répondu ${response.status} : ${body}`);
    }

    const parsed = pageSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new Error(
        "Réponse Fathom au format inattendu — la liste des réunions est introuvable.",
      );
    }

    const rows = parsed.data.items ?? parsed.data.data ?? parsed.data.meetings ?? [];
    for (const row of rows) {
      const meeting = toMeeting(row);
      if (meeting) meetings.push(meeting);
      else unreadable.push(Object.keys(row).join(","));
    }

    cursor = first(parsed.data.next_cursor, parsed.data.cursor);
    if (!cursor || rows.length === 0) break;
  }

  return { meetings, unreadable, base };
}
