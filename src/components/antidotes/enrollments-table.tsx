"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Pencil, Play, Square } from "lucide-react";
import { toast } from "sonner";

import { setEnrollmentStatus, updateObservation } from "@/app/actions/antidotes-sequences";
import { TextArea } from "@/components/antidotes/controls";
import { PendingLabel } from "@/components/ds/pending-label";
import { StatusPill, type StatusTone } from "@/components/ds/status-pill";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime, relativeDays } from "@/lib/antidotes/dates";
import type { EnrollmentRow } from "@/lib/antidotes/sequences/queries";
import {
  contactDisplayName,
  ENROLLMENT_STATUS_LABELS,
  type EnrollmentStatus,
} from "@/lib/antidotes/types";
import { cn } from "@/lib/utils";

const TONES: Record<EnrollmentStatus, StatusTone> = {
  active: "info",
  paused: "warning",
  completed: "neutral",
  stopped_on_reply: "positive",
  stopped_on_opt_out: "danger",
};

const GRID = "grid grid-cols-[minmax(180px,1.4fr)_minmax(110px,1fr)_72px_minmax(120px,1fr)_minmax(140px,1.2fr)_minmax(200px,2fr)_auto] items-center gap-3";

/**
 * Les inscriptions d'une séquence : qui, où on en est, quand part la
 * suite, et l'observation qui personnalise — éditable, parce que le modèle
 * propose et l'humain dispose. Pause, reprise, arrêt par ligne.
 */
export function EnrollmentsTable({ rows, stepCount }: { rows: EnrollmentRow[]; stepCount: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<EnrollmentRow | null>(null);

  function act(enrollmentId: string, action: "pause" | "resume" | "stop") {
    setBusy(enrollmentId);
    startTransition(async () => {
      const result = await setEnrollmentStatus({ enrollmentId, action });
      if (result.ok) {
        toast.success(result.message ?? "Fait.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setBusy(null);
    });
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1040px]">
        <div className={cn(GRID, "type-overline border-b border-border-strong bg-surface-sunken px-5 py-2 text-text-secondary")}>
          <span>Contact</span>
          <span>Canal</span>
          <span className="text-right">Étape</span>
          <span>État</span>
          <span>Prochain envoi</span>
          <span>Observation</span>
          <span />
        </div>
        {rows.map((row) => {
          const { enrollment, contact, prospect } = row;
          const isBusy = pending && busy === enrollment.id;
          const observation = enrollment.personalization.observation?.trim() || null;
          const pendingObservation = enrollment.channel === "email" && !enrollment.personalization.ready;
          const name = contactDisplayName(contact);
          return (
            <div key={enrollment.id} className={cn(GRID, "border-b border-border px-5 py-3 last:border-b-0")}>
              <div className="min-w-0">
                <p className="type-label truncate text-text-primary">{contactDisplayName(contact)}</p>
                <p className="type-caption truncate text-text-secondary">{prospect.company_name}</p>
              </div>
              <span className="type-caption text-text-secondary">
                {enrollment.channel === "linkedin" ? "LinkedIn (manuel)" : (contact.email ?? "—")}
              </span>
              <span className="type-caption text-right text-text-primary tabular-nums">
                {enrollment.channel === "linkedin" ? "—" : `${enrollment.current_step}/${stepCount}`}
              </span>
              <div className="min-w-0">
                <StatusPill tone={TONES[enrollment.status]}>{ENROLLMENT_STATUS_LABELS[enrollment.status]}</StatusPill>
                {enrollment.paused_reason ? (
                  <p className="type-caption mt-1 text-warning-ink">{enrollment.paused_reason}</p>
                ) : enrollment.last_error ? (
                  <p className="type-caption mt-1 text-danger-ink">{enrollment.last_error}</p>
                ) : null}
              </div>
              <span className="type-caption text-text-secondary tabular-nums">
                {enrollment.status === "active" && enrollment.next_send_at
                  ? formatDateTime(enrollment.next_send_at)
                  : enrollment.replied_at
                    ? `Réponse ${relativeDays(enrollment.replied_at)}`
                    : enrollment.last_sent_at
                      ? `Dernier envoi ${relativeDays(enrollment.last_sent_at)}`
                      : "—"}
              </span>
              <button
                type="button"
                onClick={() => setEditing(row)}
                className="focus-visible:ring-ring group flex min-w-0 items-start gap-1.5 rounded-sm text-left focus-visible:ring-2 focus-visible:outline-none"
                aria-label={`Modifier l'observation de ${contactDisplayName(contact)}`}
              >
                <span className={cn("type-caption line-clamp-2", observation ? "text-text-primary" : "text-text-secondary")}>
                  {observation ?? (pendingObservation ? "En préparation…" : "Aucune observation")}
                </span>
                <Pencil className="mt-0.5 size-3 shrink-0 text-text-secondary opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" strokeWidth={1.75} aria-hidden />
              </button>
              <div className="flex items-center gap-1">
                {enrollment.status === "active" ? (
                  <IconButton label={`Mettre en pause · ${name}`} disabled={isBusy} onClick={() => act(enrollment.id, "pause")}>
                    <Pause className="size-3.5" strokeWidth={1.75} aria-hidden />
                  </IconButton>
                ) : null}
                {enrollment.status === "paused" ? (
                  <IconButton label={`Reprendre · ${name}`} disabled={isBusy} onClick={() => act(enrollment.id, "resume")}>
                    <Play className="size-3.5" strokeWidth={1.75} aria-hidden />
                  </IconButton>
                ) : null}
                {enrollment.status === "active" || enrollment.status === "paused" ? (
                  <IconButton label={`Arrêter · ${name}`} disabled={isBusy} onClick={() => act(enrollment.id, "stop")}>
                    <Square className="size-3.5" strokeWidth={1.75} aria-hidden />
                  </IconButton>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <ObservationDialog row={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="focus-visible:ring-ring rounded-sm p-1.5 text-text-secondary hover:bg-surface-sunken hover:text-text-primary focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ObservationDialog({ row, onClose }: { row: EnrollmentRow | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [forId, setForId] = useState<string | null>(null);

  // Le texte suit la ligne ouverte ; on ne réinitialise que quand elle change.
  if (row && row.enrollment.id !== forId) {
    setForId(row.enrollment.id);
    setText(row.enrollment.personalization.observation ?? "");
  }

  function save() {
    if (!row) return;
    startTransition(async () => {
      const result = await updateObservation({ enrollmentId: row.enrollment.id, observation: text });
      if (result.ok) {
        toast.success(result.message ?? "Enregistré.");
        onClose();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={row !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Observation</DialogTitle>
        </DialogHeader>
        {row ? (
          <div className="grid gap-3">
            <p className="type-caption text-text-secondary">
              {contactDisplayName(row.contact)} · {row.prospect.company_name}
              {row.prospect.website ? ` · ${row.prospect.website}` : ""}
            </p>
            <TextArea
              aria-label="Observation"
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={400}
              className="min-h-28"
              placeholder="Une phrase concrète tirée de leur site ou de leurs pubs."
            />
            {row.enrollment.personalization.error ? (
              <p className="type-caption text-warning-ink">{row.enrollment.personalization.error}</p>
            ) : null}
            <div>
              <Button type="button" onClick={save} disabled={pending}>
                <PendingLabel pending={pending} busy="Enregistrement…">
                  Enregistrer
                </PendingLabel>
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
