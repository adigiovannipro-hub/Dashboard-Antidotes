import { IrisCanvas } from "@/components/hero/iris-canvas";
import type { Dictionary } from "@/i18n/types";
import { CLIENT_LOGOS } from "@/lib/logos";
import { LogoMarquee } from "./logo-marquee";

/**
 * La zone d'ouverture : le verre vert animé derrière, la promesse devant,
 * et le bandeau de logos en bas. Le texte garde son contraste grâce à la
 * vignette du canvas et au voile dégradé vers l'encre.
 */
export function Hero({ dict }: { dict: Dictionary }) {
  return (
    <section className="relative isolate overflow-hidden">
      <IrisCanvas className="absolute inset-0 -z-10" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(9,12,11,0)_45%,var(--ink-0)_100%)]" />
      <div className="container-site flex min-h-[calc(88svh-4rem)] flex-col justify-center pb-10 pt-20 md:pt-24">
        <p className="type-overline text-accent-ink">{dict.hero.eyebrow}</p>
        <h1 className="type-display mt-5 max-w-4xl text-text">{dict.hero.title}</h1>
        <p className="type-lead mt-6 max-w-xl text-text-2">{dict.hero.lead}</p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <a href="#note" className="type-body inline-flex items-center justify-center rounded-pill bg-text px-6 py-3.5 font-medium text-text-on-light transition-transform duration-(--motion) hover:-translate-y-px">
            {dict.hero.ctaPrimary}
          </a>
          <a href="#cas" className="type-body inline-flex items-center justify-center rounded-pill border border-line-strong bg-ink-0/40 px-6 py-3.5 text-text backdrop-blur transition-colors duration-(--motion) hover:bg-glass">
            {dict.hero.ctaSecondary}
          </a>
        </div>
      </div>
      <div className="pb-8 pt-2">
        <p className="container-site type-caption mb-4 text-text-3">{dict.hero.trustLabel}</p>
        <LogoMarquee logos={CLIENT_LOGOS} label={dict.hero.trustLabel} />
      </div>
      <p className="type-caption pointer-events-none absolute right-6 top-24 hidden text-text-3 md:block" aria-hidden>
        {dict.hero.hint}
      </p>
    </section>
  );
}
