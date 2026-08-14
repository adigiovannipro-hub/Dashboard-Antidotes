import { Delta } from "@/components/viz/delta";
import { MetricIcon } from "@/components/viz/metric-icon";
import { formatMetric } from "@/lib/format";
import type { MetricDelta } from "@/lib/metrics/aggregate";
import { METRIC_DEFINITIONS } from "@/lib/metrics/definitions";
import type { MetricId } from "@/lib/metrics/types";
import { cn } from "@/lib/utils";

/**
 * Tuile de statistique : pastille à gauche, libellé, valeur et variation à
 * droite.
 *
 * L'icône était refusée tant qu'elle se posait **au-dessus** du chiffre : dix
 * pictogrammes empilés au-dessus de dix nombres font un mur de symboles. En
 * colonne de gauche, elle ne concurrence plus rien — elle donne à l'œil un
 * repère pour retrouver « le budget » sans relire les dix libellés.
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
        "border-border bg-surface shadow-card flex items-center gap-3 rounded-lg border p-4",
        className,
      )}
    >
      <MetricIcon metric={metric} />

      <div className="min-w-0 flex-1">
        <p
          className="type-overline text-text-secondary truncate"
          title={definition.label}
        >
          {definition.label}
        </p>
        {/* Chiffres proportionnels : `tabular-nums` sur une grande valeur isolée
            donnerait des chasses égales et un rendu lâche. */}
        <p className="text-text-primary mt-1 truncate text-xl leading-none font-semibold">
          {formatMetric(metric, value)}
        </p>
        {delta ? (
          <Delta
            ratio={delta.ratio}
            sentiment={delta.sentiment}
            className="mt-1.5"
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Chiffre héros : la seule réponse à « est-ce que ça a marché ». Un par vue.
 *
 * Il tenait une colonne entière et deux rangées de haut. Le chiffre restait le
 * plus gros de l'écran sans avoir besoin de tout cet air autour : la carte est
 * désormais **couchée** — pastille, chiffre, variation, puis la phrase — et
 * rend deux tuiles de place au reste de la bande.
 */
export function HeroFigure({
  metric,
  value,
  delta,
  sentence,
  period,
  className,
}: {
  metric: MetricId;
  value: number | null;
  delta?: MetricDelta;
  /** La phrase que le client lira en premier. Elle doit tenir seule. */
  sentence?: string;
  period?: string;
  className?: string;
}) {
  const definition = METRIC_DEFINITIONS[metric];
  const hasComparison = delta && delta.ratio !== null;

  return (
    <div
      className={cn(
        "border-border bg-surface shadow-card flex items-center gap-4 rounded-lg border p-4",
        className,
      )}
    >
      <MetricIcon metric={metric} className="size-12" />

      <div className="min-w-0 flex-1">
        <p className="type-overline text-text-secondary">{definition.label}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-text-primary text-3xl leading-none font-bold">
            {formatMetric(metric, value)}
          </p>
          {hasComparison ? (
            <Delta ratio={delta.ratio} sentiment={delta.sentiment} />
          ) : (
            <span className="type-caption text-text-secondary">
              Pas de comparaison sur la période précédente
            </span>
          )}
        </div>

        {/* La lecture en clair plutôt qu'un vide : c'est la phrase qu'on
            recopierait dans un mail au client. */}
        {sentence ? (
          <p className="type-caption text-text-secondary mt-1.5 leading-relaxed">
            {sentence}
            {period ? ` — ${period}` : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}
