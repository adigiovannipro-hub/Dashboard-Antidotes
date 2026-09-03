import { AppShell } from "@/components/ds/app-shell";
import { requireAcademyAccess } from "@/lib/academy/access";
import { requireRealViewer } from "@/lib/auth";

/**
 * Section Academy — les formations, type Skool.
 *
 * L'accès est vérifié dans le layout : les pages n'ont pas à le refaire, et
 * aucune sous-route ne peut être ajoutée en oubliant le contrôle. La garde
 * répond 404 à qui n'est ni membre de l'organisation ni inscrit à une
 * formation — un client d'espace n'apprend pas l'existence du module.
 *
 * **C'est la seule section du produit qui refuse l'accès ouvert.** Partout
 * ailleurs, un visiteur sans session emprunte l'identité de l'owner, ce qui
 * est un confort de construction. Ici, la formation est vendue à quelqu'un
 * d'autre : l'identité décide de ce qu'on voit, elle ne peut donc pas être
 * empruntée.
 *
 * Plus de sous-titre : il nommait « Devenir freelance social media manager »
 * sur toutes les pages, y compris celles d'une autre formation.
 */
export default async function AcademyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /* `requireRealViewer` et non `requireViewer` : l'accès ouvert ferait du
     visiteur l'owner, et une élève déconnectée verrait le compte de l'agence,
     son rail complet et son back-office. Ici on renvoie vers la connexion. */
  const viewer = await requireRealViewer();
  await requireAcademyAccess();

  return (
    <AppShell viewer={viewer} title="Academy">
      {children}
    </AppShell>
  );
}
