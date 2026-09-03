"use client";

import { useActionState, useEffect, useState } from "react";
import { Mail, MailCheck, X } from "lucide-react";
import { toast } from "sonner";

import {
  updateEngagementDelivery,
  type BillingActionResult,
} from "@/app/actions/billing";
import { BodyPortal } from "@/components/planning/body-portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PendingLabel } from "@/components/ds/pending-label";
import { StatusPill } from "@/components/ds/status-pill";
import { cn } from "@/lib/utils";
import {
  DEFAULT_REMINDER_SUBJECT,
  DEFAULT_REMINDER_TEMPLATE,
  DEFAULT_SEND_SUBJECT,
  DEFAULT_SEND_TEMPLATE,
  TEMPLATE_VARIABLES,
} from "@/lib/billing/templates";
import type { BillingEngagement } from "@/lib/billing/types";

/**
 * Le réglage de l'envoi automatique d'un devis, en panneau latéral.
 *
 * Panneau et non boîte de dialogue : il y a ici deux mails entiers à relire,
 * et une modale centrée les écrasait sur six lignes de haut avec des zones de
 * texte qu'on faisait défiler à l'aveugle. Un panneau pleine hauteur montre
 * l'objet et le corps d'un seul tenant — c'est ce que le client recevra.
 * Même vocabulaire que le panneau d'une publication du Planning.
 *
 * Le voile ne referme pas au clic, seuls la croix et Échap le font : on y
 * rédige, et perdre trente lignes de modèle sur un clic mal placé serait
 * impardonnable.
 *
 * Le bouton qui l'ouvre porte l'état du dispositif — une adresse renseignée,
 * et il passe en « activé ». C'est volontaire : l'interrupteur de
 * l'automatisme est cette adresse, et rien ne serait pire qu'un client relancé
 * automatiquement sans qu'on sache où c'était réglé.
 */
export function DeliveryPanelTrigger({
  engagement,
}: {
  engagement: BillingEngagement;
}) {
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

      {open ? (
        <DeliveryPanel engagement={engagement} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function DeliveryPanel({
  engagement,
  onClose,
}: {
  engagement: BillingEngagement;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    BillingActionResult | null,
    FormData
  >(updateEngagementDelivery, null);

  /* Le champ pilote l'aperçu de l'en-tête : on veut voir « activé » ou
     « désactivé » bouger pendant la saisie, pas après l'enregistrement. */
  const [recipient, setRecipient] = useState(engagement.recipient_email ?? "");
  const enabled = recipient.trim() !== "";

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message);
      onClose();
    } else {
      toast.error(state.error);
    }
    // `onClose` referme le panneau : le rejouer à chaque rendu le refermerait
    // pendant la saisie suivante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <BodyPortal>
      {/* Le voile assombrit sans refermer — voir l'en-tête du fichier. */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" aria-hidden />

      <aside
        aria-label={`Envoi automatique de ${engagement.client_name}`}
        className="border-border bg-background animate-in slide-in-from-right fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l shadow-2xl duration-300 motion-reduce:animate-none"
      >
        <header className="border-border flex items-start justify-between gap-4 border-b px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="type-h3 truncate">{engagement.client_name}</h2>
              <StatusPill tone={enabled ? "positive" : "neutral"}>
                {enabled ? "Envoi automatique" : "Facturation à la main"}
              </StatusPill>
            </div>
            <p className="type-caption text-text-secondary mt-1">
              {engagement.label}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose}>
            <X aria-hidden />
            <span className="sr-only">Fermer</span>
          </Button>
        </header>

        <form
          action={formAction}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          <input type="hidden" name="engagementId" value={engagement.id} />

          <div className="space-y-8 px-6 py-6">
            <Section
              title="Destinataires"
              hint="Dès qu'un mois de prestation est terminé, la facture se crée chez Airwallex et part à cette adresse avec son PDF. Puis relance à J+31, J+46 et J+61 — le règlement arrête tout."
            >
              <Field
                label="Email du destinataire"
                hint="Vide : ce devis se facture à la main, rien ne part."
                wide
              >
                <Input
                  name="recipientEmail"
                  type="email"
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value)}
                  placeholder="compta@bondet.fr"
                />
              </Field>

              <Field
                label="Copies (CC)"
                hint="Séparées par des virgules."
                wide
              >
                <Input
                  name="ccEmails"
                  defaultValue={(engagement.cc_emails ?? []).join(", ")}
                  placeholder="direction@bondet.fr, assistante@bondet.fr"
                />
              </Field>

              <Field label="Prénom du contact" hint="Remplace [prénom] dans les mails.">
                <Input
                  name="contactFirstName"
                  defaultValue={engagement.contact_first_name ?? ""}
                  placeholder="Christelle"
                />
              </Field>

              <Field
                label="Facture modèle (Airwallex)"
                hint="La première facture, créée à la main : les suivantes en reprennent la forme."
              >
                <Input
                  name="templateInvoiceId"
                  defaultValue={engagement.template_invoice_external_id ?? ""}
                  placeholder="inv_sgpdwdhb5hl36cokjm3"
                  className="font-mono text-xs"
                />
              </Field>

              <p className="type-caption text-text-tertiary sm:col-span-2">
                a.digiovanni.pro@gmail.com est toujours en copie cachée.
              </p>
            </Section>

            <Section
              title="Mail d'envoi"
              hint="Celui qui accompagne la facture. Il ne réclame aucun mois précédent : les impayés ont leurs propres relances."
            >
              <Field label="Objet" wide>
                <Input
                  name="sendSubject"
                  defaultValue={engagement.send_subject ?? DEFAULT_SEND_SUBJECT}
                />
              </Field>
              <Field label="Message" wide>
                <textarea
                  name="sendTemplate"
                  rows={13}
                  className={BODY_FIELD}
                  defaultValue={engagement.send_template ?? DEFAULT_SEND_TEMPLATE}
                />
              </Field>
            </Section>

            <Section
              title="Mail de relance"
              hint="Le même texte les trois fois : c'est la répétition qui fait effet, pas la montée en agressivité."
            >
              <Field label="Objet" wide>
                <Input
                  name="reminderSubject"
                  defaultValue={engagement.reminder_subject ?? DEFAULT_REMINDER_SUBJECT}
                />
              </Field>
              <Field label="Message" wide>
                <textarea
                  name="reminderTemplate"
                  rows={13}
                  className={BODY_FIELD}
                  defaultValue={
                    engagement.reminder_template ?? DEFAULT_REMINDER_TEMPLATE
                  }
                />
              </Field>
            </Section>

            <Section title="Variables">
              <dl className="type-caption sm:col-span-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5">
                {Object.entries(TEMPLATE_VARIABLES).map(([name, explanation]) => (
                  <div key={name} className="contents">
                    <dt>
                      <code className="bg-muted text-text-primary rounded px-1.5 py-0.5 font-mono text-[0.8em]">
                        {name}
                      </code>
                    </dt>
                    <dd className="text-text-secondary self-center">{explanation}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          </div>

          {/* Barre d'action collée en bas : deux mails entiers défilent
              au-dessus, le bouton ne doit pas se chercher. */}
          <div className="border-border bg-surface-sunken sticky bottom-0 flex items-center justify-between gap-3 border-t px-6 py-4">
            <p className="type-caption text-text-secondary">
              {enabled
                ? "Les factures de ce devis partiront toutes seules."
                : "Sans adresse, rien ne part : ce devis se facture à la main."}
            </p>
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" variant="accent" size="sm" disabled={pending}>
                <PendingLabel pending={pending} busy="Enregistrement…">
                  Enregistrer
                </PendingLabel>
              </Button>
            </div>
          </div>
        </form>
      </aside>
    </BodyPortal>
  );
}

/* Les zones de texte n'ont pas de primitive dans `ui/` : trois écrans en
   portent, toutes stylées à la main à l'image de l'Input. Interligne aéré et
   police à chasse fixe — on relit un mail, pas du code, mais l'alignement des
   variables entre crochets se lit mieux ainsi. */
const BODY_FIELD =
  "border-input bg-surface focus-visible:border-ring focus-visible:ring-ring/20 w-full resize-y rounded-md border px-3 py-2.5 font-mono text-[13px] leading-relaxed outline-none focus-visible:ring-2";

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="type-overline text-text-secondary">{title}</h3>
        {hint ? (
          <p className="type-caption text-text-tertiary mt-1 max-w-prose">{hint}</p>
        ) : null}
      </div>
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", wide && "sm:col-span-2")}>
      <Label className="type-label">{label}</Label>
      {children}
      {hint ? <p className="type-caption text-text-tertiary">{hint}</p> : null}
    </div>
  );
}
