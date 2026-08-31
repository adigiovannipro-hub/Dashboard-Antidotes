import { useId } from "react";
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
  // Le glyphe officiel (tracé simple-icons), blanc sur le bleu Meta. L'ancien
  // huit couché maison se lisait « co » à 14 px ; celui-ci est le vrai dessin,
  // rendu dans la même pastille que les autres marques.
  meta: {
    background: "#0866FF",
    path: "M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z",
  },
  instagram: {
    background:
      "radial-gradient(circle at 30% 107%, #fdf497 0%, #fd5949 45%, #d6249f 60%, #285AEB 90%)",
    // Le tracé officiel simple-icons, en **contours** (le cadre est un anneau,
    // pas un aplat) : rempli d'un dégradé, il rend la caméra — l'ancien tracé
    // maison, plein, rendait un carré.
    path: "M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077",
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

/**
 * Instagram est le seul à ne pas vivre en pastille pleine : son vrai logo est
 * la caméra **elle-même en dégradé**, pas un carré dégradé au glyphe blanc —
 * demande explicite. Le tracé est le même, c'est le remplissage qui change,
 * et le glyphe grandit d'un cran pour peser autant que les pastilles à côté.
 * `useId` : plusieurs occurrences par page, chaque dégradé garde son ancre.
 */
function InstagramGlyph({ className }: { className?: string }) {
  const gradientId = useId();
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#FA7E1E" />
          <stop offset="0.45" stopColor="#D62976" />
          <stop offset="0.75" stopColor="#962FBF" />
          <stop offset="1" stopColor="#4F5BD5" />
        </linearGradient>
      </defs>
      <path d={BRANDS.instagram!.path} fill={`url(#${gradientId})`} />
    </svg>
  );
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

  if (platform === "instagram") {
    return (
      <span
        aria-hidden={hidden}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center",
          className,
        )}
      >
        <InstagramGlyph className="size-5" />
      </span>
    );
  }

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
  return <Chip hidden platform={platform} className={cn("shrink-0", className)} />;
}
