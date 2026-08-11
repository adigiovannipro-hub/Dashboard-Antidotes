"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { savePillars } from "@/app/actions/context";
import { Button } from "@/components/ui/button";
import type { ContextPillar } from "@/lib/context/types";
import { cn } from "@/lib/utils";

/**
 * L'éditeur structuré des piliers de contenu — le champ le plus important
 * pour la génération : sa richesse détermine la qualité des sorties. Chaque
 * pilier est une sous-carte (nom, description, formats, angles, fréquence),
 * sauvegardée au blur comme le reste du brief.
 */

/** L'état d'édition d'un pilier : les listes restent des textes tant qu'on tape. */
type PillarDraft = {
  nom: string;
  description: string;
  formatsText: string;
  anglesText: string;
  frequence: string;
};

const toDraft = (pillar: ContextPillar): PillarDraft => ({
  nom: pillar.nom,
  description: pillar.description,
  formatsText: pillar.formats.join(", "),
  anglesText: pillar.angles.join(", "),
  frequence: pillar.frequence,
});

const fromDraft = (draft: PillarDraft): ContextPillar => ({
  nom: draft.nom.trim(),
  description: draft.description.trim(),
  formats: splitList(draft.formatsText),
  angles: splitList(draft.anglesText),
  frequence: draft.frequence.trim(),
});

function splitList(text: string): string[] {
  return text
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const FIELD_CLASS =
  "focus-visible:ring-ring w-full rounded-md border border-border-line bg-surface px-3 py-2 type-caption text-text-primary focus-visible:ring-2 focus-visible:outline-none";

export function PillarEditor({
  workspaceSlug,
  pillars,
  readOnly,
  className,
}: {
  workspaceSlug: string;
  pillars: ContextPillar[];
  readOnly: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<PillarDraft[]>(pillars.map(toDraft));
  const [savedJson, setSavedJson] = useState(JSON.stringify(pillars));
  const [, startSave] = useTransition();

  function persist(next: PillarDraft[]) {
    // Une sous-carte encore entièrement vide n'a rien à enregistrer.
    const cleaned = next
      .map(fromDraft)
      .filter((pillar) => pillar.nom.length > 0 || pillar.description.length > 0);
    const json = JSON.stringify(cleaned);
    if (json === savedJson) return;

    startSave(async () => {
      const outcome = await savePillars({ workspace: workspaceSlug }, { pillars: cleaned });
      if (!outcome.ok) {
        toast.error(outcome.error);
        return;
      }
      setSavedJson(json);
      router.refresh();
    });
  }

  function update(index: number, patch: Partial<PillarDraft>) {
    setDrafts((current) =>
      current.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)),
    );
  }

  function remove(index: number) {
    const next = drafts.filter((_, i) => i !== index);
    setDrafts(next);
    persist(next);
  }

  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-surface shadow-card",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h3 className="type-h3">Piliers de contenu</h3>
          <p className="type-caption mt-0.5 text-text-secondary">
            Le cœur de la génération : chaque pilier doit suffire à écrire un post sans
            autre information.
          </p>
        </div>
        {!readOnly ? (
          <Button
            size="sm"
            variant="accent"
            data-icon="inline-start"
            onClick={() => setDrafts((current) => [...current, toDraft(EMPTY_PILLAR)])}
          >
            <Plus aria-hidden strokeWidth={1.75} />
            Ajouter un pilier
          </Button>
        ) : null}
      </div>

      <div className="p-5">
        {drafts.length === 0 ? (
          <p className="type-body text-text-secondary">
            {readOnly
              ? "Aucun pilier dans cette version."
              : "Aucun pilier pour le moment : ajoute le premier, ou régénère depuis les documents."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {drafts.map((draft, index) => (
              <div
                key={index}
                onBlur={(event) => {
                  // N'enregistrer qu'en quittant la sous-carte, pas entre
                  // deux champs du même pilier.
                  if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                  persist(drafts);
                }}
                className="flex flex-col gap-2.5 rounded-md border border-border-line bg-surface-sunken p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <input
                    value={draft.nom}
                    disabled={readOnly}
                    placeholder="Nom du pilier"
                    aria-label={`Nom du pilier ${index + 1}`}
                    onChange={(event) => update(index, { nom: event.target.value })}
                    className={cn(FIELD_CLASS, "type-label font-medium")}
                  />
                  {!readOnly ? (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Supprimer le pilier ${draft.nom || index + 1}`}
                      onClick={() => remove(index)}
                    >
                      <Trash2 aria-hidden strokeWidth={1.75} />
                    </Button>
                  ) : null}
                </div>

                <textarea
                  value={draft.description}
                  disabled={readOnly}
                  placeholder="Description : sujet, objectif, ce que ce pilier prouve."
                  aria-label={`Description du pilier ${index + 1}`}
                  rows={3}
                  onChange={(event) => update(index, { description: event.target.value })}
                  className={cn(FIELD_CLASS, "resize-y")}
                />

                <label className="flex flex-col gap-1">
                  <span className="type-overline text-text-secondary">Formats</span>
                  <input
                    value={draft.formatsText}
                    disabled={readOnly}
                    placeholder="Reels, Carrousel"
                    onChange={(event) => update(index, { formatsText: event.target.value })}
                    className={FIELD_CLASS}
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="type-overline text-text-secondary">Angles</span>
                  <input
                    value={draft.anglesText}
                    disabled={readOnly}
                    placeholder="portrait d'artisan, gros plan matière"
                    onChange={(event) => update(index, { anglesText: event.target.value })}
                    className={FIELD_CLASS}
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="type-overline text-text-secondary">Fréquence</span>
                  <input
                    value={draft.frequence}
                    disabled={readOnly}
                    placeholder="2 par mois"
                    onChange={(event) => update(index, { frequence: event.target.value })}
                    className={FIELD_CLASS}
                  />
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const EMPTY_PILLAR: ContextPillar = {
  nom: "",
  description: "",
  formats: [],
  angles: [],
  frequence: "",
};
