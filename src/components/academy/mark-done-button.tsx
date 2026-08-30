"use client";

import { useTransition } from "react";
import { CircleCheck } from "lucide-react";
import { toast } from "sonner";

import { markLessonDone } from "@/app/actions/academy";
import { Button } from "@/components/ui/button";

/**
 * « Marquer comme terminé » — et le geste inverse, rouvrir.
 *
 * Pas d'état local : l'action revalide `/academy` et le serveur renvoie la
 * vérité. Le bouton dit simplement qu'il travaille pendant l'aller-retour.
 */
export function MarkDoneButton({
  lessonId,
  done,
}: {
  lessonId: string;
  done: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={done ? "outline" : "default"}
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await markLessonDone({ lessonId, done: !done });
          if (!result.ok) toast.error(result.error);
        });
      }}
    >
      <CircleCheck data-icon="inline-start" aria-hidden strokeWidth={1.75} />
      {pending ? "Un instant…" : done ? "Terminée — rouvrir" : "Marquer comme terminé"}
    </Button>
  );
}
