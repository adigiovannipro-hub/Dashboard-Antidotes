import type { CSSProperties } from "react";

import { IrisCanvas } from "@/components/hero/iris-canvas";
import { Rich, plainText } from "@/components/brand/rich";
import type { Dictionary } from "@/i18n/types";

/**
 * La largeur de la plus longue ligne du titre, en em de sa taille : c'est
 * elle qui fixe la taille du titre, pour que la phrase tienne sur ses trois
 * lignes à toutes les largeurs (320 à 1920 px). Mesurée au navigateur sur les
 * polices chargées — Funnel Display 600, Instrument Serif italique —, plus
 * 4 % de marge pour l'encre qui déborde de la chasse (italique, approche
 * négative) et les écarts de rendu d'un système à l'autre.
 *
 * La clé est la phrase elle-même : si un dictionnaire la change, la mesure
 * ne s'applique plus et l'estimation prend le relais — un titre un peu plus
 * petit, jamais une ligne coupée. Remesurer alors et remplacer la clé.
 */
const TITLE_MEASURES: Record<string, number> = {
  // « Des réseaux sociaux » : 9,11 em mesurés.
  "Des réseaux sociaux\n*qui rapportent*,\n_chiffres à l'appui._": 9.48,
  // « the numbers to prove it. » : 9,92 em mesurés.
  "Social channels\n*that deliver*, with\nthe numbers _to prove it._": 10.32,
};

/** Une estimation qui ne déborde pas : 0,62 em par signe, la chasse moyenne de Funnel Display 600 étant plus étroite. */
function titleMeasure(title: string): number {
  const measured = TITLE_MEASURES[title];
  if (measured) return measured;
  const longest = Math.max(...title.split("\n").map((line) => plainText(line).length));
  return longest * 0.62;
}

/**
 * L'ouverture, univers Profondeur : la lave de la V1 derrière — ses bulles
 * de verre et la bulle qui suit la souris, repeintes aux couleurs de la
 * charte (cœur Signal, franges Menthe et Rose) — la promesse à gauche. Le bandeau de logos ouvre la section
 * suivante : posé ici, la lave passait sous les marques. Trois
 * plans : fond, matière, texte. La section remonte sous l'en-tête en verre
 * pour que la lave passe dessous au lieu d'être tranchée à 64 px.
 *
 * Le titre se lit sur trois lignes, comme la charte le pose (r-18) : une
 * ligne par segment du dictionnaire, sans retour, et une taille qui suit
 * la largeur de la colonne (`hero.css`). Au-dessus, la preuve de la
 * couverture LinkedIn : le nombre de clients accompagnés.
 */
export function Hero({ dict }: { dict: Dictionary }) {
  const measure = { "--hero-measure": titleMeasure(dict.hero.title) } as CSSProperties;
  return (
    <section data-univers="sombre" className="theme-dark relative isolate -mt-16 overflow-hidden bg-bg text-text">
      <IrisCanvas className="absolute inset-0 -z-10" />
      {/* La pénombre de la colonne de texte : Craie sur Signal tombe à 1,7:1 (r-13), le texte ne se
          pose donc jamais sur la lave. La lave reste vive à droite et sur les bords. Sous lg, le titre
          occupe presque toute la largeur : la pénombre s'élargit avec lui. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_90%_55%_at_40%_50%,rgb(11_17_12/.86)_35%,rgb(11_17_12/0)_100%)] lg:bg-[radial-gradient(ellipse_52%_64%_at_24%_50%,rgb(11_17_12/.9)_40%,rgb(11_17_12/0)_100%)]" />
      <div className="container-site flex min-h-[100svh] flex-col justify-start pb-56 pt-32 md:min-h-[94svh] md:justify-center md:pb-20 md:pt-40">
        <div className="hero-copy" style={measure}>
          <p className="hero-proof">
            <span className="hero-proof-value">{dict.hero.proof.value}</span>
            {" "}
            <span className="hero-proof-mark">{dict.hero.proof.label}</span>
          </p>
          <h1 className="hero-title type-display text-text">
            <Rich text={dict.hero.title} lines />
          </h1>
          <p className="type-lead mt-7 max-w-xl text-text-2">{dict.hero.lead}</p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a href="#note" className="btn-primary type-body inline-flex min-h-12 items-center justify-center rounded-pill px-6.5 py-3 text-center font-semibold">
              {dict.hero.ctaPrimary}
            </a>
            {/* Sous lg, la lave remonte sous les boutons : le verre y laisserait la Craie sur du Signal,
                le bouton prend donc la surface pleine de la Profondeur. Le survol garde son liseré. */}
            <a
              href="#cas"
              className="btn-glass type-body inline-flex min-h-12 items-center justify-center rounded-pill px-6.5 py-3 text-center font-medium max-lg:bg-surface max-lg:shadow-[inset_0_0_0_1px_var(--line-strong)]"
            >
              {dict.hero.ctaSecondary}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
