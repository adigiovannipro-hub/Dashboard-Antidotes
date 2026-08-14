"use client";

import { useState, useTransition } from "react";
import { Plug, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { linkSocialAccount } from "@/app/actions/social";
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
  SOCIAL_ACCOUNT_PURPOSE,
  socialAccountName,
  type SocialAccountKind,
  type SocialAccountRow,
  type SocialSelection,
} from "@/lib/social/types";

/**
 * Le branchement des comptes du client, en boîte.
 *
 * Deux choses distinctes, dans cet ordre : **à quel compte publie-t-on pour ce
 * client** (le choix), et **que faut-il rebrancher** (l'aller-retour Meta).
 *
 * Le choix est le cœur de l'écran. Un seul login Meta rapporte tous les
 * comptes de l'agence — cinq comptes Instagram dès le premier essai — et rien
 * ne dirait sur lequel publier si on ne le demandait pas. « Le premier de la
 * liste » aurait publié chez le mauvais client.
 */

export function ConnexionsDialog({
  workspaceSlug,
  workspaceName,
  accounts,
  selection,
  metaConfigured,
  open,
  onOpenChange,
}: {
  workspaceSlug: string;
  workspaceName: string;
  /** L'inventaire de l'agence : tout ce que le login Meta atteint. */
  accounts: SocialAccountRow[];
  /** Ce que ce client utilise aujourd'hui, par réseau. */
  selection: SocialSelection;
  metaConfigured: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const connexionHref = `/api/social/meta/connexion?espace=${encodeURIComponent(
    workspaceSlug,
  )}&retour=${encodeURIComponent(`/espace/${workspaceSlug}/planning`)}`;

  const inventory = accounts.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Comptes de {workspaceName}</DialogTitle>
        </DialogHeader>

        <p className="type-caption text-text-secondary">
          Un compte par réseau, choisi parmi ceux que le branchement Meta de
          l&apos;agence atteint. C&apos;est ce choix qui décide où part une
          publication, et d&apos;où viennent les chiffres du Reporting.
        </p>

        {inventory === 0 ? (
          <div className="border-border bg-surface-sunken rounded-md border p-3">
            <p className="type-caption text-text-secondary">
              Aucun compte branché pour l&apos;instant. Le branchement Meta
              rapporte d&apos;un coup les Pages Facebook, les comptes Instagram
              Professionnels rattachés et les comptes publicitaires — ensuite
              seulement, on affecte.
            </p>
          </div>
        ) : (
          <div className="border-border divide-border divide-y rounded-md border">
            {META_KINDS.map((kind) => (
              <KindPicker
                key={kind}
                kind={kind}
                accounts={accounts.filter((account) => account.kind === kind)}
                selected={selection[kind] ?? ""}
                workspaceSlug={workspaceSlug}
              />
            ))}
          </div>
        )}

        {metaConfigured ? (
          <Button
            render={<a href={connexionHref} />}
            variant={inventory > 0 ? "outline" : "accent"}
            size="sm"
          >
            {inventory > 0 ? (
              <>
                <RefreshCw className="size-3.5" strokeWidth={1.75} aria-hidden />
                Rebrancher Meta
              </>
            ) : (
              <>
                <Plug className="size-3.5" strokeWidth={1.75} aria-hidden />
                Brancher Meta
              </>
            )}
          </Button>
        ) : (
          <div className="border-border bg-surface-sunken rounded-md border p-3">
            <p className="type-caption text-text-secondary">
              L&apos;application Meta n&apos;est pas encore configurée :
              renseigne <code>META_APP_ID</code> et <code>META_APP_SECRET</code>{" "}
              dans Vercel, et le bouton de branchement apparaîtra. La
              publication sur Instagram demande en plus la validation de Meta
              (App Review), une à trois semaines.
            </p>
          </div>
        )}

        {/* `--text-tertiary` est à 2,79:1 : réservé aux icônes, jamais au texte. */}
        <p className="type-caption text-text-secondary">
          Rebrancher met l&apos;inventaire à jour sans toucher aux affectations
          déjà faites ici. LinkedIn puis TikTok viendront ensuite.
        </p>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Le choix d'un réseau.
 *
 * Une liste déroulante native : trois à six entrées, une par compte. Un
 * sélecteur maison n'apporterait rien et se comporterait moins bien au clavier
 * comme au téléphone.
 */
function KindPicker({
  kind,
  accounts,
  selected,
  workspaceSlug,
}: {
  kind: SocialAccountKind;
  accounts: SocialAccountRow[];
  selected: string;
  workspaceSlug: string;
}) {
  // Optimiste : la liste prend la valeur choisie tout de suite, et revient en
  // arrière si le serveur refuse — sinon le champ mentirait jusqu'au
  // rafraîchissement.
  const [value, setValue] = useState(selected);
  const [pending, startTransition] = useTransition();

  const chosen = accounts.find((account) => account.id === value) ?? null;

  const pick = (next: string) => {
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const result = await linkSocialAccount(workspaceSlug, {
        kind,
        accountId: next,
      });
      if (!result.ok) {
        setValue(previous);
        toast.error(result.error);
      } else if (result.message) {
        toast.success(result.message);
      }
    });
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      {chosen?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- CDN Meta
        <img
          src={chosen.avatar_url}
          alt=""
          className="size-8 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="bg-surface-sunken text-text-secondary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        >
          {SOCIAL_ACCOUNT_LABELS[kind].slice(0, 1)}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <label
          htmlFor={`compte-${kind}`}
          className="type-caption text-text-secondary block"
        >
          {SOCIAL_ACCOUNT_LABELS[kind]} — {SOCIAL_ACCOUNT_PURPOSE[kind]}
        </label>

        <select
          id={`compte-${kind}`}
          value={value}
          disabled={pending || accounts.length === 0}
          onChange={(event) => pick(event.target.value)}
          className="border-border focus-visible:ring-brand type-body mt-1 h-9 w-full rounded-md border bg-transparent px-2 outline-none focus-visible:ring-2 disabled:opacity-50"
        >
          <option value="">
            {accounts.length === 0 ? "Aucun compte branché" : "Aucun"}
          </option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {socialAccountName(account)}
              {account.username ? ` · ${account.username}` : ""}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
