"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";

import type { Dictionary } from "@/i18n/types";
import type { Locale } from "@/i18n/locale";
import {
  API,
  type BookingDto,
  type LeadRequest,
  type LeadResponse,
  type QuestionnaireRequest,
  type QuestionnaireResponse,
  type TipsRequest,
  type TipsResponse,
} from "@/lib/funnel-contract";
import { QUESTIONS, type Answers, type Question, type Temperature } from "@/lib/questionnaire";

import { Booking } from "./booking";
import { dispatch, getSnapshot, useFunnelState } from "./funnel-store";
import {
  EMAIL_PATTERN,
  TOTAL_QUESTIONS,
  fillTemplate,
  formatMeeting,
  formatSlotTime,
  optionIndexFromKey,
  readMulti,
  shortcutLetter,
  timeZoneCity,
  toggleChoice,
  utcOffsetLabel,
  utmFromSearch,
} from "./state";
import { BUTTON_GHOST, BUTTON_PRIMARY, BUTTON_SECONDARY, FIELD, LABEL, LINK_QUIET } from "./styles";

type FunnelDict = Dictionary["funnel"];

type Props = {
  dict: FunnelDict;
  locale: Locale;
  /** Le lien de la politique de confidentialité, pour la case de consentement. */
  privacyHref: string;
};

const MOTION_MS = 220;
const MOTION_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
/** Un choix unique avance tout seul, après le temps de voir sa sélection. */
const SINGLE_CHOICE_DELAY_MS = 250;
/** L'écran de calcul dure au moins ce temps, même si le serveur répond avant. */
const COMPUTING_MS = 2000;

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function postJson<TRequest, TResponse>(url: string, body: TRequest): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  return (await response.json()) as TResponse;
}

type CompletedResult = { kind: "done"; temperature: Temperature | null } | { kind: "missing"; index: number };

/**
 * La dernière réponse envoie le jeu complet. Un échec réseau se rejoue une
 * fois ; un refus persistant ouvre quand même le rendez-vous — le lead
 * existe, et c'est le rendez-vous qui compte, pas le drapeau `completed`.
 */
async function saveCompleted(leadId: string, answers: Answers): Promise<CompletedResult> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const json = await postJson<QuestionnaireRequest, QuestionnaireResponse>(API.questionnaire, { leadId, answers, completed: true });
      if (json.ok) return { kind: "done", temperature: json.temperature };
      if (json.error === "incomplete") {
        const index = QUESTIONS.findIndex((question) => question.id === json.missing?.[0]);
        if (index >= 0) return { kind: "missing", index };
      }
      if (json.error === "invalid") break;
    } catch {
      // Réseau : un second essai, puis on avance.
    }
  }
  return { kind: "done", temperature: null };
}

/**
 * Le tunnel : intro → adresse → six questions → calcul → rendez-vous ou
 * conseils → réservation → confirmation. Une seule carte, un écran à la fois.
 *
 * L'état persistant (lead, réponses, étape) vit dans `sessionStorage` par le
 * store externe ; chaque écran garde ses états passagers (saisie en cours,
 * requête en vol) et les perd en changeant d'écran, parce qu'il est remonté.
 */
export function Funnel({ dict, locale, privacyHref }: Props) {
  const state = useFunnelState();
  const cardRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const lastScreenRef = useRef<string | null>(null);
  const screenKey = state.step === "question" ? `question-${state.questionIndex}` : state.step;

  // À chaque nouvel écran : fondu + glissement de 12 px, puis le focus sur
  // ce qu'il faut lire ou saisir. Le tout premier rendu ne fait rien — on ne
  // vole pas le focus à une page qui vient de s'ouvrir.
  useEffect(() => {
    if (lastScreenRef.current === null) {
      lastScreenRef.current = screenKey;
      return;
    }
    if (lastScreenRef.current === screenKey) return;
    lastScreenRef.current = screenKey;
    const node = screenRef.current;
    if (!node) return;
    if (!prefersReducedMotion() && typeof node.animate === "function") {
      node.animate(
        [
          { opacity: 0, transform: "translateY(12px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: MOTION_MS, easing: MOTION_EASE, fill: "backwards" },
      );
    }
    const target = node.querySelector<HTMLElement>("[data-autofocus]") ?? node.querySelector<HTMLElement>("[data-screen-title]");
    target?.focus({ preventScroll: true });
  }, [screenKey]);

  // `?note=1` et tout lien `#note` amènent à la section ; après une
  // confirmation, c'est un nouveau parcours qui s'ouvre.
  useEffect(() => {
    function openIntro(): void {
      if (getSnapshot().step === "confirmed") dispatch({ type: "reset" });
      document.getElementById("note")?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
      cardRef.current?.focus({ preventScroll: true });
    }
    if (new URLSearchParams(window.location.search).get("note") === "1") openIntro();
    function onClick(event: MouseEvent): void {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.hash !== "#note" || url.origin !== window.location.origin || url.pathname !== window.location.pathname) return;
      event.preventDefault();
      if (window.location.hash !== "#note") window.history.replaceState(window.history.state, "", "#note");
      openIntro();
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  async function handleAnswer(question: Question, value: string | string[]): Promise<void> {
    const current = getSnapshot();
    if (current.step !== "question" || !current.leadId) return;
    const leadId = current.leadId;
    const answers: Answers = { ...current.answers, [question.id]: value };
    const isLast = current.questionIndex >= TOTAL_QUESTIONS - 1;
    dispatch({ type: "answer", questionId: question.id, value });
    if (!isLast) {
      // Sauvegarde silencieuse : un échec n'interrompt rien, la dernière réponse renvoie tout.
      void postJson<QuestionnaireRequest, QuestionnaireResponse>(API.questionnaire, { leadId, answers, completed: false }).catch(() => undefined);
      return;
    }
    const [result] = await Promise.all([saveCompleted(leadId, answers), wait(COMPUTING_MS)]);
    // Rechargé ou reparti en arrière pendant le calcul : le verdict ne s'applique plus.
    if (getSnapshot().step !== "computing") return;
    if (result.kind === "missing") dispatch({ type: "goto_question", index: result.index });
    else dispatch({ type: "computed", temperature: result.temperature });
  }

  let screen: ReactNode;
  switch (state.step) {
    case "intro":
      screen = <IntroScreen dict={dict} onStart={() => dispatch({ type: "start" })} />;
      break;
    case "email":
      screen = (
        <EmailScreen
          dict={dict}
          locale={locale}
          privacyHref={privacyHref}
          initialFirstName={state.firstName}
          onBack={() => dispatch({ type: "back" })}
          onCreated={(leadId, firstName) => dispatch({ type: "lead_created", leadId, firstName })}
        />
      );
      break;
    case "question": {
      const question = QUESTIONS[state.questionIndex];
      screen = (
        <QuestionScreen
          dict={dict}
          question={question}
          index={state.questionIndex}
          value={state.answers[question.id]}
          onAnswer={(value) => void handleAnswer(question, value)}
          onBack={() => dispatch({ type: "back" })}
        />
      );
      break;
    }
    case "computing":
      screen = <ComputingScreen dict={dict.computing} />;
      break;
    case "ready":
      screen = <ReadyScreen dict={dict.ready} onBook={() => dispatch({ type: "book" })} />;
      break;
    case "cold":
      screen = (
        <ColdScreen
          dict={dict}
          leadId={state.leadId}
          tipsSent={state.tipsSent}
          onTipsSent={() => dispatch({ type: "tips_sent" })}
          onBook={() => dispatch({ type: "book" })}
        />
      );
      break;
    case "booking":
      screen = (
        <div className="flex flex-1 flex-col gap-5">
          <div>
            <button type="button" className={BUTTON_GHOST} onClick={() => dispatch({ type: "back" })}>
              <span aria-hidden="true">←</span> {dict.nav.back}
            </button>
          </div>
          {state.leadId ? (
            <Booking
              dict={dict.booking}
              locale={locale}
              leadId={state.leadId}
              prefill={{ firstName: state.firstName }}
              onConfirmed={(booking, timeZone) => dispatch({ type: "confirmed", booking, timeZone })}
            />
          ) : null}
        </div>
      );
      break;
    case "confirmed":
      screen = state.booking ? (
        <ConfirmedScreen dict={dict} locale={locale} booking={state.booking} timeZone={state.bookingTimeZone} />
      ) : null;
      break;
  }

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      className="glass relative mx-auto flex min-h-130 w-full max-w-190 flex-col overflow-hidden rounded-lg p-6 outline-none sm:p-10"
    >
      {state.step === "question" ? (
        <ProgressBar
          value={state.questionIndex + 1}
          max={TOTAL_QUESTIONS}
          label={fillTemplate(dict.nav.progress, { n: state.questionIndex + 1, total: TOTAL_QUESTIONS })}
        />
      ) : null}
      <div key={screenKey} ref={screenRef} className="flex flex-1 flex-col">
        {screen}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Les écrans. Chacun est remonté à l'arrivée, donc repart d'un état propre.
   --------------------------------------------------------------------------- */

function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const percent = Math.round((value / max) * 100);
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label} className="absolute inset-x-0 top-0 h-0.5 bg-line">
      <div
        className="h-full rounded-pill"
        style={{ width: `${percent}%`, backgroundImage: "var(--gradient-iris)", transition: "width var(--motion-slow) var(--ease)" }}
      />
    </div>
  );
}

function ScreenTitle({ id, children, size = "h3" }: { id?: string; children: ReactNode; size?: "h2" | "h3" }) {
  return (
    <h2 id={id} tabIndex={-1} data-screen-title className={`${size === "h2" ? "type-h2" : "type-h3"} text-text outline-none`}>
      {children}
    </h2>
  );
}

function IntroScreen({ dict, onStart }: { dict: FunnelDict; onStart: () => void }) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <p className="type-overline text-accent-ink">{dict.eyebrow}</p>
      <ScreenTitle size="h2">{dict.title}</ScreenTitle>
      <p className="type-lead text-text-2">{dict.lead}</p>
      <ul className="flex flex-col gap-3">
        {dict.bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-3 type-body text-text">
            <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-pill" style={{ backgroundImage: "var(--gradient-iris)" }} />
            {bullet}
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:gap-5">
        <button type="button" className={BUTTON_PRIMARY} onClick={onStart} data-autofocus>
          {dict.start}
        </button>
        <span className="type-caption text-text-3">{dict.duration}</span>
      </div>
    </div>
  );
}

function EmailScreen({
  dict,
  locale,
  privacyHref,
  initialFirstName,
  onBack,
  onCreated,
}: {
  dict: FunnelDict;
  locale: Locale;
  privacyHref: string;
  initialFirstName: string;
  onBack: () => void;
  onCreated: (leadId: string, firstName: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const titleId = `${id}-title`;

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const read = (name: string) => String(data.get(name) ?? "").trim();
    const firstName = read("firstName");
    const email = read("email");
    const consent = data.get("consent") === "on";
    if (!firstName || !EMAIL_PATTERN.test(email) || !consent) {
      setError(dict.email.invalid);
      return;
    }
    let timezone: string | null = null;
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
    } catch {
      timezone = null;
    }
    const body: LeadRequest = {
      email,
      firstName,
      locale,
      consent: true,
      timezone,
      utm: utmFromSearch(window.location.search),
      website: read("website"),
    };
    setBusy(true);
    setError(null);
    try {
      const json = await postJson<LeadRequest, LeadResponse>(API.lead, body);
      if (json.ok) {
        onCreated(json.leadId, firstName);
        return;
      }
      // Seul « invalid » a son texte ; un plafond ou une panne disent « réessayez dans un instant ».
      setError(json.error === "invalid" ? dict.email.invalid : dict.booking.error);
    } catch {
      setError(dict.booking.error);
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-1 flex-col gap-6">
      <div>
        <ScreenTitle id={titleId}>{dict.email.title}</ScreenTitle>
        <p className="type-body mt-2 text-text-2">{dict.email.lead}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-first-name`} className={LABEL}>
            {dict.email.firstName}
          </label>
          <input id={`${id}-first-name`} name="firstName" required autoComplete="given-name" defaultValue={initialFirstName} className={FIELD} data-autofocus />
        </div>
        <div className="flex flex-col gap-1.5">
          {/* L'adresse n'a pas de libellé à elle : le titre de l'écran la nomme. */}
          <label htmlFor={`${id}-email`} className={`${LABEL} invisible`} aria-hidden="true">
            {dict.email.placeholder}
          </label>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            inputMode="email"
            required
            autoComplete="email"
            placeholder={dict.email.placeholder}
            aria-labelledby={titleId}
            className={FIELD}
          />
        </div>
      </div>
      {/* Champ piège : un humain ne le voit pas, un robot le remplit. */}
      <div hidden aria-hidden="true">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      <label className="flex items-start gap-3 type-small text-text-2">
        <input type="checkbox" name="consent" required className="mt-1 size-4 shrink-0 accent-(--accent-ink)" />
        <span>
          {dict.email.consent}{" "}
          <a href={privacyHref} target="_blank" rel="noreferrer" className="text-accent-ink underline underline-offset-4 hover:text-accent-ink-strong">
            {dict.email.consentLink}
          </a>
          .
        </span>
      </label>
      <div aria-live="assertive" className="min-h-6 type-small text-danger-ink">
        {error}
      </div>
      <div className="mt-auto flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" className={BUTTON_GHOST} onClick={onBack} disabled={busy}>
          <span aria-hidden="true">←</span> {dict.nav.back}
        </button>
        <button type="submit" className={BUTTON_PRIMARY} disabled={busy}>
          {busy ? dict.email.busy : dict.email.cta}
        </button>
      </div>
    </form>
  );
}

function QuestionScreen({
  dict,
  question,
  index,
  value,
  onAnswer,
  onBack,
}: {
  dict: FunnelDict;
  question: Question;
  index: number;
  value: string | string[] | undefined;
  onAnswer: (value: string | string[]) => void;
  onBack: () => void;
}) {
  const texts = dict.questions[question.id];
  const single = question.kind === "single";
  const [selected, setSelected] = useState<string[]>(() => readMulti(value));
  const pendingRef = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const progressText = fillTemplate(dict.nav.progress, { n: index + 1, total: TOTAL_QUESTIONS });
  const help = texts.help ?? (single ? null : dict.nav.multiHint);

  // Le délai d'un choix unique ne survit pas à l'écran.
  useEffect(
    () => () => {
      if (pendingRef.current !== null) window.clearTimeout(pendingRef.current);
    },
    [],
  );

  function chooseSingle(option: string): void {
    if (pendingRef.current !== null) return;
    setSelected([option]);
    pendingRef.current = window.setTimeout(() => {
      pendingRef.current = null;
      onAnswer(option);
    }, SINGLE_CHOICE_DELAY_MS);
  }

  function toggle(option: string): void {
    setSelected((current) => toggleChoice(current, option));
  }

  function next(): void {
    if (!single && selected.length > 0) onAnswer(selected);
  }

  function optionButtons(): HTMLButtonElement[] {
    return [...(listRef.current?.querySelectorAll<HTMLButtonElement>("[data-option]") ?? [])];
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
    const byKey = optionIndexFromKey(event.key, question.options.length);
    if (byKey !== null) {
      event.preventDefault();
      const option = question.options[byKey];
      if (single) chooseSingle(option);
      else {
        toggle(option);
        optionButtons()[byKey]?.focus();
      }
      return;
    }
    switch (event.key) {
      case "Enter":
        if (!single) {
          event.preventDefault();
          next();
        }
        return;
      case "ArrowDown":
      case "ArrowRight":
      case "ArrowUp":
      case "ArrowLeft": {
        event.preventDefault();
        const buttons = optionButtons();
        if (buttons.length === 0) return;
        const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
        const current = buttons.findIndex((button) => button === document.activeElement);
        const nextIndex = current < 0 ? (forward ? 0 : buttons.length - 1) : (current + (forward ? 1 : -1) + buttons.length) % buttons.length;
        buttons[nextIndex]?.focus();
        return;
      }
      case "Backspace":
        event.preventDefault();
        onBack();
        return;
      default:
        return;
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6" onKeyDown={onKeyDown}>
      <div className="flex items-center justify-between gap-3">
        <button type="button" className={BUTTON_GHOST} onClick={onBack}>
          <span aria-hidden="true">←</span> {dict.nav.back}
        </button>
        <p className="type-caption text-text-3 tabular-nums" aria-live="polite">
          {progressText}
        </p>
      </div>
      <div>
        <ScreenTitle id={titleId}>{texts.title}</ScreenTitle>
        {help ? <p className="type-small mt-1.5 text-text-2">{help}</p> : null}
      </div>
      <div ref={listRef} role={single ? "radiogroup" : "group"} aria-labelledby={titleId} className="flex flex-col gap-2">
        {question.options.map((option, optionIndex) => {
          const active = selected.includes(option);
          const letter = shortcutLetter(optionIndex);
          return (
            <button
              key={option}
              type="button"
              data-option
              role={single ? "radio" : "checkbox"}
              aria-checked={active}
              aria-keyshortcuts={`${letter} ${optionIndex + 1}`}
              onClick={() => (single ? chooseSingle(option) : toggle(option))}
              className={`flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left type-body transition duration-(--motion) ease-(--ease) ${
                active ? "border-accent-ink bg-glass-strong text-text" : "border-glass-border bg-glass text-text hover:border-line-strong hover:bg-glass-strong"
              }`}
            >
              <kbd
                aria-hidden="true"
                className={`flex size-7 shrink-0 items-center justify-center rounded-sm border type-caption font-medium ${
                  active ? "border-accent-ink bg-text text-text-on-light" : "border-glass-border text-text-2"
                }`}
              >
                {letter}
              </kbd>
              <span>{texts.options[option]}</span>
            </button>
          );
        })}
      </div>
      {!single ? (
        <div className="mt-auto flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:gap-5">
          <button type="button" className={BUTTON_PRIMARY} onClick={next} disabled={selected.length === 0}>
            {dict.nav.next}
          </button>
          <span className="hidden type-caption text-text-3 sm:inline">{dict.nav.keyHint}</span>
        </div>
      ) : null}
    </div>
  );
}

function IrisRing() {
  return (
    <svg className="size-16 motion-safe:animate-spin" viewBox="0 0 64 64" aria-hidden="true" style={{ animationDuration: "1.4s" }}>
      <defs>
        <linearGradient id="funnel-iris-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--iris-cyan)" />
          <stop offset="0.38" stopColor="var(--iris-violet)" />
          <stop offset="0.7" stopColor="var(--iris-pink)" />
          <stop offset="1" stopColor="var(--iris-amber)" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="26" stroke="var(--line-strong)" strokeWidth="5" fill="none" />
      <circle cx="32" cy="32" r="26" stroke="url(#funnel-iris-ring)" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray="110 200" />
    </svg>
  );
}

function ComputingScreen({ dict }: { dict: FunnelDict["computing"] }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center" role="status" aria-live="polite">
      <IrisRing />
      <div>
        <ScreenTitle>{dict.title}</ScreenTitle>
        <p className="type-body mx-auto mt-2 max-w-md text-text-2">{dict.text}</p>
      </div>
    </div>
  );
}

function ReadyScreen({ dict, onBook }: { dict: FunnelDict["ready"]; onBook: () => void }) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <ScreenTitle size="h2">{dict.title}</ScreenTitle>
        <p className="type-lead mt-3 text-text-2">{dict.text}</p>
      </div>
      <div className="mt-auto pt-4">
        <button type="button" className={BUTTON_PRIMARY} onClick={onBook}>
          {dict.cta}
        </button>
      </div>
    </div>
  );
}

function ColdScreen({
  dict,
  leadId,
  tipsSent,
  onTipsSent,
  onBook,
}: {
  dict: FunnelDict;
  leadId: string | null;
  tipsSent: boolean;
  onTipsSent: () => void;
  onBook: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendTips(): Promise<void> {
    if (busy || !leadId) return;
    setBusy(true);
    setError(null);
    try {
      const json = await postJson<TipsRequest, TipsResponse>(API.tips, { leadId });
      if (json.ok) onTipsSent();
      else setError(dict.booking.error);
    } catch {
      setError(dict.booking.error);
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <ScreenTitle size="h2">{dict.cold.title}</ScreenTitle>
        <p className="type-lead mt-3 text-text-2">{dict.cold.text}</p>
      </div>
      <div aria-live="polite" className="min-h-6 type-small text-danger-ink">
        {error}
      </div>
      <div className="mt-auto flex flex-col gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
        {tipsSent ? (
          <p role="status" className="type-body font-medium text-ok-ink">
            {dict.cold.tipsSent}
          </p>
        ) : (
          <button type="button" className={BUTTON_PRIMARY} onClick={() => void sendTips()} disabled={busy}>
            {busy ? dict.email.busy : dict.cold.tipsCta}
          </button>
        )}
        <button type="button" className={LINK_QUIET} onClick={onBook}>
          {dict.cold.bookAnyway}
        </button>
      </div>
    </div>
  );
}

function ConfirmedScreen({ dict, locale, booking, timeZone }: { dict: FunnelDict; locale: Locale; booking: BookingDto; timeZone: string | null }) {
  const texts = dict.booking.confirmed;
  const zone = timeZone ?? "UTC";
  const when = `${formatMeeting(booking.start, locale, zone)} – ${formatSlotTime(booking.end, locale, zone)}`;
  const zoneLabel = `${timeZoneCity(zone)} · ${utcOffsetLabel(zone, new Date(booking.start))}`;
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <span aria-hidden="true" className="mb-4 flex size-10 items-center justify-center rounded-pill bg-ok text-text-on-light">
          <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 10.5l4 4 8-9" />
          </svg>
        </span>
        <ScreenTitle size="h2">{texts.title}</ScreenTitle>
        <p className="type-body mt-2 text-text-2">{texts.text}</p>
      </div>
      <dl className="grid grid-cols-1 gap-4 rounded-md border border-glass-border bg-glass p-4 sm:grid-cols-2 sm:p-5">
        <div>
          <dt className="type-overline text-text-3">{texts.when}</dt>
          <dd className="mt-1 type-body text-text">
            <span className="block first-letter:uppercase">{when}</span>
            <span className="type-caption text-text-2">{zoneLabel}</span>
          </dd>
        </div>
        <div>
          <dt className="type-overline text-text-3">{texts.where}</dt>
          <dd className="mt-1 type-body">
            {booking.meetUrl ? (
              <a href={booking.meetUrl} target="_blank" rel="noreferrer" className="break-all text-accent-ink underline underline-offset-4 hover:text-accent-ink-strong">
                {booking.meetUrl}
              </a>
            ) : (
              <span className="text-text-2">{texts.meetPending}</span>
            )}
          </dd>
        </div>
      </dl>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <a href={booking.googleUrl} target="_blank" rel="noreferrer" className={BUTTON_SECONDARY}>
          {texts.addGoogle}
        </a>
        <a href={booking.icsUrl} download className={BUTTON_SECONDARY}>
          {texts.addIcs}
        </a>
        <a href={booking.cancelUrl} className={`${LINK_QUIET} self-center sm:ml-auto`}>
          {texts.cancel}
        </a>
      </div>
      <div className="mt-auto pt-2">
        <button
          type="button"
          className={BUTTON_GHOST}
          onClick={() => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" })}
        >
          <span aria-hidden="true">↑</span> {texts.backTop}
        </button>
      </div>
    </div>
  );
}
