"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { runSequencesNow } from "@/app/actions/antidotes-sequences";
import { PendingLabel } from "@/components/ds/pending-label";
import { Button } from "@/components/ui/button";

/**
 * « Passer maintenant » — joue le passage à la demande : relevé des fils,
 * observations, envois dus. Le workflow ne le joue plus tout seul (portée
 * `sequences` sur demande) : ce bouton est le chemin normal, et sert le jour
 * où l'on veut voir partir le premier email.
 */
export function RunSequencesButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await runSequencesNow();
          if (result.ok) {
            toast.success(result.message ?? "Passage terminé.");
            router.refresh();
          } else {
            toast.error(result.error);
          }
        })
      }
    >
      <Send aria-hidden />
      <PendingLabel pending={pending} busy="Passage…">
        Passer maintenant
      </PendingLabel>
    </Button>
  );
}
