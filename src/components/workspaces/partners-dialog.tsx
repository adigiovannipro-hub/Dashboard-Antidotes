"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Plus } from "lucide-react";
import { toast } from "sonner";

import { removePartner, savePartner } from "@/app/actions/workspaces";
import { safeAction } from "@/lib/context/safe-action";
import { StatusPill } from "@/components/ds/status-pill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { WorkspaceRole } from "@/lib/supabase/database.types";
import {
  PARTNER_ROLE_LABELS,
  type WorkspacePage,
  type WorkspacePartner,
} from "@/lib/workspaces/types";

/**
 * Qui accède à un espace, et à quelles pages.
 *
 * Le tableau de droits porte sur la **visibilité** d'une page, pas sur un
 * niveau de lecture ou d'écriture : à l'intérieur d'une page ouverte, un
 * client écrit déjà chez lui, et c'est une décision produit prise ailleurs.
 * Proposer « lecture seule » sans pouvoir la tenir serait pire que de ne pas
 * la proposer.
 *
 * La page Contexte n'apparaît jamais dans la liste : elle est réservée à
 * l'agence, et une case à cocher laisserait croire qu'elle se partage.
 */

type Draft = {
  email: string;
  role: WorkspaceRole;
  hidden: Set<string>;
  /** Adresse déjà en place : le champ email ne se modifie plus. */
  existing: boolean;
};

/** Ce que le menu a chargé en ouvrant le dialogue. */
export type WorkspaceAdminData = {
  pages: WorkspacePage[];
  partners: WorkspacePartner[];
};

export function PartnersDialog({
  slug,
  name,
  data,
  onReload,
  onClose,
}: {
  slug: string;
  name: string;
  /** `null` tant que la lecture n'est pas revenue. */
  data: WorkspaceAdminData | null;
  onReload: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, start] = useTransition();

  const pages = data?.pages ?? [];
  const partners = data?.partners ?? [];

  function save() {
    if (!draft) return;
    start(async () => {
      const result = await safeAction(() =>
        savePartner(
          { workspace: slug },
          { email: draft.email, role: draft.role, hiddenPages: [...draft.hidden] },
        ),
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setDraft(null);
      onReload();
      router.refresh();
    });
  }

  function remove(email: string) {
    start(async () => {
      const result = await safeAction(() => removePartner({ workspace: slug }, { email }));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setDraft(null);
      onReload();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Partenaires de {name}</DialogTitle>
          <DialogDescription>
            Qui accède à cet espace, et à quelles pages. La page Contexte reste
            réservée à l&apos;agence, elle ne se partage jamais.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          {data === null ? (
            <p className="type-caption text-text-secondary">Chargement…</p>
          ) : (
            <>
              {partners.length === 0 ? (
                <p className="type-body text-text-secondary">
                  Personne d&apos;autre que toi n&apos;accède à cet espace.
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {partners.map((partner) => (
                    <li
                      key={partner.email}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="type-label truncate text-text-primary">
                          {partner.email}
                        </p>
                        <p className="type-caption text-text-secondary">
                          {PARTNER_ROLE_LABELS[partner.role]}
                          {partner.hiddenPages.length > 0
                            ? `, ${partner.hiddenPages.length} page${partner.hiddenPages.length > 1 ? "s" : ""} masquée${partner.hiddenPages.length > 1 ? "s" : ""}`
                            : ", voit toutes les pages"}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {partner.status === "invited" ? (
                          <StatusPill tone="info">En attente</StatusPill>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setDraft({
                              email: partner.email,
                              role: partner.role,
                              hidden: new Set(partner.hiddenPages),
                              existing: true,
                            })
                          }
                        >
                          Modifier
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {draft ? (
                <DraftForm
                  draft={draft}
                  pages={pages}
                  onChange={setDraft}
                  onRemove={() => remove(draft.email)}
                  pending={pending}
                />
              ) : (
                <Button
                  variant="outline"
                  data-icon="inline-start"
                  onClick={() =>
                    setDraft({
                      email: "",
                      role: "client",
                      hidden: new Set(),
                      existing: false,
                    })
                  }
                >
                  <Plus aria-hidden strokeWidth={1.75} />
                  Ajouter un partenaire
                </Button>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
          {draft ? (
            <Button
              disabled={pending || draft.email.trim().length < 5}
              onClick={save}
            >
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DraftForm({
  draft,
  pages,
  onChange,
  onRemove,
  pending,
}: {
  draft: Draft;
  pages: WorkspacePage[];
  onChange: (draft: Draft) => void;
  onRemove: () => void;
  pending: boolean;
}) {
  function togglePage(key: string) {
    const hidden = new Set(draft.hidden);
    if (hidden.has(key)) hidden.delete(key);
    else hidden.add(key);
    onChange({ ...draft, hidden });
  }

  return (
    <div className="space-y-4 rounded-md border border-border bg-surface-sunken p-4">
      <label className="flex flex-col gap-1.5">
        <span className="type-overline text-text-secondary">Adresse email</span>
        <Input
          autoFocus={!draft.existing}
          type="email"
          value={draft.email}
          disabled={draft.existing}
          placeholder="partenaire@exemple.fr"
          aria-label="Adresse email du partenaire"
          onChange={(event) => onChange({ ...draft, email: event.target.value })}
        />
      </label>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="type-overline mb-1.5 text-text-secondary">Rôle</legend>
        <div className="flex flex-wrap gap-2">
          {(["client", "contributor"] as const).map((role) => (
            <label
              key={role}
              className="flex items-center gap-2 rounded-md border border-border-line bg-surface px-3 py-2"
            >
              <input
                type="radio"
                name="role-partenaire"
                checked={draft.role === role}
                onChange={() => onChange({ ...draft, role })}
                className="size-4 accent-accent-ink"
              />
              <span className="type-caption text-text-primary">
                {PARTNER_ROLE_LABELS[role]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="type-overline mb-1.5 text-text-secondary">
          Pages visibles
        </legend>

        {pages.length === 0 ? (
          <p className="type-caption text-text-secondary">
            Cet espace n&apos;a encore aucune page à partager.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {pages.map((page) => (
              <li key={page.key}>
                <label className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={!draft.hidden.has(page.key)}
                    onChange={() => togglePage(page.key)}
                    className="size-4 accent-accent-ink"
                  />
                  <span className="type-caption text-text-primary">{page.name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <p className="type-caption mt-2 flex items-center gap-1.5 text-text-secondary">
          <Lock aria-hidden strokeWidth={1.75} className="size-3.5" />
          Contexte : jamais partagé, quel que soit le rôle.
        </p>
      </fieldset>

      {draft.existing ? (
        <Button size="sm" variant="destructive" disabled={pending} onClick={onRemove}>
          Retirer de l&apos;espace
        </Button>
      ) : null}
    </div>
  );
}
