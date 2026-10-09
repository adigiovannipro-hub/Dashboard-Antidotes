import "server-only";

import { Composio } from "@composio/core";

import { composioEnabled, env } from "@/lib/env";

/**
 * La passerelle Composio : c'est elle qui tient l'autorisation Google
 * (Gmail pour les courriels, Google Calendar pour l'agenda), dans le même
 * projet que le tableau de bord. Le site ne voit jamais un jeton Google.
 *
 * Sans `COMPOSIO_API_KEY`, rien ne part : les courriels attendent dans la
 * boîte d'envoi et l'agenda se replie sur les seules réservations du site.
 */
export type Toolkit = "gmail" | "googlecalendar";

let cached: Composio | null = null;

export function composioClient(): Composio {
  if (!composioEnabled()) {
    throw new Error("COMPOSIO_API_KEY absente : la passerelle Composio n'est pas configurée.");
  }
  if (!cached) {
    const { COMPOSIO_API_KEY, COMPOSIO_BASE_URL } = env();
    cached = new Composio({ apiKey: COMPOSIO_API_KEY, ...(COMPOSIO_BASE_URL ? { baseURL: COMPOSIO_BASE_URL } : {}) });
  }
  return cached;
}

type Account = { id: string; createdAt?: string | null };

const accountCache = new Map<Toolkit, { id: string; at: number }>();

/**
 * Le compte actif le plus récent d'un outil — un rebranchement s'ajoute à
 * côté de l'ancien chez Composio, qui reste « actif » même révoqué.
 *
 * Borné à l'identifiant de l'agence : le projet Composio est partagé avec le
 * tableau de bord, où chaque client range ses comptes sous `espace:<id>` —
 * sans ce filtre, un Gmail branché par un client pourrait servir à écrire
 * aux prospects.
 */
export async function findAccount(toolkit: Toolkit): Promise<string | null> {
  const hit = accountCache.get(toolkit);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.id;
  const list = await composioClient().connectedAccounts.list({
    userIds: [env().COMPOSIO_USER_ID],
    toolkitSlugs: [toolkit],
    statuses: ["ACTIVE"],
  });
  const items = (list.items as Account[]).slice().sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    return tb - ta;
  });
  const first = items[0];
  if (!first) return null;
  accountCache.set(toolkit, { id: first.id, at: Date.now() });
  return first.id;
}

async function execute<T>(toolkit: Toolkit, slug: string, args: Record<string, unknown>): Promise<T> {
  const accountId = await findAccount(toolkit);
  if (!accountId) throw new Error(`Aucun compte ${toolkit} actif chez Composio.`);
  const result = await composioClient().tools.execute(slug, {
    userId: env().COMPOSIO_USER_ID,
    connectedAccountId: accountId,
    version: "latest",
    dangerouslySkipVersionCheck: true,
    arguments: args,
  });
  if (!result.successful) {
    throw new Error(typeof result.error === "string" && result.error ? result.error : `Échec de ${slug} chez Composio.`);
  }
  return (result.data ?? {}) as T;
}

export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

/** Envoie un courriel depuis la boîte Gmail de l'agence. */
export async function sendMail(mail: Mail): Promise<{ id: string | null }> {
  const data = await execute<{ id?: string; response_data?: { id?: string } }>("gmail", "GMAIL_SEND_EMAIL", {
    recipient_email: mail.to,
    subject: mail.subject,
    body: mail.html,
    is_html: true,
  });
  return { id: data.id ?? data.response_data?.id ?? null };
}

export type BusyRange = { start: string; end: string };

/** Les plages occupées de l'agenda sur une fenêtre, en instants ISO. */
export async function calendarBusy(options: { calendarId: string; from: Date; to: Date }): Promise<BusyRange[]> {
  const data = await execute<{
    calendars?: Record<string, { busy?: BusyRange[] }>;
    response_data?: { calendars?: Record<string, { busy?: BusyRange[] }> };
  }>("googlecalendar", "GOOGLECALENDAR_FREE_BUSY_QUERY", {
    timeMin: options.from.toISOString(),
    timeMax: options.to.toISOString(),
    timeZone: "UTC",
    items: [{ id: options.calendarId }],
  });
  const calendars = data.calendars ?? data.response_data?.calendars ?? {};
  return Object.values(calendars).flatMap((calendar) => calendar.busy ?? []);
}

export type CreatedEvent = { id: string | null; meetUrl: string | null; htmlLink: string | null };

/** Crée l'événement, avec un lien Google Meet, et invite le prospect. */
export async function calendarCreateEvent(options: {
  calendarId: string;
  start: Date;
  end: Date;
  summary: string;
  description: string;
  attendeeEmail: string;
  attendeeName: string;
}): Promise<CreatedEvent> {
  type EventData = {
    id?: string;
    hangoutLink?: string;
    htmlLink?: string;
    conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
  };
  const data = await execute<EventData & { response_data?: EventData }>("googlecalendar", "GOOGLECALENDAR_CREATE_EVENT", {
    calendar_id: options.calendarId,
    start_datetime: options.start.toISOString(),
    end_datetime: options.end.toISOString(),
    timezone: "UTC",
    summary: options.summary,
    description: options.description,
    attendees: [{ email: options.attendeeEmail, displayName: options.attendeeName }],
    create_meeting_room: true,
    send_updates: "all",
    guestsCanInviteOthers: false,
  });
  const event = data.response_data ?? data;
  const meet =
    event.hangoutLink ??
    event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri ??
    null;
  return { id: event.id ?? null, meetUrl: meet, htmlLink: event.htmlLink ?? null };
}

/** Supprime l'événement et prévient les invités. */
export async function calendarDeleteEvent(options: { calendarId: string; eventId: string }): Promise<void> {
  await execute("googlecalendar", "GOOGLECALENDAR_DELETE_EVENT", {
    calendar_id: options.calendarId,
    event_id: options.eventId,
    send_updates: "all",
  });
}

/**
 * Le lien d'autorisation d'un outil, demandé dans le projet de l'application
 * — un branchement fait depuis le tableau de bord de Composio irait dans
 * l'espace personnel, invisible d'ici.
 */
export async function connectLink(toolkit: Toolkit, callbackUrl: string): Promise<string> {
  const composio = composioClient();
  const configs = await composio.authConfigs.list({ toolkit });
  let config = configs.items.find((item) => item.status === "ENABLED") ?? configs.items[0];
  if (!config) {
    const created = await composio.authConfigs.create(toolkit, { type: "use_composio_managed_auth", name: `${toolkit}-site` });
    config = { id: created.id } as (typeof configs.items)[number];
  }
  const request = await composio.connectedAccounts.link(env().COMPOSIO_USER_ID, config.id, {
    callbackUrl,
    allowMultiple: true,
  });
  if (!request.redirectUrl) throw new Error("Composio n'a pas rendu de lien d'autorisation.");
  accountCache.delete(toolkit);
  return request.redirectUrl;
}
