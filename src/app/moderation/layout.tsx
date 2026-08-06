import type { Metadata } from "next";

import { AppShell } from "@/components/ds/app-shell";
import { requireViewer } from "@/lib/auth";
import { requireModeration } from "@/lib/moderation/access";

export const metadata: Metadata = {
  title: "Modération",
};

/**
 * Coquille du module Modération.
 *
 * `requireModeration` renvoie un 404 — et non un 403 — pour qui n'y a pas
 * accès : le module est interne, et un 403 révélerait son existence à un client
 * du dashboard de reporting.
 */
export default async function ModerationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await requireViewer();
  await requireModeration();

  return (
    <AppShell
      viewer={viewer}
      title="Modération"
      subtitle="Messages et commentaires, réponses validées à la main"
    >
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </AppShell>
  );
}
