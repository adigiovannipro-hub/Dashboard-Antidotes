import { IrisCanvas } from "@/components/hero/iris-canvas";
import type { Dictionary } from "@/i18n/types";
import { CLIENT_LOGOS } from "@/lib/logos";
import { LogoMarquee } from "./logo-marquee";

/**
 * La zone d'ouverture : le verre vert animé derrière, la promesse devant,
 * et le bandeau de logos en bas. La section remonte sous le header, qui est
 * en verre : les bulles passent dessous au lieu d'être tranchées à 64 px.
 * Le texte garde son contraste grâce à la vignette du canvas et au voile
 * dégradé vers l'encre, mesurés aux pixels sous le lead.
 */
export function Hero({ dict }: { dict: Dictionary }) {
  return (
    <section className="relative isolate -mt-16 overflow-hidden">
      <IrisCanvas className="absolute inset-0 -z-10" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(9,12,11,0)_30%,var(--ink-0)_100%)]" />
      {/* Une pénombre derrière la colonne de texte, et elle seule : le corps clair d'une bulle
          sous le surtitre tombait à 2,2:1 aux pixels. À droite, les bulles gardent leur lumière. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_85%_60%_at_50%_56%,rgba(9,12,11,.8)_40%,rgba(9,12,11,0)_100%)] md:bg-[radial-gradient(ellipse_46%_62%_at_27%_50%,rgba(9,12,11,.8)_35%,rgba(9,12,11,0)_100%)]" />
      {/* Le texte porte une ombre douce : sous le corps clair d'une bulle, c'est elle qui tient le contraste. */}
      <div className="container-site flex min-h-[88svh] flex-col justify-center pb-10 pt-36 [text-shadow:0_1px_2px_rgba(9,12,11,.7),0_0_28px_rgba(9,12,11,.95)] md:pt-40">
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
      <div className="pb-6 pt-1">
        <p className="container-site type-caption mb-4 text-text-3">{dict.hero.trustLabel}</p>
        <LogoMarquee logos={CLIENT_LOGOS} label={dict.hero.trustLabel} />
      </div>
    </section>
  );
}
