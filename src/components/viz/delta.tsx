import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { formatDelta } from "@/lib/format";
import type { DeltaSentiment } from "@/lib/metrics/aggregate";
import { cn } from "@/lib/utils";

const SENTIMENT_CLASS: Record<DeltaSentiment, string> = {
  positive: "text-[var(--delta-good)]",
  negative: "text-[var(--status-critical)]",
  neutral: "text-muted-foreground",
};

/**
 * Variation vs période précédente.
 *
 * La couleur suit le **sens métier**, pas le signe : un CPA en baisse s'affiche
 * en vert avec une flèche vers le bas. La flèche donne la direction, la couleur
 * donne le jugement — ce sont deux informations distinctes, et c'est ce qui
 * évite de lire une bonne nouvelle comme une alerte.
 */
export function Delta({
  ratio,
  sentiment,
  comparisonLabel,
  className,
}: {
  ratio: number | null;
  sentiment: DeltaSentiment;
  comparisonLabel?: string;
  className?: string;
}) {
  const Icon =
    ratio === null || ratio === 0 ? Minus : ratio > 0 ? ArrowUp : ArrowDown;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        SENTIMENT_CLASS[sentiment],
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {formatDelta(ratio)}
      {comparisonLabel ? (
        <span className="text-muted-foreground font-normal">
          {" "}
          {comparisonLabel}
        </span>
      ) : null}
    </span>
  );
}
