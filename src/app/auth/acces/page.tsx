import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Entrer dans la formation",
  robots: { index: false, follow: false },
};

/**
 * La page d'entrée du lien d'accès.
 *
 * Elle ne vérifie rien : elle pose le jeton dans un formulaire et attend un
 * clic. Le jeton ne sert qu'une fois, et les messageries ouvrent les liens
 * avant la personne — aperçu du message, filtre anti-hameçonnage, scanner
 * d'entreprise. Tant que la vérification se faisait au simple chargement,
 * ce robot consommait le jeton et l'élève arrivait sur « déjà utilisé ».
 * Un robot suit un lien, il ne soumet pas un formulaire.
 *
 * Publique par nécessité (`PUBLIC_PATHS`) : la personne n'a pas encore de
 * session, c'est tout l'objet.
 */
export default async function AuthAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; suivant?: string }>;
}) {
  const { token_hash: tokenHash, type, suivant } = await searchParams;

  if (!tokenHash || !type) redirect("/auth/erreur?raison=code-manquant");

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form
        method="post"
        action="/auth/callback"
        className="w-full max-w-sm space-y-6 text-center"
      >
        <Wordmark className="justify-center" />
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="suivant" value={suivant ?? "/"} />
        <Button type="submit" className="w-full">
          Entrer dans la formation
        </Button>
      </form>
    </main>
  );
}
