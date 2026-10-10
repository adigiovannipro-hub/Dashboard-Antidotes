import type { QuestionId } from "@/lib/questionnaire";

/**
 * Le dictionnaire d'une langue. Tout texte lu par un visiteur vit ici, FR
 * et EN partageant exactement les mêmes clés — c'est le typecheck qui
 * garantit qu'aucune section n'est muette dans une langue.
 *
 * Six sections (DA du 8/10/2026) : hero, cas, services, méthode, note,
 * FAQ. Les chiffres portent leur source.
 */
export type Stat = { value: string; label: string; source?: string };

export type CaseStudy = {
  /** La clé des visuels dans `lib/cases.ts` ; sans visuel, le cas s'affiche en texte. */
  id: string;
  client: string;
  sector: string;
  headline: string;
  stat: Stat;
};

/**
 * Un service : `label` est le nom court (« Stratégie »), `title` la promesse
 * qui l'explique, `text` le détail en une phrase.
 */
export type Service = { icon: "compass" | "calendar" | "clapperboard" | "target" | "layout" | "sparkles"; label: string; title: string; text: string };

/** Un chiffre du panneau de preuves du questionnaire, avec son client et sa source. */
export type ProofStat = { value: string; label: string; client: string; source: string };

export type Dictionary = {
  locale: "fr" | "en";
  meta: { title: string; description: string; ogTitle: string; ogDescription: string };
  nav: { cases: string; services: string; method: string; faq: string; cta: string; switchLabel: string; switchAria: string; menu: string; close: string };
  /** `title` porte ses retours à la ligne (`\n`) : la phrase se lit sur trois lignes. `proof` : le nombre de clients accompagnés. */
  hero: { proof: { value: string; label: string }; title: string; lead: string; ctaPrimary: string; ctaSecondary: string; trustLabel: string };
  cases: { eyebrow: string; title: string; items: CaseStudy[]; numbersLabel: string; numbers: Stat[] };
  services: { eyebrow: string; title: string; items: Service[] };
  method: { eyebrow: string; title: string; steps: { title: string; text: string }[] };
  funnel: {
    eyebrow: string;
    title: string;
    lead: string;
    /** Les chiffres sourcés affichés à côté du questionnaire. */
    panel: ProofStat[];
    badges: string[];
    /** Compteur court des étapes (six questions, puis l'adresse), `{n}` et `{total}` remplacés au rendu. */
    progress: string;
    email: { title: string; lead: string; placeholder: string; firstName: string; consent: string; consentLink: string; cta: string; invalid: string; busy: string };
    /** `title` porte une touche manuscrite (`_mots_`) : la rendre par `Rich`, la reprendre ailleurs par `plainText`. */
    questions: Record<QuestionId, { title: string; help?: string; options: Record<string, string> }>;
    nav: { next: string; back: string; multiHint: string; keyHint: string };
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
  footer: { tagline: string; privacy: string; terms: string; contact: string; linkedin: string; based: string; copyright: string; rights: string; madeBy: string };
  cancelPage: { title: string; text: string; confirm: string; done: string; doneText: string; missing: string; back: string; already: string };
};
