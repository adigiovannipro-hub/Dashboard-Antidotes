import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Panel, PanelBody } from "@/components/ds/surface";
import { ProfilForm } from "@/components/profil/profil-form";
import { Wordmark } from "@/components/wordmark";
import { requireViewer } from "@/lib/auth";
import { needsOnboarding, safeNext } from "@/lib/profil/identity";
import { getMyProfile, signAvatarUrl } from "@/lib/profil/queries";

export const metadata: Metadata = {
  title: "Bienvenue",
  robots: { index: false, follow: false },
};

/**
 * L'accueil d'une personne dont la fiche n'a pas de nom.
 *
 * Le cadre de l'application y renvoie tant que le prénom ou le nom manque :
 * c'est ce que l'agence lit sous chaque retour, et « Inconnu » ne dit à
 * personne qui demande quoi. Quand l'agence a nommé la personne à
 * l'invitation, la fiche est déjà complète et cette page ne s'affiche jamais.
 *
 * Hors `AppShell`, sinon la garde du cadre y renverrait en boucle.
 */
export default async function BienvenuePage({
  searchParams,
}: {
  searchParams: Promise<{ suivant?: string }>;
}) {
  const viewer = await requireViewer();
  const { suivant } = await searchParams;
  const next = safeNext(suivant);
  const profile = await getMyProfile();
  if (!needsOnboarding(profile)) redirect(next);

  const avatarUrl = await signAvatarUrl(profile?.avatar_url ?? null);

  return (
    <main className="flex flex-1 items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg space-y-6">
        <Wordmark />
        <h1 className="type-h2">Bienvenue</h1>
        <Panel>
          <PanelBody>
            <ProfilForm
              email={profile?.email ?? viewer.email}
              firstName={profile?.first_name ?? ""}
              lastName={profile?.last_name ?? ""}
              avatarUrl={avatarUrl}
              onboarding={{ next }}
            />
          </PanelBody>
        </Panel>
      </div>
    </main>
  );
}
