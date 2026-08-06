import { Delta } from "@/components/viz/delta";
import { formatMetric } from "@/lib/format";
import type { MetricDelta } from "@/lib/metrics/aggregate";
import { METRIC_DEFINITIONS } from "@/lib/metrics/definitions";
import type { MetricId } from "@/lib/metrics/types";
import { cn } from "@/lib/utils";

/**
 * Tuile de statistique : libellé, valeur, variation.
 *
 * Même gabarit que la `StatCard` du système — surblanc bordé, libellé en
 * capitales fines, chiffre à chasse tabulaire — mais sans icône : dix tuiles
 * côte à côte avec dix pictogrammes deviennent un mur de symboles, et aucune
 * des dix ne se lit plus.
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
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-4 shadow-card",
        className,
      )}
    >
      <p
        className="type-overline truncate text-text-secondary"
        title={definition.label}
      >
        {definition.label}
      </p>
      {/* Chiffres proportionnels : `tabular-nums` sur une grande valeur isolée
          donnerait des chasses égales et un rendu lâche. */}
      <p className="mt-2 text-2xl leading-none font-semibold text-text-primary">
        {formatMetric(metric, value)}
      </p>
      {delta ? (
        <Delta ratio={delta.ratio} sentiment={delta.sentiment} className="mt-2" />
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
    <div className="flex flex-col justify-between gap-6 rounded-lg border border-border bg-surface p-6 shadow-card">
      <div>
        <p className="type-overline text-text-secondary">{definition.label}</p>
        <p className="mt-2 text-5xl leading-none font-bold text-text-primary sm:text-6xl">
          {formatMetric(metric, value)}
        </p>
        {hasComparison ? (
          <Delta ratio={delta.ratio} sentiment={delta.sentiment} className="mt-3" />
        ) : (
          <p className="type-caption mt-3 text-text-secondary">
            Pas de comparaison disponible sur la période précédente.
          </p>
        )}
      </div>

      {/* Le bas de la carte porte la lecture en clair plutôt qu'un vide : c'est
          la phrase qu'on recopierait dans un mail au client. */}
      {sentence ? (
        <p className="type-body leading-relaxed text-text-primary">
          {sentence}
          {period ? (
            <span className="type-caption block pt-1 text-text-secondary">
              {period}
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
