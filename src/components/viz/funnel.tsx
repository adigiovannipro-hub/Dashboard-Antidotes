import { formatValue } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * L'entonnoir de conversion, en entonnoir.
 *
 * Trois marches empilées **verticalement**, chacune plus étroite que la
 * précédente : la forme dit la déperdition avant même qu'on lise un chiffre.
 * Des barres horizontales de longueurs décroissantes disaient la même chose,
 * mais il fallait les comparer une à une.
 *
 * La largeur est proportionnelle au volume, plancher à 34 % : une dernière
 * marche à 8 sur 47 donnerait une pointe d'un pixel, illisible et invendable.
 * Le taux de passage porte donc le chiffre exact, la forme ne fait que le
 * suggérer.
 */
export type FunnelStep = { label: string; value: number };

/** Plancher de largeur : en dessous, la marche n'a plus de surface à cliquer. */
const MIN_WIDTH = 34;

export function Funnel({
  steps,
  className,
}: {
  steps: readonly FunnelStep[];
  className?: string;
}) {
  const top = steps[0]?.value ?? 0;

  return (
    <ol className={cn("flex flex-col items-center gap-1", className)}>
      {steps.map((step, index) => {
        const previous = index === 0 ? null : (steps[index - 1]?.value ?? 0);
        // Jamais 0 quand le dénominateur est nul : ce serait lire « personne
        // n'est passé » là où personne n'est entré.
        const rate =
          previous === null || previous === 0 ? null : step.value / previous;

        const width =
          top === 0
            ? MIN_WIDTH
            : Math.max(MIN_WIDTH, (step.value / top) * 100);
        const next = steps[index + 1];
        const nextWidth =
          next === undefined
            ? width
            : top === 0
              ? MIN_WIDTH
              : Math.max(MIN_WIDTH, (next.value / top) * 100);

        // Le trapèze : bords supérieurs à la largeur de cette marche, bords
        // inférieurs à celle de la suivante. C'est ce raccord qui fait la
        // silhouette continue plutôt qu'un escalier de rectangles.
        const inset = (100 - width) / 2;
        const nextInset = (100 - nextWidth) / 2;

        return (
          <li key={step.label} className="w-full">
            <div
              className="relative flex h-16 items-center justify-center"
              style={{
                backgroundColor: "var(--accent-ink)",
                clipPath: `polygon(${inset}% 0, ${100 - inset}% 0, ${100 - nextInset}% 100%, ${nextInset}% 100%)`,
              }}
            >
              {/* Encre verte et non teinte de série : le vert de marque est à
                  2,71:1, et le blanc posé dessus l'est autant. La déperdition
                  se lit à la largeur, pas à la teinte. */}
              <span className="text-center leading-tight text-white">
                <span className="block text-lg font-bold tabular-nums">
                  {formatValue(step.value, "integer")}
                </span>
                <span className="type-caption block opacity-90">
                  {step.label}
                </span>
              </span>
            </div>

            {rate !== null ? (
              <p className="type-caption text-text-secondary py-0.5 text-center tabular-nums">
                {formatValue(rate, "percent")} de passage
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
