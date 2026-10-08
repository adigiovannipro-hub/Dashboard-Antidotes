import { CalendarCheck, Clapperboard, Compass, LayoutDashboard, Sparkles, Target } from "lucide-react";
import type { ComponentType } from "react";

import type { Dictionary, Service } from "@/i18n/types";
import { CASE_VISUALS } from "@/lib/cases";
import { PhoneCase } from "./phone-case";

/**
 * Les sections du corps de page. Aucune grille de cartes : des filets, des
 * colonnes, des téléphones et des chiffres. Chaque section tient en un
 * titre et quelques lignes ; le pourquoi vit dans le code, jamais à l'écran.
 */

export function SectionHeading({ eyebrow, title, id }: { eyebrow: string; title: string; id?: string }) {
  return (
    <div className="reveal max-w-2xl">
      <p className="type-overline text-accent-ink">{eyebrow}</p>
      <h2 id={id} className="type-h2 mt-3 text-text">
        {title}
      </h2>
    </div>
  );
}

/* --- Cas clients : trois téléphones, puis les chiffres sur une ligne. ------- */
export function Cases({ dict }: { dict: Dictionary }) {
  return (
    <section id="cas" aria-labelledby="cas-titre" className="scroll-mt-20 border-t border-line">
      <div className="container-site section-pad">
        <SectionHeading eyebrow={dict.cases.eyebrow} title={dict.cases.title} id="cas-titre" />
        <ul className="mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 sm:grid sm:grid-cols-3 sm:gap-8 sm:overflow-visible sm:pb-0">
          {dict.cases.items.map((item) => {
            const visual = CASE_VISUALS[item.id]?.[0];
            return (
              <li key={item.id} className="reveal w-[76%] shrink-0 snap-start sm:w-auto">
                {visual && (
                  <PhoneCase poster={visual.poster} video={visual.video} alt={visual.alt} handle={visual.handle} stat={{ value: item.stat.value, label: item.stat.label }}>
                    {item.stat.source && <span className="type-caption text-text-3">{item.stat.source}</span>}
                  </PhoneCase>
                )}
                <div className="mt-5 border-t border-line pt-4">
                  <h3 className="type-h3 text-text">{item.client}</h3>
                  <p className="type-caption mt-1 text-text-3">{item.sector}</p>
                  <p className="type-small mt-3 font-medium text-text">{item.headline}</p>
                  <p className="type-small mt-1 text-text-2">{item.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <dl className="reveal mt-14 grid grid-cols-1 border-y border-line sm:grid-cols-2 lg:grid-cols-4">
          {dict.cases.numbers.map((stat, index) => (
            <div key={stat.label} className={`py-6 sm:px-6 ${index > 0 ? "border-t border-line sm:border-t-0 sm:border-l" : "sm:pl-0"}`}>
              <dt className="sr-only">{dict.cases.numbersLabel}</dt>
              <dd>
                <span className="type-stat block text-text">{stat.value}</span>
                <span className="type-small mt-2 block text-text-2">{stat.label}</span>
                {stat.source && <span className="type-caption mt-1 block text-text-3">{stat.source}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* --- Services : six lignes à pictogramme, séparées par des filets. ---------- */
const ICONS: Record<Service["icon"], ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>> = {
  compass: Compass,
  calendar: CalendarCheck,
  clapperboard: Clapperboard,
  target: Target,
  layout: LayoutDashboard,
  sparkles: Sparkles,
};

export function Services({ dict }: { dict: Dictionary }) {
  return (
    <section id="services" aria-labelledby="services-titre" className="scroll-mt-20 border-t border-line">
      <div className="container-site section-pad">
        <SectionHeading eyebrow={dict.services.eyebrow} title={dict.services.title} id="services-titre" />
        <ul className="mt-12 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {dict.services.items.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <li key={item.name} className="reveal border-t border-line pt-5">
                <Icon className="size-5 text-accent-ink" strokeWidth={1.75} aria-hidden />
                <h3 className="type-h3 mt-4 text-text">{item.name}</h3>
                <p className="type-small mt-2 text-text-2">{item.text}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* --- Méthode : cinq étapes numérotées sur une ligne. ------------------------ */
export function Method({ dict }: { dict: Dictionary }) {
  return (
    <section id="methode" aria-labelledby="methode-titre" className="scroll-mt-20 border-t border-line">
      <div className="container-site section-pad">
        <SectionHeading eyebrow={dict.method.eyebrow} title={dict.method.title} id="methode-titre" />
        <ol className="mt-12 grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-5">
          {dict.method.steps.map((step, index) => (
            <li key={step.title} className="reveal border-t border-line pt-5">
              <span className="type-overline text-accent-ink tabular-nums">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="type-h3 mt-3 text-text">{step.title}</h3>
              <p className="type-small mt-2 text-text-2">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* --- Qui : deux colonnes, texte et repères. --------------------------------- */
export function About({ dict }: { dict: Dictionary }) {
  return (
    <section id="qui" aria-labelledby="qui-titre" className="scroll-mt-20 border-t border-line">
      <div className="container-site section-pad grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="reveal lg:col-span-7">
          <p className="type-overline text-accent-ink">{dict.about.eyebrow}</p>
          <h2 id="qui-titre" className="type-h2 mt-3 text-text">
            {dict.about.title}
          </h2>
          <p className="type-body mt-6 max-w-xl text-text-2">{dict.about.text}</p>
          <p className="type-small mt-4 max-w-xl text-text-3">{dict.about.location}</p>
        </div>
        <ul className="reveal lg:col-span-5 lg:pt-10">
          {dict.about.points.map((point) => (
            <li key={point} className="type-small border-t border-line py-4 text-text">
              {point}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* --- FAQ : cinq accordéons natifs, à filets. --------------------------------- */
export function Faq({ dict }: { dict: Dictionary }) {
  return (
    <section id="faq" aria-labelledby="faq-titre" className="scroll-mt-20 border-t border-line">
      <div className="container-site section-pad grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4">
          <SectionHeading eyebrow={dict.faq.eyebrow} title={dict.faq.title} id="faq-titre" />
        </div>
        <div className="reveal lg:col-span-8">
          {dict.faq.items.map((item) => (
            <details key={item.q} className="group border-t border-line last:border-b">
              <summary className="type-h3 flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-text [&::-webkit-details-marker]:hidden">
                {item.q}
                <span aria-hidden className="relative size-5 shrink-0 text-text-3">
                  <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-current" />
                  <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-current transition-transform duration-(--motion) group-open:rotate-90" />
                </span>
              </summary>
              <p className="type-small max-w-2xl pb-6 text-text-2">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
