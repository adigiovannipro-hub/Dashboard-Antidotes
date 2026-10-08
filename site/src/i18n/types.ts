import type { QuestionId } from "@/lib/questionnaire";

/**
 * Le dictionnaire d'une langue. Tout texte lu par un visiteur vit ici, FR
 * et EN partageant exactement les mêmes clés — c'est le typecheck qui
 * garantit qu'aucune section n'est muette dans une langue.
 */
export type Stat = { value: string; label: string; source?: string };

export type CaseStudy = {
  id: string;
  client: string;
  sector: string;
  period: string;
  headline: string;
  need: string;
  answer: string;
  results: Stat[];
  note?: string;
};

export type Dictionary = {
  locale: "fr" | "en";
  meta: { title: string; description: string; ogTitle: string; ogDescription: string };
  nav: { cases: string; services: string; method: string; tools: string; faq: string; cta: string; switchLabel: string; switchAria: string; menu: string; close: string };
  hero: {
    eyebrow: string;
    titleBefore: string;
    titleAccent: string;
    titleAfter: string;
    lead: string;
    ctaPrimary: string;
    ctaSecondary: string;
    trustLabel: string;
    trust: string[];
    hint: string;
  };
  proof: { eyebrow: string; items: Stat[] };
  mirror: { eyebrow: string; title: string; items: { situation: string; result: string }[] };
  cases: { eyebrow: string; title: string; lead: string; needLabel: string; answerLabel: string; resultsLabel: string; sourceLabel: string; items: CaseStudy[]; more: { eyebrow: string; title: string; text: string; items: { title: string; text: string }[] } };
  services: { eyebrow: string; title: string; lead: string; items: { name: string; text: string }[] };
  method: { eyebrow: string; title: string; lead: string; steps: { title: string; text: string }[] };
  tools: { eyebrow: string; title: string; lead: string; items: { name: string; text: string }[]; proofsTitle: string; proofs: string[] };
  about: { eyebrow: string; title: string; bio: string; points: string[]; location: string };
  offer: { eyebrow: string; title: string; text: string; items: string[]; cta: string };
  funnel: {
    eyebrow: string;
    title: string;
    lead: string;
    bullets: string[];
    start: string;
    duration: string;
    email: { title: string; lead: string; placeholder: string; firstName: string; consent: string; consentLink: string; cta: string; invalid: string; busy: string };
    questions: Record<QuestionId, { title: string; help?: string; options: Record<string, string> }>;
    nav: { next: string; back: string; progress: string; multiHint: string; keyHint: string };
    computing: { title: string; text: string };
    ready: { title: string; text: string; cta: string };
    cold: { title: string; text: string; tipsCta: string; tipsSent: string; bookAnyway: string };
    booking: {
      title: string;
      lead: string;
      tzLabel: string;
      tzChange: string;
      tzOwnerNote: string;
      loading: string;
      empty: string;
      nextWeek: string;
      prevWeek: string;
      form: { title: string; name: string; company: string; phone: string; notes: string; cta: string; busy: string };
      taken: string;
      error: string;
      confirmed: { title: string; text: string; when: string; where: string; meetPending: string; addGoogle: string; addIcs: string; cancel: string; backTop: string };
    };
  };
  faq: { eyebrow: string; title: string; items: { q: string; a: string }[] };
  final: { title: string; lead: string; cta: string; ctaSecondary: string };
  footer: { tagline: string; privacy: string; terms: string; contact: string; linkedin: string; based: string; copyright: string; rights: string; madeBy: string };
  cancelPage: { title: string; text: string; confirm: string; done: string; doneText: string; missing: string; back: string; already: string };
};
