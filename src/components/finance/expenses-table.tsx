"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clock,
  Download,
  Link2,
  Store,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import {
  createCategoryAndAssign,
  recategorizeTransaction,
  setRetrievalSource,
  type FinanceActionResult,
} from "@/app/actions/finance";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PendingLabel } from "@/components/ds/pending-label";

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
import type { RetrievalCellState } from "@/lib/finance/retrieval";
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
  /** Identifiant de la catégorie **effective** — posée à la main ou résolue
      par les règles. C'est la valeur que le sélecteur de la ligne affiche :
      montrer « Sans catégorie » sur une ligne que le tableau range en
      « Restauration » serait un mensonge d'un pixel à l'autre. */
  category_effective_id: string | null;
  /** URL signée du logo du marchand, quand la synchronisation l'a trouvé. */
  logo_url: string | null;
  /** La récupération automatique des factures du marchand, jugée côté
      serveur pour ce mois-ci — voir `retrieval.ts`. */
  retrieval: RetrievalCellState;
};

export function ExpensesTable({
  rows,
  total,
  page,
  pageCount,
  categories,
  canDecide,
}: {
  rows: DisplayExpense[];
  total: number;
  page: number;
  pageCount: number;
  categories: FinanceCategory[];
  /** Le propriétaire recatégorise ; un lecteur voit le libellé nu. */
  canDecide: boolean;
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
                  <TableHead>Récupération</TableHead>
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
                      {canDecide ? (
                        <CategoryCell row={row} categories={categories} />
                      ) : (
                        (row.category_label ?? "—")
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell>
                      <ReceiptBadge row={row} />
                    </TableCell>
                    <TableCell>
                      <RetrievalCell row={row} canDecide={canDecide} />
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
                    {!canDecide && row.category_label ? ` · ${row.category_label}` : ""}
                  </span>
                  {canDecide ? (
                    <CategoryCell row={row} categories={categories} />
                  ) : null}
                  <StatusBadge status={row.status} />
                  <ReceiptBadge row={row} />
                  <RetrievalCell row={row} canDecide={canDecide} />
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

/**
 * La cellule Catégorie, éditable d'un geste.
 *
 * Un `<select>` natif — pas de dialogue : ranger une dépense est un geste de
 * tri du quotidien, il doit coûter un clic. Le changement part aussitôt
 * (`requestSubmit`) et le serveur répond deux choses : la ligne est rangée,
 * **et le marchand s'en souviendra** — le prélèvement du mois prochain
 * arrivera déjà classé. Le toast le dit, parce que cette mémoire est
 * invisible autrement.
 */
/** Valeur sentinelle du sélecteur : ouvrir la création au lieu de ranger. */
const NEW_CATEGORY_VALUE = "__nouvelle__";

function CategoryCell({
  row,
  categories,
}: {
  row: DisplayExpense;
  categories: FinanceCategory[];
}) {
  const [state, submit, pending] = useActionState<FinanceActionResult | null, FormData>(
    recategorizeTransaction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.error);
  }, [state]);

  return (
    <>
      <form ref={formRef} action={submit}>
        <input type="hidden" name="transactionId" value={row.id} />
        <select
          name="categoryId"
          aria-label={`Catégorie de ${row.merchant ?? row.merchant_raw ?? "la dépense"}`}
          className="border-border-line bg-surface text-text-primary focus-visible:ring-ring hover:border-border h-7 max-w-48 rounded-sm border px-1.5 text-xs focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          defaultValue={row.category_effective_id ?? ""}
          disabled={pending}
          onChange={(event) => {
            /* La sentinelle n'est pas un rangement : le sélecteur revient à sa
               valeur d'avant — sinon « + Nouvelle catégorie… » resterait
               affiché en guise de catégorie — et le dialogue prend la main. */
            if (event.target.value === NEW_CATEGORY_VALUE) {
              event.target.value = row.category_effective_id ?? "";
              setCreating(true);
              return;
            }
            formRef.current?.requestSubmit();
          }}
        >
          <option value="">Sans catégorie</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
          <option value={NEW_CATEGORY_VALUE}>+ Nouvelle catégorie…</option>
        </select>
      </form>

      {creating ? (
        <NewCategoryDialog
          row={row}
          open={creating}
          onOpenChange={setCreating}
        />
      ) : null}
    </>
  );
}

/**
 * La création d'une catégorie personnalisée, depuis la ligne qui en a besoin.
 *
 * Un seul champ, un seul geste : la catégorie est créée **et** la dépense
 * rangée dedans — avec la règle par marchand, comme n'importe quel rangement.
 * Un nom déjà pris sous une autre écriture range dans l'existante au lieu de
 * créer un doublon.
 */
function NewCategoryDialog({
  row,
  open,
  onOpenChange,
}: {
  row: DisplayExpense;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, submit, pending] = useActionState<FinanceActionResult | null, FormData>(
    createCategoryAndAssign,
    null,
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message);
      onOpenChange(false);
    } else {
      toast.error(state.error);
    }
  }, [state, onOpenChange]);

  const merchantLabel = row.merchant ?? row.merchant_raw ?? "cette dépense";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nouvelle catégorie</DialogTitle>
          <DialogDescription>
            Elle sera créée dans le plan, appliquée à « {merchantLabel} », et
            retiendra ce marchand pour les prochaines fois.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          <input type="hidden" name="transactionId" value={row.id} />
          <Input
            name="name"
            placeholder="Salaires, Comptabilité, Matériel…"
            maxLength={40}
            autoFocus
            required
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button type="submit" variant="accent" size="sm" disabled={pending}>
              <PendingLabel pending={pending} busy="Création…">
                Créer et ranger
              </PendingLabel>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * La cellule Récupération : un bouton carré, et un dialogue par-dessus.
 *
 * Le dashboard ne télécharge rien — un passage sur le Mac, dont le
 * navigateur garde ses sessions, demande chaque matin ce qu'il y a à faire,
 * va chercher la facture le lendemain du prélèvement, et la dépose ici pour
 * qu'elle parte à Airwallex. La fiche est celle du **marchand** : le lien se
 * colle une fois, sur n'importe laquelle de ses dépenses, et sert tous les
 * mois. L'état arrive du serveur, calculé par le même code que la liste du
 * passage : la cellule et lui ne peuvent pas se contredire.
 *
 * Carré et sans texte : la colonne ne doit pas s'élargir pour un bouton, et
 * c'est l'en-tête qui dit ce qu'il fait. Le libellé vit dans `aria-label`
 * et l'infobulle.
 */
function RetrievalCell({
  row,
  canDecide,
}: {
  row: DisplayExpense;
  canDecide: boolean;
}) {
  const [open, setOpen] = useState(false);
  const merchant = row.merchant ?? row.merchant_raw;

  /* Un virement ou des frais bancaires n'ont aucune facture à aller chercher. */
  if (row.source === "ledger" || !merchant) {
    return <span className="text-muted-foreground">—</span>;
  }

  const state = row.retrieval;

  if (state.kind === "done") {
    /* `title` sur un `span` et non sur le bouton : un bouton inerte ne
       reçoit plus le survol (`pointer-events-none`), l'infobulle datée
       n'apparaîtrait jamais. */
    return (
      <span title={`Récupérée le ${formatDateTime(state.retrievedAt)}`} className="inline-flex">
        <Button
          type="button"
          size="icon-xs"
          variant="outline"
          disabled
          aria-label={`Facture ${merchant} récupérée ce mois-ci`}
          className="border-accent-subtle bg-accent-subtle text-accent-ink disabled:opacity-80"
        >
          <Check aria-hidden />
        </Button>
      </span>
    );
  }

  if (!canDecide) {
    if (state.kind === "none") return <span className="text-muted-foreground">—</span>;
    return (
      <StatusPill tone={state.kind === "failed" ? "danger" : "neutral"}>
        {state.kind === "failed" ? "Échec" : "En attente"}
      </StatusPill>
    );
  }

  const trigger =
    state.kind === "failed"
      ? {
          icon: <TriangleAlert aria-hidden />,
          label: `Échec de la récupération ${merchant} — modifier le lien`,
          title: `${state.error ?? "Échec sans détail"}\n${state.link}`,
          className: "border-danger-subtle bg-danger-subtle text-danger-ink",
        }
      : state.kind === "pending"
        ? {
            icon: <Clock aria-hidden />,
            label: `Facture ${merchant} en attente — modifier le lien`,
            title: `Lien enregistré — passage le lendemain du prochain prélèvement.\n${state.link}`,
            className: undefined,
          }
        : {
            icon: <Link2 aria-hidden />,
            label: `Récupérer les factures ${merchant}`,
            title: `Coller le lien où les factures ${merchant} se téléchargent`,
            className: undefined,
          };

  return (
    <>
      <Button
        type="button"
        size="icon-xs"
        variant="outline"
        aria-label={trigger.label}
        title={trigger.title}
        className={trigger.className}
        onClick={() => setOpen(true)}
      >
        {trigger.icon}
      </Button>
      {open ? (
        <RetrievalDialog
          row={row}
          merchant={merchant}
          state={state}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </>
  );
}

/**
 * Le lien d'un fournisseur, dans un dialogue par-dessus le tableau — la
 * colonne ne bouge pas d'un pixel. Un champ, trois gestes : enregistrer,
 * retirer, annuler.
 */
function RetrievalDialog({
  row,
  merchant,
  state,
  open,
  onOpenChange,
}: {
  row: DisplayExpense;
  merchant: string;
  state: Exclude<RetrievalCellState, { kind: "done" }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [result, submit, pending] = useActionState<FinanceActionResult | null, FormData>(
    setRetrievalSource,
    null,
  );

  useEffect(() => {
    if (!result) return;
    if (result.ok) {
      toast.success(result.message);
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
  }, [result, onOpenChange]);

  const link = state.kind === "none" ? "" : state.link;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Factures {merchant}</DialogTitle>
          <DialogDescription>
            Le lien de la page où les factures {merchant} se téléchargent, une fois
            connecté. Collé une fois, il vaut pour toutes ses dépenses : le passage y
            retourne chaque mois, le lendemain du prélèvement.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          <input type="hidden" name="transactionId" value={row.id} />
          <Input
            name="sourceLink"
            type="url"
            inputMode="url"
            defaultValue={link}
            placeholder="https://…"
            aria-label={`Lien des factures ${merchant}`}
            autoFocus
            required
            disabled={pending}
          />
          {state.kind === "failed" ? (
            <p className="type-caption text-danger-ink">
              Dernier passage : {state.error ?? "échec sans détail"}
            </p>
          ) : null}
          {state.kind === "pending" ? (
            <p className="type-caption text-text-secondary">
              Lien enregistré. Le passage viendra le lendemain du prochain prélèvement.
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            {link ? (
              <Button
                type="submit"
                name="remove"
                value="1"
                variant="ghost"
                size="sm"
                className="mr-auto text-danger-ink"
                disabled={pending}
                formNoValidate
              >
                Retirer le lien
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button type="submit" variant="accent" size="sm" disabled={pending}>
              <PendingLabel pending={pending} busy="Enregistrement…">
                Enregistrer
              </PendingLabel>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* L'instant d'une récupération, à l'heure de Paris : un horodatage qu'on lit
   pour vérifier un envoi, pas une date de calcul — celles-là restent en UTC. */
const DATE_TIME = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return DATE_TIME.format(date);
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return DATE.format(date);
}
