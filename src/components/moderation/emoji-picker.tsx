"use client";

import { useState } from "react";
import { Smile } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Un choix d'emojis, sans dépendance.
 *
 * Une bibliothèque d'emojis pèse plusieurs centaines de kilo-octets pour un
 * geste qu'on fait trois fois par jour, et la contrainte du projet est de ne
 * rien ajouter hors shadcn. Ce sont donc les quarante que la modération
 * utilise réellement — cœurs, pouces, sourires, et le petit jeu de symboles
 * d'un SAV — rangés par famille.
 *
 * Le clavier système reste le vrai outil pour tout le reste : ce panneau
 * évite d'aller le chercher pour un « ❤️ ».
 */
const FAMILIES: { title: string; emojis: string[] }[] = [
  {
    title: "Réactions",
    emojis: ["❤️", "🧡", "💚", "👍", "🙌", "👏", "🔥", "✨", "🎉", "💯"],
  },
  {
    title: "Visages",
    emojis: ["😊", "😍", "🥰", "😉", "🙂", "😅", "🤗", "🤔", "😌", "🙏"],
  },
  {
    title: "Service",
    emojis: ["✅", "❌", "⚠️", "📦", "🚚", "📩", "📞", "🕐", "🔗", "📍"],
  },
];

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label="Insérer un emoji"
        title="Insérer un emoji"
        className="focus-visible:ring-ring flex size-8 items-center justify-center rounded-md border border-border bg-surface text-text-secondary transition-colors duration-(--motion-duration) ease-standard hover:bg-surface-sunken hover:text-text-primary focus-visible:ring-2 focus-visible:outline-none"
      >
        <Smile className="size-4" strokeWidth={1.75} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 min-w-64 p-2">
        {FAMILIES.map((family) => (
          <div key={family.title} className="mb-1.5 last:mb-0">
            <p className="type-overline text-text-secondary px-1">{family.title}</p>
            <div className="mt-1 grid grid-cols-10 gap-0.5">
              {family.emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={emoji}
                  onClick={() => {
                    onPick(emoji);
                    setOpen(false);
                  }}
                  className="focus-visible:ring-ring flex size-5.5 items-center justify-center rounded-sm text-base transition-colors duration-(--motion-duration) ease-standard hover:bg-surface-sunken focus-visible:ring-2 focus-visible:outline-none"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
