"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Search, X } from "lucide-react";
import { toast } from "sonner";

import { setFaqClientReview } from "@/app/actions/moderation";
import { StatusPill, type StatusTone } from "@/components/ds/status-pill";
import { Panel, PanelHeader } from "@/components/ds/surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FAQ_CLIENT_REVIEW_LABELS,
  type FaqClientReview,
  type FaqEntry,
} from "@/lib/moderation/types";
import { cn } from "@/lib/utils";

/**
 * La FAQ vue du client : lire ce qui répond en son nom, valider ou refuser.
 *
 * Les entrées soumises (« À valider ») remontent en tête avec leurs deux
 * boutons ; les autres se lisent. ⌘F saute dans la recherche — le même geste
 * que partout.
 */

const REVIEW_TONES: Record<FaqClientReview, StatusTone> = {
  pending: "warning",
  approved: "positive",
  rejected: "danger",
};

export function FaqClientView({
  entries,
  categories,
  canReview,
}: {
  entries: FaqEntry[];
  categories: { id: string; name: string }[];
  /** L'owner consulte cette page comme le client la verra — sans les boutons. */
  canReview: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, start] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries
      .filter((entry) => {
        if (!needle) return true;
        return (
          (entry.title ?? "").toLowerCase().includes(needle) ||
          entry.question_canonical.toLowerCase().includes(needle) ||
          (entry.answer_fr ?? "").toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        // Ce qui attend le client d'abord, puis l'ordre alphabétique du titre.
        const pending =
          Number(b.client_review === "pending") -
          Number(a.client_review === "pending");
        if (pending !== 0) return pending;
        return (a.title ?? a.question_canonical).localeCompare(
          b.title ?? b.question_canonical,
          "fr",
        );
      });
  }, [entries, query]);

  const toReview = entries.filter((entry) => entry.client_review === "pending");

  const review = (entryId: string, verdict: "approved" | "rejected") => {
    setPendingId(entryId);
    start(async () => {
      const result = await setFaqClientReview({ entryId, verdict });
      setPendingId(null);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Panel>
      <PanelHeader
        title="Éléments de langage"
        count={rows.length}
        description={
          canReview && toReview.length > 0
            ? `${toReview.length} en attente de votre validation`
            : undefined
        }
        action={
          <div className="relative w-56">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-tertiary"
              aria-hidden
            />
            <Input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher (⌘F)"
              aria-label="Rechercher dans la FAQ"
              className="pl-9"
            />
          </div>
        }
      />

      <ul className="divide-y divide-border">
        {rows.map((entry) => (
          <li key={entry.id} className="px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="type-label font-semibold text-text-primary">
                {entry.title ?? entry.question_canonical}
              </h3>
              {entry.category_id && categoryNames.get(entry.category_id) ? (
                <StatusPill tone="neutral" dot={false}>
                  {categoryNames.get(entry.category_id)}
                </StatusPill>
              ) : null}
              {entry.client_review ? (
                <StatusPill tone={REVIEW_TONES[entry.client_review]}>
                  {FAQ_CLIENT_REVIEW_LABELS[entry.client_review]}
                </StatusPill>
              ) : null}

              {canReview && entry.client_review === "pending" ? (
                <span className="ml-auto flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={pendingId === entry.id}
                    onClick={() => review(entry.id, "approved")}
                  >
                    <Check className="size-4" strokeWidth={1.75} aria-hidden />
                    Valider
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pendingId === entry.id}
                    onClick={() => review(entry.id, "rejected")}
                  >
                    <X className="size-4" strokeWidth={1.75} aria-hidden />
                    Refuser
                  </Button>
                </span>
              ) : null}
            </div>

            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div>
                <p className="type-overline text-text-secondary">Question type</p>
                <p className="type-body mt-1 whitespace-pre-wrap text-text-secondary">
                  {entry.question_canonical}
                </p>
              </div>
              <div>
                <p className="type-overline text-text-secondary">Réponse apportée</p>
                <p
                  className={cn(
                    "type-body mt-1 whitespace-pre-wrap",
                    entry.answer_fr ? "text-text-primary" : "text-text-secondary",
                  )}
                >
                  {entry.answer_fr ?? "—"}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {rows.length === 0 ? (
        <p className="type-body py-10 text-center text-text-secondary">
          {query
            ? "Aucun élément ne correspond."
            : "Aucun élément de langage pour le moment."}
        </p>
      ) : null}
    </Panel>
  );
}
