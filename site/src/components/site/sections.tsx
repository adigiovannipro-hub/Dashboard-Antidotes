import { CalendarCheck, Clapperboard, Compass, LayoutDashboard, Sparkles, Target } from "lucide-react";
import type { ComponentType } from "react";

import type { Dictionary, Service } from "@/i18n/types";
import { CASE_VISUALS, type CaseVisual } from "@/lib/cases";
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

/* --- Cas clients : un rail de publications, trois colonnes, puis les chiffres. --- */
/* Les visuels des trois clients entremêlés, un de chacun à tour de rôle : le
   rail montre la matière, pas un client après l'autre. */
function interleaveVisuals(ids: string[]): CaseVisual[] {
  const lists = ids.map((id) => CASE_VISUALS[id] ?? []);
  const longest = Math.max(0, ...lists.map((list) => list.length));
  const rail: CaseVisual[] = [];
  for (let i = 0; i < longest; i++) for (const list of lists) if (list[i]) rail.push(list[i]);
  return rail;
}

export function Cases({ dict }: { dict: Dictionary }) {
  const rail = interleaveVisuals(dict.cases.items.map((item) => item.id));
  return (
    <section id="cas" aria-labelledby="cas-titre" className="scroll-mt-20 border-t border-line">
      <div className="container-site section-pad">
        <SectionHeading eyebrow={dict.cases.eyebrow} title={dict.cases.title} id="cas-titre" />
        {/* Le rail déborde du conteneur jusqu'aux bords de l'écran ; `body` est en `overflow-x: clip`. */}
        <ul tabIndex={0} aria-labelledby="cas-titre" className="reveal bleed-x mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
          {rail.map((visual) => (
            <li key={visual.poster} className="w-[200px] shrink-0 snap-start md:w-[220px]">
              <PhoneCase poster={visual.poster} video={visual.video} alt={visual.alt} handle={visual.handle} />
            </li>
          ))}
        </ul>
        <ul className="reveal mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {dict.cases.items.map((item) => (
            <li key={item.id} className="border-t border-line pt-5">
              <h3 className="type-h3 text-text">{item.client}</h3>
              <p className="type-caption mt-1 text-text-3">{item.sector}</p>
              <span className="type-stat mt-4 block text-text">{item.stat.value}</span>
              <span className="type-small mt-2 block text-text-2">{item.stat.label}</span>
              {item.stat.source && <span className="type-caption mt-1 block text-text-3">{item.stat.source}</span>}
              <p className="type-small mt-3 text-text-2">{item.headline}</p>
            </li>
          ))}
        </ul>
        <dl className="reveal mt-12 grid grid-cols-1 border-y border-line sm:grid-cols-2 lg:grid-cols-4">
          {dict.cases.numbers.map((stat, index) => (
            <div key={stat.label} className={`py-6 sm:px-6 ${index > 0 ? "border-t border-line sm:border-t-0 sm:border-l" : "sm:pl-0"}`}>
              <dt className="sr-only">{dict.cases.numbersLabel}</dt>
              <dd>
                <span className="type-h2 block text-text">{stat.value}</span>
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

/* --- Services : six lignes à pictogramme dans le titre, séparées par des filets. --- */
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
        <ul className="mt-10 grid grid-cols-1 gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {dict.services.items.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <li key={item.name} className="reveal border-t border-line pt-5">
                {/* L'icône dans le titre, en repère : seule au-dessus, c'était la grille « features » de tout modèle. */}
                <h3 className="type-h3 flex items-center gap-3 text-text">
                  <Icon className="size-5 shrink-0 text-accent-ink" strokeWidth={1.75} aria-hidden />
                  {item.name}
                </h3>
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
        <ol className="mt-10 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-5">
          {dict.method.steps.map((step, index) => (
            <li key={step.title} className="reveal border-t border-line pt-5">
              {/* Un numéro, grand et gris : il n'a pas le rôle d'un surtitre. Le vert reste sur « Méthode ». */}
              <span className="type-stat block text-text-3">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="type-h3 mt-4 text-text lg:min-h-15">{step.title}</h3>
              <p className="type-small mt-2 hidden text-text-2 lg:block">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* --- FAQ : cinq accordéons natifs, à filets. --------------------------------- */
export function Faq({ dict }: { dict: Dictionary }) {
  return (
    <section id="faq" aria-labelledby="faq-titre" className="scroll-mt-20 border-t border-line">
      <div className="container-site section-pad grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <SectionHeading eyebrow={dict.faq.eyebrow} title={dict.faq.title} id="faq-titre" />
        </div>
        <div className="reveal lg:col-span-7">
          {dict.faq.items.map((item) => (
            <details key={item.q} className="group border-t border-line last:border-b">
              <summary className="type-lead flex cursor-pointer list-none items-center justify-between gap-6 py-4 font-medium text-text [&::-webkit-details-marker]:hidden">
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
