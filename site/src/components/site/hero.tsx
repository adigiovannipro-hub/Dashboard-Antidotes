import { IrisCanvas } from "@/components/hero/iris-canvas";
import type { Dictionary } from "@/i18n/types";

/**
 * La zone d'ouverture : l'animation de verre iridescent derrière, la
 * promesse devant. Le texte garde son contraste grâce à la vignette du
 * canvas et à un voile dégradé vers le bas.
 */
export function Hero({ dict }: { dict: Dictionary }) {
  return (
    <section className="relative isolate overflow-hidden">
      <IrisCanvas className="absolute inset-0 -z-10" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(10,11,15,0)_40%,var(--ink-0)_100%)]" />
      <div className="container-site flex min-h-[calc(100svh-4rem)] flex-col justify-center py-20 md:py-28">
        <p className="type-overline is-visible text-accent-ink">{dict.hero.eyebrow}</p>
        <h1 className="type-display is-visible mt-6 max-w-5xl text-text">
          {dict.hero.titleBefore} <span className="accent-serif text-iris">{dict.hero.titleAccent}</span> {dict.hero.titleAfter}
        </h1>
        <p className="type-lead is-visible mt-7 max-w-2xl text-text-2">{dict.hero.lead}</p>
        <div className="is-visible mt-10 flex flex-col gap-3 sm:flex-row">
          <a href="#note" className="type-body inline-flex items-center justify-center rounded-pill bg-text px-6 py-3.5 font-medium text-text-on-light transition-transform duration-(--motion) hover:-translate-y-px">
            {dict.hero.ctaPrimary}
          </a>
          <a href="#cas" className="type-body inline-flex items-center justify-center rounded-pill border border-line-strong bg-ink-0/40 px-6 py-3.5 text-text backdrop-blur transition-colors duration-(--motion) hover:bg-glass">
            {dict.hero.ctaSecondary}
          </a>
        </div>
        <div className="is-visible mt-16 md:mt-24">
          <p className="type-caption text-text-3">{dict.hero.trustLabel}</p>
          <ul className="mt-3 flex flex-wrap gap-x-7 gap-y-2">
            {dict.hero.trust.map((name) => (
              <li key={name} className="type-small font-medium text-text-2">
                {name}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="type-caption pointer-events-none absolute bottom-6 right-6 hidden text-text-3 md:block" aria-hidden>
        {dict.hero.hint}
      </p>
    </section>
  );
}
