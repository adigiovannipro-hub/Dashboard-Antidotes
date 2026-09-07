import { Funnel } from "@/components/viz/funnel";
import { buildFunnel, rejectedTotal, rejectionBreakdown } from "@/lib/antidotes/sourcing/funnel";
import type { RunStats } from "@/lib/antidotes/types";

/**
 * Le taux de survie d'un passage — sourcés, qualifiés, décideur trouvé, email
 * valide — dans la même bande que l'entonnoir du Reporting : une marche par
 * bloc, le taux de passage entre deux marches. Les rejets, comptés par raison,
 * disent où la perte se produit.
 */
export function RunFunnel({ stats, compact }: { stats: Partial<RunStats> | null; compact?: boolean }) {
  const steps = buildFunnel(stats);
  const rejected = rejectedTotal(stats);
  const reasons = rejectionBreakdown(stats);

  if (compact) {
    return (
      <p className="type-caption flex flex-wrap items-center gap-x-1.5 text-text-secondary tabular-nums">
        {steps.map((step, index) => (
          <span key={step.key} className="inline-flex items-center gap-1.5">
            {index > 0 ? <span aria-hidden>→</span> : null}
            <span>
              <span className="font-medium text-text-primary">{step.value}</span> {step.label.toLowerCase()}
            </span>
          </span>
        ))}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <Funnel steps={steps.map((step) => ({ label: step.label, value: step.value }))} />
      {rejected > 0 ? (
        <p className="type-caption text-text-secondary">
          {rejected} rejeté{rejected > 1 ? "s" : ""} —{" "}
          {reasons.map((entry) => `${entry.reason} ${entry.count}`).join(", ")}
        </p>
      ) : null}
    </div>
  );
}
