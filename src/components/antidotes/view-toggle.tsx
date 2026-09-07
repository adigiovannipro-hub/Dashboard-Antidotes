"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Kanban, Table2 } from "lucide-react";

import {
  PIPELINE_VIEW_COOKIE,
  PREFERENCE_MAX_AGE,
  type PipelineView,
} from "@/lib/ui-preferences";
import { cn } from "@/lib/utils";

function remember(view: PipelineView) {
  document.cookie = `${PIPELINE_VIEW_COOKIE}=${view}; path=/; max-age=${PREFERENCE_MAX_AGE}; samesite=lax`;
}

/**
 * Kanban ou tableau. Le choix vit dans un cookie, pas dans le stockage
 * local : c'est le serveur qui rend la première image, il doit connaître la
 * vue avant de l'envoyer. Le bouton bascule tout de suite, la page suit.
 */
export function ViewToggle({ view }: { view: PipelineView }) {
  const router = useRouter();
  const [current, setCurrent] = useState(view);
  const [pending, startTransition] = useTransition();

  function choose(next: PipelineView) {
    if (next === current) return;
    setCurrent(next);
    remember(next);
    startTransition(() => router.refresh());
  }

  const option = (value: PipelineView, label: string, Icon: typeof Kanban) => (
    <button
      type="button"
      onClick={() => choose(value)}
      aria-pressed={current === value}
      aria-label={label}
      title={label}
      className={cn(
        "focus-visible:ring-ring flex size-7 items-center justify-center rounded-pill transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
        current === value
          ? "bg-primary text-primary-foreground"
          : "text-text-secondary hover:text-text-primary",
      )}
    >
      <Icon className="size-4" strokeWidth={1.75} aria-hidden />
    </button>
  );

  return (
    <div
      role="group"
      aria-label="Affichage du pipeline"
      aria-busy={pending}
      className="inline-flex items-center gap-1 rounded-pill bg-surface-sunken p-1"
    >
      {option("kanban", "Kanban", Kanban)}
      {option("tableau", "Tableau", Table2)}
    </div>
  );
}
