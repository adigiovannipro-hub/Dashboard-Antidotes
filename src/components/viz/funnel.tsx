import { formatValue } from "@/lib/format";

/**
 * L'entonnoir de conversion, trois marches.
 *
 * Ajout au panier, paiement initié, achat. Ce que trois tuiles côte à côte ne
 * disent pas : **où ça fuit**. La largeur des barres est proportionnelle à la
 * première marche, et chaque marche porte son taux de passage depuis la
 * précédente — c'est le chiffre qu'on cherche, pas le volume brut.
 *
 * Une marche à zéro n'est pas masquée : un entonnoir amputé se lirait comme un
 * entonnoir qui converge.
 */
export type FunnelStep = { label: string; value: number };

export function Funnel({ steps }: { steps: readonly FunnelStep[] }) {
  const top = steps[0]?.value ?? 0;

  return (
    <ol className="flex flex-col gap-2">
      {steps.map((step, index) => {
        const previous = index === 0 ? null : steps[index - 1]?.value ?? 0;
        // Taux de passage : jamais 0 quand le dénominateur est nul — ce serait
        // lire « personne n'est passé » là où personne n'est entré.
        const rate =
          previous === null || previous === 0 ? null : step.value / previous;
        const width = top === 0 ? 0 : Math.max((step.value / top) * 100, 2);

        return (
          <li key={step.label} className="min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="type-caption text-text-secondary truncate">
                {step.label}
              </span>
              <span className="type-body text-text-primary font-semibold tabular-nums">
                {formatValue(step.value, "integer")}
              </span>
            </div>

            <div className="bg-surface-sunken mt-1 h-2 w-full overflow-hidden rounded-pill">
              {/* `bg-accent` est repointé sur `--surface-sunken` par le
                  vocabulaire shadcn : la barre y était invisible. On prend la
                  teinte de série, celle des listes de barres d'à côté. */}
              <div
                className="h-full rounded-pill"
                style={{
                  width: `${width}%`,
                  backgroundColor: "var(--series-1)",
                }}
              />
            </div>

            {rate !== null ? (
              <p className="type-caption text-text-secondary mt-0.5 tabular-nums">
                {formatValue(rate, "percent")} depuis {steps[index - 1]?.label}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
