import { localDateKey, offsetMs } from "@/lib/booking/timezone";
import { DEFAULT_AVAILABILITY } from "@/lib/booking/slots";
import type { BookingDto, SlotDto } from "@/lib/funnel-contract";
import { QUESTIONS, validateAnswers, type Answers, type QuestionId, type Temperature } from "@/lib/questionnaire";

/**
 * La logique pure du tunnel — le réducteur d'étapes, la persistance, les
 * créneaux groupés par jour du visiteur, les fuseaux et les raccourcis
 * clavier. Aucun accès au DOM ni à `window` : tout se teste en Node.
 *
 * L'ordre (retours du 10/10/2026) : la première question s'affiche d'emblée,
 * les six réponses restent dans le navigateur, et l'adresse ne se demande
 * qu'à la fin — c'est elle qui crée le lead, puis le jeu complet part au
 * serveur. La note sur 10 n'apparaît nulle part ici : le serveur la calcule
 * et ne rend que la température, qui décide seulement de l'écran suivant.
 */

/** La clé de `sessionStorage`. Le suffixe suit la forme de l'état : un parcours enregistré par l'ancien ordre n'est jamais relu. */
export const STORAGE_KEY = "antidotes-funnel-v2";

export const STEPS = ["question", "email", "computing", "ready", "cold", "booking", "confirmed"] as const;
export type Step = (typeof STEPS)[number];

export type FunnelState = {
  step: Step;
  /** L'indice dans `QUESTIONS`, significatif seulement en étape `question`. */
  questionIndex: number;
  answers: Answers;
  leadId: string | null;
  firstName: string;
  temperature: Temperature | null;
  tipsSent: boolean;
  booking: BookingDto | null;
  /** Le fuseau dans lequel le rendez-vous a été choisi, pour l'afficher pareil après rechargement. */
  bookingTimeZone: string | null;
};

export const INITIAL_STATE: FunnelState = {
  step: "question",
  questionIndex: 0,
  answers: {},
  leadId: null,
  firstName: "",
  temperature: null,
  tipsSent: false,
  booking: null,
  bookingTimeZone: null,
};

export type FunnelAction =
  | { type: "answer"; questionId: QuestionId; value: string | string[] }
  | { type: "back" }
  | { type: "lead_created"; leadId: string; firstName: string }
  | { type: "goto_question"; index: number }
  | { type: "computed"; temperature: Temperature | null }
  | { type: "tips_sent" }
  | { type: "book" }
  | { type: "confirmed"; booking: BookingDto; timeZone: string }
  | { type: "reset" };

export const TOTAL_QUESTIONS = QUESTIONS.length;

/** Les étapes que compte la barre de progression : les questions, puis l'adresse. */
export const STEP_COUNT = TOTAL_QUESTIONS + 1;

/** La place d'un écran dans la barre (1 à `STEP_COUNT`), ou `null` hors du questionnaire. */
export function progressStep(state: Pick<FunnelState, "step" | "questionIndex">): number | null {
  if (state.step === "question") return state.questionIndex + 1;
  if (state.step === "email") return STEP_COUNT;
  return null;
}

/** L'indice de la première question sans réponse valable, ou `null` quand tout est répondu. */
export function firstMissingIndex(answers: Answers): number | null {
  const validation = validateAnswers(answers);
  if (validation.ok) return null;
  const index = QUESTIONS.findIndex((question) => question.id === validation.missing[0]);
  return index >= 0 ? index : 0;
}

/** L'écran de résultat d'une température : seul « froid » détourne du rendez-vous. */
export function stepForTemperature(temperature: Temperature | null): Step {
  return temperature === "froid" ? "cold" : "ready";
}

/**
 * Après la dernière question : l'adresse — sauf si le lead existe déjà (une
 * réponse reprise après un refus du serveur, un rechargement pendant le
 * calcul). On ne redemande pas ce qu'on a : le calcul repart directement.
 */
function afterLastAnswer(state: FunnelState, answers: Answers): FunnelState {
  const missing = firstMissingIndex(answers);
  if (missing !== null) return { ...state, answers, step: "question", questionIndex: missing };
  return { ...state, answers, step: state.leadId ? "computing" : "email" };
}

export function reduce(state: FunnelState, action: FunnelAction): FunnelState {
  switch (action.type) {
    case "answer": {
      if (state.step !== "question") return state;
      // Une réponse en retard (un choix unique qui avance tout seul, puis
      // « Suivant » cliqué dans la foulée) ne vaut que pour sa question.
      if (QUESTIONS[state.questionIndex]?.id !== action.questionId) return state;
      const answers: Answers = { ...state.answers, [action.questionId]: action.value };
      return state.questionIndex >= TOTAL_QUESTIONS - 1
        ? afterLastAnswer(state, answers)
        : { ...state, answers, questionIndex: state.questionIndex + 1 };
    }
    case "back":
      switch (state.step) {
        case "question":
          return state.questionIndex > 0 ? { ...state, questionIndex: state.questionIndex - 1 } : state;
        case "email":
          return { ...state, step: "question", questionIndex: TOTAL_QUESTIONS - 1 };
        case "booking":
          return { ...state, step: stepForTemperature(state.temperature) };
        default:
          return state;
      }
    case "lead_created":
      // Le lead est retenu même si l'écran a changé entre-temps : la suite ne redemandera pas l'adresse.
      return {
        ...state,
        leadId: action.leadId,
        firstName: action.firstName,
        step: state.step === "email" ? "computing" : state.step,
      };
    case "goto_question": {
      const index = Math.max(0, Math.min(TOTAL_QUESTIONS - 1, Math.trunc(action.index)));
      return { ...state, step: "question", questionIndex: index };
    }
    case "computed":
      if (state.step !== "computing") return state;
      return { ...state, temperature: action.temperature, step: stepForTemperature(action.temperature) };
    case "tips_sent":
      return { ...state, tipsSent: true };
    case "book":
      return state.step === "ready" || state.step === "cold" ? { ...state, step: "booking" } : state;
    case "confirmed":
      return { ...state, step: "confirmed", booking: action.booking, bookingTimeZone: action.timeZone };
    case "reset":
      return INITIAL_STATE;
  }
}

/* ---------------------------------------------------------------------------
   Persistance — ce qui part dans `sessionStorage` et ce qu'on accepte d'en relire.
   --------------------------------------------------------------------------- */

export function serializeState(state: FunnelState): string {
  return JSON.stringify(state);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStep(value: unknown): value is Step {
  return typeof value === "string" && (STEPS as readonly string[]).includes(value);
}

function readAnswers(value: unknown): Answers {
  if (!isRecord(value)) return {};
  const ids = new Set<string>(QUESTIONS.map((q) => q.id));
  const answers: Answers = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!ids.has(key)) continue;
    if (typeof raw === "string") answers[key as QuestionId] = raw;
    else if (Array.isArray(raw) && raw.every((v) => typeof v === "string")) answers[key as QuestionId] = raw;
  }
  return answers;
}

function readBooking(value: unknown): BookingDto | null {
  if (!isRecord(value)) return null;
  const fields = ["id", "start", "end", "cancelUrl", "icsUrl", "googleUrl"] as const;
  if (!fields.every((f) => typeof value[f] === "string")) return null;
  const meetUrl = typeof value.meetUrl === "string" ? value.meetUrl : null;
  return {
    id: value.id as string,
    start: value.start as string,
    end: value.end as string,
    meetUrl,
    cancelUrl: value.cancelUrl as string,
    icsUrl: value.icsUrl as string,
    googleUrl: value.googleUrl as string,
  };
}

/**
 * Relit un état persisté, ou `null` s'il est illisible ou d'une autre forme.
 *
 * Les questions et l'adresse se relisent sans lead : c'est l'adresse qui le
 * crée. Le reste se remet d'aplomb plutôt que d'échouer :
 *   • au-delà des questions, des réponses incomplètes renvoient à la
 *     première question sans réponse ;
 *   • tout ce qui suit l'adresse sans lead connu revient à l'adresse ;
 *   • un calcul avec son lead reprend tel quel — le tunnel relance l'envoi
 *     complet en arrivant sur l'écran, et le rejouer ne coûte rien ;
 *   • un résultat se recale sur sa température, une confirmation sans
 *     réservation revient au résultat.
 */
export function parseStoredState(raw: string | null): FunnelState | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || !isStep(parsed.step)) return null;
  const leadId = typeof parsed.leadId === "string" && parsed.leadId ? parsed.leadId : null;
  const firstName = typeof parsed.firstName === "string" ? parsed.firstName : "";
  const temperature =
    parsed.temperature === "chaud" || parsed.temperature === "tiede" || parsed.temperature === "froid"
      ? parsed.temperature
      : null;
  const questionIndex =
    typeof parsed.questionIndex === "number" && Number.isInteger(parsed.questionIndex)
      ? Math.max(0, Math.min(TOTAL_QUESTIONS - 1, parsed.questionIndex))
      : 0;
  const state: FunnelState = {
    step: parsed.step,
    questionIndex,
    answers: readAnswers(parsed.answers),
    leadId,
    firstName,
    temperature,
    tipsSent: parsed.tipsSent === true,
    booking: readBooking(parsed.booking),
    bookingTimeZone: typeof parsed.bookingTimeZone === "string" ? parsed.bookingTimeZone : null,
  };
  if (state.step === "question") return state;
  const missing = firstMissingIndex(state.answers);
  if (missing !== null) return { ...state, step: "question", questionIndex: missing };
  if (state.step === "email") return state;
  if (!leadId) return { ...state, step: "email" };
  if (state.step === "computing" || state.step === "booking") return state;
  if (state.step === "confirmed" && state.booking) return state;
  return { ...state, step: stepForTemperature(temperature) };
}

/* ---------------------------------------------------------------------------
   Questions — réponses, raccourcis, progression.
   --------------------------------------------------------------------------- */

export function readMulti(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return typeof value === "string" ? [value] : [];
}

export function toggleChoice(current: readonly string[], option: string): string[] {
  return current.includes(option) ? current.filter((c) => c !== option) : [...current, option];
}

/** La lettre-raccourci d'une option : A, B, C… */
export function shortcutLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

/** L'indice d'option visé par une touche — chiffre 1-9 ou lettre — ou `null`. */
export function optionIndexFromKey(key: string, optionCount: number): number | null {
  if (key.length !== 1) return null;
  let index: number;
  if (key >= "1" && key <= "9") index = Number(key) - 1;
  else if (/^[a-z]$/i.test(key)) index = key.toUpperCase().charCodeAt(0) - 65;
  else return null;
  return index < optionCount ? index : null;
}

/** Remplace `{n}` et `{total}` dans un libellé du dictionnaire. */
export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
}

/** Les paramètres `utm_*` d'une chaîne de recherche. */
export function utmFromSearch(search: string): Record<string, string> {
  const utm: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(search)) {
    if (key.startsWith("utm_") && value) utm[key] = value.slice(0, 200);
  }
  return utm;
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ---------------------------------------------------------------------------
   Créneaux et semaines.
   --------------------------------------------------------------------------- */

export type DayGroup = { day: string; slots: SlotDto[] };

/** Les créneaux groupés par jour civil du visiteur, triés, clés AAAA-MM-JJ. */
export function groupSlotsByDay(slots: readonly SlotDto[], timeZone: string): DayGroup[] {
  const sorted = [...slots].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const groups = new Map<string, SlotDto[]>();
  for (const slot of sorted) {
    const key = localDateKey(new Date(slot.start), timeZone);
    const list = groups.get(key) ?? [];
    list.push(slot);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([day, list]) => ({ day, slots: list }));
}

export const HORIZON_DAYS = DEFAULT_AVAILABILITY.horizonDays;
const DAY_MS = 86_400_000;

/** Le nombre de semaines navigables dans l'horizon de réservation. */
export const WEEK_COUNT = Math.ceil(HORIZON_DAYS / 7);

/** Les bornes d'une semaine de recherche, la dernière rognée à l'horizon. */
export function weekBounds(now: Date, weekIndex: number): { from: Date; to: Date } {
  const index = Math.max(0, Math.min(WEEK_COUNT - 1, weekIndex));
  const from = new Date(now.getTime() + index * 7 * DAY_MS);
  const to = new Date(Math.min(from.getTime() + 7 * DAY_MS, now.getTime() + HORIZON_DAYS * DAY_MS));
  return { from, to };
}

export function canGoPrevWeek(weekIndex: number): boolean {
  return weekIndex > 0;
}

export function canGoNextWeek(weekIndex: number): boolean {
  return weekIndex < WEEK_COUNT - 1;
}

/* ---------------------------------------------------------------------------
   Fuseaux horaires.
   --------------------------------------------------------------------------- */

/** Une trentaine de fuseaux courants, francophones et européens d'abord. */
export const COMMON_TIME_ZONES: readonly string[] = [
  "Europe/Paris",
  "Europe/Brussels",
  "Europe/Zurich",
  "Europe/Luxembourg",
  "Europe/London",
  "Europe/Lisbon",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Athens",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Africa/Casablanca",
  "Africa/Dakar",
  "Africa/Abidjan",
  "Africa/Johannesburg",
  "Indian/Reunion",
  "Indian/Mauritius",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Makassar",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
  "America/Sao_Paulo",
  "America/New_York",
  "America/Toronto",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Montreal",
  "Pacific/Honolulu",
];

/** La liste du sélecteur : le fuseau détecté en tête, puis les courants, sans doublon. */
export function timeZoneChoices(detected: string | null): string[] {
  const list = detected ? [detected, ...COMMON_TIME_ZONES] : [...COMMON_TIME_ZONES];
  return list.filter((zone, index) => list.indexOf(zone) === index);
}

/** « UTC+8 », « UTC−5:30 », « UTC » — le décalage d'un fuseau à un instant. */
export function utcOffsetLabel(timeZone: string, instant: Date): string {
  const minutes = Math.round(offsetMs(instant, timeZone) / 60_000);
  if (minutes === 0) return "UTC";
  const sign = minutes > 0 ? "+" : "−";
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  return `UTC${sign}${hours}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`;
}

/** « Paris », « Ho Chi Minh », « New York » — la ville d'un identifiant IANA. */
export function timeZoneCity(timeZone: string): string {
  const last = timeZone.split("/").pop() ?? timeZone;
  return last.replace(/_/g, " ");
}

/** « Paris · UTC+2 » : la ligne du sélecteur et du bandeau. */
export function describeTimeZone(timeZone: string, instant: Date): string {
  return `${timeZoneCity(timeZone)} · ${utcOffsetLabel(timeZone, instant)}`;
}

/* ---------------------------------------------------------------------------
   Formats — tous passent par `Intl`, avec le fuseau explicite.
   --------------------------------------------------------------------------- */

export function formatSlotTime(iso: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function formatDayHeading(iso: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
}

/** La date et l'heure d'un rendez-vous, en toutes lettres, dans un fuseau. */
export function formatMeeting(iso: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "full", timeStyle: "short" }).format(new Date(iso));
}
