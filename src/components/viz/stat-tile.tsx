import { Delta } from "@/components/viz/delta";
import { MetricIcon } from "@/components/viz/metric-icon";
import { formatMetric } from "@/lib/format";
import type { MetricDelta } from "@/lib/metrics/aggregate";
import { METRIC_DEFINITIONS } from "@/lib/metrics/definitions";
import type { MetricId } from "@/lib/metrics/types";
import { cn } from "@/lib/utils";

/**
 * Tuile de statistique : pastille à gauche, et à droite le bloc empilé —
 * libellé **au-dessus** du chiffre, variation dessous — centré verticalement
 * et aligné contre le bord droit.
 *
 * L'empilement remplace la disposition libellé-à-gauche / chiffre-à-droite :
 * sur une rangée de tuiles, l'œil lit désormais chaque carte de haut en bas
 * — quoi, combien, comment ça bouge — et les chiffres restent alignés en
 * colonne d'une carte à l'autre.
 *
 * La variation s'affiche toujours : sans période de comparaison, `Delta`
 * rend « N/A » — un tiret neutre vaut mieux qu'une case qui change de forme.
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

      <div className="flex min-w-0 flex-1 flex-col items-end justify-center gap-1 text-right">
        <p
          className="type-overline text-text-secondary leading-tight"
          title={definition.label}
        >
          {definition.label}
        </p>
        {/* Chiffres proportionnels : `tabular-nums` sur une grande valeur
            isolée donnerait des chasses égales et un rendu lâche. */}
        <p className="text-text-primary text-xl leading-none font-semibold">
          {formatMetric(metric, value)}
        </p>
        {delta ? <Delta ratio={delta.ratio} sentiment={delta.sentiment} /> : null}
      </div>
    </div>
  );
}

/**
 * Chiffre héros : la seule réponse à « est-ce que ça a marché ». Un par vue.
 *
 * Même grammaire que la tuile — libellé au-dessus, chiffre, variation — mais
 * en plus grand, et suivi de la phrase qu'on recopierait dans un mail au
 * client.
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
          {/* Toujours la pastille : sans comparaison, elle dit « N/A » — même
              langage que les tuiles, jamais une phrase d'excuse. */}
          {delta ? <Delta ratio={delta.ratio} sentiment={delta.sentiment} /> : null}
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
