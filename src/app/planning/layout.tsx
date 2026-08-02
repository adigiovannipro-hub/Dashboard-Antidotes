import type { Metadata } from "next";

import { AppHeader } from "@/components/app-header";
import { requireViewer } from "@/lib/auth";
import { requirePlanning } from "@/lib/planning/access";

export const metadata: Metadata = {
  title: "Planning Édito",
};

/**
 * Coquille du module Planning Édito.
 *
 * `requirePlanning` renvoie un 404 — et non un 403 — pour qui n'y a pas accès :
 * le module est interne, et un 403 révélerait son existence à un client du
 * dashboard de reporting.
 */
export default async function PlanningLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await requireViewer();
  await requirePlanning();

  return (
    <>
      <AppHeader viewer={viewer} />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </>
  );
}
