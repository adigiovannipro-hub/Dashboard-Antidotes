"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { NativeSelect } from "@/components/antidotes/controls";
import { CampaignDot } from "@/components/antidotes/pipeline-chips";
import { Button } from "@/components/ui/button";
import {
  PIPELINE_PARAM_KEYS,
  hasActiveFilters,
  withPipelineParams,
  type PipelineFilters as Filters,
} from "@/lib/antidotes/pipeline-params";
import type { PipelineFacets } from "@/lib/antidotes/queries";
import {
  PROSPECT_STATUSES,
  PROSPECT_STATUS_LABELS,
} from "@/lib/antidotes/types";
import { cn } from "@/lib/utils";

/**
 * La barre de filtres du pipeline.
 *
 * Chaque champ écrit dans l'URL, en français (`?secteur=`, `?pays=`,
 * `?pubs=1`, `?score=`, `?reference=`, `?campagne=`, `?statut=`) : une vue
 * se met en signet et survit au rechargement. Les options viennent des
 * valeurs réellement présentes — un secteur qu'aucun prospect ne porte n'a
 * rien à faire dans la liste.
 */

/** Au-delà, la légende des campagnes redevient une liste déroulante. */
const LEGEND_MAX = 8;

export function PipelineFilters({
  filters,
  facets,
  showStatus,
}: {
  filters: Filters;
  facets: PipelineFacets;
  /** Le tableau filtre par statut ; le kanban a ses colonnes pour ça. */
  showStatus: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(changes: Record<string, string | null>) {
    // Le panneau se referme quand la liste change : il pourrait montrer un
    // prospect que le nouveau filtre a fait sortir.
    const query = withPipelineParams(searchParams, {
      ...changes,
      [PIPELINE_PARAM_KEYS.prospect]: null,
    });
    startTransition(() => {
      router.replace(`${pathname}${query}`, { scroll: false });
    });
  }

  const select = (
    key: string,
    label: string,
    value: string | null,
    options: { value: string; label: string }[],
  ) => (
    <NativeSelect
      size="small"
      aria-label={label}
      value={value ?? ""}
      onChange={(event) => update({ [key]: event.target.value || null })}
      className={cn(value ? "text-text-primary" : "text-text-secondary")}
    >
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </NativeSelect>
  );

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 transition-opacity duration-(--motion-duration) ease-standard",
        pending && "opacity-70",
      )}
      aria-busy={pending}
    >
      {select(
        PIPELINE_PARAM_KEYS.sector,
        "Secteur",
        filters.sector,
        facets.sectors.map((sector) => ({ value: sector, label: sector })),
      )}
      {select(
        PIPELINE_PARAM_KEYS.country,
        "Pays",
        filters.country,
        facets.countries.map((country) => ({ value: country, label: country })),
      )}
      {select(
        PIPELINE_PARAM_KEYS.referenceClient,
        "Référence",
        filters.referenceClient,
        facets.referenceClients.map((client) => ({ value: client, label: client })),
      )}
      {/* Jusqu'à huit campagnes, la légende de couleurs tient lieu de filtre :
          un point, un nom, un clic. Au-delà, la barre déborderait — on
          retombe sur la liste. */}
      {facets.campaigns.length > LEGEND_MAX
        ? select(
            PIPELINE_PARAM_KEYS.campaignId,
            "Campagne",
            filters.campaignId,
            facets.campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name })),
          )
        : null}
      {select(
        PIPELINE_PARAM_KEYS.minScore,
        "Score",
        filters.minScore === null ? null : String(filters.minScore),
        [25, 50, 75].map((score) => ({ value: String(score), label: `Score ≥ ${score}` })),
      )}
      {showStatus
        ? select(
            PIPELINE_PARAM_KEYS.status,
            "Statut",
            filters.status,
            PROSPECT_STATUSES.map((status) => ({
              value: status,
              label: PROSPECT_STATUS_LABELS[status],
            })),
          )
        : null}

      <label className="type-caption flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-surface px-2.5 text-text-secondary transition-colors duration-(--motion-duration) ease-standard hover:border-ring has-checked:text-text-primary">
        <input
          type="checkbox"
          checked={filters.adsActive}
          onChange={(event) =>
            update({ [PIPELINE_PARAM_KEYS.adsActive]: event.target.checked ? "1" : null })
          }
          className="size-3.5 accent-[var(--accent-ink)]"
        />
        Pubs actives
      </label>

      {facets.campaigns.length > 0 && facets.campaigns.length <= LEGEND_MAX ? (
        <div role="group" aria-label="Campagnes" className="flex flex-wrap items-center gap-1">
          {facets.campaigns.map((campaign) => {
            const active = filters.campaignId === campaign.id;
            return (
              <button
                key={campaign.id}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  update({ [PIPELINE_PARAM_KEYS.campaignId]: active ? null : campaign.id })
                }
                className={cn(
                  "type-caption focus-visible:ring-ring inline-flex h-8 max-w-48 items-center gap-1.5 rounded-pill border px-2.5 transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
                  active
                    ? "border-border-strong bg-surface-sunken text-text-primary"
                    : "border-input bg-surface text-text-secondary hover:border-ring hover:text-text-primary",
                )}
              >
                <CampaignDot campaignId={campaign.id} />
                <span className="truncate">{campaign.name}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {hasActiveFilters(filters) ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            update(
              Object.fromEntries(
                Object.values(PIPELINE_PARAM_KEYS).map((key) => [key, null]),
              ),
            )
          }
        >
          <X aria-hidden />
          Effacer
        </Button>
      ) : null}
    </div>
  );
}
