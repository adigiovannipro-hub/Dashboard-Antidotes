import { Delta } from "@/components/viz/delta";
import { MetricIcon } from "@/components/viz/metric-icon";
import { formatMetric } from "@/lib/format";
import type { MetricDelta } from "@/lib/metrics/aggregate";
import { METRIC_DEFINITIONS } from "@/lib/metrics/definitions";
import type { MetricId } from "@/lib/metrics/types";
import { cn } from "@/lib/utils";

/**
 * Tuile de statistique : le texte à gauche, la pastille à droite.
 *
 * L'ordre est celui de la lecture — on lit **ce que c'est**, puis le chiffre,
 * puis la variation ; l'icône ferme la carte et sert de repère pour la
 * retrouver dans la rangée sans relire les libellés. Elle était à gauche et
 * repoussait le texte : les trois lignes se lisent mieux calées sur la même
 * marge que le titre du panneau au-dessus.
 *
 * Les tuiles respirent (`p-5`, interlignes desserrés) : compactées, dix
 * cartes se lisaient comme un tableau de bord de voiture — beaucoup de
 * chiffres, aucune hiérarchie.
 *
 * La variation s'affiche toujours : sans période de comparaison, `Delta`
 * rend « N/A » — un tiret neutre vaut mieux qu'une case qui change de forme.
 */
export function StatTile({
  metric,
  value,
  delta,
  label,
  className,
}: {
  metric: MetricId;
  value: number | null;
  delta?: MetricDelta;
  /** Le mot de l'onglet ouvert, quand il diffère du catalogue — « Vues » sur
      l'organique là où le payant dit « Impressions ». */
  label?: string;
  className?: string;
}) {
  const definition = METRIC_DEFINITIONS[metric];
  const titre = label ?? definition.label;

  return (
    <div
      className={cn(
        "border-border bg-surface shadow-card flex items-center gap-3 rounded-lg border p-5",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="type-overline text-text-secondary leading-tight" title={titre}>
          {titre}
        </p>
        {/* Chiffres proportionnels : `tabular-nums` sur une grande valeur
            isolée donnerait des chasses égales et un rendu lâche. */}
        <p className="text-text-primary mt-2 text-2xl leading-none font-semibold">
          {formatMetric(metric, value)}
        </p>
        {delta ? (
          <Delta
            ratio={delta.ratio}
            sentiment={delta.sentiment}
            className="mt-2.5"
          />
        ) : null}
      </div>

      <MetricIcon metric={metric} />
    </div>
  );
}

/**
 * Chiffre héros : la seule réponse à « est-ce que ça a marché ». Un par vue.
 *
 * Même grammaire que la tuile — texte à gauche, pastille à droite — mais en
 * plus grand, et suivi de la phrase qu'on recopierait dans un mail au client.
 */
export function HeroFigure({
  metric,
  value,
  delta,
  sentence,
  period,
  label,
  className,
}: {
  metric: MetricId;
  value: number | null;
  delta?: MetricDelta;
  /** La phrase que le client lira en premier. Elle doit tenir seule. */
  sentence?: string;
  period?: string;
  /** Voir `StatTile` — le vocabulaire de l'onglet prime sur le catalogue. */
  label?: string;
  className?: string;
}) {
  const definition = METRIC_DEFINITIONS[metric];

  return (
    <div
      className={cn(
        "border-border bg-surface shadow-card flex items-center gap-4 rounded-lg border p-5",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="type-overline text-text-secondary">
          {label ?? definition.label}
        </p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          <p className="text-text-primary text-4xl leading-none font-bold">
            {formatMetric(metric, value)}
          </p>
          {/* Toujours la pastille : sans comparaison, elle dit « N/A » — même
              langage que les tuiles, jamais une phrase d'excuse. */}
          {delta ? <Delta ratio={delta.ratio} sentiment={delta.sentiment} /> : null}
        </div>

        {/* La lecture en clair plutôt qu'un vide : c'est la phrase qu'on
            recopierait dans un mail au client. */}
        {sentence ? (
          <p className="type-caption text-text-secondary mt-2.5 leading-relaxed">
            {sentence}
            {period ? ` — ${period}` : ""}
          </p>
        ) : null}
      </div>

      <MetricIcon metric={metric} className="size-12" />
    </div>
  );
}
