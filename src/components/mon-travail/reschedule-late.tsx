"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";

import { updateSubject } from "@/app/actions/planning";
import { PendingLabel } from "@/components/ds/pending-label";
import { Button } from "@/components/ui/button";
import type { PublicationRow } from "@/lib/mon-travail/types";

/**
 * Reprogramme à aujourd'hui les publications validées restées en rade.
 *
 * Un sujet en retard ne part pas tout seul — c'est voulu, l'automate ne
 * rattrape pas la veille. Ce bouton fait le geste humain d'un coup : la date
 * passe à aujourd'hui, et la fenêtre de publication de 16 h les reprend.
 * Chaque ligne passe par la même action que la cellule Date du planning,
 * donc même journal, même revalidation.
 */
export function RescheduleLateButton({ rows }: { rows: PublicationRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const reschedule = () => {
    start(async () => {
      const today = new Date().toISOString().slice(0, 10);
      let done = 0;
      for (const row of rows) {
        const result = await updateSubject(
          { workspace: row.workspace.slug, board: row.board_slug },
          { subjectId: row.subject.id, field: "scheduled_on", value: today },
        );
        if (result.ok) done += 1;
        else toast.error(`${row.subject.name || "Publication"} : ${result.error}`);
      }
      if (done > 0) {
        toast.success(
          done > 1
            ? `${done} publications reprogrammées à aujourd'hui.`
            : "Publication reprogrammée à aujourd'hui.",
        );
        router.refresh();
      }
    });
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={reschedule}
    >
      <CalendarClock className="size-4" strokeWidth={1.75} aria-hidden />
      <PendingLabel pending={pending} busy="Reprogrammation…">
        Reprogrammer aujourd&apos;hui
      </PendingLabel>
    </Button>
  );
}
