"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Target } from "lucide-react";

import { PipelineBoard } from "@/components/antidotes/pipeline-board";
import { PipelineFilters } from "@/components/antidotes/pipeline-filters";
import { PipelineTable } from "@/components/antidotes/pipeline-table";
import { ProspectSheet } from "@/components/antidotes/prospect-sheet";
import { ViewToggle } from "@/components/antidotes/view-toggle";
import { EmptyState } from "@/components/ds/empty-state";
import {
  PIPELINE_PARAM_KEYS,
  hasActiveFilters,
  withPipelineParams,
  type PipelineFilters as Filters,
} from "@/lib/antidotes/pipeline-params";
import type { PipelineFacets, ProspectDetail } from "@/lib/antidotes/queries";
import type { PipelineProspect } from "@/lib/antidotes/types";
import type { PipelineView } from "@/lib/ui-preferences";

/**
 * L'écran du pipeline : la barre de filtres, la vue choisie, le panneau.
 *
 * Le prospect ouvert vit dans l'URL (`?prospect=`) : un lien se partage, le
 * rechargement rouvre le panneau, et c'est le serveur qui charge le détail.
 * Le clic, lui, n'attend pas : le panneau s'ouvre sur les données de la
 * carte, et le détail le rejoint quand la route a répondu.
 */
export function PipelineScreen({
  prospects,
  total,
  facets,
  filters,
  view,
  detail,
  selectedId,
}: {
  /** Les prospects après filtres. */
  prospects: PipelineProspect[];
  /** Le pipeline entier, pour distinguer « vide » de « rien ne correspond ». */
  total: number;
  facets: PipelineFacets;
  filters: Filters;
  view: PipelineView;
  detail: ProspectDetail | null;
  /** Le `?prospect=` de l'URL, tel que le serveur l'a lu. */
  selectedId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Le choix local part au clic ; la vérité de l'URL le rattrape — une
  // navigation arrière, un lien ouvert ailleurs, le dialogue de création.
  const [openId, setOpenId] = useState<string | null>(selectedId);
  const [seen, setSeen] = useState(selectedId);
  if (seen !== selectedId) {
    setSeen(selectedId);
    setOpenId(selectedId);
  }

  function navigate(prospectId: string | null) {
    setOpenId(prospectId);
    const query = withPipelineParams(searchParams, {
      [PIPELINE_PARAM_KEYS.prospect]: prospectId,
    });
    startTransition(() => {
      router.replace(`${pathname}${query}`, { scroll: false });
    });
  }

  const fallback = openId ? (prospects.find((row) => row.id === openId) ?? null) : null;
  const loadedDetail = detail && detail.prospect.id === openId ? detail : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PipelineFilters filters={filters} facets={facets} showStatus={view === "tableau"} />
        <ViewToggle view={view} />
      </div>

      {prospects.length === 0 ? (
        <EmptyState
          icon={Target}
          message={
            total === 0
              ? "Le pipeline est vide : ajouter un premier prospect, ou attendre le sourcing."
              : "Aucun prospect ne correspond à ces filtres."
          }
          action={
            hasActiveFilters(filters)
              ? { label: "Effacer les filtres", href: pathname }
              : undefined
          }
        />
      ) : view === "tableau" ? (
        <PipelineTable prospects={prospects} onOpen={navigate} />
      ) : (
        <PipelineBoard prospects={prospects} onOpen={navigate} />
      )}

      <ProspectSheet
        open={openId !== null}
        fallback={fallback}
        detail={loadedDetail}
        loading={pending && loadedDetail === null}
        onClose={() => navigate(null)}
      />
    </div>
  );
}
