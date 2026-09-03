"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

import {
  createEngagement,
  updateEngagementDelivery,
  type BillingActionResult,
} from "@/app/actions/billing";
import { BodyPortal } from "@/components/planning/body-portal";
import { Button } from "@/components/ui/button";
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
import { StatusPill } from "@/components/ds/status-pill";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/finance/money";
import { monthsBetween, splitTotal, ttcCentsOf } from "@/lib/billing/schedule";
import {
  DEFAULT_REMINDER_1_SUBJECT,
  DEFAULT_REMINDER_1_TEMPLATE,
  DEFAULT_REMINDER_2_SUBJECT,
  DEFAULT_REMINDER_2_TEMPLATE,
  DEFAULT_REMINDER_3_SUBJECT,
  DEFAULT_REMINDER_3_TEMPLATE,
  DEFAULT_SEND_SUBJECT,
  DEFAULT_SEND_TEMPLATE,
  TEMPLATE_VARIABLES,
} from "@/lib/billing/templates";
import type { BillingEngagement } from "@/lib/billing/types";

/**
 * La fiche d'un devis, en panneau latéral — un seul écran pour tout ce qui le
 * concerne : qui, quoi, combien, à qui l'on facture, et les quatre mails.
 *
 * Un seul panneau pour créer et pour modifier, et c'est le point : une boîte
 * de dialogue pour la création et un panneau pour les réglages donnaient deux
 * endroits où chercher la même information, avec deux mises en page. Ce qui
 * change entre les deux modes est ce qui a un sens : la période et les
 * montants engendrent les mensualités, ils ne se saisissent donc qu'à la
 * création — ensuite chaque mensualité s'ajuste sur sa ligne.
 *
 * Le voile ne referme pas au clic, seuls la croix et Échap le font : on y
 * rédige, et perdre trente lignes de modèle sur un clic mal placé serait
 * impardonnable.
 */
export function EngagementPanel({
  engagement,
  knownClients,
  onClose,
}: {
  /** Absent : création. Présent : modification de ce devis. */
  engagement?: BillingEngagement;
  knownClients?: string[];
  onClose: () => void;
}) {
  const creating = !engagement;

  const [state, formAction, pending] = useActionState<
    BillingActionResult | null,
    FormData
  >(creating ? createEngagement : updateEngagementDelivery, null);

  const [recipient, setRecipient] = useState(engagement?.recipient_email ?? "");
  const enabled = recipient.trim() !== "";

  const [firstMonth, setFirstMonth] = useState("");
  const [lastMonth, setLastMonth] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [vatRate, setVatRate] = useState("0");

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

  const preview = useMemo(
    () => buildPreview({ firstMonth, lastMonth, totalAmount, monthlyAmount, vatRate }),
    [firstMonth, lastMonth, totalAmount, monthlyAmount, vatRate],
  );

  return (
    <BodyPortal>
      {/* Le voile assombrit sans refermer — voir l'en-tête du fichier. */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" aria-hidden />

      <aside
        aria-label={creating ? "Nouveau devis" : `Devis de ${engagement.client_name}`}
        className="border-border bg-background animate-in slide-in-from-right fixed inset-y-0 right-0 z-50 flex w-full max-w-4xl flex-col border-l shadow-2xl duration-300 motion-reduce:animate-none"
      >
        <header className="border-border flex items-start justify-between gap-4 border-b px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="type-h3 truncate">
                {creating ? "Nouveau devis signé" : engagement.client_name}
              </h2>
              <StatusPill tone={enabled ? "positive" : "neutral"}>
                {enabled ? "Envoi automatique" : "Facturation à la main"}
              </StatusPill>
            </div>
            <p className="type-caption text-text-secondary mt-1">
              {creating
                ? "Une saisie unique : les mensualités se génèrent, puis avancent toutes seules."
                : engagement.label}
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
          {!creating ? (
            <input type="hidden" name="engagementId" value={engagement.id} />
          ) : null}

          <div className="space-y-8 px-6 py-6">
            <Section title="Le devis">
              <Field label="Client">
                <Input
                  name="clientName"
                  required={creating}
                  defaultValue={engagement?.client_name ?? ""}
                  readOnly={!creating}
                  list={creating ? "devis-clients-connus" : undefined}
                  placeholder="Bondet"
                  className={cn(!creating && "text-text-secondary")}
                />
                {creating ? (
                  <datalist id="devis-clients-connus">
                    {(knownClients ?? []).map((client) => (
                      <option key={client} value={client} />
                    ))}
                  </datalist>
                ) : null}
              </Field>

              <Field label="Projet">
                <Input
                  name="label"
                  required={creating}
                  defaultValue={engagement?.label ?? ""}
                  readOnly={!creating}
                  placeholder="Accompagnement social media 2026"
                  className={cn(!creating && "text-text-secondary")}
                />
              </Field>

              {creating ? (
                <>
                  <Field label="Premier mois">
                    <Input
                      name="firstMonth"
                      type="month"
                      required
                      value={firstMonth}
                      onChange={(event) => setFirstMonth(event.target.value)}
                    />
                  </Field>
                  <Field label="Dernier mois">
                    <Input
                      name="lastMonth"
                      type="month"
                      required
                      value={lastMonth}
                      onChange={(event) => setLastMonth(event.target.value)}
                    />
                  </Field>

                  <Field label="Total du devis (€ HT)">
                    <Input
                      name="totalAmount"
                      inputMode="decimal"
                      placeholder="25 230"
                      value={totalAmount}
                      onChange={(event) => setTotalAmount(event.target.value)}
                    />
                  </Field>
                  <Field label="ou Mensuel (€ HT)">
                    <Input
                      name="monthlyAmount"
                      inputMode="decimal"
                      placeholder="2 102,50"
                      value={monthlyAmount}
                      onChange={(event) => setMonthlyAmount(event.target.value)}
                    />
                  </Field>

                  <Field label="TVA">
                    <Select
                      name="vatRate"
                      value={vatRate}
                      onValueChange={(value) => setVatRate(value ?? "0")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(value: string) =>
                            VAT_RATES.find((rate) => rate.value === value)?.label ??
                            "Sans TVA (0 %)"
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
                  </Field>
                  <Field label="Note">
                    <Input name="notes" placeholder="Facultatif" />
                  </Field>

                  <p
                    className="type-caption bg-muted text-text-secondary rounded-md px-3 py-2 sm:col-span-2"
                    aria-live="polite"
                  >
                    {preview}
                  </p>
                </>
              ) : (
                <p className="type-caption text-text-tertiary sm:col-span-2">
                  La période et les montants ont engendré les mensualités : ils
                  s&apos;ajustent désormais mois par mois, sur leur ligne.
                </p>
              )}
            </Section>

            <Section
              title="Facturation"
              hint="Ce qui figurera sur la facture. IBAN et mention de TVA partent d'office."
            >
              <Field label="Raison sociale" wide>
                <Input
                  name="billingName"
                  defaultValue={engagement?.billing_name ?? ""}
                  placeholder="MEDIAPILOTE ANGERS"
                />
              </Field>

              <Field label="Email sur la fiche Airwallex">
                <Input
                  name="billingEmail"
                  type="email"
                  defaultValue={engagement?.billing_email ?? ""}
                  placeholder="a.bouju@mediapilote.com"
                />
              </Field>
              <Field label="Numéro de TVA">
                <Input
                  name="billingTaxId"
                  defaultValue={engagement?.billing_tax_id ?? ""}
                  placeholder="FR28478864432"
                />
              </Field>

              <Field label="Adresse" wide>
                <Input
                  name="billingStreet"
                  defaultValue={engagement?.billing_street ?? ""}
                  placeholder="3TER Promenade la Baumette"
                />
              </Field>
              <Field label="Code postal">
                <Input
                  name="billingPostcode"
                  defaultValue={engagement?.billing_postcode ?? ""}
                  placeholder="49000"
                />
              </Field>
              <Field label="Ville">
                <Input
                  name="billingCity"
                  defaultValue={engagement?.billing_city ?? ""}
                  placeholder="Angers"
                />
              </Field>
              <Field label="Pays">
                <Input
                  name="billingCountry"
                  defaultValue={engagement?.billing_country ?? "FR"}
                  placeholder="FR"
                  maxLength={2}
                />
              </Field>

              <Field
                label="Produit facturé"
               
              >
                <Input
                  name="productName"
                  defaultValue={engagement?.product_name ?? ""}
                  placeholder="ACCOMPAGNEMENT SOCIAL MEDIA"
                />
              </Field>

            </Section>

            <Section
              title="Destinataires"
              hint="a.digiovanni.pro@gmail.com est toujours en copie cachée."
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
                  placeholder="achats-angers@mediapilote.com"
                />
              </Field>

              <Field label="Copies (CC)" wide>
                <Input
                  name="ccEmails"
                  defaultValue={(engagement?.cc_emails ?? []).join(", ")}
                  placeholder="c.deschere@mediapilote.com, a.bouju@mediapilote.com"
                />
              </Field>

              <Field
                label="Prénom du contact"
                hint="Plusieurs prénoms admis : « Christelle, Anthony »."
                wide
              >
                <Input
                  name="contactFirstName"
                  defaultValue={engagement?.contact_first_name ?? ""}
                  placeholder="Christelle, Anthony"
                />
              </Field>

            </Section>

            <Section
              title="Mail d'envoi"
              hint="Part à l'émission, la facture jointe. La signature se met toute seule."
            >
              <Field label="Objet" wide>
                <Input
                  name="sendSubject"
                  defaultValue={engagement?.send_subject ?? DEFAULT_SEND_SUBJECT}
                />
              </Field>
              <Field label="Message" wide>
                <textarea
                  name="sendTemplate"
                  rows={12}
                  className={BODY_FIELD}
                  defaultValue={engagement?.send_template ?? DEFAULT_SEND_TEMPLATE}
                />
              </Field>
            </Section>

            <Section
              title="Relances"
              hint="Tant que la facture n'est pas payée. Un règlement arrête tout."
            >
              {REMINDERS.map((reminder) => (
                <details
                  key={reminder.key}
                  className="border-border rounded-md border sm:col-span-2"
                >
                  <summary className="type-label cursor-pointer px-3 py-2.5">
                    {reminder.label}
                    {reminder.hint ? (
                      <span className="type-caption text-text-tertiary ml-2 font-normal">
                        {reminder.hint}
                      </span>
                    ) : null}
                  </summary>
                  <div className="grid gap-3 px-3 pb-3">
                    <Input
                      name={`${reminder.key}Subject`}
                      aria-label={`${reminder.label} — objet`}
                      defaultValue={
                        engagement?.[reminder.subjectField] ?? reminder.defaultSubject
                      }
                    />
                    <textarea
                      name={`${reminder.key}Template`}
                      aria-label={`${reminder.label} — message`}
                      rows={11}
                      className={BODY_FIELD}
                      defaultValue={
                        engagement?.[reminder.bodyField] ?? reminder.defaultBody
                      }
                    />
                  </div>
                </details>
              ))}
            </Section>

            <Section title="Variables">
              <dl className="type-caption grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 sm:col-span-2">
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

          {/* Barre d'action collée en bas : quatre mails entiers défilent
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
                  {creating ? "Créer le devis" : "Enregistrer"}
                </PendingLabel>
              </Button>
            </div>
          </div>
        </form>
      </aside>
    </BodyPortal>
  );
}

/* Antidotes facture sans TVA aujourd'hui — le 0 est le défaut, les taux
   français restent à portée de main pour le jour où ça change. */
const VAT_RATES: { value: string; label: string }[] = [
  { value: "0", label: "Sans TVA (0 %)" },
  { value: "5.5", label: "5,5 %" },
  { value: "10", label: "10 %" },
  { value: "20", label: "20 %" },
];

const REMINDERS = [
  {
    key: "reminder1",
    label: "1re relance · J+31",
    subjectField: "reminder_1_subject",
    bodyField: "reminder_1_template",
    defaultSubject: DEFAULT_REMINDER_1_SUBJECT,
    defaultBody: DEFAULT_REMINDER_1_TEMPLATE,
    hint: undefined,
  },
  {
    key: "reminder2",
    label: "2e relance · J+46",
    subjectField: "reminder_2_subject",
    bodyField: "reminder_2_template",
    defaultSubject: DEFAULT_REMINDER_2_SUBJECT,
    defaultBody: DEFAULT_REMINDER_2_TEMPLATE,
    hint: undefined,
  },
  {
    key: "reminder3",
    label: "3e relance · J+61",
    subjectField: "reminder_3_subject",
    bodyField: "reminder_3_template",
    defaultSubject: DEFAULT_REMINDER_3_SUBJECT,
    defaultBody: DEFAULT_REMINDER_3_TEMPLATE,
    hint: "la dernière",
  },
] as const satisfies readonly {
  key: string;
  label: string;
  subjectField: keyof BillingEngagement;
  bodyField: keyof BillingEngagement;
  defaultSubject: string;
  defaultBody: string;
  hint: string | undefined;
}[];

/* Les zones de texte n'ont pas de primitive dans `ui/` : les trois écrans qui
   en portent les stylent à la main, à l'image de l'Input. Chasse fixe et
   interligne aéré — on relit un mail, mais les variables entre crochets se
   repèrent mieux ainsi. */
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
      {/* `items-start` : sans lui, un champ portant une explication étire
          sa rangée et son voisin flotte au milieu du vide. */}
      <div className="grid items-start gap-x-4 gap-y-4 sm:grid-cols-2">{children}</div>
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

function parseAmount(value: string): number | null {
  if (!value.trim()) return null;
  const amount = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/** L'aperçu de la division — ce que « Créer » va générer. */
function buildPreview(fields: {
  firstMonth: string;
  lastMonth: string;
  totalAmount: string;
  monthlyAmount: string;
  vatRate: string;
}): string {
  if (!fields.firstMonth || !fields.lastMonth) {
    return "Choisir la période : chaque mois de prestation devient une facture, émise le 1er du mois suivant.";
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
