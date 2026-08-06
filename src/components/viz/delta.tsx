import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { formatDelta } from "@/lib/format";
import type { DeltaSentiment } from "@/lib/metrics/aggregate";
import { cn } from "@/lib/utils";

/**
 * Variation vs période précédente, en pastille.
 *
 * La couleur suit le **sens métier**, pas le signe : un CPA en baisse s'affiche
 * en vert avec une flèche vers le bas. La flèche donne la direction, la couleur
 * donne le jugement — ce sont deux informations distinctes, et c'est ce qui
 * évite de lire une bonne nouvelle comme une alerte.
 *
 * Fond subtil et encre foncée, comme toute pastille du système : la teinte
 * vive ne porterait pas le contraste à cette taille.
 */
const SENTIMENT_CLASS: Record<DeltaSentiment, string> = {
  positive: "bg-accent-subtle text-accent-ink",
  negative: "bg-danger-subtle text-danger-ink",
  neutral: "bg-neutral-subtle text-neutral-ink",
};

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
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "type-caption inline-flex items-center gap-0.5 rounded-pill px-2 py-0.5 font-medium tabular-nums",
          SENTIMENT_CLASS[sentiment],
        )}
      >
        <Icon className="size-3 shrink-0" strokeWidth={2} aria-hidden />
        {formatDelta(ratio)}
      </span>
      {comparisonLabel ? (
        <span className="type-caption text-text-secondary">{comparisonLabel}</span>
      ) : null}
    </span>
  );
}
