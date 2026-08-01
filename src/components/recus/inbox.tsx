"use client";

import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, ShieldAlert } from "lucide-react";

import { toggleEmergencyStop, type ReceiptResult } from "@/app/actions/recus";
import { DocumentDetail } from "@/components/recus/document-detail";
import { DocumentList } from "@/components/recus/document-list";
import { Input } from "@/components/ui/input";
import { formatAmount } from "@/lib/recus/heuristics";
import type { Counters, DocumentDetail as Detail, ReceiptFilters } from "@/lib/recus/queries";
import type { ReceiptDocument, ReceiptExpense, ReceiptSource } from "@/lib/recus/types";
import { cn } from "@/lib/utils";

/**
 * L'écran Reçus, en trois colonnes.
 *
 * Le rail de gauche ne liste pas seulement des filtres : il montre aussi les
 * dépenses carte **sans justificatif**. C'est la moitié manquante du problème —
 * l'inbox dit quelles pièces attendent une ligne, cette liste dit quelles
 * lignes attendent une pièce. Une comptabilité complète se lit dans les deux
 * sens, et c'est là qu'on voit ce qui n'arrivera jamais par mail : un ticket de
 * taxi payé en carte, un abonnement facturé sans notification.
 */
export function Inbox({
  sources,
  canDecide,
  documents,
  counters,
  filters,
  unattached,
  selectedId,
  detail,
  notice,
}: {
  sources: ReceiptSource[];
  canDecide: boolean;
  documents: ReceiptDocument[];
  counters: Counters;
  filters: ReceiptFilters;
  unattached: ReceiptExpense[];
  selectedId: string | null;
  detail: Detail | null;
  notice: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(filters.search ?? "");

  const [stopState, stop, stopping] = useActionState<ReceiptResult | null, FormData>(
    toggleEmergencyStop,
    null,
  );

  const emergencyStopped = sources.some(
    (source) => source.settings.auto_forward.emergency_stop,
  );
  const failing = sources.filter((source) => source.status === "error");

  const selectedIndex = useMemo(
    () => documents.findIndex((document) => document.id === selectedId),
    [documents, selectedId],
  );

  const goTo = useCallback(
    (documentId: string) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("piece", documentId);
      router.push(`${pathname}?${next}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const move = useCallback(
    (delta: number) => {
      if (documents.length === 0) return;
      const base = selectedIndex === -1 ? 0 : selectedIndex;
      const next = Math.min(Math.max(base + delta, 0), documents.length - 1);
      goTo(documents[next]!.id);
    },
    [documents, goTo, selectedIndex],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (typing) return;

      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        move(1);
      } else if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        move(-1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [move]);

  function applyFilter(status: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (status) next.set("statut", status);
    else next.delete("statut");
    next.delete("piece");
    router.push(`${pathname}?${next}`);
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(searchParams.toString());
    if (search.trim()) next.set("q", search.trim());
    else next.delete("q");
    next.delete("piece");
    router.push(`${pathname}?${next}`);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border flex flex-wrap items-center gap-3 border-b px-4 py-2">
        <span className="bg-brand-mint text-heading rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums">
          {counters.toValidate} à valider
        </span>

        {counters.unmatched > 0 ? (
          <span className="text-brand-red text-xs font-medium">
            {counters.unmatched} non rapprochées par Airwallex
          </span>
        ) : null}

        {counters.failed > 0 ? (
          <span className="text-brand-red text-xs font-medium">
            {counters.failed} en échec
          </span>
        ) : null}

        <span className="text-muted-foreground text-xs">
          {counters.attachedThisMonth} rangées ce mois-ci
        </span>

        <form onSubmit={submitSearch} className="relative ml-auto">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher"
            aria-label="Rechercher une pièce"
            className="h-8 w-56 pl-8"
          />
        </form>

        {/* L'arrêt d'urgence est à portée de main plutôt que caché dans des
            réglages : le moment où on en a besoin est le moment où on n'a pas
            envie de chercher. */}
        {canDecide ? (
          <form action={stop}>
            <input type="hidden" name="stop" value={emergencyStopped ? "false" : "true"} />
            <button
              type="submit"
              disabled={stopping}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                emergencyStopped
                  ? "bg-brand-red/10 text-brand-red font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ShieldAlert className="size-3.5" aria-hidden />
              {emergencyStopped ? "Automatismes coupés" : "Tout couper"}
            </button>
          </form>
        ) : null}
      </div>

      {notice ? (
        <p className="border-border text-muted-foreground border-b px-4 py-2 text-xs">
          Boîte <strong className="font-medium">{notice}</strong> connectée.
        </p>
      ) : null}

      {failing.length > 0 ? (
        <p role="alert" className="text-brand-red border-border border-b px-4 py-2 text-xs">
          {failing[0]!.email_address} : {failing[0]!.last_error}
        </p>
      ) : null}

      {stopState && !stopState.ok ? (
        <p role="alert" className="text-destructive border-border border-b px-4 py-2 text-xs">
          {stopState.error}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Filtres"
          className="border-border w-56 shrink-0 space-y-4 overflow-y-auto border-r p-3"
        >
          <ul className="space-y-0.5">
            <FilterLink
              label="À traiter"
              count={counters.toValidate + counters.unmatched + counters.failed}
              active={!filters.status}
              onClick={() => applyFilter(null)}
            />
            <FilterLink
              label="En attente d'accrochage"
              count={counters.forwarded}
              active={filters.status === "forwarded"}
              onClick={() => applyFilter("forwarded")}
            />
            <FilterLink
              label="Rangées"
              active={filters.status === "attached"}
              onClick={() => applyFilter("attached")}
            />
            <FilterLink
              label="Ignorées"
              active={filters.status === "ignored"}
              onClick={() => applyFilter("ignored")}
            />
          </ul>

          {unattached.length > 0 ? (
            <section className="border-border border-t pt-3">
              <h2 className="text-muted-foreground mb-2 text-xs font-medium">
                Dépenses sans justificatif
              </h2>
              <ul className="space-y-1.5">
                {unattached.slice(0, 8).map((expense) => (
                  <li key={expense.id} className="text-xs">
                    <span className="block truncate">
                      {expense.merchant ?? "Marchand inconnu"}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatAmount(expense.amount_cents, expense.currency)} ·{" "}
                      {expense.transaction_date ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
              {unattached.length > 8 ? (
                <p className="text-muted-foreground mt-2 text-xs">
                  et {unattached.length - 8} autres
                </p>
              ) : null}
            </section>
          ) : null}
        </nav>

        <DocumentList
          documents={documents}
          selectedId={selectedId}
          onSelect={goTo}
        />

        <DocumentDetail
          key={detail?.document.id ?? "empty"}
          detail={detail}
          canDecide={canDecide}
          onAdvance={() => move(1)}
        />
      </div>
    </div>
  );
}

function FilterLink({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={cn(
          "focus-visible:ring-ring flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
          active
            ? "bg-muted text-foreground font-medium"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )}
      >
        {label}
        {count !== undefined && count > 0 ? (
          <span className="tabular-nums">{count}</span>
        ) : null}
      </button>
    </li>
  );
}
