"use client";

import { ArrowLeft, ArrowRight, ShieldCheck, Timer, UsersRound, Video, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";

import type { CaseStudy, Dictionary } from "@/i18n/types";
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

import { Rich } from "@/components/brand/rich";

import { Booking } from "./booking";
import { dispatch, getSnapshot, useFunnelState } from "./funnel-store";
import { proofSlides, type ProofSlide } from "./proofs";
import {
  EMAIL_PATTERN,
  STEP_COUNT,
  fillTemplate,
  formatMeeting,
  formatSlotTime,
  optionIndexFromKey,
  progressStep,
  readMulti,
  shortcutLetter,
  timeZoneCity,
  toggleChoice,
  utcOffsetLabel,
  utmFromSearch,
} from "./state";
import { BUTTON_GHOST, BUTTON_SECONDARY, CTA, FIELD, LABEL, LINK_QUIET } from "./styles";

type FunnelDict = Dictionary["funnel"];

type Props = {
  dict: FunnelDict;
  locale: Locale;
  /** Le lien de la politique de confidentialité, pour la case de consentement. */
  privacyHref: string;
  /** Les cas clients : ils rattachent chaque chiffre du volet de preuves à une publication de son client. */
  cases: readonly CaseStudy[];
};

const MOTION_MS = 220;
const MOTION_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
/** Un choix unique avance tout seul, après le temps de voir sa sélection. */
const SINGLE_CHOICE_DELAY_MS = 250;
/** L'écran de calcul dure au moins ce temps, même si le serveur répond avant. */
const COMPUTING_MS = 2000;
/** Le temps de lire un chiffre du volet de preuves avant le suivant. */
const PROOF_ROTATE_MS = 6500;

/** Les pictogrammes des réassurances, dans l'ordre du dictionnaire. */
const BADGE_ICONS: readonly LucideIcon[] = [UsersRound, Timer, Video, ShieldCheck];

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
 * Le jeu complet part une fois le lead créé. Un échec réseau se rejoue une
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

/** Ce qu'un clavier doit trouver sous les doigts en arrivant sur la carte : l'option choisie, sinon la première, sinon le premier champ. */
function entryPoint(root: HTMLElement): HTMLElement | null {
  return (
    root.querySelector<HTMLElement>('[data-option][aria-checked="true"]') ??
    root.querySelector<HTMLElement>("[data-option]") ??
    root.querySelector<HTMLElement>("input:not([type=hidden]):not([tabindex='-1'])") ??
    root.querySelector<HTMLElement>("[data-screen-title]")
  );
}

/**
 * Le tunnel, en carte à deux volets : à gauche la Profondeur et les chiffres
 * des clients, à droite le Verre clair et la question — affichée d'emblée.
 * Six questions → adresse → calcul → rendez-vous ou conseils → réservation
 * → confirmation, un écran à la fois.
 *
 * L'état persistant (réponses, lead, étape) vit dans `sessionStorage` par le
 * store externe ; chaque écran garde ses états passagers (saisie en cours,
 * requête en vol) et les perd en changeant d'écran, parce qu'il est remonté.
 */
export function Funnel({ dict, locale, privacyHref, cases }: Props) {
  const state = useFunnelState();
  const cardRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const lastScreenRef = useRef<string | null>(null);
  const completingRef = useRef<string | null>(null);
  const [slides] = useState(() => proofSlides(dict.panel, cases));
  const screenKey = state.step === "question" ? `question-${state.questionIndex}` : state.step;
  const position = progressStep(state);

  // À chaque nouvel écran : fondu + glissement de 12 px, puis le focus sur
  // son titre. Le tout premier rendu ne fait rien — on ne vole pas le focus
  // à une page qui vient de s'ouvrir.
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
    // Sur un téléphone, l'écran suivant peut commencer au-dessus de la vue : on y remonte.
    const pane = paneRef.current;
    if (pane && pane.getBoundingClientRect().top < 0) pane.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    node.querySelector<HTMLElement>("[data-screen-title]")?.focus({ preventScroll: true });
  }, [screenKey]);

  // Le calcul : dès qu'on y arrive avec un lead — après l'adresse, après une
  // réponse reprise, ou au rechargement de la page —, le jeu complet part.
  useEffect(() => {
    if (state.step !== "computing" || !state.leadId) return;
    const leadId = state.leadId;
    if (completingRef.current === leadId) return;
    completingRef.current = leadId;
    const answers = state.answers;
    void (async () => {
      const [result] = await Promise.all([saveCompleted(leadId, answers), wait(COMPUTING_MS)]);
      completingRef.current = null;
      // Rechargé ou reparti ailleurs pendant le calcul : le verdict ne s'applique plus.
      if (getSnapshot().step !== "computing") return;
      if (result.kind === "missing") dispatch({ type: "goto_question", index: result.index });
      else dispatch({ type: "computed", temperature: result.temperature });
    })();
  }, [state.step, state.leadId, state.answers]);

  // `?note=1` et tout lien `#note` amènent à la carte, le focus sur la
  // première option de la question en cours ; après une confirmation,
  // c'est un nouveau parcours qui s'ouvre.
  useEffect(() => {
    function openNote(): void {
      if (getSnapshot().step === "confirmed") dispatch({ type: "reset" });
      const card = cardRef.current;
      if (!card) return;
      const fits = card.offsetHeight + 160 < window.innerHeight;
      card.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: fits ? "center" : "start" });
      // Une image plus tard : le nouveau parcours a eu le temps de s'afficher.
      window.requestAnimationFrame(() => {
        const pane = paneRef.current;
        if (pane) entryPoint(pane)?.focus({ preventScroll: true });
      });
    }
    if (new URLSearchParams(window.location.search).get("note") === "1") openNote();
    function onClick(event: MouseEvent): void {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.hash !== "#note" || url.origin !== window.location.origin || url.pathname !== window.location.pathname) return;
      event.preventDefault();
      if (window.location.hash !== "#note") window.history.replaceState(window.history.state, "", "#note");
      openNote();
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  function handleAnswer(question: Question, value: string | string[]): void {
    const current = getSnapshot();
    if (current.step !== "question") return;
    const next = dispatch({ type: "answer", questionId: question.id, value });
    // Avec un lead déjà créé (réponse reprise), la sauvegarde suit en silence ;
    // sans lui, les réponses attendent l'adresse dans le navigateur.
    if (current.leadId && next.step === "question" && next !== current) {
      const body: QuestionnaireRequest = { leadId: current.leadId, answers: next.answers, completed: false };
      void postJson<QuestionnaireRequest, QuestionnaireResponse>(API.questionnaire, body).catch(() => undefined);
    }
  }

  let screen: ReactNode;
  switch (state.step) {
    case "question": {
      const question = QUESTIONS[state.questionIndex];
      screen = (
        <QuestionScreen
          dict={dict}
          question={question}
          index={state.questionIndex}
          value={state.answers[question.id]}
          onAnswer={(value) => handleAnswer(question, value)}
          onBack={() => dispatch({ type: "back" })}
        />
      );
      break;
    }
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
              <ArrowLeft aria-hidden className="size-4" strokeWidth={1.75} /> {dict.nav.back}
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
    <div>
      <div ref={cardRef} className="funnel-card glass grid scroll-mt-24 overflow-hidden rounded-xl lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ProofPanel slides={slides} />
        <div ref={paneRef} className="relative flex min-w-0 scroll-mt-24 flex-col px-5 py-6 sm:px-9 sm:py-8 lg:min-h-140 lg:px-12 lg:py-10">
          {position !== null ? <Progress value={position} max={STEP_COUNT} template={dict.progress} label={dict.eyebrow} /> : null}
          <div key={screenKey} ref={screenRef} className="flex flex-1 flex-col">
            {screen}
          </div>
        </div>
      </div>
      <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
        {dict.badges.map((badge, index) => {
          const Icon = BADGE_ICONS[index] ?? ShieldCheck;
          return (
            <li key={badge} className="type-small flex items-center gap-2 text-text-2">
              <Icon aria-hidden className="size-4 shrink-0 text-accent-ink" strokeWidth={1.75} />
              {badge}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Le volet de preuves : la Profondeur, une vraie publication assombrie, un
   chiffre sourcé. Les trois défilent lentement, s'arrêtent au survol et au
   focus, restent figés en mouvement réduit — les tirets les choisissent à
   la main. Sur un téléphone, il devient une bande au-dessus de la question.
   --------------------------------------------------------------------------- */

function ProofPanel({ slides }: { slides: readonly ProofSlide[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false);
  const [inView, setInView] = useState(false);

  // Hors de l'écran, rien ne tourne : on arrive toujours sur un chiffre lisible du début.
  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver(([entry]) => setInView(Boolean(entry?.isIntersecting)), { threshold: 0.35 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (held || !inView || slides.length < 2 || prefersReducedMotion()) return;
    const timer = window.setInterval(() => setActive((index) => (index + 1) % slides.length), PROOF_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [held, inView, slides.length]);

  if (slides.length === 0) return null;
  return (
    <div
      ref={rootRef}
      className="funnel-proof theme-dark relative isolate flex flex-col overflow-hidden bg-profondeur px-5 py-5 text-text sm:px-9 lg:px-10 lg:py-10"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeld(false);
      }}
    >
      {/* Les publications, assombries pour que le chiffre se lise par-dessus. */}
      <div aria-hidden className="absolute inset-0 -z-10 hidden lg:block">
        {slides.map((slide, index) =>
          slide.poster ? (
            // eslint-disable-next-line @next/next/no-img-element -- affiche 720 px déjà optimisée, sous la ligne de flottaison
            <img
              key={slide.poster}
              src={slide.poster}
              alt=""
              width={720}
              height={1280}
              loading="lazy"
              decoding="async"
              className="funnel-proof-photo"
              data-active={index === active}
            />
          ) : null,
        )}
        <span className="funnel-proof-scrim" />
      </div>
      <div className="grid flex-1">
        {slides.map((slide, index) => {
          const current = index === active;
          return (
            <div
              key={slide.client}
              className="funnel-proof-slide flex flex-col justify-end gap-6 [grid-area:1/1] lg:justify-between"
              data-active={current}
              aria-hidden={!current}
              inert={!current}
            >
              {slide.handle ? (
                <p className="type-data hidden items-center gap-2 self-start rounded-pill border border-line bg-[color-mix(in_srgb,var(--profondeur)_55%,transparent)] px-3 py-1.5 text-text-2 lg:inline-flex">
                  <span aria-hidden className="size-1.5 rounded-pill bg-signal" />
                  {slide.handle}
                </p>
              ) : (
                <span className="hidden lg:block" />
              )}
              <div className="flex flex-col">
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 lg:block">
                  <span className="funnel-proof-value kw">{slide.value}</span>
                  <span className="type-small text-text lg:type-lead lg:mt-3 lg:block">{slide.label}</span>
                </p>
                <p className="type-caption mt-2 text-text-2 lg:mt-5">
                  <span className="font-medium text-text">{slide.client}</span>
                  <span aria-hidden> · </span>
                  {slide.source}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {slides.length > 1 ? (
        <div className="mt-3 flex gap-1 lg:mt-7">
          {slides.map((slide, index) => (
            <button
              key={slide.client}
              type="button"
              aria-label={slide.client}
              aria-pressed={index === active}
              onClick={() => setActive(index)}
              className="group -my-2 py-2 pr-1"
            >
              <span
                aria-hidden
                className={`block h-1 rounded-pill transition-[width,background-color] duration-(--motion) ease-(--ease) ${
                  index === active ? "w-8 bg-craie" : "w-4 bg-[color-mix(in_srgb,var(--craie)_35%,transparent)] group-hover:bg-[color-mix(in_srgb,var(--craie)_60%,transparent)]"
                }`}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Les écrans. Chacun est remonté à l'arrivée, donc repart d'un état propre.
   --------------------------------------------------------------------------- */

/** La barre segmentée et son compteur « 3 / 7 » : un segment par étape, Signal jusqu'à l'écran en cours. */
function Progress({ value, max, template, label }: { value: number; max: number; template: string; label: string }) {
  const text = fillTemplate(template, { n: value, total: max });
  const [before, after = ""] = template.split("{n}");
  return (
    <div className="mb-7 flex items-center gap-4 lg:mb-9">
      <div role="progressbar" aria-label={label} aria-valuemin={1} aria-valuemax={max} aria-valuenow={value} aria-valuetext={text} className="flex flex-1 gap-1.5">
        {Array.from({ length: max }, (_, index) => (
          <span key={index} className={`funnel-segment h-1 flex-1 rounded-pill ${index < value ? "is-done" : ""}`} />
        ))}
      </div>
      <p className="type-data shrink-0 text-text-3" aria-live="polite">
        <span className="sr-only">{text}</span>
        <span aria-hidden>
          {fillTemplate(before ?? "", { total: max })}
          <span className="font-medium text-text">{value}</span>
          {fillTemplate(after, { total: max })}
        </span>
      </p>
    </div>
  );
}

function ScreenTitle({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h3 id={id} tabIndex={-1} data-screen-title className="funnel-title outline-none">
      {children}
    </h3>
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
    if (pendingRef.current !== null || selected.length === 0) return;
    onAnswer(single ? selected[0] : selected);
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
        // Sur une option, Entrée la choisit (comportement du bouton) ; ailleurs, elle valide.
        if (target instanceof HTMLElement && target.closest("[data-option], button")) return;
        event.preventDefault();
        next();
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
        if (index === 0) return;
        event.preventDefault();
        onBack();
        return;
      default:
        return;
    }
  }

  return (
    <div className="flex flex-1 flex-col" onKeyDown={onKeyDown}>
      <div>
        <ScreenTitle id={titleId}>
          <Rich text={texts.title} />
        </ScreenTitle>
        {help ? <p className="type-small mt-2.5 text-text-2">{help}</p> : null}
      </div>
      <div
        ref={listRef}
        role={single ? "radiogroup" : "group"}
        aria-labelledby={titleId}
        className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:mt-8"
      >
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
              className="funnel-option flex min-h-14 w-full items-center gap-3 rounded-md border px-4 py-2.5 text-left type-body text-text"
            >
              <kbd aria-hidden="true" className="funnel-key flex size-7 shrink-0 items-center justify-center rounded-sm border type-caption font-medium">
                {letter}
              </kbd>
              <span className="leading-snug">{texts.options[option]}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-auto pt-6">
        <div className="flex items-center justify-between gap-4 border-t border-dashed border-line-strong pt-5">
          {index > 0 ? (
            <button type="button" className={BUTTON_GHOST} onClick={onBack}>
              <ArrowLeft aria-hidden className="size-4" strokeWidth={1.75} /> {dict.nav.back}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-5">
            <span className="hidden type-caption text-text-3 md:inline">{dict.nav.keyHint}</span>
            <button type="button" className={CTA} onClick={next} disabled={selected.length === 0}>
              {dict.nav.next}
              <ArrowRight aria-hidden className="size-4.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
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
        // Le lead existe (nouveau ou déjà connu par son adresse) : le calcul prend la suite.
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
    <form onSubmit={submit} noValidate className="flex flex-1 flex-col">
      <div>
        <ScreenTitle id={titleId}>{dict.email.title}</ScreenTitle>
        <p className="type-body mt-2.5 text-text-2">{dict.email.lead}</p>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-7">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-first-name`} className={LABEL}>
            {dict.email.firstName}
          </label>
          <input id={`${id}-first-name`} name="firstName" required autoComplete="given-name" defaultValue={initialFirstName} className={FIELD} />
        </div>
        <div className="flex flex-col gap-1.5">
          {/* L'adresse n'a pas de libellé à elle : le titre de l'écran la nomme. */}
          <label htmlFor={`${id}-email`} className={`${LABEL} invisible max-sm:hidden`} aria-hidden="true">
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
      <label className="mt-5 flex items-start gap-3 type-small text-text-2">
        <input type="checkbox" name="consent" required className="mt-1 size-4 shrink-0 accent-(--accent-ink)" />
        <span>
          {dict.email.consent}{" "}
          <a href={privacyHref} target="_blank" rel="noreferrer" className="text-accent-ink underline underline-offset-4 hover:text-accent-ink-strong">
            {dict.email.consentLink}
          </a>
          .
        </span>
      </label>
      <div aria-live="assertive" className="mt-3 min-h-6 type-small text-danger-ink">
        {error}
      </div>
      <div className="mt-auto pt-4">
        <div className="flex items-center justify-between gap-4 border-t border-dashed border-line-strong pt-5">
          <button type="button" className={BUTTON_GHOST} onClick={onBack} disabled={busy}>
            <ArrowLeft aria-hidden className="size-4" strokeWidth={1.75} /> {dict.nav.back}
          </button>
          <button type="submit" className={CTA} disabled={busy}>
            {busy ? dict.email.busy : dict.email.cta}
            {busy ? null : <ArrowRight aria-hidden className="size-4.5" strokeWidth={1.75} />}
          </button>
        </div>
      </div>
    </form>
  );
}

function SignalRing() {
  return (
    <svg className="size-16 motion-safe:animate-spin" viewBox="0 0 64 64" aria-hidden="true" style={{ animationDuration: "1.4s" }}>
      <circle cx="32" cy="32" r="26" stroke="var(--line-strong)" strokeWidth="5" fill="none" />
      <circle cx="32" cy="32" r="26" stroke="var(--signal)" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray="110 200" />
    </svg>
  );
}

function ComputingScreen({ dict }: { dict: FunnelDict["computing"] }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center" role="status" aria-live="polite">
      <SignalRing />
      <div>
        <ScreenTitle>{dict.title}</ScreenTitle>
        <p className="type-body mx-auto mt-3 max-w-md text-text-2">{dict.text}</p>
      </div>
    </div>
  );
}

/** L'icône verre de la charte (r-04, r-15) : une tuile Signal en volume, coche en relief — ce qui est fait est fait. */
function DoneMark() {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- rendu 3D précalculé, 320 px, décoratif
    <img
      src="/brand/icone-verre.webp"
      alt=""
      width={320}
      height={320}
      loading="lazy"
      decoding="async"
      className="pointer-events-none -ml-3 mb-3 size-20 -rotate-6 select-none lg:mb-4 lg:size-24"
    />
  );
}

function ReadyScreen({ dict, onBook }: { dict: FunnelDict["ready"]; onBook: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <div>
        <DoneMark />
        <ScreenTitle>{dict.title}</ScreenTitle>
        <p className="type-lead mt-4 max-w-xl text-text-2">{dict.text}</p>
      </div>
      <div className="mt-auto pt-8">
        <div className="flex justify-end border-t border-dashed border-line-strong pt-5">
          <button type="button" className={CTA} onClick={onBook}>
            {dict.cta}
            <ArrowRight aria-hidden className="size-4.5" strokeWidth={1.75} />
          </button>
        </div>
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
    <div className="flex flex-1 flex-col">
      <div>
        <DoneMark />
        <ScreenTitle>{dict.cold.title}</ScreenTitle>
        <p className="type-lead mt-4 max-w-xl text-text-2">{dict.cold.text}</p>
      </div>
      <div aria-live="polite" className="mt-3 min-h-6 type-small text-danger-ink">
        {error}
      </div>
      <div className="mt-auto pt-6">
        <div className="flex flex-col-reverse gap-4 border-t border-dashed border-line-strong pt-5 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" className={`${LINK_QUIET} self-start sm:self-auto`} onClick={onBook}>
            {dict.cold.bookAnyway}
          </button>
          {tipsSent ? (
            <p role="status" className="type-body font-medium text-ok-ink">
              {dict.cold.tipsSent}
            </p>
          ) : (
            <button type="button" className={CTA} onClick={() => void sendTips()} disabled={busy}>
              {busy ? dict.email.busy : dict.cold.tipsCta}
            </button>
          )}
        </div>
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
        <DoneMark />
        <ScreenTitle>{texts.title}</ScreenTitle>
        <p className="type-body mt-3 text-text-2">{texts.text}</p>
      </div>
      <dl className="grid grid-cols-1 gap-4 rounded-md border border-line bg-field p-4 sm:grid-cols-2 sm:p-5">
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
