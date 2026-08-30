"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { inviteToWorkspace, type ActionResult } from "@/app/actions/access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PendingLabel } from "@/components/ds/pending-label";
import type { WorkspaceAccess } from "@/lib/auth";

const ROLE_LABELS: Record<string, string> = {
  client: "Client",
  contributor: "Contributeur",
};

export function InviteForm({ workspaces }: { workspaces: WorkspaceAccess[] }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    inviteToWorkspace,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message);
      formRef.current?.reset();
    } else {
      toast.error(state.error);
    }
  }, [state]);

  if (workspaces.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Aucun espace partageable pour le moment.
      </p>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="border-border bg-card space-y-4 rounded-xl border p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="invite-first-name">Prénom</Label>
          <Input id="invite-first-name" name="firstName" placeholder="Camille" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-last-name">Nom</Label>
          <Input id="invite-last-name" name="lastName" placeholder="Durand" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
      <div className="space-y-2">
        <Label htmlFor="invite-email">Adresse email</Label>
        <Input
          id="invite-email"
          name="email"
          type="email"
          required
          placeholder="prenom@client.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="invite-workspace">Espace</Label>
        <Select name="workspaceId" required defaultValue={workspaces[0]?.id}>
          <SelectTrigger id="invite-workspace" className="w-full sm:w-44">
            {/* Base UI affiche la *valeur* par défaut : ici un UUID. On rend
                le nom de l'espace à la place. */}
            <SelectValue placeholder="Choisir">
              {(value: string) =>
                workspaces.find((workspace) => workspace.id === value)?.name ??
                "Choisir"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {workspaces.map((workspace) => (
              <SelectItem key={workspace.id} value={workspace.id}>
                {workspace.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="invite-role">Rôle</Label>
        <div className="flex gap-2">
          <Select name="role" required defaultValue="client">
            <SelectTrigger id="invite-role" className="w-full sm:w-40">
              <SelectValue>
                {(value: string) => ROLE_LABELS[value] ?? value}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={pending}>
            <PendingLabel pending={pending} busy="Envoi…">Inviter</PendingLabel>
          </Button>
        </div>
      </div>
      </div>
    </form>
  );
}
