"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, RefreshCw, SlidersHorizontal, Table2 } from "lucide-react";
import { toast } from "sonner";

import { collectRadarNow } from "@/app/actions/antidotes-inbound";
import { InboundAccountsDialog } from "@/components/antidotes/inbound-accounts-dialog";
import { InboundCalendar } from "@/components/antidotes/inbound-calendar";
import { InboundContentTable } from "@/components/antidotes/inbound-content-table";
import { ActiveFilterChips, InboundFiltersPanel } from "@/components/antidotes/inbound-filters";
import { InboundMineMenu } from "@/components/antidotes/inbound-mine-menu";
import { InboundPromptsDialog } from "@/components/antidotes/inbound-prompts-dialog";
import { InboundSheet } from "@/components/antidotes/inbound-sheet";
import { useInboundUrl } from "@/components/antidotes/inbound-url";
import { PendingLabel } from "@/components/ds/pending-label";
import { SectionHeader } from "@/components/ds/surface";
import { Button } from "@/components/ui/button";
import { monthKeyOf, parseMonthKey } from "@/lib/antidotes/inbound/calendar";
import { activeFilterCount, parseContentFilters } from "@/lib/antidotes/inbound/filters";
import type { InboundData } from "@/lib/antidotes/inbound/queries";
import { parseInboundView } from "@/lib/antidotes/inbound/views";
import type { PostPlatform } from "@/lib/antidotes/types";
import { cn } from "@/lib/utils";

/**
 * L'inbound : un tableau, un calendrier, un panneau. Rien d'autre.
 *
 * Il y avait six vues. Cinq étaient des réglages ou des listes qu'on
 * consultait une fois par semaine ; elles sont passées dans des fenêtres
 * (Comptes, Prompts) ou ont disparu (les sujets proposés). Ce qui reste est
 * le geste : regarder ce qui a marché, en tirer quelque chose.
 *
 * **Tout l'état d'affichage se lit dans l'URL et s'y écrit sans repasser par
 * le serveur** (`useInboundUrl`) : filtrer, trier, ouvrir une ligne ne coûte
 * plus un aller-retour. L'écran se partage toujours par copie du lien.
 */
export function InboundScreen({ data }: { data: InboundData }) {
  const router = useRouter();
  const { params, go } = useInboundUrl();
  const [showFilters, setShowFilters] = useState(false);
  const [collecting, startCollect] = useTransition();

  const view = parseInboundView(params.get("vue"));
  const filters = useMemo(
    () =>
      parseContentFilters({
        reseau: params.get("reseau") ?? undefined,
        jours: params.get("jours") ?? undefined,
        vues: params.get("vues") ?? undefined,
        likes: params.get("likes") ?? undefined,
        commentaires: params.get("commentaires") ?? undefined,
        partages: params.get("partages") ?? undefined,
        enregistrements: params.get("enregistrements") ?? undefined,
        tri: params.get("tri") ?? undefined,
        sens: params.get("sens") ?? undefined,
        source: params.get("source") ?? undefined,
      }),
    [params],
  );
  const month = parseMonthKey(params.get("mois") ?? undefined, new Date(data.now));

  const openId = params.get("post");
  const openDraftId = params.get("brouillon");
  const content = useMemo(
    () => (openId ? (data.contents.find((entry) => entry.post.id === openId) ?? null) : null),
    [openId, data.contents],
  );
  const sheetDrafts = useMemo(
    () => (openId ? data.drafts.filter((draft) => draft.source_post_id === openId) : []),
    [openId, data.drafts],
  );
  const loneDraft = useMemo(
    () => (!openId && openDraftId ? (data.drafts.find((draft) => draft.id === openDraftId) ?? null) : null),
    [openId, openDraftId, data.drafts],
  );

  /** Les réseaux proposés au filtre sont ceux qui ont réellement quelque chose. */
  const platforms = useMemo(() => {
    const set = new Set<PostPlatform>(data.accounts.map((account) => account.platform));
    for (const entry of data.contents) set.add(entry.post.platform);
    return [...set];
  }, [data.accounts, data.contents]);

  const filterCount = activeFilterCount(filters);

  const collect = () =>
    startCollect(async () => {
      const result = await collectRadarNow();
      if (result.ok) {
        toast.success(result.message ?? "Relevé lancé.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Inbound"
        action={
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <div className="inline-flex items-center gap-1 rounded-pill bg-surface-sunken p-1">
              <ViewButton
                current={view === "tableau"}
                label="Tableau"
                icon={<Table2 className="size-4" strokeWidth={1.75} aria-hidden />}
                onClick={() => go({ vue: null, mois: null })}
              />
              <ViewButton
                current={view === "calendrier"}
                label="Calendrier"
                icon={<CalendarDays className="size-4" strokeWidth={1.75} aria-hidden />}
                onClick={() => go({ vue: "calendrier", mois: monthKeyOf(new Date(data.now)) })}
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-expanded={showFilters}
              onClick={() => setShowFilters((open) => !open)}
            >
              <SlidersHorizontal aria-hidden />
              Filtres
              {filterCount > 0 ? (
                <span className="type-caption ml-1 rounded-pill bg-accent-subtle px-1.5 font-medium text-accent-ink tabular-nums">
                  {filterCount}
                </span>
              ) : null}
            </Button>

            <InboundAccountsDialog
              accounts={data.accounts}
              availability={data.availability}
              settings={data.settings}
            />
            <InboundPromptsDialog settings={data.settings} />

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={collecting || data.accounts.length === 0}
              onClick={collect}
            >
              <RefreshCw aria-hidden />
              <PendingLabel pending={collecting} busy="Lancement…">
                Relever
              </PendingLabel>
            </Button>

            <InboundMineMenu embeddings={data.studio.embeddings} />
          </div>
        }
      />

      {showFilters ? (
        <InboundFiltersPanel filters={filters} platforms={platforms} onClose={() => setShowFilters(false)} />
      ) : (
        <ActiveFilterChips filters={filters} />
      )}

      {view === "tableau" ? (
        <InboundContentTable contents={data.contents} filters={filters} now={data.now} />
      ) : (
        <InboundCalendar month={month} contents={data.contents} drafts={data.drafts} now={data.now} />
      )}

      <InboundSheet
        content={content}
        drafts={sheetDrafts}
        loneDraft={loneDraft}
        visuals={data.visuals}
        studio={data.studio}
        onClose={() => go({ post: null, brouillon: null })}
      />
    </div>
  );
}

function ViewButton({
  current,
  label,
  icon,
  onClick,
}: {
  current: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={current}
      className={cn(
        "type-caption focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 font-medium whitespace-nowrap transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
        current ? "bg-primary text-primary-foreground" : "text-text-secondary hover:text-text-primary",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
