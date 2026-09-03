"use client";

import { useActionState, useEffect, useState } from "react";
import { Mail, MailCheck } from "lucide-react";
import { toast } from "sonner";

import {
  updateEngagementDelivery,
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
import { cn } from "@/lib/utils";
import {
  DEFAULT_REMINDER_TEMPLATE,
  DEFAULT_SEND_TEMPLATE,
  TEMPLATE_VARIABLES,
} from "@/lib/billing/templates";
import type { BillingEngagement } from "@/lib/billing/types";

/**
 * L'envoi automatique d'un devis : à qui, avec quel texte, à partir de quelle
 * facture modèle.
 *
 * Le bouton porte l'état du dispositif — une adresse renseignée, et il passe
 * en « activé ». C'est volontaire : l'interrupteur de l'automatisme est cette
 * adresse, et rien ne serait pire qu'un client relancé automatiquement sans
 * qu'on sache où c'était réglé.
 */
/* Les zones de texte n'ont pas de primitive dans `ui/` — trois usages dans
   tout le projet, tous stylés à la main comme ici, à l'image de l'Input. */
const FIELD =
  "border-input bg-surface focus-visible:border-ring focus-visible:ring-ring/20 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2";

export function DeliveryDialog({ engagement }: { engagement: BillingEngagement }) {
  const [open, setOpen] = useState(false);
  const enabled = Boolean(engagement.recipient_email);

  return (
    <>
      <Button
        type="button"
        variant={enabled ? "outline" : "ghost"}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {enabled ? <MailCheck aria-hidden /> : <Mail aria-hidden />}
        {enabled ? "Envoi automatique activé" : "Régler l'envoi automatique"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Envoi automatique — {engagement.client_name}</DialogTitle>
            <DialogDescription>
              Dès qu&apos;un mois de prestation est terminé, la facture se crée chez
              Airwallex et part au client avec son PDF. Puis relance à J+31,
              J+46 et J+61 tant qu&apos;elle n&apos;est pas payée — le règlement arrête
              tout.
            </DialogDescription>
          </DialogHeader>

          <DeliveryForm engagement={engagement} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeliveryForm({
  engagement,
  onDone,
}: {
  engagement: BillingEngagement;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    BillingActionResult | null,
    FormData
  >(updateEngagementDelivery, null);

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

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="engagementId" value={engagement.id} />

      <div className="grid gap-1">
        <Label htmlFor="envoi-destinataire">Email du destinataire</Label>
        <Input
          id="envoi-destinataire"
          name="recipientEmail"
          type="email"
          defaultValue={engagement.recipient_email ?? ""}
          placeholder="compta@bondet.fr"
        />
        <p className="type-caption text-text-tertiary">
          Vide : ce devis se facture à la main, rien ne part.
        </p>
      </div>

      <div className="grid gap-1">
        <Label htmlFor="envoi-cc">Copies (CC)</Label>
        <Input
          id="envoi-cc"
          name="ccEmails"
          defaultValue={(engagement.cc_emails ?? []).join(", ")}
          placeholder="direction@bondet.fr, assistante@bondet.fr"
        />
        <p className="type-caption text-text-tertiary">
          Séparées par des virgules. a.digiovanni.pro@gmail.com est toujours en
          copie cachée.
        </p>
      </div>

      <div className="grid gap-1">
        <Label htmlFor="envoi-prenom">Prénom du contact</Label>
        <Input
          id="envoi-prenom"
          name="contactFirstName"
          defaultValue={engagement.contact_first_name ?? ""}
          placeholder="Jean"
        />
      </div>

      <div className="grid gap-1">
        <Label htmlFor="envoi-modele">Facture modèle (Airwallex)</Label>
        <Input
          id="envoi-modele"
          name="templateInvoiceId"
          defaultValue={engagement.template_invoice_external_id ?? ""}
          placeholder="inv_sgpdwdhb5hl36cokjm3"
        />
        <p className="type-caption text-text-tertiary">
          L&apos;identifiant de la première facture, créée à la main : les suivantes
          en reprennent la forme, mentions légales comprises.
        </p>
      </div>

      <div className="grid gap-1 sm:col-span-2">
        <Label htmlFor="envoi-modele-envoi">Modèle du mail d&apos;envoi</Label>
        <textarea
          id="envoi-modele-envoi"
          name="sendTemplate"
          rows={9}
          className={cn(FIELD, "resize-y font-mono")}
          defaultValue={engagement.send_template ?? DEFAULT_SEND_TEMPLATE}
        />
      </div>

      <div className="grid gap-1 sm:col-span-2">
        <Label htmlFor="envoi-modele-relance">Modèle du mail de relance</Label>
        <textarea
          id="envoi-modele-relance"
          name="reminderTemplate"
          rows={9}
          className={cn(FIELD, "resize-y font-mono")}
          defaultValue={engagement.reminder_template ?? DEFAULT_REMINDER_TEMPLATE}
        />
      </div>

      <div className="type-caption bg-muted text-text-secondary rounded-md px-3 py-2 sm:col-span-2">
        <p className="mb-1">
          <strong>La première ligne est l&apos;objet du mail</strong>, le reste est le
          corps. Variables disponibles :
        </p>
        <ul className="grid gap-0.5">
          {Object.entries(TEMPLATE_VARIABLES).map(([name, explanation]) => (
            <li key={name}>
              <code>{name}</code> — {explanation}
            </li>
          ))}
        </ul>
      </div>

      <div className="sm:col-span-2">
        <Button type="submit" variant="accent" disabled={pending}>
          <PendingLabel pending={pending} busy="Enregistrement…">
            Enregistrer
          </PendingLabel>
        </Button>
      </div>
    </form>
  );
}
