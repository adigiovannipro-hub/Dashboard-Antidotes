"use client";

import { useId } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Download } from "lucide-react";

import { StatusPill, type StatusTone } from "@/components/ds/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDualAmount } from "@/lib/finance/money";
import {
  transactionStatusLabel,
  type BadgeTone,
  type FinanceCategory,
  type FinanceTransaction,
} from "@/lib/finance/types";

/**
 * Le tableau des dépenses — la réplique locale de l'écran Airwallex.
 *
 * Filtres, tri et page vivent dans l'URL : un état de tableau se partage par
 * lien, survit au retour arrière, et c'est le serveur qui pagine — l'écran ne
 * reçoit jamais plus d'une page.
 *
 * Sous 768 px, chaque ligne devient une carte : dix colonnes sur un écran de
 * poche, c'est un tableau qu'on fait défiler à l'aveugle.
 */

export type DisplayExpense = FinanceTransaction & {
  /** Catégorie résolue (plan Antidotes), sinon le libellé Airwallex brut. */
  category_label: string | null;
};

export function ExpensesTable({
  rows,
  total,
  page,
  pageCount,
  categories,
}: {
  rows: DisplayExpense[];
  total: number;
  page: number;
  pageCount: number;
  categories: FinanceCategory[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fieldId = useId();

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    // Tout changement de filtre ou de tri ramène en première page : la page 4
    // d'un autre filtrage ne veut rien dire.
    if (!("page" in changes)) next.delete("page");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const sortField = searchParams.get("tri") ?? "date";
  const sortAsc = searchParams.get("sens") === "asc";

  function toggleSort(field: "date" | "montant" | "marchand") {
    if (sortField === field) {
      update({ tri: field, sens: sortAsc ? "desc" : "asc" });
    } else {
      update({ tri: field, sens: field === "marchand" ? "asc" : "desc" });
    }
  }

  const exportParams = new URLSearchParams(searchParams.toString());
  exportParams.delete("page");
  const exportHref = `/entreprise/finance/export${
    exportParams.size > 0 ? `?${exportParams}` : ""
  }`;

  const hasFilters = ["du", "au", "categorie", "justificatif"].some((key) =>
    searchParams.has(key),
  );

  return (
    <div className="space-y-4">
      {/* --- Filtres --------------------------------------------------- */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label htmlFor={`${fieldId}-du`} className="text-muted-foreground text-xs">
            Du
          </Label>
          <Input
            id={`${fieldId}-du`}
            type="date"
            className="h-8 w-36"
            value={searchParams.get("du") ?? ""}
            onChange={(event) => update({ du: event.target.value || null })}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`${fieldId}-au`} className="text-muted-foreground text-xs">
            Au
          </Label>
          <Input
            id={`${fieldId}-au`}
            type="date"
            className="h-8 w-36"
            value={searchParams.get("au") ?? ""}
            onChange={(event) => update({ au: event.target.value || null })}
          />
        </div>
        <div className="grid gap-1">
          <Label
            htmlFor={`${fieldId}-categorie`}
            className="text-muted-foreground text-xs"
          >
            Catégorie
          </Label>
          <select
            id={`${fieldId}-categorie`}
            className="border-input bg-background focus-visible:ring-ring h-8 rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            value={searchParams.get("categorie") ?? ""}
            onChange={(event) => update({ categorie: event.target.value || null })}
          >
            <option value="">Toutes</option>
            <option value="aucune">Sans catégorie</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex h-8 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-(--brand) size-4"
            checked={searchParams.get("justificatif") === "manquant"}
            onChange={(event) =>
              update({ justificatif: event.target.checked ? "manquant" : null })
            }
          />
          Sans justificatif
        </label>

        <div className="ml-auto flex items-center gap-2">
          {hasFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                update({ du: null, au: null, categorie: null, justificatif: null })
              }
            >
              Réinitialiser
            </Button>
          ) : null}
          <Button variant="outline" size="sm" render={<a href={exportHref} />}>
            <Download aria-hidden />
            Export CSV
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {hasFilters
            ? "Aucune dépense ne correspond à ces filtres."
            : "Aucune dépense synchronisée pour l'instant."}
        </p>
      ) : (
        <>
          {/* --- Tableau (md et plus) -------------------------------- */}
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead
                    label="Date"
                    active={sortField === "date"}
                    ascending={sortAsc}
                    onSort={() => toggleSort("date")}
                  />
                  <SortableHead
                    label="Marchand"
                    active={sortField === "marchand"}
                    ascending={sortAsc}
                    onSort={() => toggleSort("marchand")}
                  />
                  <SortableHead
                    label="Montant"
                    active={sortField === "montant"}
                    ascending={sortAsc}
                    onSort={() => toggleSort("montant")}
                    align="right"
                  />
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Justificatif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
                      {formatDate(row.occurred_at)}
                    </TableCell>
                    <TableCell className="max-w-56">
                      <p className="truncate font-medium">
                        {row.merchant ?? row.merchant_raw ?? "—"}
                      </p>
                      {row.card_last_four ? (
                        <p className="text-muted-foreground text-xs">
                          Carte •••• {row.card_last_four}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <Amount row={row} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.category_label ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell>
                      <ReceiptBadge present={row.has_receipt} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* --- Cartes (mobile) -------------------------------------- */}
          <ul className="space-y-2 md:hidden">
            {rows.map((row) => (
              <li key={row.id} className="bg-background rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate font-medium">
                    {row.merchant ?? row.merchant_raw ?? "—"}
                  </p>
                  <Amount row={row} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-muted-foreground mr-auto text-xs tabular-nums">
                    {formatDate(row.occurred_at)}
                    {row.category_label ? ` · ${row.category_label}` : ""}
                  </span>
                  <StatusBadge status={row.status} />
                  <ReceiptBadge present={row.has_receipt} />
                </div>
              </li>
            ))}
          </ul>

          {/* --- Pagination ------------------------------------------- */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-muted-foreground text-xs tabular-nums">
              {total} dépense{total > 1 ? "s" : ""} — page {page} / {pageCount}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => update({ page: String(page - 1) })}
              >
                Précédent
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= pageCount}
                onClick={() => update({ page: String(page + 1) })}
              >
                Suivant
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SortableHead({
  label,
  active,
  ascending,
  onSort,
  align,
}: {
  label: string;
  active: boolean;
  ascending: boolean;
  onSort: () => void;
  align?: "right";
}) {
  return (
    <TableHead
      aria-sort={active ? (ascending ? "ascending" : "descending") : undefined}
      className={align === "right" ? "text-right" : undefined}
    >
      <button
        type="button"
        onClick={onSort}
        className="hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 focus-visible:ring-2 focus-visible:outline-none"
      >
        {label}
        {active ? (
          ascending ? (
            <ArrowUp className="size-3" aria-hidden />
          ) : (
            <ArrowDown className="size-3" aria-hidden />
          )
        ) : null}
      </button>
    </TableHead>
  );
}

function Amount({ row }: { row: DisplayExpense }) {
  const { primary, funded } = formatDualAmount(row);
  return (
    <div className="text-right">
      <p className="font-medium whitespace-nowrap tabular-nums">{primary}</p>
      {funded ? (
        <p className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
          financé avec {funded}
        </p>
      ) : null}
    </div>
  );
}

/* Le vocabulaire d'Airwallex vers celui du système : une dépense incomplète
   attend une action de ma part, une contestation est une alerte. */
const TONES: Record<BadgeTone, StatusTone> = {
  neutral: "neutral",
  positive: "positive",
  warning: "warning",
  critical: "danger",
};

function StatusBadge({ status }: { status: string | null }) {
  const { label, tone } = transactionStatusLabel(status);
  return <StatusPill tone={TONES[tone]}>{label}</StatusPill>;
}

function ReceiptBadge({ present }: { present: boolean }) {
  return (
    <StatusPill tone={present ? "positive" : "warning"}>
      {present ? "Reçu" : "Manquant"}
    </StatusPill>
  );
}

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return DATE.format(date);
}
