import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/server";

/**
 * La page de désinscription — **publique**, sans `AppShell`, à un bouton.
 *
 * Le lien de chaque email de prospection mène ici. La page ne fait rien
 * d'elle-même : c'est le bouton qui poste, parce que les messageries ouvrent
 * les liens avant la personne — un GET qui désinscrirait ferait sortir du
 * fichier tous ceux dont l'anti-hameçonnage a suivi le lien. Même leçon que
 * le lien d'accès de l'Academy.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ne plus recevoir mes messages",
  robots: { index: false, follow: false },
};

type Params = Promise<{ token: string }>;
type Search = Promise<{ fait?: string }>;

const TOKEN = /^[0-9a-f]{32}$/;

export default async function DesinscriptionPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { token } = await params;
  const { fait } = await searchParams;
  if (!TOKEN.test(token)) notFound();

  const admin = createAdminClient();
  const { data } = await admin
    .from("antidotes_contacts")
    .select("first_name, opted_out")
    .eq("unsubscribe_token", token)
    .maybeSingle();
  const contact = data as unknown as { first_name: string | null; opted_out: boolean } | null;
  if (!contact) notFound();

  const done = contact.opted_out || fait === "1";

  return (
    <div className="flex min-h-svh items-center justify-center bg-canvas px-5 py-10">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-7 shadow-card">
        <p className="type-overline text-text-secondary">Antidotes</p>
        {done ? (
          <>
            <h1 className="type-h2 mt-2 text-text-primary">C&apos;est fait</h1>
            <p className="type-body mt-3 text-text-secondary">
              Vous ne recevrez plus de message de ma part. Merci de me l&apos;avoir dit.
            </p>
          </>
        ) : (
          <>
            <h1 className="type-h2 mt-2 text-text-primary">Ne plus recevoir mes messages</h1>
            <p className="type-body mt-3 text-text-secondary">
              Un clic suffit : votre adresse sort du fichier, définitivement.
            </p>
            <form method="post" action={`/api/desinscription/${token}`} className="mt-6">
              <input type="hidden" name="confirm" value="1" />
              <button
                type="submit"
                className="focus-visible:ring-ring inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-primary-foreground type-label transition-[background-color,box-shadow] duration-(--motion-duration) ease-standard hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
              >
                Me désinscrire
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
