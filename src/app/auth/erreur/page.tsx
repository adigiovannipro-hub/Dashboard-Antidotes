import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Connexion impossible",
};

const REASONS: Record<string, string> = {
  "code-manquant": "Le lien de connexion est incomplet.",
  "lien-invalide": "Ce lien a expiré ou a déjà été utilisé.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ raison?: string }>;
}) {
  const { raison } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-sm space-y-4 text-center">
        <h1 className="text-xl font-semibold">Connexion impossible</h1>
        <p className="text-muted-foreground text-sm">
          {(raison && REASONS[raison]) ?? "Le lien de connexion n'a pas pu être validé."}{" "}
          Demandez-en un nouveau, il ne prend qu&apos;un instant.
        </p>
        <Button nativeButton={false} render={<Link href="/login" />}>
          Retour à la connexion
        </Button>
      </div>
    </main>
  );
}
