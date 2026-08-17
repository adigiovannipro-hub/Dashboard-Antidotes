import { ArrowDown } from "lucide-react";

import { formatValue } from "@/lib/format";
import { cn } from "@/lib/utils";

export type FunnelStep = {
  label: string;
  value: number;
};

/**
 * L'entonnoir de conversion, dans la grammaire du reste de l'écran.
 *
 * Les trapèzes pleins juraient avec la charte : un aplat sombre par marche,
 * du texte posé sur la couleur, une forme qui ne ressemblait à rien d'autre
 * dans l'application. Ici chaque marche parle **le langage des BarList du
 * Persona** — libellé et chiffre en encre de texte, barre `--accent` sur
 * piste creuse, longueur proportionnelle à la première marche — et le taux
 * de passage vit **entre** les marches, là où il se produit, en flèche
 * discrète plutôt qu'en légende.
 *
 * La barre garde un minimum visible : 8 achats sur 465 paniers font 1,7 %,
 * et une barre d'un pixel se lirait comme un bug, pas comme un chiffre.
 */
export function Funnel({
  steps,
  className,
}: {
  steps: readonly FunnelStep[];
  className?: string;
}) {
  const first = steps[0]?.value ?? 0;

  return (
    <div className={cn("flex flex-col", className)}>
      {steps.map((step, index) => {
        const share = first > 0 ? step.value / first : 0;
        const width = step.value > 0 ? Math.max(share * 100, 4) : 0;
        const previous = steps[index - 1];
        const passage =
          previous && previous.value > 0 ? step.value / previous.value : null;

        return (
          <div key={step.label}>
            {/* Le taux de passage entre deux marches — c'est lui, l'entonnoir. */}
            {index > 0 ? (
              <p className="type-caption text-text-secondary my-2.5 flex items-center gap-1">
                <ArrowDown
                  className="text-text-tertiary size-3.5 shrink-0"
                  strokeWidth={1.75}
                  aria-hidden
                />
                {passage === null
                  ? "—"
                  : `${formatValue(passage * 100, "decimal")} % de passage`}
              </p>
            ) : null}

            <div className="flex items-baseline justify-between gap-2">
              <p className="type-caption text-text-secondary truncate" title={step.label}>
                {step.label}
              </p>
              <p className="text-text-primary text-sm font-semibold tabular-nums">
                {formatValue(step.value, "integer")}
              </p>
            </div>
            <div
              className="bg-surface-sunken mt-1 h-2 overflow-hidden rounded-pill"
              role="img"
              aria-label={`${step.label} : ${formatValue(step.value, "integer")}`}
            >
              <div
                className="h-full rounded-pill"
                style={{ width: `${width}%`, backgroundColor: "var(--accent)" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
