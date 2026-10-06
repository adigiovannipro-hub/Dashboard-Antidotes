import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { StatusPill, type StatusTone } from "@/components/ds/status-pill";
import { SortHead } from "@/components/billing/group-sort";
import {
  DeleteInstallmentButton,
  InstallmentAction,
} from "@/components/billing/installment-action";
import { InstallmentCells } from "@/components/billing/installment-cells";
import { dayLabel } from "@/lib/billing/format";
import { deliveryTrack, type DeliveryTrack } from "@/lib/billing/delivery";
import { isLate, isPaymentOverdue } from "@/lib/billing/schedule";
import { isOverdue } from "@/lib/finance/invoices";
import type { UnmatchedInvoice } from "@/lib/billing/queries";
import {
  EMAIL_KIND_LABELS,
  LATE_LABEL,
  STAGE_LABELS,
  type BillingEmailKind,
  type BillingInstallment,
  type InstallmentStage,
} from "@/lib/billing/types";
import { formatMoney } from "@/lib/finance/money";

/**
 * Une échéance, dans n'importe quel groupe de l'écran : son état, qui, quel
 * mois, combien HT, combien TTC — et le filet d'actions manuelles quand le
 * rapprochement Airwallex ne peut pas trancher seul.
 *
 * L'état ouvre la ligne, à gauche du nom : c'est la première chose qu'on
 * cherche en parcourant une colonne, et la chercher à droite obligeait à
 * traverser le libellé à chaque ligne.
 *
 * Au téléphone, la ligne se replie en trois niveaux : l'état et le client,
 * puis la période et les montants, puis les actions.
 */

/** Une échéance aplatie avec son devis — ce que la page assemble. */
export type InstallmentLine = BillingInstallment & {
  client: string;
  project: string;
  /** Ce qui est parti chez le client pour cette mensualité, dans l'ordre. */
  emails?: { kind: BillingEmailKind; sent_at: string }[];
  /** Le devis porte une adresse : l'automate envoie et relance. Sans elle,
      plus rien ne part — même une facture déjà relancée une fois. */
  autoSend?: boolean;
};

/**
 * Ce que le mail dit de cette ligne, en une phrase : quand la facture est
 * partie, la dernière relance, et — tant qu'elle attend son règlement — la
 * prochaine. Sans cette mention, un client relancé trois fois et un client
 * jamais contacté auraient exactement la même ligne à l'écran.
 */
function deliveryNote(
  line: InstallmentLine,
  stage: InstallmentStage,
  track: DeliveryTrack | null,
  now: Date,
): string | null {
  if (line.last_send_error) return `envoi bloqué — ${line.last_send_error}`;

  if (!track) {
    /* Émise sans passer par l'envoi automatique — reprise de Monday, ou
       facturée à la main : rien ne la relancera, et il faut le savoir. */
    return stage === "invoiced" ? "hors envoi automatique · pas de relance" : null;
  }

  /* La dernière chose partie, puis la suivante : c'est ce qu'on vient lire.
     La date d'envoi initial s'efface dès la première relance — elle reste
     dans l'infobulle de la première coche. */
  const parts = [
    track.lastReminder?.sentAt
      ? `relancée le ${dayLabel(track.lastReminder.sentAt.slice(0, 10))}`
      : `envoyée le ${dayLabel(track.steps[0]!.sentAt!.slice(0, 10))}`,
  ];
  if (stage === "invoiced" && line.autoSend !== false) {
    if (!track.next) {
      parts.push("plus de relance automatique");
    } else if (track.next.dueOn === now.toISOString().slice(0, 10)) {
      parts.push("relance prévue aujourd'hui");
    } else {
      parts.push(`relance prévue le ${dayLabel(track.next.dueOn)}`);
    }
  }
  return parts.join(" · ");
}

/** Le libellé d'une coche, pour l'infobulle : ce qui est parti, ou quand. */
function stepTitle(step: DeliveryTrack["steps"][number]): string {
  const name = step.kind === "invoice" ? "Facture" : EMAIL_KIND_LABELS[step.kind];
  if (step.sentAt) {
    return `${name} envoyée le ${dayLabel(step.sentAt.slice(0, 10))}`;
  }
  return step.dueOn ? `${name} prévue le ${dayLabel(step.dueOn)}` : name;
}

/**
 * Les quatre coches : l'envoi, puis les trois relances — grises tant
 * qu'elles ne sont pas parties, bleues ensuite. Une facture émise hors de
 * l'envoi automatique n'en a pas : quatre coches grises y diraient « jamais
 * envoyée », ce qui est faux.
 */
function DeliveryChecks({ track }: { track: DeliveryTrack | null }) {
  if (!track) {
    return (
      <span
        className="type-caption text-text-secondary hidden md:inline"
        title="Hors envoi automatique : aucune relance ne part"
      >
        —
      </span>
    );
  }

  const done = track.steps.filter((step) => step.sentAt !== null).length;
  return (
    <span
      role="img"
      aria-label={`${done} envoi${done > 1 ? "s" : ""} sur 4 — ${track.steps.map(stepTitle).join(", ")}`}
      className="inline-flex w-fit items-center gap-0.5"
    >
      {track.steps.map((step) => (
        <span key={step.kind} title={stepTitle(step)} className="inline-flex">
          <Check
            aria-hidden
            strokeWidth={2.5}
            className={cn(
              "size-3.5",
              step.sentAt ? "text-info" : "text-text-tertiary",
            )}
          />
        </span>
      ))}
    </span>
  );
}

/**
 * Une rangée du board : une mensualité de devis, ou une facture Airwallex
 * qui n'en a pas trouvé — les deux cohabitent dans les mêmes groupes, parce
 * que l'écran montre la facturation réelle, pas seulement la planifiée.
 */
export type BoardRow =
  | { kind: "installment"; line: InstallmentLine }
  | { kind: "invoice"; invoice: UnmatchedInvoice };

/** Gabarit partagé par l'en-tête et les lignes. */
/* Cinq colonnes — la colonne HT est partie : Antidotes facture sans TVA,
   HT et TTC affichaient le même chiffre deux fois, et l'œil devait choisir. */
export const INSTALLMENT_GRID =
  "md:grid md:grid-cols-[8.5rem_minmax(0,1.4fr)_8.5rem_8rem_minmax(9rem,auto)] md:items-center md:gap-x-4";

/* Le groupe « Facturée » gagne une colonne entre l'état et le client : les
   coches d'envoi et de relance. L'état garde ses 8,5 rem — l'œil descend
   toujours la même colonne d'étiquettes d'un groupe à l'autre. */
export const INSTALLMENT_GRID_TRACKED =
  "md:grid md:grid-cols-[8.5rem_4rem_minmax(0,1.4fr)_8.5rem_8rem_minmax(9rem,auto)] md:items-center md:gap-x-4";

export function gridFor(tracked: boolean): string {
  return tracked ? INSTALLMENT_GRID_TRACKED : INSTALLMENT_GRID;
}

/* Les trois colonnes qui portent une valeur comparable se trient au clic ;
   l'état et les actions n'en sont pas. Le tri est local au groupe — d'où le
   paramètre d'URL passé de haut en bas plutôt que déduit ici. Sans lui, les
   en-têtes restent du texte : seule une page qui applique le tri a le droit
   de le proposer. */
export function InstallmentsHeader({
  sortParam,
  tracked = false,
}: {
  sortParam?: string;
  tracked?: boolean;
}) {
  return (
    <div
      className={cn(
        "type-overline hidden border-b border-border bg-surface-sunken px-5 py-1.5 text-text-secondary",
        gridFor(tracked),
      )}
    >
      <span>Statut</span>
      {tracked ? <span>Envois</span> : null}
      {sortParam ? (
        <>
          <SortHead
            param={sortParam}
            field="client"
            label="Client · Projet"
            announce="client"
          />
          <SortHead param={sortParam} field="periode" label="Période" />
          <span className="text-right">
            <SortHead param={sortParam} field="montant" label="Montant" align="right" />
          </span>
        </>
      ) : (
        <>
          <span>Client · Projet</span>
          <span>Période</span>
          <span className="text-right">Montant</span>
        </>
      )}
      <span>
        <span className="sr-only">Actions</span>
      </span>
    </div>
  );
}

/**
 * Le ton d'un état, identique à celui du dashboard Finance : tout l'en-cours
 * non réglé est orange, l'encaissé vert, le planifié bleu, le retard rouge.
 */
export const STAGE_TONES: Record<InstallmentStage, StatusTone> = {
  confirmed: "info",
  to_invoice: "warning",
  invoiced: "warning",
  paid: "positive",
  skipped: "neutral",
};

/** « Facturée » se dit « Envoyée » sur une ligne : le groupe porte déjà le
    statut, la pastille dit ce qui s'est passé — la facture est partie.
    Exporté parce que le détail d'un devis affiche les mêmes lignes : deux
    noms pour un seul état donneraient deux vérités. */
export const ROW_LABELS: Record<InstallmentStage, string> = {
  ...STAGE_LABELS,
  invoiced: "Envoyée",
};

export function InstallmentRow({
  line,
  stage,
  canDecide,
  tracked = false,
}: {
  line: InstallmentLine;
  stage: InstallmentStage;
  canDecide: boolean;
  /** Afficher la colonne des coches — le groupe « Facturée » seulement. */
  tracked?: boolean;
}) {
  const now = new Date();
  const late = stage === "to_invoice" && isLate(line);
  const overdue = isPaymentOverdue(line);
  const enRetard = late || overdue;
  const track = deliveryTrack(line.emails ?? [], now);
  const delivery = deliveryNote(line, stage, track, now);

  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3", gridFor(tracked))}
    >
      <StatusPill tone={enRetard ? "danger" : STAGE_TONES[stage]} className="w-fit">
        {enRetard ? LATE_LABEL : ROW_LABELS[stage]}
      </StatusPill>

      {tracked ? <DeliveryChecks track={track} /> : null}

      {/* Le nom prend sa propre ligne au téléphone : coincé dans le rang
          flex, il se faisait tronquer jusqu'à « Bon… ». */}
      <div className="min-w-0 basis-full md:basis-auto">
        <p className="type-label text-text-primary truncate">{line.client}</p>
        <p className="type-caption text-text-secondary truncate">
          {line.project}
          {overdue && line.invoice_due_on
            ? ` · échéance dépassée le ${dayLabel(line.invoice_due_on)}`
            : ""}
          {line.notes ? ` · ${line.notes}` : ""}
        </p>
        {/* Pas de troncature : « relance prévue le … » est la moitié qu'on
            vient chercher, et c'est elle qui tombait sous les points. */}
        {delivery ? (
          <p
            className={cn(
              "type-caption",
              line.last_send_error ? "text-danger-ink" : "text-text-secondary",
            )}
          >
            {delivery}
          </p>
        ) : null}
      </div>

      <InstallmentCells
        installmentId={line.id}
        serviceMonth={line.service_month}
        amountCents={line.amount_cents}
        vatRate={line.vat_rate}
        currency={line.currency}
        notes={line.notes}
        canEdit={canDecide}
      />

      {canDecide ? (
        <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
          <RowActions line={line} stage={stage} />
        </div>
      ) : (
        <span />
      )}
    </div>
  );
}

/**
 * Une facture Airwallex sans devis, dans les mêmes colonnes. Aucune action :
 * son statut EST celui d'Airwallex, la synchronisation Airwallex le tient à
 * jour — et le jour où un devis correspondant est saisi, le rapprochement la
 * déplacera sur sa mensualité.
 *
 * Le montant est le total de la facture, sans détail de taxe : il s'affiche
 * tel quel dans les deux colonnes — exact tant que la facturation se fait
 * sans TVA, et de toute façon la seule valeur connue.
 */
export function InvoiceRow({
  invoice,
  stage,
  tracked = false,
}: {
  invoice: UnmatchedInvoice;
  stage: InstallmentStage;
  tracked?: boolean;
}) {
  const overdue = stage === "invoiced" && isOverdue(invoice);
  const chip =
    stage === "invoiced"
      ? invoice.issued_on
        ? `émise le ${dayLabel(invoice.issued_on)}`
        : "émise"
      : invoice.paid_at
        ? `payée le ${dayLabel(invoice.paid_at.slice(0, 10))}`
        : "payée";

  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3", gridFor(tracked))}
    >
      <StatusPill tone={overdue ? "danger" : STAGE_TONES[stage]} className="w-fit">
        {overdue ? LATE_LABEL : ROW_LABELS[stage]}
      </StatusPill>

      {/* Une facture sans devis est partie à la main : pas de coches. */}
      {tracked ? <DeliveryChecks track={null} /> : null}

      <div className="min-w-0 basis-full md:basis-auto">
        <p className="type-label text-text-primary truncate">{invoice.client_name}</p>
        <p className="type-caption text-text-secondary truncate">
          Facture hors devis
          {overdue && invoice.due_on ? ` · échéance dépassée le ${dayLabel(invoice.due_on)}` : ""}
        </p>
      </div>

      <span className="type-caption bg-neutral-subtle text-neutral-ink inline-flex w-fit items-center rounded-pill px-2.5 py-0.5 font-medium whitespace-nowrap tabular-nums">
        {chip}
      </span>

      <span className="type-label text-text-primary text-left tabular-nums md:text-right">
        {formatMoney(invoice.amount_cents, invoice.currency)}
      </span>

      <span />
    </div>
  );
}

/**
 * Le filet manuel, calibré par groupe : chaque étape n'offre que les gestes
 * qui ont un sens depuis elle. En temps normal, personne ne clique — le
 * rapprochement Airwallex fait avancer les lignes tout seul.
 */
function RowActions({ line, stage }: { line: InstallmentLine; stage: InstallmentStage }) {
  switch (stage) {
    case "confirmed":
      /* « Passer » n'a plus sa place ici : un mois planifié qui ne doit pas
         exister se supprime — la trace d'un mois offert se pose au moment de
         facturer, pas des mois à l'avance. */
      return <DeleteInstallmentButton installmentId={line.id} />;
    case "to_invoice":
      return (
        <>
          <InstallmentAction installmentId={line.id} status="issued">
            Facturée
          </InstallmentAction>
          <InstallmentAction installmentId={line.id} status="skipped" variant="ghost">
            Passer
          </InstallmentAction>
        </>
      );
    case "invoiced":
      return (
        <>
          <InstallmentAction installmentId={line.id} status="paid" icon="check">
            Payée
          </InstallmentAction>
          <InstallmentAction installmentId={line.id} status="pending" variant="ghost">
            Rouvrir
          </InstallmentAction>
        </>
      );
    case "paid":
      /* « Pas encaissée » plutôt que « Rouvrir » : le cas réel est une ligne
         dite payée que la banque contredit. Elle redescend d'un cran, garde
         sa facture — donc son échéance de règlement — et repasse « En
         retard » toute seule si le délai est dépassé. « Rouvrir » la
         remonterait jusqu'à « à facturer », ce qui nierait une facture bel
         et bien partie. */
      return (
        <>
          <InstallmentAction installmentId={line.id} status="issued" variant="outline">
            Pas encaissée
          </InstallmentAction>
          <InstallmentAction installmentId={line.id} status="pending" variant="ghost">
            Rouvrir
          </InstallmentAction>
        </>
      );
    case "skipped":
      return (
        <InstallmentAction installmentId={line.id} status="pending" variant="ghost">
          Rétablir
        </InstallmentAction>
      );
  }
}
