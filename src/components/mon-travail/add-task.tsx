"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { QuickAdd } from "@/components/mon-travail/quick-add";
import { Button } from "@/components/ui/button";
import type { TaskWorkspace } from "@/lib/mon-travail/types";

/**
 * L'ajout de tâche, replié derrière un bouton dans l'en-tête du panneau.
 *
 * Le champ était posé en travers de la liste et coupait la lecture : on
 * consulte ses tâches cent fois pour une qu'on en ajoute. Il reste à une
 * frappe — le bouton donne le focus au champ dès l'ouverture.
 */
export function AddTask({ clientWorkspaces, today }: {
  clientWorkspaces: TaskWorkspace[];
  today: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={open ? "ghost" : "accent"}
        size="sm"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
      >
        {open ? (
          <>
            <X className="size-3.5" aria-hidden />
            Fermer
          </>
        ) : (
          <>
            <Plus className="size-3.5" aria-hidden />
            Ajouter
          </>
        )}
      </Button>

      {open ? (
        <div className="absolute inset-x-0 top-full z-10 border-b border-border bg-surface-sunken p-4">
          <QuickAdd clientWorkspaces={clientWorkspaces} today={today} autoFocus />
        </div>
      ) : null}
    </>
  );
}
