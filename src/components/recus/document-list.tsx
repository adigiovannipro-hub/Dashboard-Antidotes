"use client";

import { useEffect, useRef } from "react";
import { Paperclip, Link2Off } from "lucide-react";

import { formatAmount } from "@/lib/recus/heuristics";
import { KIND_LABELS, STATUS_LABELS, type ReceiptDocument } from "@/lib/recus/types";
import { cn } from "@/lib/utils";

/**
 * La colonne du milieu.
 *
 * Une ligne doit répondre d'un coup d'œil à la seule question qui compte avant
 * de valider : *de qui, combien, et l'a-t-on rapprochée ?* Le reste attend le
 * panneau de droite.
 */
export function DocumentList({
  documents,
  selectedId,
  onSelect,
}: {
  documents: ReceiptDocument[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  if (documents.length === 0) {
    return (
      <div className="border-border text-muted-foreground flex w-96 shrink-0 items-center justify-center border-r p-8 text-center text-sm">
        Rien à traiter ici. Les pièces déjà rangées sont dans « Rangées ».
      </div>
    );
  }

  return (
    <ul className="border-border w-96 shrink-0 overflow-y-auto border-r">
      {documents.map((document) => {
        const selected = document.id === selectedId;
        const matched = document.expense_id !== null;

        return (
          <li key={document.id}>
            <button
              ref={selected ? selectedRef : undefined}
              type="button"
              onClick={() => onSelect(document.id)}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "border-border focus-visible:ring-ring w-full border-b px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:-outline-offset-2",
                selected ? "bg-card" : "hover:bg-card/60",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">
                  {document.merchant ?? document.from_name ?? document.from_email}
                </span>
                {document.amount_cents !== null && document.currency ? (
                  <span className="shrink-0 text-sm tabular-nums">
                    {formatAmount(document.amount_cents, document.currency)}
                  </span>
                ) : (
                  <span className="text-muted-foreground shrink-0 text-xs">
                    montant absent
                  </span>
                )}
              </div>

              <p className="text-muted-foreground mt-0.5 truncate text-xs">
                {document.subject ?? "(sans objet)"}
              </p>

              <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span>{KIND_LABELS[document.kind]}</span>
                <span aria-hidden>·</span>
                <span>{formatDate(document.document_date ?? document.received_at)}</span>

                {/* Le rapprochement est le signal décisif : sans lui, valider
                    revient à envoyer une pièce sans savoir où elle atterrira. */}
                {matched ? (
                  <span className="inline-flex items-center gap-1">
                    <Paperclip className="size-3" aria-hidden />
                    rapprochée
                  </span>
                ) : (
                  <span className="text-danger-ink inline-flex items-center gap-1">
                    <Link2Off className="size-3" aria-hidden />
                    sans ligne
                  </span>
                )}

                {document.status !== "awaiting_validation" ? (
                  <span className="bg-muted rounded px-1.5 py-0.5">
                    {STATUS_LABELS[document.status]}
                  </span>
                ) : null}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}
