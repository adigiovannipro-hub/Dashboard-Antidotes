"use client";

import { Plug, RefreshCw } from "lucide-react";

import { StatusPill } from "@/components/ds/status-pill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  META_KINDS,
  SOCIAL_ACCOUNT_LABELS,
  SOCIAL_STATUS_LABELS,
  type SocialAccountKind,
  type SocialAccountRow,
  type SocialAccountStatus,
} from "@/lib/social/types";

/**
 * Le branchement des comptes du client, en boîte.
 *
 * Une page entière pour trois lignes obligeait à quitter le planning pour y
 * revenir : la connexion est une parenthèse dans le travail, pas une
 * destination.
 */

const STATUS_TONES: Record<
  SocialAccountStatus,
  "positive" | "warning" | "danger" | "neutral"
> = {
  connected: "positive",
  expired: "warning",
  error: "danger",
  disabled: "neutral",
};

export function ConnexionsDialog({
  workspaceSlug,
  boardSlug,
  accounts,
  metaConfigured,
  open,
  onOpenChange,
}: {
  workspaceSlug: string;
  boardSlug: string;
  accounts: SocialAccountRow[];
  metaConfigured: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const metaAccounts = accounts.filter((account) =>
    META_KINDS.includes(account.kind),
  );

  // Le retour d'OAuth revient sur ce tableau : c'est d'ici qu'on est parti.
  const connexionHref = `/api/social/meta/connexion?espace=${encodeURIComponent(
    workspaceSlug,
  )}&retour=${encodeURIComponent(`/espace/${workspaceSlug}/planning/${boardSlug}`)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Comptes sociaux</DialogTitle>
        </DialogHeader>

        <p className="type-caption text-text-secondary">
          Un seul branchement Meta rapporte les Pages Facebook, les comptes
          Instagram Professionnels rattachés et les comptes publicitaires. Il
          sert la publication, la prévisualisation du feed et le Reporting.
        </p>

        {metaAccounts.length > 0 ? (
          <ul className="border-border divide-border max-h-72 divide-y overflow-y-auto rounded-md border">
            {metaAccounts.map((account) => (
              <AccountRow key={account.id} account={account} />
            ))}
          </ul>
        ) : null}

        {metaConfigured ? (
          <Button
            render={<a href={connexionHref} />}
            variant={metaAccounts.length > 0 ? "outline" : "accent"}
            size="sm"
          >
            {metaAccounts.length > 0 ? (
              <>
                <RefreshCw className="size-3.5" strokeWidth={1.75} aria-hidden />
                Reconnecter Meta
              </>
            ) : (
              <>
                <Plug className="size-3.5" strokeWidth={1.75} aria-hidden />
                Connecter Meta
              </>
            )}
          </Button>
        ) : (
          <div className="border-border bg-surface-sunken rounded-md border p-3">
            <p className="type-caption text-text-secondary">
              L&apos;application Meta n&apos;est pas encore configurée :
              renseigne <code>META_APP_ID</code> et <code>META_APP_SECRET</code>{" "}
              dans Vercel, et le bouton de connexion apparaîtra. La publication
              sur Instagram demande en plus la validation de Meta (App Review),
              une à trois semaines.
            </p>
          </div>
        )}

        {/* `--text-tertiary` est à 2,79:1 : réservé aux icônes, jamais au texte. */}
        <p className="type-caption text-text-secondary">
          LinkedIn puis TikTok viendront ensuite — chacun demande sa propre
          validation d&apos;application.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function AccountRow({ account }: { account: SocialAccountRow }) {
  const label = SOCIAL_ACCOUNT_LABELS[account.kind as SocialAccountKind];
  const name = account.display_name ?? account.external_id;

  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      {account.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- CDN Meta
        <img
          src={account.avatar_url}
          alt=""
          className="size-8 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="bg-surface-sunken text-text-secondary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="type-body truncate font-medium">{name}</p>
        {/* Réseau et identifiant suffisent : à quoi sert le compte est dit
            une fois, en tête de la boîte, plutôt que tronqué à chaque ligne. */}
        <p className="type-caption truncate text-text-secondary">
          {label}
          {account.username ? ` · ${account.username}` : ""}
        </p>
      </div>

      <StatusPill tone={STATUS_TONES[account.status]}>
        {SOCIAL_STATUS_LABELS[account.status]}
      </StatusPill>
    </li>
  );
}
