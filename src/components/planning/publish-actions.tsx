"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { PlanningResult } from "@/app/actions/planning";
import { publishSubjectNow, scheduleSubject } from "@/app/actions/publication";
import { ConfirmDialog } from "@/components/ds/confirm-dialog";
import type { useCellAction } from "@/components/planning/cells";
import type { Scope } from "@/components/planning/subject-row";
import { cn } from "@/lib/utils";

/**
 * « Publier » et « Programmer », posés sur la case statut d'une ligne
 * « Validé » au survol — l'agence seule.
 *
 * Ils couvrent la pastille sauf sa marge droite : un clic sur ce reste ouvre
 * toujours le sélecteur de statut, sans quoi une ligne validée ne pourrait
 * plus revenir à « À valider » depuis le tableau. Au clavier, ils apparaissent
 * dès que le focus entre dans la case.
 *
 * Publier demande confirmation : une publication ne se retire pas d'ici. Elle
 * tourne côté serveur une à deux minutes (l'encodage d'un reel) ; la page se
 * relit à quelques reprises pour montrer la ligne passer « Publié ».
 */
const REFRESH_AFTER_MS = [15_000, 45_000, 120_000];

export function PublishActions({
  scope,
  subjectId,
  subjectName,
  networks,
  run,
}: {
  scope: Scope;
  subjectId: string;
  subjectName: string;
  /** « Instagram et Facebook » — ce que la confirmation annonce. */
  networks: string;
  run: ReturnType<typeof useCellAction>["run"];
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const publish = async () => {
    const result: PlanningResult = await run(() => publishSubjectNow(scope, subjectId));
    if (!result.ok) return;
    timers.current = REFRESH_AFTER_MS.map((delay) =>
      window.setTimeout(() => router.refresh(), delay),
    );
  };

  const label = subjectName.trim() ? `« ${subjectName.trim()} »` : "cette publication";

  return (
    <>
      <span className="bg-border-strong absolute inset-y-0 left-0 right-3 hidden gap-px group-focus-within/statut:flex group-hover/statut:flex">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={cn(ACTION, "flex-1")}
        >
          Publier
        </button>
        <button
          type="button"
          onClick={() => run(() => scheduleSubject(scope, subjectId))}
          className={cn(ACTION, "flex-[1.4]")}
        >
          Programmer
        </button>
      </span>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Publier ${label} maintenant`}
        description={`Elle part tout de suite sur ${networks}, sans attendre sa date. Une publication ne se retire pas d'ici.`}
        confirmLabel="Publier"
        confirmVariant="default"
        onConfirm={publish}
      />
    </>
  );
}

const ACTION =
  "bg-surface text-foreground hover:bg-muted focus-visible:ring-ring flex min-w-0 items-center justify-center px-0.5 text-[11px] font-semibold outline-none transition-[background-color] duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:ring-inset";
