"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Les boutons de génération de wording — outil d'agence, invisibles du client
 * (l'appelant ne les rend qu'à l'owner, et les routes rendent 404 derrière).
 *
 * Le pictogramme est un stylo blanc sur l'encre d'accent : c'est le langage
 * de la création dans ce design system, et l'encre tient le contraste dans
 * les deux thèmes là où le vert vif ne le tient pas.
 */

/** Le stylo d'une cellule : rédige (ou recrée) le wording de cette publication. */
export function GenerateWordingButton({
  subjectId,
  subjectName,
  className,
}: {
  subjectId: string;
  subjectName: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const generate = () => {
    start(async () => {
      const response = await fetch("/api/planning/wording", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject_id: subjectId }),
      }).catch(() => null);

      const body = (await response?.json().catch(() => null)) as
        | { ok: boolean; error?: string }
        | null;
      if (!response?.ok || !body?.ok) {
        toast.error(body?.error ?? "Génération impossible.");
        return;
      }
      toast.success("Wording rédigé.");
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      disabled={pending}
      onClick={(event) => {
        event.stopPropagation();
        generate();
      }}
      aria-label={`Générer le wording de ${subjectName || "la publication"}`}
      title="Générer le wording depuis le contexte client"
      className={cn(
        "bg-accent-ink focus-visible:ring-ring flex size-6 shrink-0 items-center justify-center rounded-md text-white transition-opacity duration-(--motion-duration) ease-standard hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <PenLine className="size-3.5" strokeWidth={2} aria-hidden />
      )}
    </button>
  );
}

/**
 * Le stylo d'un mois : lance la phase wording sur tout le mois — compléter
 * les manquants, ou tout recréer avant validation. Le travail part en job,
 * suivi depuis la carte du client sur l'accueil.
 */
export function MonthWordingMenu({
  workspaceId,
  targetMonth,
  monthLabel,
}: {
  workspaceId: string;
  /** `YYYY-MM-01`, la clé du mois. */
  targetMonth: string;
  monthLabel: string;
}) {
  const [pending, start] = useTransition();

  const launch = (mode: "completer" | "recreer") => {
    start(async () => {
      const response = await fetch("/api/generate/wording", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          target_month: targetMonth,
          mode,
        }),
      }).catch(() => null);

      const body = (await response?.json().catch(() => null)) as
        | { ok: boolean; error?: string }
        | null;
      if (!response?.ok || !body?.ok) {
        toast.error(body?.error ?? "Génération impossible.");
        return;
      }
      toast.success("Génération lancée — suivi sur la carte du client.");
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        aria-label={`Générer les wordings de ${monthLabel}`}
        title="Générer les wordings du mois depuis le contexte client"
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "bg-accent-ink focus-visible:ring-ring flex size-6 shrink-0 items-center justify-center rounded-md text-white transition-opacity duration-(--motion-duration) ease-standard hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none",
          // Discret au repos, présent dès que le mois est survolé — même
          // grammaire que la poignée de drag des lignes.
          "md:opacity-0 md:group-hover/mois:opacity-100 md:focus-visible:opacity-100 md:data-[state=open]:opacity-100",
        )}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <PenLine className="size-3.5" strokeWidth={2} aria-hidden />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 min-w-64"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuItem onClick={() => launch("completer")}>
          Rédiger les wordings manquants
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => launch("recreer")}>
          Recréer aussi ceux à valider
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
