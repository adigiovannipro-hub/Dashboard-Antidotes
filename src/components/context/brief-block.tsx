"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Un bloc du brief, replié quand il est rempli.
 *
 * La règle de la refonte : **seuls les blocs vides restent dépliés**. Un brief
 * complet tenait sur trois écrans de champs qu'on ne vient pas relire, et le
 * seul champ vide — celui qu'on vient remplir — se noyait au milieu. Replié,
 * un bloc rempli se résume en une ligne cliquable ; vide, il est ouvert et
 * porte son invitation.
 *
 * L'état initial se calcule au rendu depuis `rempli`, jamais par un effet :
 * un `setState` dans un effet est interdit par le compilateur React du dépôt,
 * et remettrait le bloc à zéro au moindre rafraîchissement.
 */
export function BriefBlock({
  id,
  title,
  hint,
  filled,
  summary,
  tone = "neutral",
  flush = false,
  action,
  children,
}: {
  /** Ancre de la barre de complétude — même chaîne que `CompletenessEntry.ancre`. */
  id: string;
  title: string;
  hint?: string;
  filled: boolean;
  /** Ce que la ligne repliée montre : la première ligne, un décompte. */
  summary: string;
  /** `danger` pour les interdits : ils ne se lisent pas comme le reste. */
  tone?: "neutral" | "danger";
  /**
   * Corps sans marge : pour les éditeurs qui portent déjà leurs propres
   * rangées à `px-5`, sans quoi la marge se paierait deux fois.
   */
  flush?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(!filled);

  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 rounded-lg border bg-surface shadow-card",
        tone === "danger" ? "border-danger-ink/30" : "border-border",
      )}
    >
      <div className="flex items-start gap-2 px-5 py-4">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="focus-visible:ring-ring -m-1 flex min-w-0 flex-1 items-start gap-2 rounded-md p-1 text-left focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronDown
            aria-hidden
            strokeWidth={1.75}
            className={cn(
              "mt-0.5 size-4 shrink-0 text-text-tertiary transition-transform duration-(--motion-duration) ease-standard",
              open ? "" : "-rotate-90",
            )}
          />
          <span className="min-w-0 flex-1">
            <span className="type-h3 block">{title}</span>
            {/* Replié : le résumé. Déplié : l'aide de saisie, s'il y en a une.
                Jamais les deux — ce serait deux phrases sous un titre. */}
            {!open && summary ? (
              <span className="type-caption mt-0.5 block truncate text-text-secondary">
                {summary}
              </span>
            ) : null}
            {open && hint ? (
              <span className="type-caption mt-0.5 block text-text-secondary">{hint}</span>
            ) : null}
          </span>
        </button>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      {open ? (
        <div className={cn("border-t border-border", flush ? "" : "px-5 py-4")}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

/** La première ligne d'un texte, pour la ligne repliée. */
export function firstLine(value: string | null | undefined): string {
  if (!value) return "";
  const line = value.trim().split("\n")[0] ?? "";
  return line.length > 120 ? `${line.slice(0, 120)}…` : line;
}
