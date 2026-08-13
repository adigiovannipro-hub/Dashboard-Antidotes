import "server-only";

import { z } from "zod";

import type { FathomActionItem, FathomAssignee, FathomMeeting } from "./fathom";

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
 * Les adresses candidates de l'API, essayées dans l'ordre.
 *
 * Il y en a deux parce que l'API n'a **jamais pu être appelée** depuis
 * l'environnement de développement — la politique de sortie du bac à sable la
 * refuse — et qu'une adresse supposée qui se révèle fausse coûte un aller-
 * retour d'une journée pour le découvrir. Le client passe donc à la suivante
 * quand l'hôte ne répond pas du tout, ou répond 404 : dans les deux cas
 * l'adresse est mauvaise. Il **s'arrête** sur 200, 401 ou 403, qui prouvent
 * que l'hôte est le bon et déplacent le problème sur la clé.
 *
 * L'adresse retenue est rendue dans le rapport. Le jour où le premier vrai
 * passage tranche, cette liste se réduit à une ligne.
 *
 * `FATHOM_API_BASE`, s'il est renseigné, gagne seul : il sert à rejouer la
 * chaîne contre un serveur local.
 */
const FATHOM_BASES = process.env.FATHOM_API_BASE?.trim()
  ? [process.env.FATHOM_API_BASE.trim()]
  : ["https://api.fathom.ai/external/v1", "https://api.fathom.video/external/v1"];

/** Une personne : les deux champs qu'on lit, sous leurs noms possibles. */
const personSchema = z
  .object({
    name: z.string().nullish(),
    display_name: z.string().nullish(),
    email: z.string().nullish(),
  })
  .partial()
  .passthrough();

const actionItemSchema = z
  .object({
    description: z.string().nullish(),
    text: z.string().nullish(),
    title: z.string().nullish(),
    completed: z.boolean().nullish(),
    is_completed: z.boolean().nullish(),
    assignee: personSchema.nullish(),
    user: personSchema.nullish(),
    recording_playback_url: z.string().nullish(),
    playback_url: z.string().nullish(),
    url: z.string().nullish(),
  })
  .partial()
  .passthrough();

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
    action_items: z.array(actionItemSchema).nullish(),
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
type RawItem = z.infer<typeof actionItemSchema>;

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

function toActionItem(raw: RawItem): FathomActionItem | null {
  const description = first(raw.description, raw.text, raw.title);
  if (!description) return null;

  return {
    description,
    completed: raw.completed ?? raw.is_completed ?? false,
    assignee: toAssignee(raw.assignee ?? raw.user),
    playbackUrl: first(raw.recording_playback_url, raw.playback_url, raw.url),
  };
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
    actionItems: (raw.action_items ?? [])
      .map(toActionItem)
      .filter((item): item is FathomActionItem => item !== null),
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
      include_action_items: "true",
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
