"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteRadarAccount, updateRadarAccount } from "@/app/actions/antidotes-inbound";
import { StatusPill } from "@/components/ds/status-pill";
import { PanelRows } from "@/components/ds/surface";
import { Input } from "@/components/ui/input";
import { relativeDays } from "@/lib/antidotes/dates";
import { POST_PLATFORM_LABELS, type PostPlatform, type RadarAccount } from "@/lib/antidotes/types";

/** Les comptes veillés : réseau, identifiant, abonnés éditables, dernier relevé, erreur, pause, retrait. */
export function RadarAccounts({ accounts, availability }: { accounts: RadarAccount[]; availability: Record<PostPlatform, string | null> }) {
  return (
    <PanelRows>
      {accounts.map((account) => (
        <AccountRow key={account.id} account={account} missing={availability[account.platform]} />
      ))}
    </PanelRows>
  );
}

function AccountRow({ account, missing }: { account: RadarAccount; missing: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [followers, setFollowers] = useState(account.followers?.toString() ?? "");
  // La case répond tout de suite ; le serveur confirme au rechargement.
  const [active, setActive] = useState(account.is_active);

  function apply(action: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) router.refresh();
      else toast.error(result.error);
    });
  }

  return (
    <div className="grid gap-2 px-5 py-3 md:grid-cols-[minmax(0,1fr)_140px_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone="neutral" dot={false}>{POST_PLATFORM_LABELS[account.platform]}</StatusPill>
          <span className="type-label truncate text-text-primary">{account.label || account.handle}</span>
          {account.label ? <span className="type-caption text-text-secondary">{account.handle}</span> : null}
          {account.url ? (
            <a href={account.url} target="_blank" rel="noreferrer" className="focus-visible:ring-ring rounded-sm text-accent-ink focus-visible:ring-2 focus-visible:outline-none" aria-label={`Ouvrir le profil de ${account.label || account.handle}`}>
              <ExternalLink className="size-3.5" strokeWidth={1.75} aria-hidden />
            </a>
          ) : null}
          {!active ? <StatusPill tone="neutral">En pause</StatusPill> : null}
        </div>
        <p className="type-caption mt-0.5 text-text-secondary">
          {account.last_error ? (
            <span className="text-danger-ink">{account.last_error}</span>
          ) : account.last_collected_at ? (
            `Relevé ${relativeDays(account.last_collected_at)}`
          ) : missing ? (
            <span className="text-warning-ink">{missing}</span>
          ) : (
            "Jamais relevé"
          )}
        </p>
      </div>
      <Input
        aria-label={`Abonnés de ${account.label || account.handle}`}
        type="number"
        min={0}
        value={followers}
        placeholder="Abonnés"
        onChange={(event) => setFollowers(event.target.value)}
        onBlur={() => {
          const next = followers.trim() === "" ? null : Math.max(0, Math.round(Number(followers)) || 0);
          if (next !== account.followers) apply(() => updateRadarAccount({ accountId: account.id, followers: next }));
        }}
      />
      <div className="flex items-center gap-1">
        <label className="type-caption flex items-center gap-1.5 text-text-primary">
          <input
            type="checkbox"
            checked={active}
            disabled={pending}
            onChange={(event) => {
              const next = event.target.checked;
              setActive(next);
              apply(() => updateRadarAccount({ accountId: account.id, isActive: next }));
            }}
            className="size-4 accent-[var(--accent-ink)]"
          />
          Actif
        </label>
        <button
          type="button"
          disabled={pending}
          aria-label={`Retirer ${account.label || account.handle} de la veille`}
          onClick={() => {
            if (window.confirm("Retirer ce compte de la veille ? Les posts déjà relevés restent.")) {
              apply(() => deleteRadarAccount({ accountId: account.id }));
            }
          }}
          className="focus-visible:ring-ring rounded-sm p-1.5 text-text-secondary hover:text-danger-ink focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
        >
          <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </div>
  );
}
