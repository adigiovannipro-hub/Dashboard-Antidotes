"use client";

import { useActionState, useState } from "react";
import { Archive, Check, Link2Off, Send, Zap } from "lucide-react";

import { StatusPill, type StatusTone } from "@/components/ds/status-pill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  approveDocument,
  archiveDocument,
  setMerchantAutomation,
  toggleAutoForward,
  type ReceiptResult,
} from "@/app/actions/recus";
import { formatMoney } from "@/lib/finance/money";
import { STATUS_LABELS, type ReceiptDocument } from "@/lib/recus/types";
import { cn } from "@/lib/utils";

/**
 * Les reçus, réduits à ce qui demande un geste.
 *
 * Cet écran remplace une page entière — inbox à trois colonnes, filtres,
 * détail, historique. Le constat qui l'a fait disparaître : on ne vient jamais
 * « consulter ses reçus », on vient répondre à une question unique, « est-ce
 * que j'envoie cette pièce ? ». Tout le reste était du décor autour de deux
 * boutons.
 *
 * Une ligne par pièce, deux gestes, et la place qu'occupe un panneau parmi les
 * autres de la page Finance — à côté des dépenses qu'elles justifient, plutôt
 * qu'à un clic de distance.
 */

export type ReceiptRow = ReceiptDocument & {
  /** Le domaine de l'expéditeur est-il déjà approuvé pour l'auto-transfert ? */
  merchant_automated: boolean;
  sender_domain: string;
};

export function ReceiptsPanel({
  rows,
  autoForwardOpen,
  canDecide,
}: {
  rows: ReceiptRow[];
  autoForwardOpen: boolean;
  canDecide: boolean;
}) {
  const [autoState, toggleAuto, togglingAuto] = useActionState<
    ReceiptResult | null,
    FormData
  >(toggleAutoForward, null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="type-caption text-text-secondary">
          {rows.length === 0
            ? "Rien à traiter — les reçus arrivent par mail et se rangent seuls."
            : "Vérifiez la ligne, puis envoyez la pièce à Airwallex."}
        </p>

        {canDecide ? (
          <form action={toggleAuto}>
            <input
              type="hidden"
              name="enabled"
              value={autoForwardOpen ? "false" : "true"}
            />
            <button
              type="submit"
              disabled={togglingAuto}
              title={
                autoForwardOpen
                  ? "Refermer : toutes les pièces repasseront par vous"
                  : "Ouvrir : les fournisseurs approuvés partiront seuls"
              }
              className={cn(
                "type-caption inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors duration-(--motion-duration) ease-standard",
                autoForwardOpen
                  ? "bg-accent-subtle text-accent-ink font-medium"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              <Zap className="size-3.5" strokeWidth={1.75} aria-hidden />
              {autoForwardOpen ? "Envoi auto ouvert" : "Envoi auto fermé"}
            </button>
          </form>
        ) : null}
      </div>

      {autoState && !autoState.ok ? (
        <p className="type-caption text-danger-ink">{autoState.error}</p>
      ) : null}

      {rows.length > 0 ? (
        <ul className="divide-border-line divide-y">
          {rows.map((row) => (
            <ReceiptLine key={row.id} row={row} canDecide={canDecide} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ReceiptLine({ row, canDecide }: { row: ReceiptRow; canDecide: boolean }) {
  const [approveState, approve, approving] = useActionState<
    ReceiptResult | null,
    FormData
  >(approveDocument, null);
  const [archiveState, archive, archiving] = useActionState<
    ReceiptResult | null,
    FormData
  >(archiveDocument, null);
  const [ruleState, setRule, settingRule] = useActionState<
    ReceiptResult | null,
    FormData
  >(setMerchantAutomation, null);

  const busy = approving || archiving || settingRule;
  const error =
    (approveState && !approveState.ok && approveState.error) ||
    (archiveState && !archiveState.ok && archiveState.error) ||
    (ruleState && !ruleState.ok && ruleState.error) ||
    null;

  /* Une pièce déjà partie ne se renvoie pas : le circuit est à sens unique,
     et Gmail n'a pas de bouton « défaire ». Elle garde en revanche son bouton
     d'archivage — c'est exactement le cas du reçu qu'Airwallex n'a pas su
     ranger et qu'on accroche à la main chez eux. */
  const sendable = row.forwarded_at === null;
  const pending = row.status === "awaiting_validation";

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      {/* Pleine largeur au téléphone : la pastille d'état, qui ne se coupe
          pas, recouvrait la date quand elle partageait la ligne. */}
      <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
        <p className="type-label text-text-primary truncate">
          {row.merchant ?? row.subject ?? row.from_email}
        </p>
        <p className="type-caption text-text-secondary tabular-nums">
          {row.amount_cents !== null && row.currency
            ? formatMoney(row.amount_cents, row.currency)
            : "montant inconnu"}
          {row.document_date ? ` · ${formatDay(row.document_date)}` : ""}
        </p>
      </div>

      <div className="shrink-0">
        {pending ? (
          <MatchPill row={row} />
        ) : (
          <StatusPill tone={statusTone(row.status)}>
            {STATUS_LABELS[row.status]}
          </StatusPill>
        )}
      </div>

      {canDecide ? (
        <div className="flex items-center gap-1.5">
          {/* « Toujours » n'apparaît que là où il a un sens : un fournisseur
              pas encore approuvé. C'est le seul chemin restant pour accorder
              l'automatisme, l'écran qui le portait ayant disparu. */}
          {pending && !row.merchant_automated ? (
            <form action={setRule}>
              <input type="hidden" name="domain" value={row.sender_domain} />
              <input type="hidden" name="enabled" value="true" />
              <button
                type="submit"
                disabled={busy}
                title={`Envoyer sans demander, à l'avenir, pour ${row.sender_domain}`}
                className="type-caption text-text-secondary hover:text-text-primary focus-visible:ring-ring inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none"
              >
                <Check className="size-3.5" strokeWidth={1.75} aria-hidden />
                Toujours
              </button>
            </form>
          ) : null}

          <form action={archive}>
            <input type="hidden" name="documentId" value={row.id} />
            <button
              type="submit"
              disabled={busy}
              title={
                sendable
                  ? "Écarter cette pièce : elle ne partira pas"
                  : "Je m'en suis occupé à la main dans Airwallex"
              }
              className="type-caption text-text-secondary hover:text-text-primary focus-visible:ring-ring inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none"
            >
              <Archive className="size-3.5" strokeWidth={1.75} aria-hidden />
              {archiving ? "…" : "Archiver"}
            </button>
          </form>

          {sendable ? (
            <form action={approve}>
              <input type="hidden" name="documentId" value={row.id} />
              <button
                type="submit"
                disabled={busy}
                className="bg-primary text-primary-foreground focus-visible:ring-ring type-caption inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
              >
                <Send className="size-3.5" strokeWidth={1.75} aria-hidden />
                {approving ? "Envoi…" : "Envoyer"}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="type-caption text-danger-ink w-full">{error}</p>
      ) : null}
    </li>
  );
}

/**
 * L'historique des pièces parties, derrière une icône.
 *
 * Il vit dans une fenêtre et non dans la page : on ne le consulte qu'après
 * coup — « est-ce que ce reçu est bien parti ? » — et une liste de cinquante
 * lignes déjà réglées noierait les trois qui attendent une décision.
 */
export function ReceiptsArchive({ rows }: { rows: ReceiptDocument[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => setOpen(true)}
        title="Les pièces déjà envoyées à Airwallex"
      >
        <Archive className="size-4" strokeWidth={1.75} aria-hidden />
        <span className="sr-only">Voir les pièces envoyées</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Pièces envoyées</DialogTitle>
            <DialogDescription>
              Reçues par mail puis transférées à Airwallex, seules ou après
              votre accord.
            </DialogDescription>
          </DialogHeader>

          {rows.length === 0 ? (
            <p className="type-caption text-text-secondary">
              Aucune pièce n&apos;est encore partie.
            </p>
          ) : (
            <ul className="divide-border-line max-h-[60vh] divide-y overflow-y-auto">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="type-label text-text-primary truncate">
                      {row.merchant ?? row.subject ?? row.from_email}
                    </p>
                    <p className="type-caption text-text-secondary tabular-nums">
                      {row.amount_cents !== null && row.currency
                        ? formatMoney(row.amount_cents, row.currency)
                        : "montant inconnu"}
                      {row.forwarded_at
                        ? ` · envoyée le ${formatInstant(row.forwarded_at)}`
                        : ""}
                      {row.auto_decided ? " · auto" : ""}
                    </p>
                  </div>
                  <StatusPill tone={statusTone(row.status)}>
                    {archiveLabel(row)}
                  </StatusPill>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Le sort d'une pièce partie, dit sans mentir.
 *
 * Une pièce transférée puis archivée porte le statut `ignored`, faute d'en
 * avoir un à elle. « Ignoré » serait faux : elle est partie, et on l'a rangée
 * soi-même chez Airwallex. `forwarded_at` tranche, et il n'y a qu'ici que la
 * nuance se voit — la liste de travail ne montre jamais de pièce archivée.
 */
function archiveLabel(row: ReceiptDocument): string {
  if (row.status === "ignored") return "Archivé à la main";
  return STATUS_LABELS[row.status];
}

/* Le rapprochement est la seule information dont dépend la décision : une
   pièce sans ligne partira quand même, mais Airwallex devra la ranger seul. */
function MatchPill({ row }: { row: ReceiptRow }) {
  if (row.expense_id) {
    return <StatusPill tone="positive">Dépense trouvée</StatusPill>;
  }
  return (
    <StatusPill tone="warning">
      <Link2Off className="size-3" strokeWidth={1.75} aria-hidden />
      Sans ligne
    </StatusPill>
  );
}

function statusTone(status: ReceiptDocument["status"]): StatusTone {
  switch (status) {
    case "attached":
      return "positive";
    case "forwarded":
    case "queued":
      return "info";
    case "failed":
    case "unmatched":
      return "danger";
    default:
      return "neutral";
  }
}

const DAY = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

function formatDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? iso : DAY.format(date);
}

function formatInstant(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : DAY.format(date);
}
