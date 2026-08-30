"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import {
  attachAvatar,
  cancelInvitation,
  prepareAvatarUpload,
  revokeAccess,
  updateMemberProfile,
  type ActionResult,
} from "@/app/actions/access";
import { PendingLabel } from "@/components/ds/pending-label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ROLE_LABELS: Record<string, string> = {
  owner: "Propriétaire",
  contributor: "Contributeur",
  client: "Client",
};

type MemberRow = {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  /** URL signée de la photo, ou null — les initiales prennent le relais. */
  avatarUrl: string | null;
  workspaceId: string;
  workspaceName: string;
  role: string;
};

type InvitationRow = {
  id: string;
  email: string;
  fullName: string;
  workspaceName: string;
  role: string;
  expiresAt: string;
};

/** Les initiales du rond de secours : prénom + nom, sinon l'adresse. */
function initialsOf(member: MemberRow): string {
  const parts = [member.firstName, member.lastName].filter((part) => part !== "");
  if (parts.length > 0) {
    return parts.map((part) => part.charAt(0).toUpperCase()).join("");
  }
  return member.email.charAt(0).toUpperCase();
}

export function AccessTable({
  members,
  invitations,
}: {
  members: MemberRow[];
  invitations: InvitationRow[];
}) {
  const [editing, setEditing] = useState<MemberRow | null>(null);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Accès actifs</h2>
        {members.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Personne d&apos;autre que vous n&apos;a encore accès à un espace.
          </p>
        ) : (
          <div className="border-border overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Membre</TableHead>
                  <TableHead>Espace</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead className="w-px" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          {member.avatarUrl ? (
                            <AvatarImage src={member.avatarUrl} alt="" />
                          ) : null}
                          <AvatarFallback className="text-xs">
                            {initialsOf(member)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          {member.firstName || member.lastName ? (
                            <>
                              <p className="truncate font-medium">
                                {[member.firstName, member.lastName]
                                  .filter(Boolean)
                                  .join(" ")}
                              </p>
                              <p className="text-muted-foreground truncate text-xs">
                                {member.email}
                              </p>
                            </>
                          ) : (
                            <p className="truncate font-medium">{member.email}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditing(member)}
                          aria-label={`Modifier la fiche de ${member.email}`}
                          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded p-1 focus-visible:ring-2 focus-visible:outline-none"
                        >
                          <Pencil className="size-3.5" strokeWidth={1.75} aria-hidden />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>{member.workspaceName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {ROLE_LABELS[member.role] ?? member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <RevokeButton
                        userId={member.userId}
                        workspaceId={member.workspaceId}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {invitations.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Invitations en attente</h2>
          <div className="border-border overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Adresse</TableHead>
                  <TableHead>Espace</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Expire le</TableHead>
                  <TableHead className="w-px" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">
                      {invitation.email}
                      {invitation.fullName ? (
                        <span className="text-muted-foreground ml-2 text-xs font-normal">
                          {invitation.fullName}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>{invitation.workspaceName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ROLE_LABELS[invitation.role] ?? invitation.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Intl.DateTimeFormat("fr-FR", {
                        dateStyle: "long",
                      }).format(new Date(invitation.expiresAt))}
                    </TableCell>
                    <TableCell>
                      <CancelButton invitationId={invitation.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}

      {editing ? (
        <ProfileDialog member={editing} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}

/**
 * La fiche d'un membre : prénom, nom, photo. La photo part du navigateur
 * droit au bucket — même mécanique que les logos d'espace — et s'affiche en
 * rond dans le tableau.
 */
function ProfileDialog({
  member,
  onClose,
}: {
  member: MemberRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(member.firstName);
  const [lastName, setLastName] = useState(member.lastName);
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const save = () => {
    start(async () => {
      const form = new FormData();
      form.set("userId", member.userId);
      form.set("firstName", firstName);
      form.set("lastName", lastName);
      const result = await updateMemberProfile(null, form);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      onClose();
      router.refresh();
    });
  };

  const uploadPhoto = (file: File) => {
    start(async () => {
      const prepared = await prepareAvatarUpload({
        userId: member.userId,
        name: file.name,
        type: file.type,
        size: file.size,
      });
      if (!prepared.ok) {
        toast.error(prepared.error);
        return;
      }

      const upload = await fetch(prepared.url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      }).catch(() => null);
      if (!upload?.ok) {
        toast.error("Envoi interrompu. Réessayer.");
        return;
      }

      const form = new FormData();
      form.set("userId", member.userId);
      form.set("path", prepared.path);
      const attached = await attachAvatar(null, form);
      if (!attached.ok) {
        toast.error(attached.error);
        return;
      }
      toast.success(attached.message);
      router.refresh();
    });
  };

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fiche de {member.email}</DialogTitle>
          <DialogDescription>
            Le nom s&apos;affiche à la place de l&apos;adresse, la photo en rond
            à côté. PNG, JPG ou WebP, 2 Mo maximum.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 py-1">
          <Avatar className="size-14">
            {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" /> : null}
            <AvatarFallback>{initialsOf(member)}</AvatarFallback>
          </Avatar>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => fileInput.current?.click()}
          >
            Changer la photo
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) uploadPhoto(file);
            }}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="type-overline text-text-secondary">Prénom</span>
            <Input
              autoFocus
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              aria-label="Prénom"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="type-overline text-text-secondary">Nom</span>
            <Input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              aria-label="Nom"
            />
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={pending} onClick={save}>
            <PendingLabel pending={pending} busy="En cours…">
              Enregistrer
            </PendingLabel>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Affiche le retour de l'action en toast, sans bloquer le rendu du tableau. */
function useActionToast(state: ActionResult | null) {
  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.error);
  }, [state]);
}

function RevokeButton({
  userId,
  workspaceId,
}: {
  userId: string;
  workspaceId: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    revokeAccess,
    null,
  );
  useActionToast(state);

  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        Révoquer
      </Button>
    </form>
  );
}

function CancelButton({ invitationId }: { invitationId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    cancelInvitation,
    null,
  );
  useActionToast(state);

  return (
    <form action={action}>
      <input type="hidden" name="invitationId" value={invitationId} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        Annuler
      </Button>
    </form>
  );
}
