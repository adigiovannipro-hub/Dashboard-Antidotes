"use client";

import { INJECTED_CONTEXT_TOKEN_LIMIT } from "@/lib/context/token-estimate";
import { missingEntries, type Completeness } from "@/lib/context/completeness";
import { formatValue } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * La barre de complétude, en tête de page.
 *
 * Elle remplace quatre cartes de mesure qui répondaient à des questions que
 * personne ne se pose en ouvrant un brief — « combien de documents injectés »,
 * « combien d'accroches mémorisées » — et taisaient la seule qui compte : ce
 * qui manque, et où le remplir. Chaque bloc vide est donc un lien vers son
 * ancre, pas une phrase à lire.
 */
export function CompletenessBar({
  completeness,
  tokens,
}: {
  completeness: Completeness;
  tokens: number;
}) {
  const manquants = missingEntries(completeness);
  const overBudget = tokens > INJECTED_CONTEXT_TOKEN_LIMIT;

  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="type-label text-text-primary">
          Brief rempli à{" "}
          <span className="tabular-nums">{completeness.pourcentage} %</span>
        </p>
        <p
          className={cn(
            "type-caption tabular-nums",
            overBudget ? "text-warning-ink" : "text-text-secondary",
          )}
        >
          {formatValue(tokens, "integer")} /{" "}
          {formatValue(INJECTED_CONTEXT_TOKEN_LIMIT, "integer")} tokens
        </p>
      </div>

      {/* Le remplissage est à l'encre d'accent : le vert de marque tombe à
          2,71:1, et une barre de progression se lit, elle ne se devine pas. */}
      <div
        role="progressbar"
        aria-valuenow={completeness.pourcentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Complétude du brief"
        className="mt-3 h-1.5 w-full overflow-hidden rounded-pill bg-canvas"
      >
        <div
          className="h-full rounded-pill bg-accent-ink transition-[width] duration-(--motion-duration) ease-standard"
          style={{ width: `${completeness.pourcentage}%` }}
        />
      </div>

      {manquants.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="type-caption text-text-secondary">À remplir :</span>
          {manquants.map((entry) => (
            <a
              key={entry.ancre}
              href={`#${entry.ancre}`}
              className="focus-visible:ring-ring rounded-md px-1 type-caption text-accent-ink underline underline-offset-2 hover:text-text-primary focus-visible:ring-2 focus-visible:outline-none"
            >
              {entry.label}
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}
