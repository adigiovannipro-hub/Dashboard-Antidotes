import { cn } from "@/lib/utils";

/**
 * La barre de progression de la formation.
 *
 * Le remplissage est à la teinte vive de la marque : c'est un aplat, pas un
 * texte — la règle « couleur vive ≠ couleur de texte » ne s'applique qu'à ce
 * qui se lit. Le pourcentage, lui, se dit à côté en encre normale.
 */
export function ProgressBar({
  percent,
  className,
  label,
}: {
  /** Entier 0-100. */
  percent: number;
  className?: string;
  /** Lu par les lecteurs d'écran — « Progression de la formation ». */
  label: string;
}) {
  const bounded = Math.min(100, Math.max(0, percent));
  return (
    <div
      role="progressbar"
      aria-valuenow={bounded}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-pill bg-surface-sunken", className)}
    >
      <div
        className="h-full rounded-pill bg-accent transition-[width] duration-(--motion-duration) ease-standard motion-reduce:transition-none"
        style={{ width: `${bounded}%` }}
      />
    </div>
  );
}
