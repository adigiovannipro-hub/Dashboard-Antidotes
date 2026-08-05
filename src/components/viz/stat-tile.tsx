import { Delta } from "@/components/viz/delta";
import { formatMetric } from "@/lib/format";
import type { MetricDelta } from "@/lib/metrics/aggregate";
import { METRIC_DEFINITIONS } from "@/lib/metrics/definitions";
import type { MetricId } from "@/lib/metrics/types";
import { cn } from "@/lib/utils";

/**
 * Tuile de statistique : libellé, valeur, variation.
 *
 * Pas de bordure — la card #F2F2F2 de la charte structure à elle seule. La
 * hiérarchie tient à la taille et au poids, sans ornement.
 */
export function StatTile({
  metric,
  value,
  delta,
  className,
}: {
  metric: MetricId;
  value: number | null;
  delta?: MetricDelta;
  className?: string;
}) {
  const definition = METRIC_DEFINITIONS[metric];

  return (
    <div className={cn("bg-card rounded-lg p-4", className)}>
      <p className="text-muted-foreground truncate text-xs" title={definition.label}>
        {definition.label}
      </p>
      {/* Chiffres proportionnels : `tabular-nums` sur une grande valeur isolée
          donnerait des chasses égales et un rendu lâche. */}
      <p className="text-foreground mt-1 text-2xl leading-none font-semibold">
        {formatMetric(metric, value)}
      </p>
      {delta ? (
        <Delta
          ratio={delta.ratio}
          sentiment={delta.sentiment}
          className="mt-2"
        />
      ) : null}
    </div>
  );
}

/**
 * Chiffre héros : la seule réponse à « est-ce que ça a marché ». Un par vue.
 *
 * C'est l'écart assumé avec le rapport Looker actuel, où dix cartes de taille
 * identique donnent le même poids aux impressions qu'au ROAS et noient la
 * seule question qui compte.
 */
export function HeroFigure({
  metric,
  value,
  delta,
  sentence,
  period,
}: {
  metric: MetricId;
  value: number | null;
  delta?: MetricDelta;
  /** La phrase que le client lira en premier. Elle doit tenir seule. */
  sentence?: string;
  period?: string;
}) {
  const definition = METRIC_DEFINITIONS[metric];
  const hasComparison = delta && delta.ratio !== null;

  return (
    <div className="bg-card flex flex-col justify-between gap-4 rounded-lg p-5">
      <div>
        <p className="text-muted-foreground text-xs tracking-wide uppercase">
          {definition.label}
        </p>
        <p className="text-foreground mt-2 text-5xl leading-none font-bold">
          {formatMetric(metric, value)}
        </p>
        {hasComparison ? (
          <Delta
            ratio={delta.ratio}
            sentiment={delta.sentiment}
            className="mt-3"
          />
        ) : (
          <p className="text-muted-foreground mt-3 text-xs">
            Pas de comparaison disponible sur la période précédente.
          </p>
        )}
      </div>

      {/* Le bas de la carte porte la lecture en clair plutôt qu'un vide : c'est
          la phrase qu'on recopierait dans un mail au client. */}
      {sentence ? (
        <p className="text-foreground text-sm leading-relaxed">
          {sentence}
          {period ? (
            <span className="text-muted-foreground block pt-1 text-xs">
              {period}
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
