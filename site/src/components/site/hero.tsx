import { LavaCanvas } from "@/components/brand/lava-canvas";
import { Rich } from "@/components/brand/rich";
import type { Dictionary } from "@/i18n/types";

/**
 * L'ouverture, univers Profondeur (r-05) : la lave derrière — grandes
 * formes coupées par les bords, cœur Signal, franges Menthe et Rose — la
 * promesse à gauche sur la grille. Le bandeau de logos ouvre la section
 * suivante : posé ici, la lave passait sous les marques. Trois
 * plans : fond, matière, texte. La section remonte sous l'en-tête en verre
 * pour que la lave passe dessous au lieu d'être tranchée à 64 px.
 */
export function Hero({ dict }: { dict: Dictionary }) {
  return (
    <section data-univers="sombre" className="theme-dark relative isolate -mt-16 overflow-hidden bg-bg text-text">
      <LavaCanvas className="absolute inset-0 -z-10" />
      {/* La pénombre de la colonne de texte : Craie sur Signal tombe à 1,7:1 (r-13), le texte ne se
          pose donc jamais sur la lave. La lave reste vive à droite et sur les bords. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_90%_55%_at_40%_50%,rgb(11_17_12/.86)_35%,rgb(11_17_12/0)_100%)] md:bg-[radial-gradient(ellipse_52%_64%_at_24%_50%,rgb(11_17_12/.9)_40%,rgb(11_17_12/0)_100%)]" />
      <div className="container-site flex min-h-[100svh] flex-col justify-start pb-56 pt-32 md:min-h-[94svh] md:justify-center md:pb-20 md:pt-40">
        <div className="max-w-[46rem]">
          <p className="type-overline flex items-center gap-2.5 text-text-2">
            <span aria-hidden className="size-2 rounded-pill bg-signal shadow-[0_0_10px_var(--signal)]" />
            {`${dict.hero.proof.value}\u00a0${dict.hero.proof.label}`}
          </p>
          <h1 className="type-display mt-6 text-text">
            <Rich text={dict.hero.title} />
          </h1>
          <p className="type-lead mt-7 max-w-xl text-text-2">{dict.hero.lead}</p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a href="#note" className="type-body inline-flex items-center justify-center rounded-pill bg-btn px-6.5 py-3.5 font-semibold text-btn-text transition-colors duration-(--motion) hover:bg-btn-hover">
              {dict.hero.ctaPrimary}
            </a>
            <a href="#cas" className="glass type-body inline-flex items-center justify-center rounded-pill px-6.5 py-3.5 font-medium text-text transition-[filter] duration-(--motion) hover:brightness-125 max-md:bg-surface max-md:shadow-[inset_0_0_0_1px_var(--line-strong)]">
              {dict.hero.ctaSecondary}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
