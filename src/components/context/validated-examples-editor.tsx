"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { saveValidatedExamples } from "@/app/actions/context";
import { Button } from "@/components/ui/button";
import { safeAction } from "@/lib/context/safe-action";
import {
  VALIDATED_EXAMPLES_TARGET,
  type ValidatedExample,
} from "@/lib/context/types";

/**
 * Les publications réellement parues et approuvées par le client, collées
 * brutes.
 *
 * Brutes, et pas résumées : c'est le registre à reproduire, et un résumé
 * n'apprendrait rien au modèle sur la façon d'écrire de la marque. Le réseau
 * accompagne chaque texte parce qu'une légende Instagram et un post LinkedIn
 * ne se lisent pas comme le même registre.
 */
export function ValidatedExamplesEditor({
  workspaceSlug,
  examples,
  reseaux,
  readOnly,
}: {
  workspaceSlug: string;
  examples: ValidatedExample[];
  /** Les réseaux déclarés aux livrables — mêmes mots qu'ailleurs. */
  reseaux: string[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<ValidatedExample[]>(examples);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(examples));
  const [, startSave] = useTransition();

  function persist(next: ValidatedExample[]) {
    const json = JSON.stringify(next);
    if (json === savedJson) return;

    startSave(async () => {
      const outcome = await safeAction(() =>
        saveValidatedExamples({ workspace: workspaceSlug }, { examples: next }),
      );
      if (!outcome.ok) {
        toast.error(outcome.error);
        return;
      }
      setSavedJson(json);
      router.refresh();
    });
  }

  function update(index: number, patch: Partial<ValidatedExample>) {
    setDrafts((current) =>
      current.map((example, i) => (i === index ? { ...example, ...patch } : example)),
    );
  }

  function remove(index: number) {
    const next = drafts.filter((_, i) => i !== index);
    setDrafts(next);
    persist(next);
  }

  const manquants = VALIDATED_EXAMPLES_TARGET.min - drafts.length;

  return (
    <div className="flex flex-col gap-4">
      {drafts.length === 0 ? (
        <p className="type-body text-text-secondary">
          {readOnly ? "—" : "Coller trois à cinq publications réelles, approuvées par le client."}
        </p>
      ) : null}

      {drafts.map((example, index) => (
        <div key={index} className="flex flex-col gap-2 rounded-md border border-border-line p-3">
          <div className="flex items-center gap-2">
            <input
              list="reseaux-exemples-valides"
              value={example.reseau}
              disabled={readOnly}
              placeholder="Réseau"
              aria-label={`Réseau de l'exemple ${index + 1}`}
              onChange={(event) => update(index, { reseau: event.target.value })}
              onBlur={() => persist(drafts)}
              className="focus-visible:ring-ring h-9 w-40 rounded-md border border-border-line bg-surface px-3 type-caption text-text-primary focus-visible:ring-2 focus-visible:outline-none"
            />
            {!readOnly ? (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Retirer l'exemple ${index + 1}`}
                onClick={() => remove(index)}
              >
                <Trash2 aria-hidden strokeWidth={1.75} />
              </Button>
            ) : null}
          </div>
          <textarea
            value={example.texte}
            disabled={readOnly}
            rows={5}
            placeholder="Le texte publié, tel quel."
            aria-label={`Texte de l'exemple ${index + 1}`}
            onChange={(event) => update(index, { texte: event.target.value })}
            onBlur={() => persist(drafts)}
            className="focus-visible:ring-ring w-full resize-y rounded-md border border-border-line bg-surface px-3 py-2 type-caption text-text-primary focus-visible:ring-2 focus-visible:outline-none"
          />
        </div>
      ))}

      <datalist id="reseaux-exemples-valides">
        {reseaux.map((nom) => (
          <option key={nom} value={nom} />
        ))}
      </datalist>

      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            data-icon="inline-start"
            disabled={drafts.length >= VALIDATED_EXAMPLES_TARGET.max}
            onClick={() =>
              setDrafts((current) => [...current, { reseau: reseaux[0] ?? "", texte: "" }])
            }
          >
            <Plus aria-hidden strokeWidth={1.75} />
            Ajouter un exemple
          </Button>
          {manquants > 0 ? (
            <span className="type-caption text-text-secondary">
              {manquants} de plus pour atteindre le minimum conseillé
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
