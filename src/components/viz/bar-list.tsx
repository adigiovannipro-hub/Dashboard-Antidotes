"use client";

import { formatValue } from "@/lib/format";

export interface BarDatum {
  label: string;
  value: number;
  /** Part du total, dans `[0, 1]`. Fournie par l'appelant pour rester exacte. */
  share: number;
  /**
   * Ligne hors de l'échelle ordonnée — « Inconnu », « Autres ». Elle reste
   * dans la liste parce que sa part compte, mais en gris : « Inconnu » n'est
   * pas la tranche d'âge la plus élevée, et le laisser prendre le pas le plus
   * foncé de la rampe le ferait lire comme telle.
   */
  outOfScale?: boolean;
}

/**
 * Liste de barres horizontales.
 *
 * Remplace les donuts du rapport Looker pour les tranches d'âge et les
 * régions : un donut ne se lit pas quand les parts sont proches (22,9 % contre
 * 20,7 % contre 18,8 %), et au-delà de six segments les couleurs se brouillent.
 * Une barre se compare à l'œil, sans effort.
 *
 * Une seule teinte, donc pas de légende : le titre du bloc dit ce qui est
 * mesuré. La valeur est en étiquette directe — pas seulement en infobulle.
 */
export function BarList({
  data,
  color = "var(--series-1)",
  ordinal = false,
}: {
  data: readonly BarDatum[];
  color?: string;
  /**
   * Catégories intrinsèquement ordonnées (tranches d'âge) : la rampe ordinale
   * mono-teinte est alors légitime. Sur des catégories nominales elle serait
   * une faute — elle double-encoderait la longueur de la barre en teinte.
   */
  ordinal?: boolean;
}) {
  const max = Math.max(...data.map((datum) => datum.share), 0.0001);
  // La rampe se répartit sur les seules lignes ordonnées : compter « Inconnu »
  // décalerait toute l'échelle.
  const scaleLength = data.filter((datum) => !datum.outOfScale).length || 1;

  return (
    <ul className="space-y-2">
      {data.map((datum, index) => {
        const fill = datum.outOfScale
          ? "var(--viz-axis)"
          : ordinal
            ? `var(--ordinal-${Math.min(Math.floor((index / scaleLength) * 3) + 1, 3)})`
            : color;

        return (
          <li key={datum.label} className="grid grid-cols-[1fr_auto] gap-x-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-foreground truncate text-xs" title={datum.label}>
                {datum.label}
              </span>
            </div>
            <span className="text-muted-foreground text-xs tabular-nums">
              {formatValue(datum.share, "percent")}
            </span>

            <div
              className="col-span-2 h-1.5 overflow-hidden rounded-full"
              style={{ backgroundColor: "var(--viz-grid)" }}
            >
              {/* Extrémité arrondie 4px, ancrée à la ligne de base à gauche. */}
              <div
                className="h-full rounded-r-[4px]"
                style={{
                  width: `${(datum.share / max) * 100}%`,
                  backgroundColor: fill,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Vue tableau jumelle — l'équivalent accessible du même jeu de données. */
export function BarListTable({
  data,
  categoryLabel,
}: {
  data: readonly BarDatum[];
  categoryLabel: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground text-left">
            <th scope="col" className="pb-2 font-medium">
              {categoryLabel}
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              Part
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              Impressions
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((datum) => (
            <tr key={datum.label} className="border-t border-[var(--viz-grid)]">
              <th scope="row" className="py-1.5 text-left font-normal">
                {datum.label}
              </th>
              <td className="py-1.5 text-right">
                {formatValue(datum.share, "percent")}
              </td>
              <td className="py-1.5 text-right">
                {formatValue(datum.value, "integer")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
