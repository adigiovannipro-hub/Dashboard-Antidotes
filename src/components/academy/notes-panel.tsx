"use client";

import { useEffect, useRef, useState } from "react";

import { saveLessonNote } from "@/app/actions/academy";

/**
 * Le bloc-notes d'une leçon, sauvegardé tout seul.
 *
 * L'écriture part 900 ms après la dernière frappe — assez court pour ne rien
 * perdre en fermant l'onglet, assez long pour ne pas mitrailler le serveur à
 * chaque lettre. L'état de sauvegarde se dit en toutes lettres sous le champ :
 * un enregistrement silencieux qui échoue est une note perdue sans prévenir.
 */

type SaveState = "idle" | "saving" | "saved" | "error";

const SAVE_LABELS: Record<SaveState, string> = {
  idle: "Sauvegarde automatique.",
  saving: "Enregistrement…",
  saved: "Enregistré.",
  error: "L'enregistrement a échoué — la note reste dans le champ, réessaie.",
};

export function NotesPanel({
  lessonId,
  initialContent,
}: {
  lessonId: string;
  initialContent: string;
}) {
  const [content, setContent] = useState(initialContent);
  const [state, setState] = useState<SaveState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRenderRef = useRef(true);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setState("saving");
      void saveLessonNote({ lessonId, content }).then((result) => {
        setState(result.ok ? "saved" : "error");
      });
    }, 900);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [content, lessonId]);

  return (
    <div className="max-w-[72ch]">
      <label htmlFor="academy-note" className="sr-only">
        Mes notes sur cette leçon
      </label>
      <textarea
        id="academy-note"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Ce que tu retiens, ce que tu veux appliquer, tes chiffres à toi…"
        rows={10}
        className="type-body w-full resize-y rounded-md border border-input bg-surface px-3 py-2 leading-relaxed transition-colors duration-(--motion-duration) ease-standard outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
      />
      <p
        aria-live="polite"
        className={
          state === "error"
            ? "type-caption mt-1.5 text-danger-ink"
            : "type-caption mt-1.5 text-text-secondary"
        }
      >
        {SAVE_LABELS[state]}
      </p>
    </div>
  );
}
