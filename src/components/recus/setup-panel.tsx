import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Écran d'accueil quand rien n'est encore branché.
 *
 * Il ne se contente pas d'un bouton : il dit ce que l'outil va faire des accès
 * demandés. Autoriser une application à lire sa boîte mail et à envoyer en son
 * nom n'est pas anodin, et une case à cocher sans explication mérite d'être
 * refusée.
 */
export function SetupPanel({
  error,
  connected,
  canDecide,
}: {
  error: string | null;
  connected: string | null;
  canDecide: boolean;
}) {
  return (
    <main className="flex flex-1 justify-center p-6 md:p-10">
      <div className="w-full max-w-2xl space-y-8">
        <header className="space-y-2">
          <h1 className="font-heading text-2xl">Reçus</h1>
          <p className="text-muted-foreground text-sm">
            Les factures qui arrivent par mail sont identifiées, rapprochées de la
            dépense carte correspondante, puis transférées à Airwallex qui les
            accroche à la bonne ligne de frais.
          </p>
        </header>

        {connected ? (
          <p className="border-brand-mint bg-brand-mint/10 flex items-start gap-2 rounded-lg border p-3 text-sm">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <strong className="font-medium">{connected}</strong> est connectée. La
              première lecture aura lieu au prochain passage de la synchronisation.
            </span>
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="border-destructive/40 text-destructive flex items-start gap-2 rounded-lg border p-3 text-sm"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}

        <section className="bg-card space-y-4 rounded-xl p-5">
          <h2 className="font-heading text-base">Ce qui sera demandé</h2>

          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-medium">Lire les messages</dt>
              <dd className="text-muted-foreground">
                Pour repérer les factures. Les mails sans rapport avec la comptabilité
                sont écartés par des règles simples, avant même d&apos;être analysés.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Envoyer des messages</dt>
              <dd className="text-muted-foreground">
                Uniquement pour transférer une pièce à{" "}
                <code className="text-xs">receipts@expenses.airwallex.com</code>.
                Airwallex n&apos;accepte un reçu que s&apos;il vient de l&apos;adresse
                rattachée au compte : c&apos;est la raison de cette autorisation.
              </dd>
            </div>
          </dl>

          <p className="text-muted-foreground border-border border-t pt-3 text-xs">
            L&apos;autorisation de modifier ou supprimer des messages n&apos;est
            volontairement pas demandée. Rien ne sera déplacé, archivé ni effacé dans
            votre boîte.
          </p>
        </section>

        {canDecide ? (
          <Button nativeButton={false} render={<Link href="/api/recus/connexion" />}>
            <Mail aria-hidden />
            Connecter une boîte Gmail
            <ArrowRight aria-hidden />
          </Button>
        ) : (
          <p className="text-muted-foreground text-sm">
            Seul un propriétaire de l&apos;organisation peut connecter une boîte.
          </p>
        )}

        <p className="text-muted-foreground text-xs">
          La mise en place côté Google et Airwallex est décrite dans{" "}
          <code>docs/recus-setup.md</code>.
        </p>
      </div>
    </main>
  );
}
