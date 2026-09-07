import { AntidotesNav } from "@/components/antidotes/antidotes-nav";
import { AppShell } from "@/components/ds/app-shell";
import { requireAntidotesAccess } from "@/lib/antidotes/access";
import { requireViewer } from "@/lib/auth";

/**
 * Le pôle Antidotes — outbound et inbound de l'agence elle-même.
 *
 * Distinct de `/entreprise`, qui porte la comptabilité : ici on prospecte et
 * on publie pour Antidotes, on ne compte pas. L'accès est vérifié dans le
 * layout, comme pour Finance : les pages n'ont pas à le refaire, et aucune
 * sous-route ne peut être ajoutée en oubliant le contrôle. Qui n'est pas
 * owner tombe sur un 404 — le module n'existe pas pour lui.
 *
 * `wide` : un kanban à huit colonnes prend l'écran qu'on lui donne.
 */
export default async function AntidotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await requireViewer();
  await requireAntidotesAccess();

  return (
    <AppShell viewer={viewer} title="Prospection" wide>
      <div className="flex min-w-0 flex-col gap-6">
        <AntidotesNav />
        <div className="min-w-0">{children}</div>
      </div>
    </AppShell>
  );
}
