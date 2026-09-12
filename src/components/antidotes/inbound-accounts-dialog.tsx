"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Plus, Radio, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addRadarAccount,
  deleteRadarAccount,
  resumeRadarAccount,
  saveInboundThresholds,
  type InboundResult,
} from "@/app/actions/antidotes-inbound";
import { PlatformChip } from "@/components/antidotes/inbound-chips";
import { StatusPill } from "@/components/ds/status-pill";
import { PendingLabel } from "@/components/ds/pending-label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { relativeDays } from "@/lib/antidotes/dates";
import {
  POST_PLATFORM_LABELS,
  type InboundSettings,
  type PostPlatform,
  type RadarAccount,
} from "@/lib/antidotes/types";

/**
 * Les comptes veillés, dans une fenêtre — plus dans un onglet à eux.
 *
 * On n'y vient pas pour lire : on y vient pour ajouter quelqu'un, ou pour
 * retirer quelqu'un. Un onglet de navigation pour deux gestes rares coûtait
 * une place permanente dans la barre.
 *
 * On colle **le lien du profil**, et c'est tout : le réseau se lit dans le
 * domaine. Ni case « actif » — un compte est veillé ou retiré, il n'y a pas
 * de troisième état —, ni compteur d'abonnés à saisir : on suit quelqu'un
 * pour ce qu'il publie, pas pour sa taille, et le relevé rapporte le chiffre
 * quand le réseau le donne.
 */
export function InboundAccountsDialog({
  accounts,
  availability,
  settings,
}: {
  accounts: RadarAccount[];
  availability: Record<PostPlatform, string | null>;
  settings: InboundSettings | null;
}) {
  const [open, setOpen] = useState(false);
  const platforms = [...new Set(accounts.map((account) => account.platform))];

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Radio aria-hidden />
        Comptes
        {accounts.length > 0 ? (
          <span className="type-caption ml-1 rounded-pill bg-surface-sunken px-1.5 font-medium text-text-secondary tabular-nums">
            {accounts.length}
          </span>
        ) : null}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Les comptes veillés</DialogTitle>
            <DialogDescription>
              Collez le lien d&apos;un profil : le réseau se reconnaît tout seul.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] space-y-5 overflow-y-auto">
            <AddForm />

            {accounts.length === 0 ? (
              <p className="type-body text-text-secondary">
                Aucun compte veillé pour l&apos;instant.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {accounts.map((account) => (
                  <li key={account.id}>
                    <AccountRow account={account} missing={availability[account.platform]} />
                  </li>
                ))}
              </ul>
            )}

            {platforms.length > 0 ? <Thresholds platforms={platforms} settings={settings} /> : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<InboundResult | null, FormData>(addRadarAccount, null);
  const form = useRef<HTMLFormElement>(null);
  const last = useRef<InboundResult | null>(null);

  useEffect(() => {
    if (!state || state === last.current) return;
    last.current = state;
    if (state.ok) {
      toast.success(state.message ?? "Ajouté.");
      form.current?.reset();
      router.refresh();
    } else {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <form ref={form} action={formAction} className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
      <div className="grid gap-1">
        <Label htmlFor="acc-url">Lien du profil</Label>
        <Input
          id="acc-url"
          name="url"
          required
          maxLength={400}
          inputMode="url"
          placeholder="https://www.linkedin.com/in/prenom-nom"
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="acc-label">Nom affiché</Label>
        <Input id="acc-label" name="label" maxLength={120} placeholder="facultatif" />
      </div>
      <Button type="submit" variant="accent" disabled={pending}>
        <Plus aria-hidden />
        <PendingLabel pending={pending} busy="Ajout…">
          Veiller
        </PendingLabel>
      </Button>
    </form>
  );
}

function AccountRow({ account, missing }: { account: RadarAccount; missing: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <PlatformChip platform={account.platform} />
      <div className="min-w-0 flex-1">
        <p className="type-label flex min-w-0 items-center gap-2 text-text-primary">
          <span className="truncate">{account.label || account.handle}</span>
          {/* En pause : le relevé n'ira plus le chercher. Sans cette
              pastille, la ligne serait identique à une ligne veillée et la
              pause serait muette — le contraire de ce qu'on cherche. */}
          {account.is_active ? null : <StatusPill tone="neutral">En pause</StatusPill>}
          {account.followers !== null ? (
            <span className="type-caption shrink-0 text-text-secondary tabular-nums">
              {account.followers.toLocaleString("fr-FR")} abonnés
            </span>
          ) : null}
        </p>
        <p className="type-caption truncate text-text-secondary">
          {account.last_error ? (
            <span className="text-danger-ink">{account.last_error}</span>
          ) : account.last_collected_at ? (
            `${POST_PLATFORM_LABELS[account.platform]} · relevé ${relativeDays(account.last_collected_at)}`
          ) : missing ? (
            <span className="text-warning-ink">{missing}</span>
          ) : (
            `${POST_PLATFORM_LABELS[account.platform]} · jamais relevé`
          )}
        </p>
      </div>
      {account.url ? (
        <a
          href={account.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Ouvrir le profil de ${account.label || account.handle}`}
          className="focus-visible:ring-ring rounded-sm p-1.5 text-text-secondary hover:text-accent-ink focus-visible:ring-2 focus-visible:outline-none"
        >
          <ExternalLink className="size-4" strokeWidth={1.75} aria-hidden />
        </a>
      ) : null}
      {account.is_active ? null : (
        <button
          type="button"
          disabled={pending}
          aria-label={`Remettre ${account.label || account.handle} dans la veille`}
          onClick={() => {
            startTransition(async () => {
              const result = await resumeRadarAccount({ accountId: account.id });
              if (result.ok) router.refresh();
              else toast.error(result.error);
            });
          }}
          className="focus-visible:ring-ring rounded-sm p-1.5 text-text-secondary hover:text-accent-ink focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
        >
          <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        aria-label={`Retirer ${account.label || account.handle} de la veille`}
        onClick={() => {
          if (!window.confirm("Retirer ce compte de la veille ? Les posts déjà relevés restent.")) return;
          startTransition(async () => {
            const result = await deleteRadarAccount({ accountId: account.id });
            if (result.ok) router.refresh();
            else toast.error(result.error);
          });
        }}
        className="focus-visible:ring-ring rounded-sm p-1.5 text-text-secondary hover:text-danger-ink focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
      >
        <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}

/**
 * Ce qu'une vague garde. C'est un réglage de **relevé**, pas d'affichage : en
 * dessous du seuil, le contenu n'entre pas en base — d'où sa place ici, avec
 * les comptes, et non dans le panneau des filtres.
 *
 * Un champ vide n'est pas zéro : c'est l'absence de seuil, et zéro en serait
 * un. Un seuil ne juge par ailleurs que ce que le réseau rend — « ≥ 10 000
 * vues » n'écarte pas un post LinkedIn, qui n'a pas de vues.
 */
function Thresholds({ platforms, settings }: { platforms: PostPlatform[]; settings: InboundSettings | null }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<InboundResult | null, FormData>(saveInboundThresholds, null);
  const last = useRef<InboundResult | null>(null);

  useEffect(() => {
    if (!state || state === last.current) return;
    last.current = state;
    if (state.ok) {
      toast.success(state.message ?? "Enregistré.");
      router.refresh();
    } else {
      toast.error(state.error);
    }
  }, [state, router]);

  const value = (platform: PostPlatform, key: "min_views" | "min_likes" | "min_comments") =>
    settings?.thresholds?.[platform]?.[key]?.toString() ?? "";

  return (
    <form action={formAction} className="rounded-md border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="type-label text-text-primary">Ce qu&apos;une vague garde</p>
          <p className="type-caption text-text-secondary">En dessous, le contenu n&apos;entre pas.</p>
        </div>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          <PendingLabel pending={pending} busy="Enregistrement…">
            Enregistrer
          </PendingLabel>
        </Button>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {platforms.map((platform) => (
          <div key={platform} className="grid grid-cols-3 gap-2">
            <p className="type-caption col-span-3 text-text-secondary">{POST_PLATFORM_LABELS[platform]}</p>
            <Seuil platform={platform} field="views" label="Vues" value={value(platform, "min_views")} />
            <Seuil platform={platform} field="likes" label="Likes" value={value(platform, "min_likes")} />
            <Seuil platform={platform} field="comments" label="Comm." value={value(platform, "min_comments")} />
          </div>
        ))}
      </div>
    </form>
  );
}

function Seuil({
  platform,
  field,
  label,
  value,
}: {
  platform: PostPlatform;
  field: "views" | "likes" | "comments";
  label: string;
  value: string;
}) {
  const id = `seuil-${platform}-${field}`;
  return (
    <div className="grid min-w-0 gap-1">
      <Label htmlFor={id} className="type-caption text-text-secondary">
        {label}
      </Label>
      <Input
        id={id}
        name={`seuil_${platform}_${field}`}
        inputMode="numeric"
        defaultValue={value}
        placeholder="—"
        className="min-w-0 tabular-nums"
      />
    </div>
  );
}
