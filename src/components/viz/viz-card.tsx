"use client";

import { useId, useState } from "react";
import { Table2, ChartColumn } from "lucide-react";

import { Panel, PanelBody, PanelHeader } from "@/components/ds/surface";
import { Button } from "@/components/ui/button";

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
    <Panel className={className}>
      <PanelHeader
        title={title}
        description={subtitle}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView(view === "chart" ? "table" : "chart")}
            aria-controls={panelId}
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
          </Button>
        }
      />
      <PanelBody id={panelId}>{view === "chart" ? chart : table}</PanelBody>
    </Panel>
  );
}
