"use client";

import { useState, useTransition } from "react";
import { Copy, Mail, RotateCcw, Trash2, UserMinus } from "lucide-react";
import { toast } from "sonner";

import {
  deleteEnrollment,
  resendOnboarding,
  setEnrollmentStatus,
} from "@/app/actions/academy";
import { PanelRows } from "@/components/ds/surface";
import { StatusPill, type StatusTone } from "@/components/ds/status-pill";
import { Button } from "@/components/ui/button";
import {
  ENROLLMENT_STATUS_LABELS,
  type AcademyEnrollment,
  type AcademyEnrollmentStatus,
} from "@/lib/academy/types";
import { formatDayFr } from "@/lib/format";

const TONES: Record<AcademyEnrollmentStatus, StatusTone> = {
  active: "positive",
  invited: "info",
  revoked: "neutral",
};

/**
 * Le fichier des inscrites d'une formation.
 *
 * « Retirer » ne supprime pas : la ligne passe en `revoked`, l'accès se ferme,
 * la progression reste. On garde la trace de qui a acheté quoi, et rendre
 * l'accès ne repart pas de zéro. La suppression franche existe à côté, pour la
 * ligne créée par erreur.
 */
export function EnrollmentTable({
  enrollments,
}: {
  enrollments: AcademyEnrollment[];
}) {
  return (
    <PanelRows>
      {enrollments.map((enrollment) => (
        <EnrollmentRow key={enrollment.id} enrollment={enrollment} />
      ))}
    </PanelRows>
  );
}

function EnrollmentRow({ enrollment }: { enrollment: AcademyEnrollment }) {
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);

  const name = [enrollment.first_name, enrollment.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-48 flex-1">
          <p className="type-body font-medium text-text-primary">
            {name || enrollment.email}
          </p>
          <p className="type-caption text-text-secondary">
            {name ? enrollment.email : null}
            {name ? " · " : null}
            {/* Le `slice` coupe l'horodatage au jour UTC : `formatDayFr`
                attend une date nue, et tout calcul de date se fait en UTC. */}
            {enrollment.status === "active" && enrollment.activated_at
              ? `entrée le ${formatDayFr(enrollment.activated_at.slice(0, 10))}`
              : `invitée le ${formatDayFr(enrollment.invited_at.slice(0, 10))}`}
          </p>
        </div>

        <StatusPill tone={TONES[enrollment.status]} className="shrink-0">
          {ENROLLMENT_STATUS_LABELS[enrollment.status]}
        </StatusPill>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Renvoyer l'accès à ${enrollment.email}`}
            disabled={pending}
            onClick={() => {
              start(async () => {
                const result = await resendOnboarding({ enrollmentId: enrollment.id });
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success(result.message);
                setLink(result.sent ? null : result.link);
              });
            }}
          >
            <Mail aria-hidden strokeWidth={1.75} />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={
              enrollment.status === "revoked"
                ? `Rendre l'accès à ${enrollment.email}`
                : `Retirer l'accès de ${enrollment.email}`
            }
            disabled={pending}
            onClick={() => {
              start(async () => {
                const result = await setEnrollmentStatus({
                  enrollmentId: enrollment.id,
                  // Rendre l'accès repose sur `active` et non `invited` : la
                  // personne est déjà venue, lui redemander de cliquer un lien
                  // serait une étape pour rien.
                  status: enrollment.status === "revoked" ? "active" : "revoked",
                });
                if (result.ok) toast.success(result.message ?? "Fait.");
                else toast.error(result.error);
              });
            }}
          >
            {enrollment.status === "revoked" ? (
              <RotateCcw aria-hidden strokeWidth={1.75} />
            ) : (
              <UserMinus aria-hidden strokeWidth={1.75} />
            )}
          </Button>

          <Button
            variant="ghost"
            size={armed ? "sm" : "icon-sm"}
            aria-label={`Supprimer l'inscription de ${enrollment.email}`}
            disabled={pending}
            className={armed ? "text-danger-ink" : undefined}
            onClick={() => {
              if (!armed) {
                setArmed(true);
                setTimeout(() => setArmed(false), 3000);
                return;
              }
              setArmed(false);
              start(async () => {
                const result = await deleteEnrollment({ enrollmentId: enrollment.id });
                if (result.ok) toast.success(result.message ?? "Supprimée.");
                else toast.error(result.error);
              });
            }}
          >
            {armed ? "Confirmer ?" : <Trash2 aria-hidden strokeWidth={1.75} />}
          </Button>
        </div>
      </div>

      {link ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="type-caption min-w-0 flex-1 truncate rounded bg-muted px-2 py-1.5 text-text-primary">
            {link}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(link);
              toast.success("Lien copié.");
            }}
          >
            <Copy data-icon="inline-start" aria-hidden strokeWidth={1.75} />
            Copier
          </Button>
        </div>
      ) : null}
    </div>
  );
}
