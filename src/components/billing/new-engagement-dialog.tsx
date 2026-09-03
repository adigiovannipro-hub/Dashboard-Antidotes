"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import {
  createEngagement,
  type BillingActionResult,
} from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PendingLabel } from "@/components/ds/pending-label";
import { formatMoney } from "@/lib/finance/money";
import { monthsBetween, splitTotal, ttcCentsOf } from "@/lib/billing/schedule";
import {
  DEFAULT_REMINDER_1_TEMPLATE,
  DEFAULT_REMINDER_2_TEMPLATE,
  DEFAULT_REMINDER_3_TEMPLATE,
  DEFAULT_REMINDER_SUBJECT,
  DEFAULT_SEND_SUBJECT,
  DEFAULT_SEND_TEMPLATE,
  TEMPLATE_VARIABLES,
} from "@/lib/billing/templates";

/* Même style que l'Input : les zones de texte n'ont pas de primitive dans
   `ui/`, elles se stylent à la main dans les trois écrans qui en portent. */
const TEMPLATE_FIELD =
  "border-input bg-surface focus-visible:border-ring focus-visible:ring-ring/20 w-full resize-y rounded-md border px-3 py-2 font-mono text-sm outline-none focus-visible:ring-2";

/* Antidotes facture sans TVA aujourd'hui — le 0 est le défaut, les taux
   français restent à portée de main pour le jour où ça change. */
const VAT_RATES: { value: string; label: string }[] = [
  { value: "0", label: "Sans TVA (0 %)" },
  { value: "5.5", label: "5,5 %" },
  { value: "10", label: "10 %" },
  { value: "20", label: "20 %" },
];

/**
 * La saisie d'un devis signé — le seul point d'entrée du module.
 *
 * On donne la période et l'un des deux montants : le total se divise, le
 * mensuel se multiplie. L'aperçu dit ce qui va être généré avant de valider —
 * « 12 mensualités de 2 102,50 € HT » — parce qu'un devis mal découpé se
 * corrige mieux avant qu'après.
 */
export function NewEngagementDialog({ knownClients }: { knownClients: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="accent" size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Ajouter un devis
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau devis signé</DialogTitle>
            <DialogDescription>
              Une saisie unique : les mensualités se génèrent, puis avancent
              toutes seules au fil de la facturation.
            </DialogDescription>
          </DialogHeader>

          <NewEngagementForm
            knownClients={knownClients}
            onDone={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function NewEngagementForm({
  knownClients,
  onDone,
}: {
  knownClients: string[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    BillingActionResult | null,
    FormData
  >(createEngagement, null);

  const [firstMonth, setFirstMonth] = useState("");
  const [lastMonth, setLastMonth] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [vatRate, setVatRate] = useState("0");

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message);
      onDone();
    } else {
      toast.error(state.error);
    }
    // `onDone` referme le dialogue : le rejouer à chaque rendu le refermerait
    // pendant la saisie suivante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const preview = useMemo(
    () =>
      buildPreview({ firstMonth, lastMonth, totalAmount, monthlyAmount, vatRate }),
    [firstMonth, lastMonth, totalAmount, monthlyAmount, vatRate],
  );

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-1">
        <Label htmlFor="devis-client">Client</Label>
        <Input
          id="devis-client"
          name="clientName"
          required
          list="devis-clients-connus"
          placeholder="Bondet"
        />
        {/* Les noms déjà vus sur les factures Airwallex : saisir à
            l'identique, c'est brancher le rapprochement du premier coup. */}
        <datalist id="devis-clients-connus">
          {knownClients.map((client) => (
            <option key={client} value={client} />
          ))}
        </datalist>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="devis-label">Projet</Label>
        <Input
          id="devis-label"
          name="label"
          required
          placeholder="Accompagnement social media 2026"
        />
      </div>

      <div className="grid gap-1">
        <Label htmlFor="devis-first">Premier mois</Label>
        <Input
          id="devis-first"
          name="firstMonth"
          type="month"
          required
          value={firstMonth}
          onChange={(event) => setFirstMonth(event.target.value)}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="devis-last">Dernier mois</Label>
        <Input
          id="devis-last"
          name="lastMonth"
          type="month"
          required
          value={lastMonth}
          onChange={(event) => setLastMonth(event.target.value)}
        />
      </div>

      <div className="grid gap-1">
        <Label htmlFor="devis-total">Total du devis (€ HT)</Label>
        <Input
          id="devis-total"
          name="totalAmount"
          inputMode="decimal"
          placeholder="25 230"
          value={totalAmount}
          onChange={(event) => setTotalAmount(event.target.value)}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="devis-monthly">ou Mensuel (€ HT)</Label>
        <Input
          id="devis-monthly"
          name="monthlyAmount"
          inputMode="decimal"
          placeholder="2 102,50"
          value={monthlyAmount}
          onChange={(event) => setMonthlyAmount(event.target.value)}
        />
      </div>

      <div className="grid gap-1">
        <Label htmlFor="devis-tva">TVA</Label>
        <Select name="vatRate" value={vatRate} onValueChange={(value) => setVatRate(value ?? "0")}>
          <SelectTrigger id="devis-tva" className="w-full">
            <SelectValue>
              {(value: string) =>
                VAT_RATES.find((rate) => rate.value === value)?.label ?? "Sans TVA (0 %)"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {VAT_RATES.map((rate) => (
              <SelectItem key={rate.value} value={rate.value}>
                {rate.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="devis-notes">Note</Label>
        <Input id="devis-notes" name="notes" placeholder="Facultatif" />
      </div>

      {/* L'envoi automatique, replié : un devis se saisit d'abord, et la
          plupart n'ont rien à changer aux modèles communs. Ce qui est dedans
          reste soumis avec le formulaire, ouvert ou non. */}
      <details className="border-border rounded-md border sm:col-span-2">
        <summary className="type-label cursor-pointer px-3 py-2">
          Envoi automatique au client
          <span className="type-caption text-text-tertiary ml-2 font-normal">
            facultatif — sans adresse, la facture se fait à la main
          </span>
        </summary>

        <div className="grid gap-3 px-3 pb-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <Label htmlFor="devis-destinataire">Email du destinataire</Label>
            <Input
              id="devis-destinataire"
              name="recipientEmail"
              type="email"
              placeholder="compta@bondet.fr"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="devis-cc">Copies (CC)</Label>
            <Input
              id="devis-cc"
              name="ccEmails"
              placeholder="direction@bondet.fr, assistante@bondet.fr"
            />
          </div>

          <div className="grid gap-1">
            <Label htmlFor="devis-prenom">Prénom du contact</Label>
            <Input id="devis-prenom" name="contactFirstName" placeholder="Jean" />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="devis-modele">Facture modèle (Airwallex)</Label>
            <Input
              id="devis-modele"
              name="templateInvoiceId"
              placeholder="inv_sgpdwdhb5hl36cokjm3"
            />
          </div>

          <div className="grid gap-1 sm:col-span-2">
            <Label htmlFor="devis-objet-envoi">Objet du mail d&apos;envoi</Label>
            <Input
              id="devis-objet-envoi"
              name="sendSubject"
              defaultValue={DEFAULT_SEND_SUBJECT}
            />
          </div>
          <div className="grid gap-1 sm:col-span-2">
            <Label htmlFor="devis-modele-envoi">Message d&apos;envoi</Label>
            <textarea
              id="devis-modele-envoi"
              name="sendTemplate"
              rows={8}
              className={TEMPLATE_FIELD}
              defaultValue={DEFAULT_SEND_TEMPLATE}
            />
          </div>

          <div className="grid gap-1 sm:col-span-2">
            <Label htmlFor="devis-objet-relance">Objet des relances</Label>
            <Input
              id="devis-objet-relance"
              name="reminderSubject"
              defaultValue={DEFAULT_REMINDER_SUBJECT}
            />
          </div>
          {/* Trois textes : une relance qui répète la précédente mot pour mot
              se lit comme un automate. */}
          <div className="grid gap-1 sm:col-span-2">
            <Label htmlFor="devis-relance-1">1re relance — J+31</Label>
            <textarea
              id="devis-relance-1"
              name="reminder1Template"
              rows={7}
              className={TEMPLATE_FIELD}
              defaultValue={DEFAULT_REMINDER_1_TEMPLATE}
            />
          </div>
          <div className="grid gap-1 sm:col-span-2">
            <Label htmlFor="devis-relance-2">2e relance — J+46</Label>
            <textarea
              id="devis-relance-2"
              name="reminder2Template"
              rows={7}
              className={TEMPLATE_FIELD}
              defaultValue={DEFAULT_REMINDER_2_TEMPLATE}
            />
          </div>
          <div className="grid gap-1 sm:col-span-2">
            <Label htmlFor="devis-relance-3">3e relance — J+61</Label>
            <textarea
              id="devis-relance-3"
              name="reminder3Template"
              rows={7}
              className={TEMPLATE_FIELD}
              defaultValue={DEFAULT_REMINDER_3_TEMPLATE}
            />
          </div>

          <p className="type-caption text-text-secondary sm:col-span-2">
            Variables : {Object.keys(TEMPLATE_VARIABLES).join(", ")}. Copie
            cachée systématique vers a.digiovanni.pro@gmail.com. Relances à
            J+31, J+46 et J+61 tant que la facture n&apos;est pas payée. Tout se
            retouche ensuite depuis la fiche du devis.
          </p>
        </div>
      </details>

      {/* L'aperçu de la division — ce que « Créer » va générer. */}
      <p
        className="type-caption bg-muted text-text-secondary rounded-md px-3 py-2 sm:col-span-2"
        aria-live="polite"
      >
        {preview}
      </p>

      <div className="sm:col-span-2">
        <Button type="submit" variant="accent" disabled={pending}>
          <PendingLabel pending={pending} busy="Création…">
            Créer le devis et ses mensualités
          </PendingLabel>
        </Button>
      </div>
    </form>
  );
}

function parseAmount(value: string): number | null {
  if (!value.trim()) return null;
  const amount = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function buildPreview(fields: {
  firstMonth: string;
  lastMonth: string;
  totalAmount: string;
  monthlyAmount: string;
  vatRate: string;
}): string {
  if (!fields.firstMonth || !fields.lastMonth) {
    return "Choisir la période : chaque mois de prestation devient une mensualité, facturée le 1er du mois suivant.";
  }
  const first = `${fields.firstMonth}-01`;
  const last = `${fields.lastMonth}-01`;
  if (last < first) return "La période est inversée : le dernier mois précède le premier.";

  const count = monthsBetween(first, last);
  if (count > 60) return "Plus de cinq ans : erreur de saisie probable.";

  const total = parseAmount(fields.totalAmount);
  const monthly = parseAmount(fields.monthlyAmount);
  if (!total && !monthly) {
    return `${count} mensualité${count > 1 ? "s" : ""} — saisir le total du devis ou le mensuel.`;
  }

  const vat = Number(fields.vatRate.replace(",", ".")) || 0;
  const totalCents = total ? Math.round(total * 100) : Math.round(monthly! * 100) * count;
  const parts = splitTotal(totalCents, count);
  const firstPart = parts[0]!;
  const lastPart = parts[parts.length - 1]!;
  const even = firstPart === lastPart;

  const monthlyText = even
    ? `${count} mensualité${count > 1 ? "s" : ""} de ${formatMoney(firstPart, "EUR")} HT`
    : `${count} mensualités de ${formatMoney(firstPart, "EUR")} à ${formatMoney(lastPart, "EUR")} HT`;

  const ttcText =
    vat > 0
      ? `${formatMoney(ttcCentsOf(firstPart, vat), "EUR")} TTC/mois, `
      : "sans TVA, ";

  return `${monthlyText} — ${ttcText}${formatMoney(totalCents, "EUR")} HT au total. Ajustable mois par mois ensuite.`;
}
