"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange } from "lucide-react";

import { DateField } from "@/components/ds/date-field";
import { describeOutcome, startSync } from "@/components/viz/sync-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDayFr } from "@/lib/format";
import {
  presetOf,
  presetRange,
  RANGE_PRESET_LABELS,
  type DateRange,
  type RangePreset,
} from "@/lib/reporting/period";

/**
 * La période du rapport : un préréglage, ou deux dates.
 *
 * Le préréglage sert 90 % des cas — « le mois dernier », qu'on regarde chaque
 * début de mois. Les deux champs sont là pour le reste : une opération sur
 * quinze jours, une comparaison calée sur un événement.
 *
 * Rien n'est appliqué à la frappe. Modifier une borne relancerait la page à
 * chaque caractère, et une plage à moitié saisie n'a pas de sens — d'où le
 * bouton **Appliquer**, et l'abandon qui rend son état d'origine au panneau.
 *
 * La plage vit dans l'URL (`?du=&au=`), en ISO : un rapport se transmet par
 * copie du lien, et le destinataire doit voir la même période.
 */
export function RangePicker({
  range,
  syncWorkspace,
}: {
  range: DateRange;
  /**
   * Slug de l'espace à synchroniser quand une plage est appliquée — passé au
   * propriétaire seulement. Choisir une période, c'est demander ses chiffres :
   * la collecte part toute seule et couvre la plage, même ancienne.
   */
  syncWorkspace?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(range);

  // `now` au rendu et non en constante de module : une session laissée ouverte
  // une nuit reconnaîtrait encore « le mois dernier » d'hier.
  const preset = presetOf(draft, new Date());

  const apply = (next: DateRange) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("du", next.from);
    params.set("au", next.to);
    // Le mois n'a plus de sens dès qu'une plage libre est choisie.
    params.delete("mois");
    setOpen(false);
    startTransition(() => {
      router.push(`${pathname}?${params}`, { scroll: false });
    });

    if (syncWorkspace) {
      void startSync(syncWorkspace, next.from).then((outcome) => {
        describeOutcome(outcome);
        router.refresh();
      });
    }
  };

  const choosePreset = (value: RangePreset) => {
    const bounds = presetRange(value, new Date());
    if (bounds) setDraft(bounds);
  };

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        // À l'ouverture comme à l'abandon, le panneau repart de la période
        // réellement affichée : un brouillon abandonné ne survit pas.
        setDraft(range);
        setOpen(next);
      }}
    >
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            disabled={pending}
            className="border-border bg-surface text-text-primary hover:bg-muted/60 focus-visible:ring-brand inline-flex h-9 items-center gap-2 rounded-md border px-2.5 transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          >
            <CalendarRange
              className="text-text-tertiary size-4"
              strokeWidth={1.75}
              aria-hidden
            />
            <span className="type-label">
              {formatDayFr(range.from)} – {formatDayFr(range.to)}
            </span>
          </button>
        }
      />

      <DropdownMenuContent align="end" className="w-96 p-4">
        <label className="type-caption text-text-secondary block">
          Période
          <select
            value={preset}
            onChange={(event) => choosePreset(event.target.value as RangePreset)}
            className="border-border type-body text-text-primary mt-1 h-9 w-full rounded-md border bg-transparent px-2 outline-none"
          >
            {(
              Object.keys(RANGE_PRESET_LABELS) as RangePreset[]
            ).map((option) => (
              <option key={option} value={option}>
                {RANGE_PRESET_LABELS[option]}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <DateField
            label="Début"
            value={draft.from}
            onChange={(iso) =>
              setDraft((current) => ({ ...current, from: iso ?? current.from }))
            }
          />
          <DateField
            label="Fin"
            value={draft.to}
            onChange={(iso) =>
              setDraft((current) => ({ ...current, to: iso ?? current.to }))
            }
          />
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button size="sm" onClick={() => apply(draft)}>
            Appliquer
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
