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

        <p className="text-muted-foreground text-center text-xs leading-relaxed">
          L&apos;accès est réservé aux adresses invitées. Si la vôtre ne l&apos;est
          pas encore, le lien fonctionnera mais aucun espace ne sera visible.
        </p>
      </div>
    </main>
  );
}
