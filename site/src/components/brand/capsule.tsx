import type { CSSProperties } from "react";
import type { Locale } from "@/i18n/locale";
import "./capsule.css";

/**
 * Les rendus 3D de la charte (r-06, r-01, r-04), précalculés une fois en
 * three.js puis exportés en WebP avec alpha : le site n'embarque ni WebGL ni
 * bibliothèque 3D pour les gélules, et la première image est déjà la bonne.
 * Chaque image porte son inclinaison, sa lumière et son halo peint.
 * Fichiers à 2× la taille d'affichage conseillée. Les halos animés lisent
 * les tokens de la palette, jamais une valeur en dur.
 */
export const CAPSULE_ASSETS = {
  hero: { src: "/brand/gelule-hero.webp", halo: "var(--azur)", size: 520 },
  heroBlur: { src: "/brand/gelule-hero-flou.webp", halo: "var(--lilas)", size: 260 },
  iconCheck: { src: "/brand/icone-verre.webp", halo: "var(--signal)", size: 160 },
} as const;

/** Boîte de la matière seule, halo exclu, en fractions du cadre de l'image. */
export type PillCore = { left: number; top: number; right: number; bottom: number };

/**
 * Les pilules vertes des services (retour du 11/10) : la gamme verte de la
 * charte — Signal, 400, 300, 200, Menthe, Forêt dans les ombres — et le nom
 * du service gravé ton sur ton en Funnel Display 600 (r-06). Le mot est dans
 * l'image, donc une image par langue ; « Production » s'écrit pareil dans les
 * deux. `engraved: false` laisserait la pilule lisse et le libellé en texte.
 * Rendus à 400 px, pour un affichage jusqu'à 200 px. `core` : la boîte de
 * la matière seule, halo exclu, en fractions du cadre (identique en FR et EN).
 */
export const SERVICE_PILLS = {
  strategie: { src: { fr: "/brand/pilule-strategie-fr.webp", en: "/brand/pilule-strategie-en.webp" }, halo: "var(--signal)", engraved: true, core: { left: 0.12, top: 0.198, right: 0.865, bottom: 0.813 } },
  accompagnement: { src: { fr: "/brand/pilule-accompagnement-fr.webp", en: "/brand/pilule-accompagnement-en.webp" }, halo: "var(--signal)", engraved: true, core: { left: 0.068, top: 0.308, right: 0.913, bottom: 0.683 } },
  production: { src: { fr: "/brand/pilule-production.webp", en: "/brand/pilule-production.webp" }, halo: "var(--g-400)", engraved: true, core: { left: 0.115, top: 0.268, right: 0.9, bottom: 0.725 } },
  publicite: { src: { fr: "/brand/pilule-publicite-fr.webp", en: "/brand/pilule-publicite-en.webp" }, halo: "var(--lagon)", engraved: true, core: { left: 0.16, top: 0.233, right: 0.838, bottom: 0.8 } },
  plateforme: { src: { fr: "/brand/pilule-plateforme-fr.webp", en: "/brand/pilule-plateforme-en.webp" }, halo: "var(--signal)", engraved: true, core: { left: 0.085, top: 0.288, right: 0.905, bottom: 0.725 } },
  ia: { src: { fr: "/brand/pilule-ia-fr.webp", en: "/brand/pilule-ia-en.webp" }, halo: "var(--lagon)", engraved: true, core: { left: 0.205, top: 0.26, right: 0.785, bottom: 0.733 } },
} as const satisfies Record<string, { src: Record<Locale, string>; halo: string; engraved: boolean; core: PillCore }>;

export type ServicePill = keyof typeof SERVICE_PILLS;

/**
 * Les pilules qui flottent en parallaxe sur la Craie (méthode, questionnaire,
 * FAQ) : vertes, lisses, sans texte, cinq formes différentes. `max` est la
 * plus grande taille d'affichage (le fichier est à 2×) ; `core` est la boîte
 * de la matière seule, halo exclu, en fractions du cadre — de quoi caler une
 * pilule sur le bord d'une colonne de texte sans jamais passer dessous.
 */
export const FLOATING_PILLS = {
  softgel: { src: "/brand/pilule-deco-softgel.webp", max: 340, core: { left: 0.216, top: 0.162, right: 0.771, bottom: 0.851 } },
  gelule: { src: "/brand/pilule-deco-gelule.webp", max: 300, core: { left: 0.277, top: 0.142, right: 0.738, bottom: 0.883 } },
  oblong: { src: "/brand/pilule-deco-oblong.webp", max: 240, core: { left: 0.133, top: 0.283, right: 0.85, bottom: 0.721 } },
  bicolore: { src: "/brand/pilule-deco-bicolore.webp", max: 170, core: { left: 0.174, top: 0.188, right: 0.841, bottom: 0.824 } },
  comprime: { src: "/brand/pilule-deco-comprime.webp", max: 150, core: { left: 0.203, top: 0.243, right: 0.8, bottom: 0.777 } },
} as const satisfies Record<string, { src: string; max: number; core: PillCore }>;

export type FloatingPill = keyof typeof FLOATING_PILLS;

type CapsuleProps = {
  /** Chemin de l'image (voir `CAPSULE_ASSETS`). */
  src: string;
  /** Texte alternatif ; vide (défaut) = image décorative, ignorée des lecteurs d'écran. */
  label?: string;
  /** Taille d'affichage en px (carré). L'image se réduit avec son conteneur. */
  size?: number;
  /** Alias de `size`. */
  width?: number;
  /** Angle de repos en degrés, ajouté à l'inclinaison déjà rendue dans l'image. */
  rotate?: number;
  /** Couleur CSS du halo animé au survol. */
  halo?: string;
  /** Apparition au défilement (−6° → angle, 40 px → 0). `false` pour le héros. */
  reveal?: boolean;
  /** Chargement immédiat et prioritaire : réservé à l'image du premier écran. */
  priority?: boolean;
  className?: string;
};

/**
 * Pose une capsule : apparition au défilement par l'observateur du site
 * (`.reveal` → `is-visible`), rotation +6° et halo ×1,4 au survol de la
 * capsule ou de son conteneur `.capsule-host`, tout figé en mouvement réduit.
 */
export function Capsule({
  src,
  label = "",
  size,
  width,
  rotate = 0,
  halo = "var(--signal)",
  reveal = true,
  priority = false,
  className,
}: CapsuleProps) {
  const px = size ?? width ?? 260;
  const style = {
    "--capsule-size": `${px}px`,
    "--capsule-rotate": `${rotate}deg`,
    "--capsule-halo": halo,
  } as CSSProperties;
  const classes = ["capsule", reveal ? "capsule-in reveal" : "capsule-static", className]
    .filter(Boolean)
    .join(" ");
  const decorative = label === "";
  return (
    <span className={classes} style={style} aria-hidden={decorative || undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element -- rendu 3D déjà encodé en WebP à 2× : next/image le réencoderait sans rien gagner */}
      <img
        className="capsule-img"
        src={src}
        alt={label}
        width={px}
        height={px}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "low"}
        decoding="async"
        draggable={false}
      />
    </span>
  );
}
