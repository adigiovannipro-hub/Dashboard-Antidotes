"use client";

import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Aide-mémoire des raccourcis, ouvert par « ? ».
 *
 * Un outil pensé pour le clavier doit dire lesquels : sans cette liste, seul
 * celui qui a écrit le code les connaît. Mais une icône de clavier posée dans
 * la barre occupait la place toute l'année pour un panneau qu'on ouvre deux
 * fois — et personne ne la reconnaissait. « ? » est la convention de toutes
 * les applications au clavier, et il est lui-même dans la liste.
 */
const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["J", "↓"], label: "Message suivant" },
  { keys: ["K", "↑"], label: "Message précédent" },
  { keys: ["V"], label: "Valider et envoyer" },
  { keys: ["R"], label: "Refuser — ouvre la correction" },
  { keys: ["I"], label: "Ignorer" },
  { keys: ["A"], label: "Mettre en attente" },
  { keys: ["⌘", "Entrée"], label: "Envoyer la réponse écrite à la main" },
  { keys: ["/"], label: "Rechercher" },
  { keys: ["?"], label: "Cette aide" },
  { keys: ["Échap"], label: "Quitter le champ, puis refermer le fil" },
];

export function ShortcutsHint() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "?") return;
      const target = event.target as HTMLElement | null;
      // On tape « ? » dans une réponse : le panneau ne doit pas s'ouvrir.
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      event.preventDefault();
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
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
