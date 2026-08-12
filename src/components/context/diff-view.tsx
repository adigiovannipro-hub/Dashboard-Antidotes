"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { applyRegeneration } from "@/app/actions/context";
import { safeAction } from "@/lib/context/safe-action";
import { Panel, PanelHeader, PanelRows } from "@/components/ds/surface";
import { Button } from "@/components/ui/button";
import type { ContextFieldDiff } from "@/lib/context/diff";
import type { ContextFieldKey, ContextProposal } from "@/lib/context/types";

/**
 * Le diff de régénération : champ par champ, l'actuel à gauche, le proposé à
 * droite, une case par champ pour accepter ou refuser. La validation crée une
 * version + 1 — le diff est obligatoire, jamais d'écrasement silencieux.
 */
export function DiffView({
  workspaceSlug,
  diff,
  proposal,
  onClose,
}: {
  workspaceSlug: string;
  diff: ContextFieldDiff[];
  proposal: ContextProposal;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startApply] = useTransition();
  const changed = diff.filter((entry) => entry.changed);
  const unchanged = diff.filter((entry) => !entry.changed);
  const [accepted, setAccepted] = useState<Set<ContextFieldKey>>(
    () => new Set(changed.map((entry) => entry.key)),
  );

  function toggle(key: ContextFieldKey) {
    setAccepted((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function apply() {
    startApply(async () => {
      const outcome = await safeAction(() =>
        applyRegeneration(
          { workspace: workspaceSlug },
          { proposal, acceptedKeys: [...accepted] },
        ),
      );
      if (!outcome.ok) {
        toast.error(outcome.error);
        return;
      }
      toast.success(outcome.message ?? "Nouvelle version activée.");
      onClose();
      router.refresh();
    });
  }

  return (
    <Panel>
      <PanelHeader
        title="Proposition de consolidation"
        count={changed.length}
        description="Coche les champs à appliquer : les autres gardent leur valeur actuelle. La validation crée une nouvelle version, l'ancienne reste consultable."
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button size="sm" disabled={pending || accepted.size === 0} onClick={apply}>
              {pending
                ? "Application…"
                : `Appliquer ${accepted.size > 1 ? `les ${accepted.size} champs` : "le champ"}`}
            </Button>
          </div>
        }
      />
      <PanelRows>
        {changed.map((entry) => (
          <div key={entry.key} className="px-5 py-4">
            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={accepted.has(entry.key)}
                onChange={() => toggle(entry.key)}
                className="size-4 accent-accent-ink"
              />
              <span className="type-label text-text-primary">{entry.label}</span>
            </label>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-md bg-surface-sunken p-3">
                <p className="type-overline mb-1.5 text-text-secondary">Actuel</p>
                <p className="type-caption whitespace-pre-wrap text-text-primary">
                  {entry.before || "—"}
                </p>
              </div>
              <div className="rounded-md bg-accent-subtle/40 p-3">
                <p className="type-overline mb-1.5 text-accent-ink">Proposé</p>
                <p className="type-caption whitespace-pre-wrap text-text-primary">
                  {entry.after || "—"}
                </p>
              </div>
            </div>
          </div>
        ))}

        {unchanged.length > 0 ? (
          <p className="px-5 py-3 type-caption text-text-secondary">
            Sans changement : {unchanged.map((entry) => entry.label).join(", ")}.
          </p>
        ) : null}
      </PanelRows>
    </Panel>
  );
}
