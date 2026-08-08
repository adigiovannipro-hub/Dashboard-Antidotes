"use client";

import { useId } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Download, Store } from "lucide-react";

import { DateField } from "@/components/ds/date-field";
import { StatusPill, type StatusTone } from "@/components/ds/status-pill";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { merchantInitials } from "@/lib/finance/merchant-logo";
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
  /** URL signée du logo du marchand, quand la synchronisation l'a trouvé. */
  logo_url: string | null;
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
        <DateField
          label="Du"
          value={searchParams.get("du")}
          onChange={(iso) => update({ du: iso })}
        />
        <DateField
          label="Au"
          value={searchParams.get("au")}
          onChange={(iso) => update({ au: iso })}
        />
        <div className="grid gap-1">
          <Label
            htmlFor={`${fieldId}-categorie`}
            className="type-overline text-text-secondary"
          >
            Catégorie
          </Label>
          <select
            id={`${fieldId}-categorie`}
            className="border-border-line bg-surface focus-visible:ring-ring type-body text-text-primary h-10 rounded-md border px-2 focus-visible:ring-2 focus-visible:outline-none"
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
        <label className="type-body flex h-10 items-center gap-2">
          <input
            type="checkbox"
            className="accent-(--accent) size-4"
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
                    <TableCell className="max-w-64">
                      <Merchant row={row} />
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
                      <ReceiptBadge row={row} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* --- Cartes (mobile) -------------------------------------- */}
          <ul className="space-y-2 md:hidden">
            {rows.map((row) => (
              <li key={row.id} className="bg-surface-sunken rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <Merchant row={row} />
                  <Amount row={row} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="type-caption text-text-secondary mr-auto tabular-nums">
                    {formatDate(row.occurred_at)}
                    {row.category_label ? ` · ${row.category_label}` : ""}
                  </span>
                  <StatusBadge status={row.status} />
                  <ReceiptBadge row={row} />
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

/**
 * Le marchand : sa marque, son nom, et la carte qui a payé, dessous.
 *
 * La marque porte des initiales et non le vrai logo — les trois façons d'avoir
 * un logo de marque coûtent toutes quelque chose que ce projet ne paie pas.
 * Le raisonnement complet est en tête de `merchant-logo.ts`.
 */
function Merchant({ row }: { row: DisplayExpense }) {
  const raw = row.merchant ?? row.merchant_raw;
  const initials = merchantInitials(raw);

  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span
        aria-hidden
        className="border-border-line text-text-secondary type-caption flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white font-semibold"
      >
        {/* Le vrai logo quand la synchronisation l'a trouvé ; sinon les
            initiales ; sinon une icône générique — jamais une lettre
            inventée, jamais un carré vide. Fond blanc dans les deux modes :
            un favicon est dessiné pour un fond clair. */}
        {row.logo_url ? (
          /* `img` nu et non `next/image` : l'URL est signée et expire dans
             l'heure — l'optimiseur la mettrait en cache au-delà de sa durée
             de vie, et un favicon de 128 px n'a rien à optimiser. */
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.logo_url} alt="" className="size-6 object-contain" />
        ) : (
          initials || <Store strokeWidth={1.75} className="size-4" />
        )}
      </span>
      <div className="min-w-0">
        <p className="type-label text-text-primary truncate">{raw ?? "—"}</p>
        {/* Masqué au téléphone : la carte est toujours la même, et la ligne
            volait la largeur au nom du marchand, qui se retrouvait tronqué à
            « Black Sand… ». Ce qui ne sert pas au petit écran en sort. */}
        {row.card_last_four ? (
          <p className="type-caption text-text-secondary hidden tabular-nums md:block">
            Carte •••• {row.card_last_four}
          </p>
        ) : null}
        {/* Un virement n'a pas de carte : sa deuxième ligne dit à qui il est
            parti et pourquoi, sans quoi dix « Virement émis » se ressemblent.
            Visible au téléphone, contrairement au numéro de carte : c'est ici
            la vraie identité de la ligne, pas un détail. */}
        {!row.card_last_four && row.source === "ledger" && row.merchant_raw ? (
          // `title` : une référence bancaire dépasse souvent la largeur de la
          // colonne, et l'ellipse ne doit pas la rendre inaccessible.
          <p
            title={row.merchant_raw}
            className="type-caption text-text-secondary truncate"
          >
            {row.merchant_raw}
          </p>
        ) : null}
      </div>
    </div>
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

/* Un virement émis ou des frais bancaires n'attendent aucun justificatif :
   les marquer « Manquant » réclamerait éternellement une pièce qui n'existe
   pas. La colonne dit « sans objet », et le compteur de la bande haute les
   écarte de la même façon. */
function ReceiptBadge({ row }: { row: DisplayExpense }) {
  if (row.source === "ledger") {
    return <StatusPill tone="neutral">Sans objet</StatusPill>;
  }
  return (
    <StatusPill tone={row.has_receipt ? "positive" : "warning"}>
      {row.has_receipt ? "Reçu" : "Manquant"}
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
