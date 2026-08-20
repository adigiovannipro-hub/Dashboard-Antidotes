import { Share2 } from "lucide-react";

import type { PlanningPlatform } from "@/lib/planning/types";
import { cn } from "@/lib/utils";

/**
 * Le logo d'un réseau, dans sa pastille de marque.
 *
 * Posés nus sur le blanc du tableau, les pictogrammes se lisaient mal : un
 * trait de couleur de 16 px au milieu d'une ligne de texte, chacun avec son
 * poids et sa densité propres — l'œil ne les distinguait qu'en s'arrêtant
 * dessus. En pastille pleine, glyphe blanc sur la couleur du réseau, ils
 * deviennent un repère qu'on balaie : c'est la grammaire de Monday, et elle
 * marche parce que la **forme** de la tache est la même partout, seule la
 * couleur change.
 *
 * Tracés inline : lucide ne distribue pas d'icônes de marques, et une image
 * distante ferait une requête externe pour un pictogramme de 16 px.
 */

type Brand = {
  /** Le fond de la pastille — dégradé accepté (Instagram). */
  background: string;
  /** Le tracé du glyphe, en viewBox 24. */
  path: string;
  /** Tracé au trait plutôt qu'en aplat — pour les formes qui se referment. */
  stroke?: boolean;
};

const BRANDS: Partial<Record<PlanningPlatform, Brand>> = {
  instagram: {
    background:
      "radial-gradient(circle at 30% 107%, #fdf497 0%, #fd5949 45%, #d6249f 60%, #285AEB 90%)",
    path: "M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23a3.7 3.7 0 0 1-.9 1.38c-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 5.68a4.16 4.16 0 1 0 0 8.32 4.16 4.16 0 0 0 0-8.32Zm0 6.86a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Zm5.3-7.02a.97.97 0 1 1-1.94 0 .97.97 0 0 1 1.94 0Z",
  },
  facebook: {
    background: "#1877F2",
    path: "M13.5 21.9V13.6h2.8l.5-3.3h-3.3V8.2c0-.9.3-1.6 1.6-1.6h1.8V3.7c-.3 0-1.4-.1-2.6-.1-2.6 0-4.4 1.6-4.4 4.5v2.2H7.1v3.3h2.8v8.3h3.6Z",
  },
  linkedin: {
    background: "#0A66C2",
    path: "M7.1 20.4H3.6V9h3.5v11.4ZM5.3 7.4a2.06 2.06 0 1 1 0-4.1 2.06 2.06 0 0 1 0 4.1Zm15.1 13h-3.5v-5.6c0-1.3 0-3-1.9-3-1.9 0-2.1 1.4-2.1 2.9v5.7H9.4V9h3.3v1.6h.05c.47-.9 1.6-1.85 3.35-1.85 3.6 0 4.3 2.4 4.3 5.4v6.25Z",
  },
  youtube: {
    background: "#FF0000",
    path: "M22.5 7.2a2.8 2.8 0 0 0-2-2C18.8 4.7 12 4.7 12 4.7s-6.8 0-8.5.5a2.8 2.8 0 0 0-2 2C1 8.9 1 12 1 12s0 3.1.5 4.8a2.8 2.8 0 0 0 2 2c1.7.5 8.5.5 8.5.5s6.8 0 8.5-.5a2.8 2.8 0 0 0 2-2c.5-1.7.5-4.8.5-4.8s0-3.1-.5-4.8ZM9.8 15.3V8.7l5.7 3.3-5.7 3.3Z",
  },
  tiktok: {
    background: "#010101",
    path: "M16.6 2h-3.2v13.1a2.6 2.6 0 1 1-2.6-2.6c.27 0 .53.04.78.12V9.3a5.9 5.9 0 0 0-.78-.05 5.9 5.9 0 1 0 5.9 5.9V8.6a7 7 0 0 0 4.1 1.3V6.7a3.9 3.9 0 0 1-2.9-1.3A4 4 0 0 1 16.6 2Z",
  },
  x: {
    background: "#000000",
    path: "M17.7 3.3h3L14.2 11l7.7 10.2h-6l-4.7-6.2-5.4 6.2H2.7l7-8-7.4-9.9h6.2l4.3 5.7 4.9-5.7Zm-1 16.1h1.7L7.4 5H5.6l11.1 14.4Z",
  },
  pinterest: {
    background: "#E60023",
    path: "M12 2a10 10 0 0 0-3.7 19.3c-.1-.8-.1-2 0-2.9l1.2-5.1s-.3-.6-.3-1.5c0-1.4.8-2.5 1.9-2.5.9 0 1.3.7 1.3 1.5 0 .9-.6 2.2-.9 3.5-.2 1 .5 1.9 1.5 1.9 1.8 0 3.2-1.9 3.2-4.7 0-2.5-1.8-4.2-4.3-4.2-2.9 0-4.6 2.2-4.6 4.5 0 .9.3 1.8.8 2.3.1.1.1.2.1.3l-.3 1.1c0 .2-.2.2-.3.1-1.2-.6-2-2.3-2-3.8 0-3.1 2.2-5.9 6.5-5.9 3.4 0 6 2.4 6 5.7 0 3.4-2.1 6.1-5.1 6.1-1 0-2-.5-2.3-1.1l-.6 2.4c-.2.9-.8 2-1.2 2.6A10 10 0 1 0 12 2Z",
  },
  snapchat: {
    background: "#FFFC00",
    path: "M12 2.3c2.9 0 5.2 2.3 5.2 5.3 0 .9 0 1.7-.1 2.4.2.1.4.1.6.1.4 0 .9-.2 1.2-.2.5 0 1 .3 1 .8 0 .6-.7 1-1.5 1.3-.4.1-.9.3-1 .6-.1.2 0 .5.2.9.7 1.4 1.9 2.5 3.4 2.8.3.1.5.3.5.6 0 .8-1.5 1.2-2.5 1.4-.1.3-.2.8-.4.9-.6.1-1.4-.2-2.3-.1-.8.2-1.5 1.5-4.3 1.5s-3.5-1.3-4.3-1.5c-.9-.2-1.7.2-2.3.1-.3-.1-.3-.6-.4-.9-1-.2-2.5-.6-2.5-1.4 0-.3.2-.5.5-.6 1.5-.3 2.7-1.4 3.4-2.8.2-.4.3-.7.2-.9-.1-.3-.6-.5-1-.6-.8-.3-1.5-.7-1.5-1.3 0-.5.5-.8 1-.8.3 0 .8.2 1.2.2.2 0 .4 0 .6-.1-.1-.7-.1-1.5-.1-2.4 0-3 2.3-5.3 5.2-5.3Z",
  },
};

/** Le glyphe de Snapchat se lit en noir : son jaune est trop clair. */
const DARK_GLYPH = new Set<PlanningPlatform>(["snapchat"]);

/**
 * META n'a pas de pastille : c'est un couloir qui publie **sur deux réseaux**
 * à la fois (voir `src/lib/publishing/`). Son huit couché, tracé à 14 px, se
 * lisait « co » et ne disait rien de cette double destination — on montre donc
 * les deux marques, l'une devant l'autre.
 */
const DUOS: Partial<Record<PlanningPlatform, PlanningPlatform[]>> = {
  meta: ["instagram", "facebook"],
};

/**
 * La couleur de filet d'un couloir sans pastille propre. Meta garde son bleu :
 * prendre celle du premier membre du duo peignait un rail rose Instagram sur
 * toute la hauteur du tableau, ce que personne ne lit comme « Meta ».
 */
const RAIL: Partial<Record<PlanningPlatform, string>> = {
  meta: "#0866FF",
};

/**
 * La couleur d'un réseau, pour les repères qui ne sont pas le logo — le filet
 * vertical d'un couloir, par exemple. Rend la couleur de la charte quand le
 * réseau n'a pas de marque connue : un repère gris vaut mieux qu'aucun.
 */
export function platformColor(platform: PlanningPlatform): string {
  const rail = RAIL[platform];
  if (rail) return rail;

  const brand = BRANDS[platform]?.background;
  // Un dégradé ne convient pas à un filet de 3 px : Instagram y rendrait une
  // bouillie. On prend alors son rose dominant.
  if (!brand) return "var(--border-strong)";
  return brand.startsWith("radial") ? "#d6249f" : brand;
}

/** Une pastille : le glyphe blanc sur l'aplat de marque. */
function Chip({
  platform,
  className,
  hidden,
}: {
  platform: PlanningPlatform;
  className?: string;
  /** Porté par la pastille seule ; le duo le porte sur son enveloppe. */
  hidden?: boolean;
}) {
  const brand = BRANDS[platform];
  const ink = DARK_GLYPH.has(platform) ? "#0F0F0F" : "#FFFFFF";

  if (!brand) {
    return (
      <span
        aria-hidden={hidden}
        className={cn(
          "bg-surface-sunken text-text-secondary flex size-5 shrink-0 items-center justify-center rounded-md",
          className,
        )}
      >
        <Share2 className="size-3" strokeWidth={2} />
      </span>
    );
  }

  return (
    <span
      aria-hidden={hidden}
      className={cn("flex size-5 shrink-0 items-center justify-center rounded-md", className)}
      style={{ background: brand.background }}
    >
      <svg viewBox="0 0 24 24" className="size-3.5">
        <path
          d={brand.path}
          fill={brand.stroke ? "none" : ink}
          stroke={brand.stroke ? ink : undefined}
          strokeWidth={brand.stroke ? 2.2 : undefined}
          strokeLinejoin={brand.stroke ? "round" : undefined}
        />
      </svg>
    </span>
  );
}

export function PlatformIcon({
  platform,
  className,
}: {
  platform: PlanningPlatform;
  className?: string;
}) {
  const duo = DUOS[platform];

  if (duo) {
    return (
      <span aria-hidden className={cn("flex shrink-0 items-center", className)}>
        {duo.map((member, index) => (
          <Chip
            key={member}
            platform={member}
            // Le second chevauche le premier, cerné de blanc : deux pastilles
            // qui se touchent formeraient une seule tache.
            className={index > 0 ? "-ml-1.5 ring-2 ring-surface" : undefined}
          />
        ))}
      </span>
    );
  }

  return <Chip hidden platform={platform} className={cn("shrink-0", className)} />;
}
