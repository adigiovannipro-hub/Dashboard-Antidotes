import type { Metadata } from "next";

import { AppShell } from "@/components/ds/app-shell";
import { requireViewer } from "@/lib/auth";
import { requireModeration } from "@/lib/moderation/access";

export const metadata: Metadata = {
  title: "Inbox",
};

/**
 * Coquille du module Inbox — la Modération, renommée le 11/09 : ce qu'on
 * ouvre le matin est une boîte de réception, pas un poste de police.
 *
 * `requireModeration` renvoie un 404 — et non un 403 — pour qui n'y a pas
 * accès : le module est interne, et un 403 révélerait son existence à un client
 * du dashboard de reporting.
 */
export default async function InboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await requireViewer();
  await requireModeration();

  return (
    <AppShell
      viewer={viewer}
      hideOpenAccessBadge
      title="Inbox"
      subtitle="Commentaires et messages privés de tous les clients. Réponses validées manuellement."
    >
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </AppShell>
  );
}
