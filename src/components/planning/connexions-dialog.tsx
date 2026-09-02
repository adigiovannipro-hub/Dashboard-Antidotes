"use client";

import { useState, useTransition } from "react";
import { Plug, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { addClientNetwork, linkSocialAccount } from "@/app/actions/social";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NETWORK_SUGGESTIONS, networkKey } from "@/lib/context/types";
import { safeAction } from "@/lib/context/safe-action";
import {
  COMPOSIO_TRANSITION_NOTE,
  isDirectConnectEnabled,
} from "@/lib/social/direct-connect";
import { planConnexionRows, type ConnexionRow } from "@/lib/social/networks";
import {
  isConnectable,
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
 * L'écran affichait trois lignes en dur — celles que le branchement Meta
 * rapporte — quel que soit le client. Un client sur LinkedIn et YouTube n'en
 * voyait aucune trace : « il manque des réseaux » était exact, et l'omission
 * était silencieuse.
 *
 * La liste vient maintenant des **réseaux déclarés aux livrables**, c'est-à-dire
 * du contrat. S'y ajoutent toujours le compte publicitaire, qui alimente le
 * Reporting sans que personne pense à le déclarer, et tout compte déjà affecté
 * — retirer un réseau du contrat ne doit pas faire disparaître de l'écran une
 * connexion qui, elle, continue de publier.
 *
 * Un réseau se rajoute ici à tout moment : il rejoint les livrables du
 * Contexte, qui reste la source unique.
 */

export function ConnexionsDialog({
  workspaceSlug,
  workspaceName,
  accounts,
  selection,
  networks,
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
  /** Les réseaux déclarés aux livrables du Contexte. */
  networks: string[];
  metaConfigured: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const rows = planConnexionRows({
    networks,
    linked: Object.keys(selection) as SocialAccountKind[],
  });

  const consentHref = (connector: "meta" | "youtube" | "linkedin") =>
    `/api/social/${connector}/connexion?espace=${encodeURIComponent(
      workspaceSlug,
    )}&retour=${encodeURIComponent(`/espace/${workspaceSlug}/planning`)}`;
  const connexionHref = consentHref("meta");

  // YouTube ne se branche que si le client en a un : proposer le bouton à
  // tout le monde encombrerait la boîte de ceux qui n'y publient pas.
  const wantsYouTube = rows.some((row) => row.kind === "youtube");
  const youtubeLinked = accounts.some((account) => account.kind === "youtube");

  /* LinkedIn ne demande **aucun consentement ici** : l'autorisation vit chez
     Composio, posée une fois pour toute l'agence. Le bouton ne fait
     qu'importer les pages entreprise dans l'inventaire — d'où « Relever les
     pages » plutôt que « Brancher ». */
  const wantsLinkedin = rows.some((row) => row.kind === "linkedin");
  const linkedinLinked = accounts.some((account) => account.kind === "linkedin");

  const inventory = accounts.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Comptes de {workspaceName}</DialogTitle>
        </DialogHeader>

        <p className="type-caption text-text-secondary">
          Un compte par réseau : c&apos;est ce choix qui décide où part une
          publication, et d&apos;où viennent les chiffres du Reporting. Les
          comptes proposés sont ceux de l&apos;inventaire de l&apos;agence.
        </p>

        <div className="border-border-line divide-border-line max-h-[45vh] divide-y overflow-y-auto rounded-md border">
          {rows.map((row) => (
            <ConnexionLine
              key={row.kind ?? `libre-${row.label}`}
              row={row}
              accounts={
                row.kind
                  ? accounts.filter((account) => account.kind === row.kind)
                  : []
              }
              selected={row.kind ? (selection[row.kind] ?? "") : ""}
              workspaceSlug={workspaceSlug}
            />
          ))}
        </div>

        <AddNetwork workspaceSlug={workspaceSlug} rows={rows} />

        {/* LinkedIn est **hors** du branchement direct : son autorisation vit
            chez Composio, pas dans un aller-retour OAuth d'ici. Le bouton
            n'importe que les pages dans l'inventaire, et reste donc offert
            quel que soit l'état des branchements directs. */}
        {wantsLinkedin ? (
          <Button
            render={<a href={consentHref("linkedin")} />}
            variant={linkedinLinked ? "outline" : "accent"}
            size="sm"
          >
            {linkedinLinked ? (
              <>
                <RefreshCw className="size-3.5" strokeWidth={1.75} aria-hidden />
                Relever les pages LinkedIn
              </>
            ) : (
              <>
                <Plug className="size-3.5" strokeWidth={1.75} aria-hidden />
                Ajouter les pages LinkedIn
              </>
            )}
          </Button>
        ) : null}

        {isDirectConnectEnabled() ? (
          <>
          {wantsYouTube ? (
            <Button render={<a href={consentHref("youtube")} />} variant="outline" size="sm">
              {youtubeLinked ? (
                <>
                  <RefreshCw className="size-3.5" strokeWidth={1.75} aria-hidden />
                  Rebrancher YouTube
                </>
              ) : (
                <>
                  <Plug className="size-3.5" strokeWidth={1.75} aria-hidden />
                  Brancher YouTube
                </>
              )}
            </Button>
          ) : null}

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
            <div className="border-border-line bg-surface-sunken rounded-md border p-3">
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
            déjà faites ici. Meta, YouTube et LinkedIn ont un connecteur : les
            autres réseaux se déclarent, s&apos;affichent, et attendent le leur.
            Pour TikTok, les démarches à engager sont listées dans{" "}
            <code>docs/connecteurs-linkedin-tiktok.md</code> — ce sont les
            validations qui prennent des semaines, pas le code.
          </p>
          </>
        ) : (
          <div className="border-border-line bg-surface-sunken space-y-2 rounded-md border p-3">
            <p className="type-caption text-text-secondary">
              {COMPOSIO_TRANSITION_NOTE}
            </p>
            <p className="type-caption text-text-secondary">
              Les affectations déjà faites ici restent en place : c&apos;est le
              branchement qui change de main, pas le choix du compte sur lequel
              ce client publie.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Une ligne : un réseau, et ce qu'on peut en faire.
 *
 * Trois cas, dits franchement plutôt que confondus dans une liste vide :
 * le réseau a un connecteur et des comptes (on choisit), il a un connecteur
 * mais rien de branché (on branche), ou il n'en a pas encore (on attend, et
 * l'écran le dit).
 */
function ConnexionLine({
  row,
  accounts,
  selected,
  workspaceSlug,
}: {
  row: ConnexionRow;
  accounts: SocialAccountRow[];
  selected: string;
  workspaceSlug: string;
}) {
  // Optimiste : la liste prend la valeur choisie tout de suite, et revient en
  // arrière si le serveur refuse — sinon le champ mentirait jusqu'au
  // rafraîchissement.
  const [value, setValue] = useState(selected);
  const [pending, startTransition] = useTransition();

  const label = row.kind ? SOCIAL_ACCOUNT_LABELS[row.kind] : row.label;
  const chosen = accounts.find((account) => account.id === value) ?? null;
  const connectable = row.kind !== null && isConnectable(row.kind);

  const pick = (next: string) => {
    if (!row.kind) return;
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const result = await safeAction(() =>
        linkSocialAccount(workspaceSlug, { kind: row.kind!, accountId: next }),
      );
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
          {label.slice(0, 1).toUpperCase()}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <label
          htmlFor={`compte-${row.kind ?? networkKey(row.label)}`}
          className="type-caption text-text-secondary block"
        >
          {/* « Meta › Instagram » : les trois lignes d'une même déclaration se
              lisent alors comme un ensemble, et non comme trois réseaux
              qu'on aurait déclarés un par un. */}
          {row.group ? `${row.group} › ` : null}
          {label}
          {row.kind ? ` — ${SOCIAL_ACCOUNT_PURPOSE[row.kind]}` : null}
        </label>

        {connectable ? (
          <select
            id={`compte-${row.kind}`}
            value={value}
            disabled={pending || accounts.length === 0}
            onChange={(event) => pick(event.target.value)}
            className="border-border-line focus-visible:ring-ring type-body mt-1 h-9 w-full rounded-md border bg-transparent px-2 outline-none focus-visible:ring-2 disabled:opacity-50"
          >
            <option value="">
              {accounts.length === 0 ? "Aucun compte branché" : "Aucun"}
            </option>
            {/* Nom, pseudo, abonnés, identifiant : trois Pages peuvent porter
                le même nom (vécu — trois « I-WAY »), et c'est l'identifiant
                qui les distingue, jamais le nom. */}
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {socialAccountName(account)}
                {account.username ? ` · ${account.username}` : ""}
                {account.followers_count !== null
                  ? ` · ${account.followers_count} abonnés`
                  : ""}
                {` · ${account.external_id}`}
              </option>
            ))}
          </select>
        ) : (
          <p className="type-caption text-text-secondary mt-1">
            {row.kind
              ? "Déclaré au contrat. Aucun connecteur pour ce réseau à ce jour — la publication s'y fait à la main."
              : /* Vrai d'une newsletter comme d'un réseau qu'on ne sait pas
                   encore nommer : dans les deux cas il n'y a pas de compte à
                   affecter. Dire « livrable hors réseau » serait faux du
                   second. */
                "Déclaré aux livrables. Aucun compte à brancher pour ce libellé."}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Ajouter un réseau sans repasser par le Contexte.
 *
 * Il rejoint les **livrables**, pas une liste parallèle : la déclaration du
 * client reste à un seul endroit, et le réseau ajouté ici apparaît aussi dans
 * son Contexte et dans les couloirs qu'on lui créera.
 */
function AddNetwork({
  workspaceSlug,
  rows,
}: {
  workspaceSlug: string;
  rows: ConnexionRow[];
}) {
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();

  const present = new Set(
    rows.flatMap((row) => (row.label ? [networkKey(row.label)] : [])),
  );
  const restantes = NETWORK_SUGGESTIONS.filter(
    (suggestion) => !present.has(networkKey(suggestion)),
  );

  const ajouter = (nom: string) => {
    const propre = nom.trim();
    if (propre.length === 0) return;

    start(async () => {
      const result = await safeAction(() =>
        addClientNetwork(workspaceSlug, { nom: propre }),
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDraft("");
      if (result.message) toast.success(result.message);
    });
  };

  return (
    <div className="space-y-2">
      <p className="type-overline text-text-secondary">Ajouter un réseau</p>

      {restantes.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {restantes.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={pending}
              onClick={() => ajouter(suggestion)}
              className="border-border-line hover:bg-surface-sunken focus-visible:ring-ring type-caption text-text-secondary rounded-pill border px-2.5 py-1 transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder="Un autre réseau…"
          aria-label="Ajouter un réseau"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            ajouter(draft);
          }}
        />
        <Button
          variant="outline"
          type="button"
          disabled={pending || draft.trim().length === 0}
          onClick={() => ajouter(draft)}
        >
          <Plus className="size-4" strokeWidth={1.75} aria-hidden />
          Ajouter
        </Button>
      </div>
    </div>
  );
}
