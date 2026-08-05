"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { createTask, type TravailResult } from "@/app/actions/mon-travail";
import { Button } from "@/components/ui/button";
import type { TaskWorkspace } from "@/lib/mon-travail/types";

/**
 * L'ajout en deux secondes : un champ, entrée, c'est noté. Le rattachement
 * client et la date sont là mais n'exigent rien — leurs valeurs par défaut
 * (« aucun client », aujourd'hui) sont les bonnes neuf fois sur dix.
 */
export function QuickAdd({
  clientWorkspaces,
  today,
}: {
  clientWorkspaces: TaskWorkspace[];
  today: string;
}) {
  const [result, action, pending] = useActionState<TravailResult | null, FormData>(
    createTask,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const lastResult = useRef<TravailResult | null>(null);

  useEffect(() => {
    if (!result || result === lastResult.current) return;
    lastResult.current = result;
    if (result.ok) {
      formRef.current?.reset();
      formRef.current?.querySelector<HTMLInputElement>("input[name=title]")?.focus();
    } else {
      toast.error(result.error);
    }
  }, [result]);

  const field =
    "border-input bg-background focus-visible:ring-brand rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none";

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2 sm:flex-row">
      <input
        name="title"
        required
        maxLength={300}
        placeholder="Ajouter une tâche…"
        aria-label="Nouvelle tâche"
        autoComplete="off"
        className={`${field} min-w-0 flex-1`}
      />

      <div className="flex gap-2">
        <select
          name="workspaceId"
          aria-label="Client rattaché"
          defaultValue=""
          className={`${field} text-muted-foreground min-w-0 flex-1 sm:w-40 sm:flex-none`}
        >
          <option value="">Aucun client</option>
          {clientWorkspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          name="dueDate"
          defaultValue={today}
          aria-label="Échéance"
          className={`${field} tabular-nums`}
        />

        <Button type="submit" disabled={pending} aria-label="Ajouter la tâche">
          <Plus className="size-4" aria-hidden />
          <span className="hidden sm:inline">Ajouter</span>
        </Button>
      </div>
    </form>
  );
}
