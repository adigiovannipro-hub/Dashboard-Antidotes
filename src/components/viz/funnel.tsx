import { Fragment } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { formatValue } from "@/lib/format";
import { cn } from "@/lib/utils";

export type FunnelStep = {
  label: string;
  value: number;
};

/** La rampe ordinale de la charte : l'entonnoir se resserre, la teinte fonce. */
const RAMP = ["var(--ordinal-1)", "var(--ordinal-2)", "var(--ordinal-3)"];

/**
 * L'entonnoir de conversion — une bande horizontale, lue de gauche à droite
 * comme le parcours qu'elle décrit.
 *
 * Trois formes ont été essayées avant celle-ci : des trapèzes pleins (une
 * forme étrangère à toute l'application, du texte posé sur un aplat), des
 * barres horizontales empilées, puis une colonne verticale coincée à droite
 * des tuiles — chaque fois, un objet graphique isolé au milieu d'un écran
 * fait de cartes et de listes de barres.
 *
 * Ici, l'entonnoir emprunte le vocabulaire de l'écran : chaque marche est un
 * bloc à trois lignes — libellé, chiffre, barre proportionnelle — et le taux
 * de passage vit **entre** deux marches, là où la perte se produit. Le
 * rétrécissement se lit dans la longueur des barres et dans la rampe
 * ordinale ; les chiffres, eux, restent en encre de texte, jamais posés sur
 * la couleur.
 *
 * Une barre garde un minimum visible : 15 achats sur 465 paniers font 3,2 %,
 * et un trait d'un pixel se lirait comme un bug plutôt que comme un chiffre.
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
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-0",
        className,
      )}
    >
      {steps.map((step, index) => {
        const share = first > 0 ? step.value / first : 0;
        const width = step.value > 0 ? Math.max(share * 100, 5) : 0;
        const previous = steps[index - 1];
        const passage =
          previous && previous.value > 0 ? step.value / previous.value : null;

        return (
          <Fragment key={step.label}>
            {index > 0 ? (
              <Passage ratio={passage} />
            ) : null}

            <div className="min-w-0 flex-1 sm:px-4 sm:first:pl-0 sm:last:pr-0">
              <p className="type-overline text-text-secondary truncate" title={step.label}>
                {step.label}
              </p>
              <p className="text-text-primary mt-2 text-2xl leading-none font-semibold">
                {formatValue(step.value, "integer")}
              </p>
              <div
                className="bg-surface-sunken mt-3 h-2 overflow-hidden rounded-pill"
                role="img"
                aria-label={`${step.label} : ${formatValue(step.value, "integer")}, soit ${formatValue(share, "percent")} de la première marche`}
              >
                <div
                  className="h-full rounded-pill transition-[width] duration-(--motion-duration) ease-standard"
                  style={{
                    width: `${width}%`,
                    backgroundColor: RAMP[Math.min(index, RAMP.length - 1)],
                  }}
                />
              </div>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

/**
 * Le taux de passage d'une marche à la suivante.
 *
 * Sur une rangée, le chevron pointe à droite ; empilé, il pointe en bas.
 * L'information est la même, la direction suit la lecture.
 */
function Passage({ ratio }: { ratio: number | null }) {
  const label = ratio === null ? "—" : formatValue(ratio, "percent");

  return (
    <div className="flex shrink-0 items-center justify-center sm:px-1">
      {/* Une pastille, comme les variations des tuiles : posée nue entre deux
          blocs, la mention se lisait comme une note de bas de page alors
          qu'elle est le sujet même de l'entonnoir. */}
      <span className="bg-surface-sunken text-text-secondary type-caption inline-flex items-center gap-1 rounded-pill px-2 py-1 font-medium tabular-nums whitespace-nowrap">
        <ChevronDown className="size-3.5 shrink-0 sm:hidden" strokeWidth={2} aria-hidden />
        <ChevronRight
          className="hidden size-3.5 shrink-0 sm:block"
          strokeWidth={2}
          aria-hidden
        />
        {label}
      </span>
    </div>
  );
}
