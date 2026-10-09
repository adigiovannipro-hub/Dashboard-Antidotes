import { LOGOTYPE } from "@/components/brand/logotype-paths";

/**
 * Le logotype de la charte (r-08) : « antidotes » en tracés Funnel Display,
 * à la couleur courante (Encre sur clair, Craie sur la Profondeur), et le
 * point — Encre sur clair, Signal avec un léger halo sur la Profondeur, via
 * `--dot`. Jamais de dégradé dans le logo. `height` est la hauteur des
 * ascendantes en pixels ; sous 96 px de large la charte demande la
 * miniature, mais l'en-tête reste lisible à 24 px de haut.
 */
export function Logo({ className = "", height = 22, title = "antidotes" }: { className?: string; height?: number; title?: string }) {
  const [, , w, h] = LOGOTYPE.viewBox.split(" ").map(Number);
  return (
    <svg
      role="img"
      aria-label={title}
      viewBox={LOGOTYPE.viewBox}
      width={Math.round((height * w) / h)}
      height={height}
      className={`logo-mark block overflow-visible ${className}`}
    >
      <path d={LOGOTYPE.letters} fill="currentColor" />
      <circle cx={LOGOTYPE.dot.cx} cy={LOGOTYPE.dot.cy} r={LOGOTYPE.dot.r} fill="var(--dot)" className="logo-dot" />
    </svg>
  );
}
