import type { Metadata } from "next";

import { ProfilForm } from "@/components/profil/profil-form";
import { AppShell } from "@/components/ds/app-shell";
import { Panel, PanelBody } from "@/components/ds/surface";
import { requireRealViewer } from "@/lib/auth";
import { getMyProfile, signAvatarUrl } from "@/lib/profil/queries";

export const metadata: Metadata = { title: "Mon profil" };

/**
 * Ma fiche : photo, prénom, nom.
 *
 * Le seul écran de réglage ouvert à **tout le monde**, membre de l'équipe
 * comme élève de l'Academy — d'où la place à la racine et non sous `/admin`,
 * qui est owner-only. Il n'y a pas de garde de rôle ici : avoir une session
 * suffit à pouvoir se nommer.
 */
export default async function MonProfilPage() {
  /* Vraie session exigée : en accès ouvert, « ma fiche » serait celle de
     l'owner, et n'importe quel visiteur pourrait réécrire son nom et sa
     photo. */
  const viewer = await requireRealViewer();
  const profile = await getMyProfile();
  const avatarUrl = await signAvatarUrl(profile?.avatar_url ?? null);

  return (
    <AppShell viewer={viewer} title="Mon profil">
      <Panel className="max-w-2xl">
        <PanelBody>
          <ProfilForm
            email={profile?.email ?? viewer.email}
            firstName={profile?.first_name ?? ""}
            lastName={profile?.last_name ?? ""}
            avatarUrl={avatarUrl}
          />
        </PanelBody>
      </Panel>
    </AppShell>
  );
}
