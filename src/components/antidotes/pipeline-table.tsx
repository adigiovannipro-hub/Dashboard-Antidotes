"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { toast } from "sonner";

import { moveProspects } from "@/app/actions/antidotes";
import { NativeSelect } from "@/components/antidotes/controls";
import { EnrollDialog } from "@/components/antidotes/enroll-dialog";
import { CampaignChip, ScoreFlag } from "@/components/antidotes/pipeline-chips";
import { PendingLabel } from "@/components/ds/pending-label";
import { StatusPill } from "@/components/ds/status-pill";
import { Button } from "@/components/ui/button";
import { PROSPECT_STATUS_TONES } from "@/lib/antidotes/colors";
import { relativeDays } from "@/lib/antidotes/dates";
import type { SequenceOption } from "@/lib/antidotes/sequences/queries";
import {
  PROSPECT_STATUSES,
  PROSPECT_STATUS_LABELS,
  contactDisplayName,
  type PipelineProspect,
  type ProspectStatus,
} from "@/lib/antidotes/types";
import { cn } from "@/lib/utils";

/**
 * La vue en tableau — celle du tri de masse : deux cents prospects
 * fraîchement sourcés, à trier colonne par colonne puis à faire avancer
 * d'un coup.
 *
 * Le tri est local : la liste entière est déjà là, un aller-retour serveur
 * pour réordonner ce qu'on a sous les yeux serait une attente pour rien.
 * La sélection l'est aussi, et survit aux tris ; elle s'efface une fois
 * l'action de masse partie.
 */

type SortKey =
  | "company"
  | "campaign"
  | "city"
  | "sector"
  | "country"
  | "status"
  | "score"
  | "contact";

const GRID =
  "grid grid-cols-[28px_minmax(180px,1.6fr)_minmax(140px,1.1fr)_minmax(110px,1fr)_minmax(120px,1fr)_56px_minmax(120px,1fr)_80px_minmax(110px,1fr)_minmax(150px,1.2fr)] items-center gap-x-2";

/** L'origine d'un prospect, telle que la colonne Campagne la trie. */
function originOf(row: PipelineProspect): string {
  return row.campaign_name ?? (row.reference_client ? `Miroir de ${row.reference_client}` : "");
}

const collator = new Intl.Collator("fr");

export function PipelineTable({
  prospects,
  onOpen,
  sequences,
}: {
  prospects: PipelineProspect[];
  onOpen: (prospectId: string) => void;
  sequences: SequenceOption[];
}) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkStatus, setBulkStatus] = useState<ProspectStatus>("qualified");
  const [pending, startTransition] = useTransition();

  const rows = useMemo(() => {
    if (!sort) return prospects;
    const factor = sort.desc ? -1 : 1;
    const text = (value: string | null) => value ?? "";
    return [...prospects].sort((a, b) => {
      switch (sort.key) {
        case "company":
          return collator.compare(a.company_name, b.company_name) * factor;
        case "campaign":
          return collator.compare(originOf(a), originOf(b)) * factor;
        case "city":
          return collator.compare(text(a.city), text(b.city)) * factor;
        case "sector":
          return collator.compare(text(a.sector), text(b.sector)) * factor;
        case "country":
          return collator.compare(text(a.country), text(b.country)) * factor;
        case "status":
          return (
            (PROSPECT_STATUSES.indexOf(a.status) - PROSPECT_STATUSES.indexOf(b.status)) *
            factor
          );
        case "score":
          return (a.score - b.score) * factor;
        case "contact":
          return collator.compare(text(a.last_contact_at), text(b.last_contact_at)) * factor;
      }
    });
  }, [prospects, sort]);

  // La sélection ne compte que ce qui est encore affiché : un prospect sorti
  // de la liste par un filtre ne doit pas partir dans l'action de masse.
  const visibleSelected = rows.filter((row) => selected.has(row.id));
  const allSelected = rows.length > 0 && visibleSelected.length === rows.length;

  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      if (allSelected) for (const row of rows) next.delete(row.id);
      else for (const row of rows) next.add(row.id);
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyBulk() {
    const ids = visibleSelected.map((row) => row.id);
    if (ids.length === 0) return;
    startTransition(async () => {
      const result = await moveProspects({ prospectIds: ids, status: bulkStatus });
      if (result.ok) {
        toast.success(
          `${ids.length} prospect${ids.length > 1 ? "s" : ""} → ${PROSPECT_STATUS_LABELS[bulkStatus]}.`,
        );
        setSelected(new Set());
      } else {
        toast.error(result.error);
      }
    });
  }

  const header = (key: SortKey, label: string, align: "left" | "right" = "left") => (
    <button
      type="button"
      onClick={() =>
        setSort((current) =>
          current?.key === key ? { key, desc: !current.desc } : { key, desc: key === "score" },
        )
      }
      aria-sort={sort?.key === key ? (sort.desc ? "descending" : "ascending") : undefined}
      className={cn(
        "type-overline focus-visible:ring-ring flex items-center gap-0.5 rounded px-1.5 py-1 text-left uppercase transition-colors duration-(--motion-duration) ease-standard hover:text-text-primary focus-visible:ring-2 focus-visible:outline-none",
        align === "right" && "justify-end text-right",
        sort?.key === key ? "text-text-primary" : "text-text-secondary",
      )}
    >
      {label}
      {sort?.key === key ? (
        sort.desc ? (
          <ArrowDown className="size-3" aria-hidden />
        ) : (
          <ArrowUp className="size-3" aria-hidden />
        )
      ) : null}
    </button>
  );

  return (
    <div className="space-y-3">
      {visibleSelected.length > 0 ? (
        <div
          role="region"
          aria-label="Action sur la sélection"
          className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 shadow-card"
        >
          <span className="type-label text-text-primary tabular-nums">
            {visibleSelected.length} sélectionné{visibleSelected.length > 1 ? "s" : ""}
          </span>
          <NativeSelect
            size="small"
            aria-label="Nouveau statut"
            value={bulkStatus}
            onChange={(event) => setBulkStatus(event.target.value as ProspectStatus)}
          >
            {PROSPECT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {PROSPECT_STATUS_LABELS[status]}
              </option>
            ))}
          </NativeSelect>
          <Button type="button" size="sm" onClick={applyBulk} disabled={pending}>
            <PendingLabel pending={pending} busy="Déplacement…">
              Déplacer
            </PendingLabel>
          </Button>
          <EnrollDialog
            prospectIds={visibleSelected.map((row) => row.id)}
            sequences={sequences}
            onDone={() => setSelected(new Set())}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setSelected(new Set())}
            className="ml-auto"
          >
            <X aria-hidden />
            Tout désélectionner
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-card">
        <div className="min-w-[1200px]">
          <div className={cn(GRID, "border-b border-border-strong bg-surface-sunken px-2 py-1")}>
            <span className="flex justify-center">
              <input
                type="checkbox"
                aria-label="Tout sélectionner"
                checked={allSelected}
                onChange={toggleAll}
                className="size-4 accent-[var(--accent-ink)]"
              />
            </span>
            {header("company", "Société")}
            {header("campaign", "Campagne")}
            {header("city", "Ville")}
            {header("sector", "Secteur")}
            {header("country", "Pays")}
            {header("status", "Statut")}
            {header("score", "Score", "right")}
            {header("contact", "Dernier contact")}
            <span className="type-overline px-1.5 text-text-secondary">Contact</span>
          </div>

          {rows.map((row) => {
            const primary = row.contacts.find((contact) => contact.is_primary) ?? row.contacts[0];
            const checked = selected.has(row.id);
            return (
              <div
                key={row.id}
                className={cn(
                  GRID,
                  "border-b border-border px-2 py-1.5 transition-colors duration-(--motion-duration) ease-standard last:border-b-0 hover:bg-surface-sunken",
                  checked && "bg-accent-subtle/30",
                )}
              >
                <span className="flex justify-center">
                  <input
                    type="checkbox"
                    aria-label={`Sélectionner ${row.company_name}`}
                    checked={checked}
                    onChange={() => toggleOne(row.id)}
                    className="size-4 accent-[var(--accent-ink)]"
                  />
                </span>
                <button
                  type="button"
                  onClick={() => onOpen(row.id)}
                  className="focus-visible:ring-ring flex min-w-0 items-center gap-2 rounded px-1.5 py-0.5 text-left outline-none focus-visible:ring-2"
                >
                  <span className="type-label truncate text-text-primary">
                    {row.company_name}
                  </span>
                  {row.ads_active ? <StatusPill tone="positive">Pubs</StatusPill> : null}
                </button>
                <span className="flex min-w-0 px-1.5">
                  {originOf(row) ? (
                    <CampaignChip
                      campaignId={row.campaign_id}
                      campaignName={row.campaign_name}
                      referenceClient={row.reference_client}
                    />
                  ) : (
                    <span className="type-caption text-text-secondary">—</span>
                  )}
                </span>
                <span className="type-caption truncate px-1.5 text-text-secondary">
                  {row.city ?? "—"}
                </span>
                <span className="type-caption truncate px-1.5 text-text-secondary">
                  {row.sector ?? "—"}
                </span>
                <span className="type-caption px-1.5 text-text-secondary">
                  {row.country ?? "—"}
                </span>
                <span className="px-1.5">
                  <StatusPill tone={PROSPECT_STATUS_TONES[row.status]}>
                    {PROSPECT_STATUS_LABELS[row.status]}
                  </StatusPill>
                </span>
                <span className="flex justify-end px-1.5">
                  <ScoreFlag score={row.score} />
                </span>
                <span className="type-caption px-1.5 text-text-secondary">
                  {row.last_contact_at ? relativeDays(row.last_contact_at) : "—"}
                </span>
                <span className="type-caption truncate px-1.5 text-text-secondary">
                  {primary ? contactDisplayName(primary) : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
