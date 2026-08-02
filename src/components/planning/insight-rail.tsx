"use client";

import { AlertTriangle, Info } from "lucide-react";

import type { CadenceIssue } from "@/lib/planning/cadence";
import type { MonthHealth } from "@/lib/planning/health";
import type { DeducedStrategy } from "@/lib/planning/strategy";
import { FORMAT_LABELS, PLATFORM_LABELS } from "@/lib/planning/types";
import { cn } from "@/lib/utils";

/**
 * Colonne de gauche : où en est le mois, ce qui cloche, et ce que dit
 * l'habitude.
 *
 * Trois questions dans cet ordre précis, parce que c'est celui dans lequel on
 * se les pose : est-ce que le mois est prêt, qu'est-ce qui bloque, et est-ce
 * que ce planning ressemble à ceux d'avant.
 */
export function InsightRail({
  health,
  issues,
  strategy,
}: {
  health: MonthHealth | null;
  issues: CadenceIssue[];
  strategy: DeducedStrategy | null;
}) {
  return (
    <aside
      aria-label="Analyse du mois"
      className="border-border w-64 shrink-0 overflow-y-auto border-r p-3"
    >
      {health ? <HealthSection health={health} /> : null}
      <CadenceSection issues={issues} />
      {strategy ? <StrategySection strategy={strategy} /> : null}
    </aside>
  );
}

function HealthSection({ health }: { health: MonthHealth }) {
  const percent = Math.round(health.completion * 100);

  return (
    <Section title="Avancement">
      <div className="px-2">
        <div className="flex items-baseline justify-between">
          <span className="text-heading font-heading text-2xl">{percent} %</span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {health.published + health.ready} / {health.total}
          </span>
        </div>

        <div
          className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full"
          role="img"
          aria-label={`${percent} % du mois publié ou prêt à partir`}
        >
          <div
            className="bg-brand h-full rounded-full"
            style={{ width: `${percent}%` }}
          />
        </div>

        {health.nextUp ? (
          <p className="text-muted-foreground mt-3 text-xs">
            Prochain :{" "}
            <span className="text-foreground">{health.nextUp.name}</span>
            {health.nextUp.scheduled_on ? (
              <> le {Number(health.nextUp.scheduled_on.slice(8, 10))}</>
            ) : null}
          </p>
        ) : null}
      </div>

      {health.gaps.length > 0 ? (
        <ul className="mt-3 space-y-0.5">
          {health.gaps.map((gap) => (
            <li
              key={gap.code}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs"
            >
              <span
                className={cn(
                  "truncate",
                  gap.severity === "critical"
                    ? "text-brand-red font-medium"
                    : "text-muted-foreground",
                )}
              >
                {gap.message}
              </span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {gap.subjectIds.length}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground px-2 pt-3 text-xs">
          Rien ne manque sur ce mois.
        </p>
      )}
    </Section>
  );
}

function CadenceSection({ issues }: { issues: CadenceIssue[] }) {
  return (
    <Section title="Cadence">
      {issues.length === 0 ? (
        <p className="text-muted-foreground px-2 text-xs">
          Alternance, couverture et rotation : rien à signaler.
        </p>
      ) : (
        <ul className="space-y-1">
          {issues.map((issue, index) => (
            <li
              key={`${issue.code}-${index}`}
              className="flex gap-1.5 rounded-md px-2 py-1 text-xs"
            >
              {issue.severity === "warning" ? (
                <AlertTriangle
                  className="text-brand-red mt-0.5 size-3 shrink-0"
                  aria-label="Avertissement"
                />
              ) : (
                <Info
                  className="text-muted-foreground mt-0.5 size-3 shrink-0"
                  aria-label="Information"
                />
              )}
              <span
                className={
                  issue.severity === "warning"
                    ? "text-foreground"
                    : "text-muted-foreground"
                }
              >
                {issue.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function StrategySection({ strategy }: { strategy: DeducedStrategy }) {
  if (strategy.source === "none") {
    return (
      <Section title="Stratégie">
        <p className="text-muted-foreground px-2 text-xs">
          Pas encore assez d&apos;historique complet pour déduire un rythme.
        </p>
      </Section>
    );
  }

  return (
    <Section
      title="Stratégie"
      hint={
        strategy.source === "declared"
          ? "déclarée"
          : `déduite de ${strategy.monthsObserved.length} mois`
      }
    >
      <ul className="space-y-2 px-2">
        {strategy.platforms.map((platform) => (
          <li key={platform.platform}>
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium">
                {PLATFORM_LABELS[platform.platform]}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {platform.monthlyTarget} / mois
              </span>
            </div>
            <p className="text-muted-foreground text-[11px]">
              {platform.formatMix
                .filter((entry) => entry.perMonth > 0)
                .map(
                  (entry) =>
                    `${formatCount(entry.perMonth)} ${FORMAT_LABELS[entry.format]}`,
                )
                .join(" · ") || "—"}
            </p>
            {platform.sponsoringMedian ? (
              <p className="text-muted-foreground text-[11px]">
                Sponso médiane{" "}
                {new Intl.NumberFormat("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                  maximumFractionDigits: 0,
                }).format(platform.sponsoringMedian)}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Les médianes tombent souvent sur un demi : « 2,5 Reels » est plus honnête
    qu'un arrondi qui laisserait croire à une cible entière. */
function formatCount(value: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <h2 className="text-muted-foreground mb-1.5 flex items-baseline gap-1.5 px-2 text-[11px] font-medium tracking-wide uppercase">
        {title}
        {hint ? <span className="normal-case opacity-70">{hint}</span> : null}
      </h2>
      {children}
    </div>
  );
}
