"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  updateInstallment,
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
import { PendingLabel } from "@/components/ds/pending-label";
import { inputAmountValue, monthLabel, periodLabel } from "@/lib/billing/format";
import { ttcCentsOf } from "@/lib/billing/schedule";
import { formatMoney } from "@/lib/finance/money";
import { cn } from "@/lib/utils";

/**
 * Les trois cellules modifiables d'une échéance : période, montant HT,
 * montant TTC.
 *
 * Chacune est un bouton qui ouvre le **même** dialogue, focalisé sur le champ
 * qu'on vient de cliquer. Trois éditions en ligne indépendantes auraient
 * demandé trois mécanismes de sauvegarde, trois états d'attente et trois
 * façons d'échouer ; un seul formulaire montre en plus les trois valeurs
 * ensemble — et comme le TTC se déduit du HT, les voir côte à côte est
 * précisément ce qui évite de saisir l'un en croyant modifier l'autre.
 */

type Champ = "periode" | "ht" | "ttc";

export function InstallmentCells({
  installmentId,
  serviceMonth,
  amountCents,
  vatRate,
  currency,
  notes,
  canEdit,
}: {
  installmentId: string;
  serviceMonth: string;
  amountCents: number;
  vatRate: number;
  currency: string;
  notes: string | null;
  canEdit: boolean;
}) {
  const [champ, setChamp] = useState<Champ | null>(null);

  const periode = periodLabel(serviceMonth);
  const ttc = formatMoney(ttcCentsOf(amountCents, vatRate), currency);

  if (!canEdit) {
    return (
      <>
        <span className="type-caption bg-neutral-subtle text-neutral-ink inline-flex w-fit items-center rounded-pill px-2.5 py-0.5 font-medium whitespace-nowrap tabular-nums">
          {periode}
        </span>
        <span className="type-label text-text-primary text-left tabular-nums md:text-right">
          {ttc}
        </span>
      </>
    );
  }

  /* La convention de l'écran pour **tout ce qui s'édite d'un clic** : rien au
     repos — une bordure permanente ferait de chaque ligne un formulaire, et la
     page se lit d'abord — puis un liseré pointillé et un fond au survol. Le
     pointillé est posé en `outline` et non en `border` : il se dessine hors du
     flux, donc le chiffre ne bouge pas d'un pixel au passage de la souris.
     Au clavier, c'est l'anneau de focus de la maison qui prend le relais. */
  const cellule = cn(
    "cursor-pointer rounded-sm outline-1 outline-offset-2 outline-dashed outline-transparent",
    "transition-colors duration-(--motion-duration) ease-standard",
    "hover:bg-muted hover:outline-border-strong",
    "focus-visible:bg-muted focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setChamp("periode")}
        aria-label={`Modifier la période de ${monthLabel(serviceMonth)}`}
        className={cn(
          cellule,
          "type-caption bg-neutral-subtle text-neutral-ink inline-flex w-fit items-center rounded-pill px-2.5 py-0.5 font-medium whitespace-nowrap tabular-nums hover:bg-neutral-subtle/70",
        )}
      >
        {periode}
      </button>

      {/* Un seul montant à l'écran — le TTC, celui que la facture portera.
          Le dialogue garde ses deux champs couplés pour le jour où la TVA
          reviendrait ; « ht » n'est simplement plus un point d'entrée. */}
      <button
        type="button"
        onClick={() => setChamp("ttc")}
        aria-label={`Modifier le montant de ${monthLabel(serviceMonth)}`}
        className={cn(
          cellule,
          "type-label text-text-primary px-1 text-left tabular-nums md:text-right",
        )}
      >
        {ttc}
      </button>

      <Dialog open={champ !== null} onOpenChange={(ouvert) => !ouvert && setChamp(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Échéance de {monthLabel(serviceMonth)}</DialogTitle>
            <DialogDescription>
              Période, montant : cette ligne seule change, les autres mois du
              devis restent tels quels.
            </DialogDescription>
          </DialogHeader>

          {champ ? (
            <EditForm
              installmentId={installmentId}
              serviceMonth={serviceMonth}
              amountCents={amountCents}
              vatRate={vatRate}
              notes={notes}
              focus={champ}
              onDone={() => setChamp(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditForm({
  installmentId,
  serviceMonth,
  amountCents,
  vatRate,
  notes,
  focus,
  onDone,
}: {
  installmentId: string;
  serviceMonth: string;
  amountCents: number;
  vatRate: number;
  notes: string | null;
  focus: Champ;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    BillingActionResult | null,
    FormData
  >(updateInstallment, null);

  const [ht, setHt] = useState(() => inputAmountValue(amountCents));
  const [ttc, setTtc] = useState(() => inputAmountValue(ttcCentsOf(amountCents, vatRate)));

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

  const parse = (valeur: string): number | null => {
    const nombre = Number(valeur.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(nombre) ? nombre : null;
  };

  /* Les deux montants restent d'accord : saisir l'un recalcule l'autre. Seul
     le hors-taxe part au serveur — c'est lui que la base stocke, et deux
     valeurs envoyées pour une seule vérité finissent toujours par diverger. */
  const onHt = (valeur: string) => {
    setHt(valeur);
    const nombre = parse(valeur);
    if (nombre !== null) setTtc(inputAmountValue(ttcCentsOf(Math.round(nombre * 100), vatRate)));
  };
  const onTtc = (valeur: string) => {
    setTtc(valeur);
    const nombre = parse(valeur);
    if (nombre !== null) {
      setHt(inputAmountValue(Math.round((nombre * 100 * 100) / (100 + vatRate))));
    }
  };

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="installmentId" value={installmentId} />

      <div className="grid gap-1">
        <Label htmlFor={`edit-mois-${installmentId}`}>Mois de prestation</Label>
        <Input
          id={`edit-mois-${installmentId}`}
          name="serviceMonth"
          type="month"
          required
          autoFocus={focus === "periode"}
          defaultValue={serviceMonth.slice(0, 7)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1">
          <Label htmlFor={`edit-ht-${installmentId}`}>Montant HT</Label>
          <Input
            id={`edit-ht-${installmentId}`}
            name="amount"
            inputMode="decimal"
            required
            autoFocus={focus === "ht"}
            value={ht}
            onChange={(event) => onHt(event.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`edit-ttc-${installmentId}`}>
            Montant TTC{vatRate > 0 ? ` (${vatRate} %)` : ""}
          </Label>
          <Input
            id={`edit-ttc-${installmentId}`}
            inputMode="decimal"
            autoFocus={focus === "ttc"}
            value={ttc}
            onChange={(event) => onTtc(event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-1">
        <Label htmlFor={`edit-note-${installmentId}`}>Note</Label>
        <Input
          id={`edit-note-${installmentId}`}
          name="notes"
          placeholder="Mois offert, rallonge…"
          defaultValue={notes ?? ""}
        />
      </div>

      <Button type="submit" disabled={pending}>
        <PendingLabel pending={pending} busy="Enregistrement…">
          Enregistrer
        </PendingLabel>
      </Button>
    </form>
  );
}
