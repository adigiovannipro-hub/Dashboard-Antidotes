import { cn } from "@/lib/utils";

/**
 * L'état d'une entité — tâche, publication, message, facture — sous une forme
 * unique dans toute l'application.
 *
 * Une seule règle de couleur, et elle est sémantique, jamais décorative :
 *
 *   `positive`  publié, payé, terminé au sens favorable
 *   `warning`   en attente d'une action de ma part, à valider
 *   `danger`    en retard, en échec, en alerte
 *   `info`      planifié, programmé — daté, mais rien à faire aujourd'hui
 *   `neutral`   sans état, archivé, terminé sans qualité particulière
 *
 * Le point reprend l'encre et non la teinte vive : sur un fond subtil, le
 * vert de marque tombe à 2,7:1 et l'ambre à 2,0:1 — invisibles à 6 px. Même
 * famille chromatique, contraste tenu.
 */

export type StatusTone = "positive" | "warning" | "danger" | "info" | "neutral";

const TONES: Record<StatusTone, string> = {
  positive: "bg-accent-subtle text-accent-ink",
  warning: "bg-warning-subtle text-warning-ink",
  danger: "bg-danger-subtle text-danger-ink",
  info: "bg-info-subtle text-info-ink",
  neutral: "bg-neutral-subtle text-neutral-ink",
};

export function StatusPill({
  tone = "neutral",
  children,
  dot = true,
  className,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  /** Sans point pour une pastille purement informative (un compteur). */
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "type-caption inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-pill bg-current"
        />
      ) : null}
      {children}
    </span>
  );
}
