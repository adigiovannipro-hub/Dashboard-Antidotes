import {
  FORMAT_LABELS,
  STATUS_LABELS,
  type PlanningFormat,
  type PlanningStatus,
} from "@/lib/planning/types";
import { cn } from "@/lib/utils";

/**
 * Pastilles de statut et de format.
 *
 * Le vert de marque est une ponctuation : il ne marque que l'état terminal —
 * publié. Tout ce qui demande une action porte l'encre normale, et seul le
 * réellement bloquant passe en rouge. Un planning entier en couleurs vives ne
 * signalerait plus rien.
 */

const STATUS_TONE: Record<PlanningStatus, string> = {
  published: "bg-brand-mint text-heading",
  scheduled: "bg-card text-foreground",
  validated: "bg-card text-foreground",
  to_validate: "border-brand-red/40 text-brand-red border",
  wording_todo: "border-border text-foreground border",
  draft: "border-border text-muted-foreground border",
  in_progress: "border-border text-muted-foreground border",
  on_hold: "bg-muted text-muted-foreground",
  idea: "bg-muted text-muted-foreground",
  dropped: "bg-muted text-muted-foreground line-through",
};

export function StatusBadge({
  status,
  raw,
  className,
}: {
  status: PlanningStatus;
  /** Libellé Monday d'origine : c'est le vocabulaire du client qui prime. */
  raw?: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        STATUS_TONE[status],
        className,
      )}
    >
      {raw?.trim() ? raw : STATUS_LABELS[status]}
    </span>
  );
}

const FORMAT_TONE: Record<PlanningFormat, string> = {
  reel: "text-[var(--series-2)]",
  story: "text-[var(--series-3)]",
  carousel: "text-[var(--series-2)]",
  video: "text-[var(--series-2)]",
  thread: "text-[var(--series-3)]",
  dark: "text-muted-foreground",
  post: "text-muted-foreground",
  other: "text-muted-foreground",
};

export function FormatBadge({
  format,
  className,
}: {
  format: PlanningFormat;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "shrink-0 text-[11px] font-medium tracking-wide uppercase",
        FORMAT_TONE[format],
        className,
      )}
    >
      {FORMAT_LABELS[format]}
    </span>
  );
}
