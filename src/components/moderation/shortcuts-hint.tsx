"use client";

import { useState } from "react";
import { Keyboard } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Aide-mémoire des raccourcis.
 *
 * Un outil pensé pour le clavier doit dire lesquels : sans cette liste, seul
 * celui qui a écrit le code les connaît.
 */
const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["J", "↓"], label: "Message suivant" },
  { keys: ["K", "↑"], label: "Message précédent" },
  { keys: ["V"], label: "Valider et envoyer" },
  { keys: ["R"], label: "Refuser — ouvre la correction" },
  { keys: ["I"], label: "Ignorer" },
  { keys: ["A"], label: "Mettre en attente" },
  { keys: ["E"], label: "Éditer le brouillon" },
  { keys: ["/"], label: "Rechercher" },
  { keys: ["?"], label: "Cette aide" },
  { keys: ["Échap"], label: "Quitter le champ courant" },
];

export function ShortcutsHint() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Raccourcis clavier"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-brand rounded p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <Keyboard className="size-4" aria-hidden />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raccourcis clavier</DialogTitle>
            <DialogDescription>
              Tout le traitement se fait au clavier. La souris n&apos;est jamais
              nécessaire.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-1.5 text-sm">
            {SHORTCUTS.map((shortcut) => (
              <li key={shortcut.label} className="flex items-baseline gap-3">
                <span className="flex shrink-0 gap-1">
                  {shortcut.keys.map((key) => (
                    <kbd
                      key={key}
                      className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-[11px]"
                    >
                      {key}
                    </kbd>
                  ))}
                </span>
                <span className="text-muted-foreground">{shortcut.label}</span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
