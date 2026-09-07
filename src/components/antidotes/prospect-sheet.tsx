"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  CalendarCheck,
  ExternalLink,
  Mail,
  MailOpen,
  MailX,
  MessageSquare,
  MousePointerClick,
  Phone,
  Plus,
  Reply,
  StickyNote,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  addContact,
  addInteraction,
  moveProspects,
  updateProspectNotes,
  type AntidotesResult,
} from "@/app/actions/antidotes";
import { NativeSelect, TextArea } from "@/components/antidotes/controls";
import { EnrollDialog } from "@/components/antidotes/enroll-dialog";
import { PendingLabel } from "@/components/ds/pending-label";
import { StatusPill, type StatusTone } from "@/components/ds/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatDateTime, relativeDays } from "@/lib/antidotes/dates";
import type { ProspectDetail, ProspectEnrollmentSummary } from "@/lib/antidotes/queries";
import type { SequenceOption } from "@/lib/antidotes/sequences/queries";
import {
  DISCOVERY_SOURCE_LABELS,
  EMAIL_STATUS_LABELS,
  INTERACTION_TYPE_LABELS,
  MANUAL_INTERACTION_TYPES,
  OUTREACH_CHANNEL_LABELS,
  PROSPECT_SOURCE_LABELS,
  PROSPECT_STATUSES,
  PROSPECT_STATUS_LABELS,
  SENIORITIES,
  SENIORITY_LABELS,
  contactDisplayName,
  type Contact,
  type EmailStatus,
  type Interaction,
  type InteractionType,
  ENROLLMENT_STATUS_LABELS,
  type PipelineProspect,
  type ProspectStatus,
} from "@/lib/antidotes/types";
import { cn } from "@/lib/utils";

/**
 * Le panneau d'un prospect : tout ce qu'on sait, qui on peut joindre, ce qui
 * s'est dit — dans cet ordre, du haut vers le bas.
 *
 * Le panneau s'ouvre sur les données de la carte avant que le détail
 * n'arrive du serveur : l'en-tête est déjà là, seule la timeline attend.
 * Sans ça, un clic sur une carte laissait l'écran figé le temps de
 * l'aller-retour.
 */
export function ProspectSheet({
  open,
  fallback,
  detail,
  loading,
  onClose,
  sequences,
}: {
  open: boolean;
  /** Le prospect tel que la liste le connaît — l'en-tête, tout de suite. */
  fallback: PipelineProspect | null;
  /** Le détail complet, quand le serveur l'a rendu pour ce prospect. */
  detail: ProspectDetail | null;
  loading: boolean;
  onClose: () => void;
  /** Les séquences où inscrire ce prospect. */
  sequences: SequenceOption[];
}) {
  const prospect = detail?.prospect ?? fallback;

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <SheetContent className="gap-0 sm:max-w-xl" aria-busy={loading}>
        {prospect ? (
          <ProspectPanel
            prospect={prospect}
            interactions={detail?.interactions ?? null}
            enrollments={detail?.enrollments ?? null}
            sequences={sequences}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ProspectPanel({
  prospect,
  interactions,
  enrollments,
  sequences,
}: {
  prospect: PipelineProspect;
  /** `null` : le journal arrive encore — le panneau, lui, est déjà là. */
  interactions: Interaction[] | null;
  enrollments: ProspectEnrollmentSummary[] | null;
  sequences: SequenceOption[];
}) {
  const place = [prospect.city, prospect.country].filter(Boolean).join(", ");

  return (
    <>
      <SheetHeader className="border-b border-border pr-12">
        <SheetTitle className="type-h2 flex flex-wrap items-center gap-2 text-text-primary">
          {prospect.company_name}
          {prospect.ads_active ? <StatusPill tone="positive">Pubs actives</StatusPill> : null}
        </SheetTitle>
        <SheetDescription className="type-caption flex flex-wrap items-center gap-x-2 text-text-secondary">
          {prospect.sector ? <span>{prospect.sector}</span> : null}
          {prospect.sector && place ? <span aria-hidden>·</span> : null}
          {place ? <span>{place}</span> : null}
          {prospect.website ? (
            <a
              href={prospect.website}
              target="_blank"
              rel="noreferrer"
              className="focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm text-accent-ink hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              {hostOf(prospect.website)}
              <ExternalLink className="size-3" strokeWidth={1.75} aria-hidden />
            </a>
          ) : null}
        </SheetDescription>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <StatusSelect prospectId={prospect.id} status={prospect.status} />
          <span className="type-label text-text-primary tabular-nums">Score {prospect.score}</span>
          <span className="type-caption text-text-secondary">
            {prospect.last_contact_at
              ? `Dernier contact ${relativeDays(prospect.last_contact_at)}`
              : "Pas encore contacté"}
          </span>
        </div>
      </SheetHeader>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
        <Facts prospect={prospect} />
        <Contacts prospect={prospect} sequences={sequences} enrollments={enrollments} />
        <Notes prospectId={prospect.id} notes={prospect.notes} />
        <Timeline prospect={prospect} interactions={interactions} />
      </div>
    </>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// --- Statut ----------------------------------------------------------------------

function StatusSelect({ prospectId, status }: { prospectId: string; status: ProspectStatus }) {
  const [current, setCurrent] = useState(status);
  const [pending, startTransition] = useTransition();

  // La ligne vient du serveur : quand elle change — un glisser-déposer
  // derrière le panneau —, le sélecteur suit.
  const [seen, setSeen] = useState(status);
  if (seen !== status) {
    setSeen(status);
    setCurrent(status);
  }

  return (
    <NativeSelect
      size="small"
      aria-label="Statut du prospect"
      value={current}
      disabled={pending}
      onChange={(event) => {
        const next = event.target.value as ProspectStatus;
        const previous = current;
        setCurrent(next);
        startTransition(async () => {
          const result = await moveProspects({ prospectIds: [prospectId], status: next });
          if (!result.ok) {
            setCurrent(previous);
            toast.error(result.error);
          }
        });
      }}
    >
      {PROSPECT_STATUSES.map((value) => (
        <option key={value} value={value}>
          {PROSPECT_STATUS_LABELS[value]}
        </option>
      ))}
    </NativeSelect>
  );
}

// --- Fiche -----------------------------------------------------------------------

function Facts({ prospect }: { prospect: PipelineProspect }) {
  const size = Object.entries(prospect.size_signal ?? {})
    .filter(([, value]) => typeof value === "number")
    .map(([key, value]) => `${SIZE_LABELS[key] ?? key} ${new Intl.NumberFormat("fr-FR").format(value as number)}`)
    .join(" · ");

  const rows: [string, string | null][] = [
    ["Source", PROSPECT_SOURCE_LABELS[prospect.source]],
    ["Campagne", prospect.campaign_name],
    ["Référence", prospect.reference_client],
    ["Taille", size || null],
    ["Pubs vues", prospect.ads_last_seen_at ? formatDate(prospect.ads_last_seen_at) : null],
    ["Ajouté", formatDate(prospect.created_at)],
  ];

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="type-caption text-text-secondary">{label}</dt>
          <dd className="type-caption text-text-primary">{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

const SIZE_LABELS: Record<string, string> = {
  reviews_count: "avis",
  employees: "salariés",
  revenue: "CA",
  traffic: "visites",
};

// --- Contacts --------------------------------------------------------------------

const EMAIL_TONES: Record<EmailStatus, StatusTone> = {
  unknown: "neutral",
  valid: "positive",
  risky: "warning",
  invalid: "danger",
};

function Contacts({
  prospect,
  sequences,
  enrollments,
}: {
  prospect: PipelineProspect;
  sequences: SequenceOption[];
  enrollments: ProspectEnrollmentSummary[] | null;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <section aria-labelledby="prospect-contacts">
      <div className="flex items-center justify-between gap-3">
        <h3 id="prospect-contacts" className="type-h3 text-text-primary">
          Contacts
          <span className="type-caption ml-2 text-text-secondary tabular-nums">
            {prospect.contacts.length}
          </span>
        </h3>
        {!adding ? (
          <div className="flex flex-wrap items-center gap-2">
            {prospect.contacts.length > 0 ? (
              <EnrollDialog prospectIds={[prospect.id]} sequences={sequences} variant="ghost" />
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
              <Plus aria-hidden />
              Ajouter un contact
            </Button>
          </div>
        ) : null}
      </div>

      {enrollments && enrollments.length > 0 ? (
        <ul className="type-caption mt-3 flex flex-wrap gap-2 text-text-secondary">
          {enrollments.map(({ enrollment, sequenceName }) => (
            <li key={enrollment.id} className="inline-flex items-center gap-1.5 rounded-pill border border-border px-2.5 py-1">
              <span className="text-text-primary">{sequenceName}</span>
              <span aria-hidden>·</span>
              <span>{ENROLLMENT_STATUS_LABELS[enrollment.status]}</span>
              {enrollment.channel === "linkedin" ? <span>· LinkedIn</span> : enrollment.current_step > 0 ? <span>· étape {enrollment.current_step}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {prospect.contacts.length > 0 ? (
        <ul className="mt-3 divide-y divide-border rounded-md border border-border">
          {prospect.contacts.map((contact) => (
            <ContactRow key={contact.id} contact={contact} />
          ))}
        </ul>
      ) : !adding ? (
        <p className="type-caption mt-3 text-text-secondary">Aucun décisionnaire identifié.</p>
      ) : null}

      {adding ? (
        <AddContactForm
          prospectId={prospect.id}
          first={prospect.contacts.length === 0}
          onDone={() => setAdding(false)}
        />
      ) : null}
    </section>
  );
}

function ContactRow({ contact }: { contact: Contact }) {
  const detail = [contact.role, DISCOVERY_SOURCE_LABELS[contact.discovery_source]]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex flex-col gap-1 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="type-label text-text-primary">{contactDisplayName(contact)}</span>
        {contact.is_primary ? <StatusPill tone="neutral" dot={false}>Principal</StatusPill> : null}
        {contact.opted_out ? <StatusPill tone="danger">Désinscrit</StatusPill> : null}
      </div>
      {detail ? <p className="type-caption text-text-secondary">{detail}</p> : null}
      <div className="type-caption flex flex-wrap items-center gap-x-3 gap-y-1 text-text-secondary">
        {contact.email ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-text-primary">{contact.email}</span>
            <StatusPill tone={EMAIL_TONES[contact.email_status]}>
              {EMAIL_STATUS_LABELS[contact.email_status]}
            </StatusPill>
          </span>
        ) : null}
        {contact.linkedin_url ? (
          <a
            href={contact.linkedin_url}
            target="_blank"
            rel="noreferrer"
            className="focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm text-accent-ink hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            LinkedIn
            <ExternalLink className="size-3" strokeWidth={1.75} aria-hidden />
          </a>
        ) : null}
        {contact.phone ? <span>{contact.phone}</span> : null}
        <span>{OUTREACH_CHANNEL_LABELS[contact.outreach_channel]}</span>
      </div>
    </li>
  );
}

function AddContactForm({
  prospectId,
  first,
  onDone,
}: {
  prospectId: string;
  /** Premier contact : principal d'office, la case est cochée. */
  first: boolean;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<AntidotesResult | null, FormData>(
    addContact,
    null,
  );
  const lastState = useRef<AntidotesResult | null>(null);

  useEffect(() => {
    if (!state || state === lastState.current) return;
    lastState.current = state;
    if (state.ok) {
      toast.success(state.message ?? "Contact ajouté.");
      onDone();
    } else {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form
      action={formAction}
      className="mt-3 grid gap-3 rounded-md border border-border bg-surface-sunken p-3 sm:grid-cols-2"
    >
      <input type="hidden" name="prospectId" value={prospectId} />
      <div className="grid gap-1">
        <Label htmlFor="contact-first">Prénom</Label>
        <Input id="contact-first" name="firstName" maxLength={80} autoFocus />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="contact-last">Nom</Label>
        <Input id="contact-last" name="lastName" maxLength={80} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="contact-role">Poste</Label>
        <Input id="contact-role" name="role" maxLength={120} placeholder="Responsable marketing" />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="contact-seniority">Niveau</Label>
        <NativeSelect id="contact-seniority" name="seniority" defaultValue="other">
          {SENIORITIES.map((value) => (
            <option key={value} value={value}>
              {SENIORITY_LABELS[value]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="contact-email">Email</Label>
        <Input id="contact-email" name="email" type="email" maxLength={200} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="contact-phone">Téléphone</Label>
        <Input id="contact-phone" name="phone" inputMode="tel" maxLength={40} />
      </div>
      <div className="grid gap-1 sm:col-span-2">
        <Label htmlFor="contact-linkedin">Profil LinkedIn</Label>
        <Input
          id="contact-linkedin"
          name="linkedinUrl"
          inputMode="url"
          maxLength={300}
          placeholder="linkedin.com/in/…"
        />
      </div>
      <label className="type-caption flex items-center gap-2 text-text-primary sm:col-span-2">
        <input
          type="checkbox"
          name="isPrimary"
          defaultChecked={first}
          className="size-4 accent-[var(--accent-ink)]"
        />
        Contact principal
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          <PendingLabel pending={pending} busy="Ajout…">
            Enregistrer
          </PendingLabel>
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone} disabled={pending}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

// --- Notes -----------------------------------------------------------------------

function Notes({ prospectId, notes }: { prospectId: string; notes: string | null }) {
  const [value, setValue] = useState(notes ?? "");
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  /** Ce que la base porte, pour ne pas renvoyer une note inchangée au blur. */
  const [committed, setCommitted] = useState(notes ?? "");

  // Une note enregistrée ailleurs — autre onglet — remplace la nôtre tant
  // qu'on n'a pas commencé à écrire.
  const [seen, setSeen] = useState(notes ?? "");
  if (seen !== (notes ?? "")) {
    setSeen(notes ?? "");
    if (value === committed) setValue(notes ?? "");
    setCommitted(notes ?? "");
  }

  async function commit() {
    if (value === committed) return;
    setSaved("saving");
    const result = await updateProspectNotes({ prospectId, notes: value });
    if (result.ok) {
      setCommitted(value);
      setSaved("saved");
      setTimeout(() => setSaved("idle"), 1500);
    } else {
      setSaved("idle");
      toast.error(result.error);
    }
  }

  return (
    <section aria-labelledby="prospect-notes">
      <div className="flex items-center justify-between gap-3">
        <h3 id="prospect-notes" className="type-h3 text-text-primary">
          Notes
        </h3>
        <span className="type-caption text-text-secondary" aria-live="polite">
          {saved === "saving" ? "Enregistrement…" : saved === "saved" ? "Enregistré" : ""}
        </span>
      </div>
      <TextArea
        aria-label="Notes sur le prospect"
        value={value}
        maxLength={5000}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        placeholder="Ce qu'il faut savoir avant de les appeler."
        className="mt-2"
      />
    </section>
  );
}

// --- Journal ---------------------------------------------------------------------

const INTERACTION_ICONS: Record<InteractionType, LucideIcon> = {
  email_sent: Mail,
  email_open: MailOpen,
  email_click: MousePointerClick,
  reply: Reply,
  call: Phone,
  note: StickyNote,
  linkedin_dm: MessageSquare,
  meeting: CalendarCheck,
  bounce: MailX,
  opt_out: UserX,
};

function Timeline({
  prospect,
  interactions,
}: {
  prospect: PipelineProspect;
  interactions: Interaction[] | null;
}) {
  const contactName = new Map(
    prospect.contacts.map((contact) => [contact.id, contactDisplayName(contact)]),
  );

  return (
    <section aria-labelledby="prospect-timeline">
      <h3 id="prospect-timeline" className="type-h3 text-text-primary">
        Historique
        {interactions ? (
          <span className="type-caption ml-2 text-text-secondary tabular-nums">
            {interactions.length}
          </span>
        ) : null}
      </h3>

      <AddInteractionForm prospect={prospect} />

      {interactions === null ? (
        <div className="mt-3 space-y-2" aria-hidden>
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : interactions.length === 0 ? (
        <p className="type-caption mt-3 text-text-secondary">Rien encore.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {interactions.map((interaction) => {
            const Icon = INTERACTION_ICONS[interaction.type];
            const text =
              typeof interaction.payload.text === "string" ? interaction.payload.text : null;
            const who = interaction.contact_id
              ? (contactName.get(interaction.contact_id) ?? null)
              : null;
            return (
              <li key={interaction.id} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-pill bg-surface-sunken"
                >
                  <Icon className="size-3.5 text-text-secondary" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="type-caption flex flex-wrap items-center gap-x-2 text-text-secondary">
                    <span className="font-medium text-text-primary">
                      {INTERACTION_TYPE_LABELS[interaction.type]}
                    </span>
                    {who ? <span>{who}</span> : null}
                    <span className="tabular-nums">{formatDateTime(interaction.occurred_at)}</span>
                  </p>
                  {text ? (
                    <p className="type-body mt-0.5 whitespace-pre-wrap text-text-primary">{text}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function AddInteractionForm({ prospect }: { prospect: PipelineProspect }) {
  const [state, formAction, pending] = useActionState<AntidotesResult | null, FormData>(
    addInteraction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const lastState = useRef<AntidotesResult | null>(null);

  useEffect(() => {
    if (!state || state === lastState.current) return;
    lastState.current = state;
    if (state.ok) {
      toast.success(state.message ?? "Ajouté.");
      formRef.current?.reset();
    } else {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-3 grid gap-2 rounded-md border border-border bg-surface-sunken p-3"
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          formRef.current?.requestSubmit();
        }
      }}
    >
      <input type="hidden" name="prospectId" value={prospect.id} />
      <div className="flex flex-wrap gap-2">
        <NativeSelect size="small" name="type" aria-label="Type" defaultValue="note">
          {MANUAL_INTERACTION_TYPES.map((type) => (
            <option key={type} value={type}>
              {INTERACTION_TYPE_LABELS[type]}
            </option>
          ))}
        </NativeSelect>
        {prospect.contacts.length > 0 ? (
          <NativeSelect size="small" name="contactId" aria-label="Contact concerné" defaultValue="">
            <option value="">Sans contact</option>
            {prospect.contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contactDisplayName(contact)}
              </option>
            ))}
          </NativeSelect>
        ) : null}
      </div>
      <TextArea
        name="text"
        required
        maxLength={5000}
        aria-label="Texte"
        placeholder="Ce qui s'est dit…   ⌘↵ pour ajouter"
        className={cn("min-h-16 bg-surface")}
      />
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          <PendingLabel pending={pending} busy="Ajout…">
            Ajouter
          </PendingLabel>
        </Button>
      </div>
    </form>
  );
}
