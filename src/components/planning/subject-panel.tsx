"use client";

import { useActionState, useState } from "react";
import { ExternalLink, Upload } from "lucide-react";

import { pushWording, saveWording } from "@/app/actions/planning";
import type { PlanningResult } from "@/app/actions/planning";
import { FormatBadge, StatusBadge } from "@/components/planning/badges";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/planning/permissions";
import {
  FORMAT_LABELS,
  PLATFORM_LABELS,
  effectiveWording,
} from "@/lib/planning/types";
import type { PlanningRole, SubjectWithLane } from "@/lib/planning/types";

/**
 * Colonne de droite : le sujet, et l'écriture de son wording.
 *
 * Le texte enregistré ici ne part pas seul dans Monday. C'est délibéré : un
 * client qui relit son planning ne doit pas voir une caption changer sous ses
 * yeux parce que quelqu'un tapait à côté. L'envoi est un geste séparé, et la
 * différence entre « enregistré » et « dans Monday » reste visible tant qu'elle
 * existe.
 */
export function SubjectPanel({
  subject,
  clientId,
  clientSlug,
  role,
}: {
  subject: SubjectWithLane | null;
  clientId: string;
  clientSlug: string;
  role: PlanningRole;
}) {
  if (!subject) {
    return (
      <aside className="border-border text-muted-foreground hidden w-96 shrink-0 items-center justify-center border-l p-6 text-sm lg:flex">
        Sélectionnez un contenu.
      </aside>
    );
  }

  return (
    <aside
      key={subject.id}
      aria-label="Détail du contenu"
      className="border-border hidden w-96 shrink-0 flex-col overflow-y-auto border-l lg:flex"
    >
      <Header subject={subject} />
      {/* La clé remonte l'éditeur au changement de sujet : le brouillon repart
          du texte du nouveau contenu, sans effet de synchronisation. */}
      <WordingEditor
        key={subject.id}
        subject={subject}
        clientId={clientId}
        clientSlug={clientSlug}
        role={role}
      />
      <Meta subject={subject} />
    </aside>
  );
}

function Header({ subject }: { subject: SubjectWithLane }) {
  return (
    <div className="border-border space-y-2 border-b p-4">
      <div className="flex items-center gap-2">
        <FormatBadge format={subject.format} />
        <span className="text-muted-foreground text-xs">
          {PLATFORM_LABELS[subject.platform]}
        </span>
        <StatusBadge
          status={subject.status}
          raw={subject.status_raw}
          className="ml-auto"
        />
      </div>

      <h2 className="text-base leading-snug font-medium">{subject.name}</h2>

      <p className="text-muted-foreground text-xs">
        {subject.scheduled_on
          ? new Intl.DateTimeFormat("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }).format(new Date(`${subject.scheduled_on}T00:00:00Z`))
          : "Sans date"}
      </p>
    </div>
  );
}

function WordingEditor({
  subject,
  clientId,
  clientSlug,
  role,
}: {
  subject: SubjectWithLane;
  clientId: string;
  clientSlug: string;
  role: PlanningRole;
}) {
  const [draft, setDraft] = useState(effectiveWording(subject) ?? "");
  const [saveState, save, saving] = useActionState<PlanningResult | null, FormData>(
    saveWording,
    null,
  );
  const [pushState, push, pushing] = useActionState<PlanningResult | null, FormData>(
    pushWording,
    null,
  );

  const editable = can(role, "wording.write");
  const pending = subject.pending_wording !== null;
  const result = pushState ?? saveState;

  return (
    <div className="border-border space-y-2 border-b p-4">
      <div className="flex items-baseline justify-between">
        <label htmlFor="wording" className="text-xs font-medium">
          Wording
        </label>
        {pending ? (
          <span className="text-brand text-[11px]">
            Modifié ici, pas encore dans Monday
          </span>
        ) : null}
      </div>

      <form action={save} className="space-y-2">
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="clientSlug" value={clientSlug} />
        <input type="hidden" name="subjectId" value={subject.id} />

        <textarea
          id="wording"
          name="wording"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={12}
          readOnly={!editable}
          placeholder={
            editable
              ? "Intention en phase de planning, caption finale en phase de rédaction."
              : undefined
          }
          className="border-input bg-background focus-visible:ring-brand w-full rounded-md border px-3 py-2 text-sm whitespace-pre-wrap focus-visible:ring-2 focus-visible:outline-none"
        />

        {editable ? (
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>

            <span className="text-muted-foreground text-xs tabular-nums">
              {draft.length} car.
            </span>
          </div>
        ) : null}
      </form>

      {editable && pending && can(role, "sync.push") ? (
        <form action={push}>
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="clientSlug" value={clientSlug} />
          <input type="hidden" name="subjectId" value={subject.id} />
          <Button type="submit" size="sm" variant="secondary" disabled={pushing}>
            <Upload className="size-3.5" aria-hidden />
            {pushing ? "Envoi…" : "Envoyer dans Monday"}
          </Button>
        </form>
      ) : null}

      {result ? (
        <p
          role="status"
          className={
            result.ok ? "text-muted-foreground text-xs" : "text-brand-red text-xs"
          }
        >
          {result.ok ? result.message : result.error}
        </p>
      ) : null}
    </div>
  );
}

function Meta({ subject }: { subject: SubjectWithLane }) {
  const rows: { label: string; value: string }[] = [
    { label: "Format", value: subject.format_raw ?? FORMAT_LABELS[subject.format] },
    { label: "Couloir", value: subject.lane_name },
  ];

  if (subject.objective) rows.push({ label: "Objectif", value: subject.objective });
  if (subject.owner_name)
    rows.push({ label: "Propriétaire", value: subject.owner_name });
  if (subject.sponsoring !== null) {
    rows.push({
      label: "Sponsorisation",
      value: new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
      }).format(subject.sponsoring),
    });
  }

  return (
    <div className="space-y-4 p-4">
      <dl className="space-y-1.5 text-xs">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="truncate text-right">{row.value}</dd>
          </div>
        ))}
      </dl>

      {subject.comments ? (
        <div>
          <p className="text-muted-foreground mb-1 text-xs font-medium">
            Commentaires
          </p>
          <p className="bg-card rounded-md p-2.5 text-xs whitespace-pre-wrap">
            {subject.comments}
          </p>
        </div>
      ) : null}

      {subject.visual_urls.length > 0 ? (
        <div>
          <p className="text-muted-foreground mb-1 text-xs font-medium">
            Visuels ({subject.visual_urls.length})
          </p>
          <ul className="space-y-1">
            {subject.visual_urls.map((url, index) => (
              <li key={`${url}-${index}`}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs"
                >
                  <ExternalLink className="size-3 shrink-0" aria-hidden />
                  <span className="truncate">{fileName(url)}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {subject.permalink ? (
        <a
          href={subject.permalink}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs"
        >
          <ExternalLink className="size-3" aria-hidden />
          Ouvrir dans Monday
        </a>
      ) : null}
    </div>
  );
}

function fileName(url: string): string {
  try {
    return decodeURIComponent(url.split("/").pop() ?? url);
  } catch {
    return url;
  }
}
