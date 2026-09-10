"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { NativeSelect } from "@/components/antidotes/controls";
import { useInboundUrl } from "@/components/antidotes/inbound-url";
import { Panel, PanelBody } from "@/components/ds/surface";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CONTENT_PERIODS,
  CONTENT_SORT_LABELS,
  CONTENT_SOURCE_LABELS,
  type ContentFilters,
  type ContentSort,
  type ContentSource,
} from "@/lib/antidotes/inbound/filters";
import { POST_PLATFORM_LABELS, type PostPlatform } from "@/lib/antidotes/types";
import { cn } from "@/lib/utils";

/**
 * Tous les filtres au même endroit.
 *
 * Ils étaient dispersés : les réseaux en pastilles à droite du titre, la
 * période à côté, trois seuils en champs libres posés en travers du tableau.
 * Chacun était lisible, l'ensemble ne l'était pas. Un panneau qu'on ouvre,
 * qu'on règle, qu'on referme — et sous la barre, les filtres réellement
 * posés, chacun avec sa croix, pour qu'on sache toujours ce qu'on regarde.
 */

const SOURCES: ContentSource[] = ["tout", "veille", "moi"];
const SORTS: ContentSort[] = ["score", "vues", "likes", "commentaires", "partages", "enregistrements", "date"];

export function InboundFiltersPanel({
  filters,
  platforms,
  onClose,
}: {
  filters: ContentFilters;
  /** Les réseaux qui ont réellement quelque chose : un filtre vide ne sert à rien. */
  platforms: PostPlatform[];
  onClose: () => void;
}) {
  const { go } = useInboundUrl();
  const set = (patch: Record<string, string | null>) => go({ ...patch, post: null, brouillon: null });

  return (
    <Panel>
      <PanelBody className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Réseau">
            <NativeSelect
              aria-label="Réseau"
              value={filters.platform ?? ""}
              onChange={(event) => set({ reseau: event.target.value || null })}
            >
              <option value="">Tous</option>
              {platforms.map((platform) => (
                <option key={platform} value={platform}>
                  {POST_PLATFORM_LABELS[platform]}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="Période">
            <NativeSelect
              aria-label="Période"
              value={filters.days === null ? "tout" : String(filters.days)}
              onChange={(event) => set({ jours: event.target.value })}
            >
              {CONTENT_PERIODS.map((period) => (
                <option key={period.label} value={period.value === null ? "tout" : String(period.value)}>
                  {period.label}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="Ce qu'on regarde">
            <NativeSelect
              aria-label="Ce qu'on regarde"
              value={filters.source}
              onChange={(event) => set({ source: event.target.value })}
            >
              {SOURCES.map((source) => (
                <option key={source} value={source}>
                  {CONTENT_SOURCE_LABELS[source]}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Threshold label="Vues" name="vues" value={filters.minViews} onApply={set} />
          <Threshold label="Likes" name="likes" value={filters.minLikes} onApply={set} />
          <Threshold label="Commentaires" name="commentaires" value={filters.minComments} onApply={set} />
          <Threshold label="Partages" name="partages" value={filters.minShares} onApply={set} />
          <Threshold label="Enregistrements" name="enregistrements" value={filters.minSaves} onApply={set} />
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <Field label="Trier par">
            <div className="flex items-center gap-2">
              <NativeSelect
                aria-label="Trier par"
                value={filters.sort}
                onChange={(event) => set({ tri: event.target.value })}
                className="w-48"
              >
                {SORTS.map((sort) => (
                  <option key={sort} value={sort}>
                    {CONTENT_SORT_LABELS[sort]}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                aria-label="Ordre"
                value={filters.direction}
                onChange={(event) => set({ sens: event.target.value === "asc" ? "asc" : null })}
              >
                <option value="desc">Du plus grand</option>
                <option value="asc">Du plus petit</option>
              </NativeSelect>
            </div>
          </Field>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                set({
                  reseau: null,
                  jours: null,
                  vues: null,
                  likes: null,
                  commentaires: null,
                  partages: null,
                  enregistrements: null,
                  source: null,
                })
              }
              className="type-caption focus-visible:ring-ring rounded-sm text-text-secondary hover:text-text-primary focus-visible:ring-2 focus-visible:outline-none"
            >
              Tout effacer
            </button>
            <button
              type="button"
              onClick={onClose}
              className="type-caption focus-visible:ring-ring rounded-sm font-medium text-accent-ink focus-visible:ring-2 focus-visible:outline-none"
            >
              Fermer
            </button>
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}

/** Ce qui est réellement posé, sous la barre — chaque filtre avec sa croix. */
export function ActiveFilterChips({ filters }: { filters: ContentFilters }) {
  const { go } = useInboundUrl();
  const chips: { key: string; label: string; clear: Record<string, string | null> }[] = [];

  if (filters.platform) {
    chips.push({
      key: "reseau",
      label: POST_PLATFORM_LABELS[filters.platform],
      clear: { reseau: null },
    });
  }
  if (filters.days !== 30) {
    chips.push({
      key: "jours",
      label: filters.days === null ? "Tout l'historique" : `${filters.days} jours`,
      clear: { jours: null },
    });
  }
  if (filters.source !== "tout") {
    chips.push({ key: "source", label: CONTENT_SOURCE_LABELS[filters.source], clear: { source: null } });
  }
  const thresholds: [string, number | null, string][] = [
    ["vues", filters.minViews, "vues"],
    ["likes", filters.minLikes, "likes"],
    ["commentaires", filters.minComments, "commentaires"],
    ["partages", filters.minShares, "partages"],
    ["enregistrements", filters.minSaves, "enregistrements"],
  ];
  for (const [key, value, word] of thresholds) {
    if (value !== null) {
      chips.push({ key, label: `≥ ${value.toLocaleString("fr-FR")} ${word}`, clear: { [key]: null } });
    }
  }

  if (chips.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type="button"
            onClick={() => go(chip.clear)}
            className="type-caption focus-visible:ring-ring inline-flex items-center gap-1 rounded-pill bg-surface-sunken py-1 pr-1.5 pl-2.5 text-text-secondary transition-colors duration-(--motion-duration) ease-standard hover:text-text-primary focus-visible:ring-2 focus-visible:outline-none"
          >
            {chip.label}
            <X className="size-3" strokeWidth={1.75} aria-hidden />
            <span className="sr-only">Retirer ce filtre</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label className="type-caption text-text-secondary">{label}</Label>
      {children}
    </div>
  );
}

/**
 * Un seuil s'applique en quittant le champ ou à Entrée — jamais à la frappe :
 * une navigation par caractère rechargerait le tableau six fois pour « 10000 ».
 */
function Threshold({
  label,
  name,
  value,
  onApply,
}: {
  label: string;
  name: string;
  value: number | null;
  onApply: (patch: Record<string, string | null>) => void;
}) {
  const [draft, setDraft] = useState(value?.toString() ?? "");
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value?.toString() ?? "");
  }

  const apply = () => {
    const next = draft.trim();
    if (next === (value?.toString() ?? "")) return;
    onApply({ [name]: next || null });
  };

  return (
    <label className={cn("grid gap-1")}>
      <span className="type-caption text-text-secondary">Au moins · {label}</span>
      <Input
        inputMode="numeric"
        value={draft}
        onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ""))}
        onBlur={apply}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            apply();
          }
        }}
        className="tabular-nums"
        placeholder="—"
      />
    </label>
  );
}
