"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import {
  cancelInvitation,
  revokeAccess,
  type ActionResult,
} from "@/app/actions/access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

interface MemberRow {
  id: string;
  userId: string;
  email: string;
  workspaceId: string;
  workspaceName: string;
  role: string;
}

interface InvitationRow {
  id: string;
  email: string;
  workspaceName: string;
  role: string;
  expiresAt: string;
}

export function AccessTable({
  members,
  invitations,
}: {
  members: MemberRow[];
  invitations: InvitationRow[];
}) {
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
                  <TableHead>Adresse</TableHead>
                  <TableHead>Espace</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead className="w-px" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.email}</TableCell>
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
                    <TableCell className="font-medium">{invitation.email}</TableCell>
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
    </div>
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
