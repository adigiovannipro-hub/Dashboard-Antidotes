import type { Metadata } from "next";

import { LoginForm } from "./login-form";
import { Wordmark } from "@/components/wordmark";

export const metadata: Metadata = {
  title: "Connexion",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ suivant?: string }>;
}) {
  const { suivant } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <Wordmark className="justify-center" />
          <p className="text-muted-foreground text-sm">
            Un lien de connexion vous sera envoyé par email.
          </p>
        </div>

        <LoginForm next={suivant} />

        {/* Une adresse inconnue ne reçoit rien depuis le 1/10/2026
            (`requestLoginLink`) : l'ancienne phrase promettait un lien. */}
        <p className="text-muted-foreground text-center text-xs leading-relaxed">
          Accès réservé aux adresses invitées.
        </p>
      </div>
    </main>
  );
}
