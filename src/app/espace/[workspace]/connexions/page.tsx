import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plug, RefreshCw, Sparkles } from "lucide-react";

import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelRows,
  SectionHeader,
} from "@/components/ds/surface";
import { StatusPill } from "@/components/ds/status-pill";
import { Button } from "@/components/ui/button";
import { getWorkspace } from "@/lib/auth";
import { metaConfigured } from "@/lib/social/meta";
import { listSocialAccounts } from "@/lib/social/queries";
import {
  META_KINDS,
  SOCIAL_ACCOUNT_LABELS,
  SOCIAL_ACCOUNT_PURPOSE,
  SOCIAL_STATUS_LABELS,
  type SocialAccountKind,
  type SocialAccountRow,
  type SocialAccountStatus,
} from "@/lib/social/types";

type Params = Promise<{ workspace: string }>;
type Search = Promise<Record<string, string | undefined>>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { workspace: slug } = await params;
  const workspace = await getWorkspace(slug);
  return { title: workspace ? `Connexions · ${workspace.name}` : "Introuvable" };
}

const STATUS_TONES: Record<SocialAccountStatus, "positive" | "warning" | "danger" | "neutral"> = {
  connected: "positive",
  expired: "warning",
  error: "danger",
  disabled: "neutral",
};

export default async function ConnexionsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspace(slug);
  if (!workspace) notFound();

  // Brancher un compte engage un jeton : la page est réservée à l'agence, et
  // reste introuvable pour le client plutôt que refusée.
  if (workspace.role !== "owner") notFound();

  const [accounts, query] = await Promise.all([
    listSocialAccounts(workspace.id),
    searchParams,
  ]);

  const configured = metaConfigured();
  const metaAccounts = accounts.filter((account) =>
    META_KINDS.includes(account.kind),
  );

  return (
    <div className="space-y-5">
      {query.connecte ? (
        <p className="border-accent-ink/30 bg-brand-mint/40 type-body rounded-lg border px-4 py-3">
          {query.connecte}
        </p>
      ) : null}
      {query.erreur ? (
        <p className="border-danger-ink/30 type-body rounded-lg border bg-red-50 px-4 py-3 text-danger-ink dark:bg-red-950/30">
          {query.erreur}
        </p>
      ) : null}

      <SectionHeader
        title="Comptes sociaux"
        description="Un branchement par client. Il sert au planning — publication, prévisualisation du feed — et au Reporting."
      />

      <Panel>
        <PanelHeader
          title="Meta"
          description="Pages Facebook, comptes Instagram Professionnels et comptes publicitaires arrivent d'une seule autorisation."
          count={metaAccounts.length || undefined}
          action={
            configured ? (
              <Button
                render={
                  <a href={`/api/social/meta/connexion?espace=${workspace.slug}`} />
                }
                variant={metaAccounts.length > 0 ? "outline" : "accent"}
                size="sm"
              >
                {metaAccounts.length > 0 ? (
                  <>
                    <RefreshCw className="size-3.5" strokeWidth={1.75} aria-hidden />
                    Reconnecter
                  </>
                ) : (
                  <>
                    <Plug className="size-3.5" strokeWidth={1.75} aria-hidden />
                    Connecter Meta
                  </>
                )}
              </Button>
            ) : null
          }
        />

        {/* Les comptes déjà branchés s'affichent quoi qu'il arrive : couper
            la liste parce que la configuration manque ferait croire qu'on les
            a perdus. L'avertissement s'ajoute, il ne remplace pas. */}
        {metaAccounts.length > 0 ? (
          <PanelRows>
            {metaAccounts.map((account) => (
              <AccountRow key={account.id} account={account} />
            ))}
          </PanelRows>
        ) : configured ? (
          <PanelBody>
            <p className="type-body text-text-secondary">
              Aucun compte branché. Le bouton ouvre l&apos;autorisation Meta :
              choisis la Page du client, son compte Instagram Professionnel, et
              le compte publicitaire si tu veux relier le Reporting.
            </p>
          </PanelBody>
        ) : null}

        {!configured ? (
          <PanelBody className="border-border border-t">
            <p className="type-body text-text-secondary">
              L&apos;application Meta n&apos;est pas encore configurée.
              Renseigne <code className="type-caption">META_APP_ID</code> et{" "}
              <code className="type-caption">META_APP_SECRET</code> dans les
              variables d&apos;environnement Vercel, puis reviens ici — le
              bouton de connexion apparaîtra.
            </p>
            <p className="type-caption mt-2 text-text-secondary">
              La publication sur Instagram demande en plus la validation des
              autorisations par Meta (App Review) : comptez une à trois
              semaines. Le reste du branchement fonctionne sans attendre.
            </p>
          </PanelBody>
        ) : null}
      </Panel>

      <Panel>
        <PanelHeader
          title="LinkedIn et TikTok"
          description="Pas encore branchés."
        />
        <PanelBody>
          <p className="type-body flex items-start gap-2 text-text-secondary">
            <Sparkles
              className="mt-0.5 size-4 shrink-0 text-text-tertiary"
              strokeWidth={1.75}
              aria-hidden
            />
            À venir, dans cet ordre : LinkedIn (page entreprise), puis TikTok.
            Chacun demande sa propre validation d&apos;application.
          </p>
        </PanelBody>
      </Panel>

      <p className="type-caption text-text-secondary">
        <Link
          href={`/espace/${workspace.slug}/planning`}
          className="underline underline-offset-2"
        >
          Retour au planning éditorial
        </Link>
      </p>
    </div>
  );
}

function AccountRow({ account }: { account: SocialAccountRow }) {
  const label = SOCIAL_ACCOUNT_LABELS[account.kind as SocialAccountKind];

  return (
    <div className="flex items-center gap-3 px-5 py-3">
      {account.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- CDN Meta
        <img
          src={account.avatar_url}
          alt=""
          className="size-9 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="bg-surface-sunken text-text-secondary flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        >
          {label.slice(0, 1)}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="type-body truncate font-medium">
          {account.display_name ?? account.external_id}
        </p>
        <p className="type-caption truncate text-text-secondary">
          {label}
          {account.username ? ` · ${account.username}` : ""}
          {account.followers_count !== null
            ? ` · ${new Intl.NumberFormat("fr-FR").format(account.followers_count)} abonnés`
            : ""}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <StatusPill tone={STATUS_TONES[account.status]}>
          {SOCIAL_STATUS_LABELS[account.status]}
        </StatusPill>
        <span className="type-caption text-text-secondary">
          {SOCIAL_ACCOUNT_PURPOSE[account.kind as SocialAccountKind]}
        </span>
      </div>
    </div>
  );
}
