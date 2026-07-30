"use client";

import { useId, useState } from "react";
import { Table2, ChartColumn } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Coquille d'un bloc de visualisation, avec sa **vue tableau jumelle**.
 *
 * Ce n'est pas une option : trois teintes de la palette passent sous 3:1 de
 * contraste en mode clair, et une infobulle ne doit jamais être le seul moyen
 * de lire une valeur. Le tableau est l'équivalent accessible, toujours à un
 * clic — et c'est aussi ce qu'on copie-colle dans un mail.
 */
export function VizCard({
  title,
  subtitle,
  chart,
  table,
  className,
}: {
  title: string;
  subtitle?: string;
  chart: React.ReactNode;
  table: React.ReactNode;
  className?: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const panelId = useId();

  return (
    <section className={cn("bg-card rounded-lg p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{title}</h3>
          {subtitle ? (
            <p className="text-muted-foreground mt-0.5 text-xs">{subtitle}</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setView(view === "chart" ? "table" : "chart")}
          aria-controls={panelId}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-brand -m-1 flex shrink-0 items-center gap-1 rounded p-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          {view === "chart" ? (
            <>
              <Table2 className="size-3.5" aria-hidden />
              Tableau
            </>
          ) : (
            <>
              <ChartColumn className="size-3.5" aria-hidden />
              Graphique
            </>
          )}
        </button>
      </div>

      <div id={panelId}>{view === "chart" ? chart : table}</div>
    </section>
  );
}
