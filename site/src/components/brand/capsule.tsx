import type { CSSProperties } from "react";
import "./capsule.css";

/**
 * Les rendus 3D de la charte (r-06, r-01, r-04), précalculés une fois en
 * three.js puis exportés en WebP avec alpha : le site n'embarque ni WebGL ni
 * bibliothèque 3D pour les gélules, et la première image est déjà la bonne.
 * Chaque image porte son inclinaison, sa lumière et son halo peint ; aucun
 * texte n'y est gravé, le libellé se pose en HTML et suit la langue.
 * Fichiers à 2× la taille d'affichage conseillée.
 */
export const CAPSULE_ASSETS = {
  strategie: { src: "/brand/capsule-strategie.webp", halo: "#4D7BFF", size: 260 },
  accompagnement: { src: "/brand/capsule-accompagnement.webp", halo: "#9C95FF", size: 260 },
  production: { src: "/brand/capsule-production.webp", halo: "#B49CFF", size: 260 },
  publicite: { src: "/brand/capsule-publicite.webp", halo: "#FF9A7A", size: 260 },
  plateforme: { src: "/brand/capsule-plateforme.webp", halo: "#F7A8D8", size: 260 },
  ia: { src: "/brand/capsule-ia.webp", halo: "#2FD3C6", size: 260 },
  hero: { src: "/brand/gelule-hero.webp", halo: "#4D7BFF", size: 520 },
  heroBlur: { src: "/brand/gelule-hero-flou.webp", halo: "#9C95FF", size: 260 },
  iconCheck: { src: "/brand/icone-verre.webp", halo: "#22E05B", size: 160 },
} as const;

export type CapsuleAsset = keyof typeof CAPSULE_ASSETS;

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
  halo = "#9C95FF",
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
