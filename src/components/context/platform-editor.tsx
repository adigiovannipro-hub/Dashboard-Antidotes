"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { savePlatformRules } from "@/app/actions/context";
import { safeAction } from "@/lib/context/safe-action";
import { networkKey, type ContextPlatformRules } from "@/lib/context/types";
import { cn } from "@/lib/utils";

/**
 * Les règles d'écriture par réseau : format, longueur, emojis, hashtags,
 * tutoiement ou vouvoiement, mentions obligatoires. Une rangée par réseau,
 * sauvegardée au blur.
 *
 * Les rangées suivent les **réseaux déclarés dans les livrables**, et non
 * plus une liste en dur : tous les clients ne sont pas sur Instagram,
 * Facebook, LinkedIn et TikTok, et quatre champs vides sur cinq donnaient
 * l'impression d'un brief à moitié rempli.
 */
export function PlatformEditor({
  workspaceSlug,
  platforms,
  reseaux,
  readOnly,
  className,
}: {
  workspaceSlug: string;
  platforms: ContextPlatformRules;
  /** Réseaux du client, dans l'ordre où ils ont été déclarés. */
  reseaux: string[];
  readOnly: boolean;
  className?: string;
}) {
  const router = useRouter();

  // Les réseaux déclarés, plus ceux qu'une règle **déjà écrite** mentionne
  // encore : retirer un réseau des livrables ne doit pas faire disparaître son
  // texte en silence. Une clé restée vide, elle, ne survit pas — c'est
  // exactement le champ inutile qu'on cherche à ne plus afficher.
  const keys = useMemo(() => {
    const declared = reseaux.map((name) => networkKey(name));
    const orphans = Object.entries(platforms)
      .filter(
        ([key, rule]) => !declared.includes(key) && rule.trim().length > 0,
      )
      .map(([key]) => key)
      .sort();
    return [...declared, ...orphans];
  }, [platforms, reseaux]);

  // La clé est stockée sans accent ni majuscule ; l'écran montre le réseau
  // tel que l'agence l'a écrit.
  const labels = useMemo(
    () => Object.fromEntries(reseaux.map((name) => [networkKey(name), name])),
    [reseaux],
  );

  const [drafts, setDrafts] = useState<ContextPlatformRules>(() =>
    Object.fromEntries(keys.map((key) => [key, platforms[key] ?? ""])),
  );
  const [savedJson, setSavedJson] = useState(() =>
    JSON.stringify(clean(drafts)),
  );
  const [, startSave] = useTransition();

  function persist() {
    const cleaned = clean(drafts);
    const json = JSON.stringify(cleaned);
    if (json === savedJson) return;

    startSave(async () => {
      const outcome = await safeAction(() =>
        savePlatformRules({ workspace: workspaceSlug }, { platforms: cleaned }),
      );
      if (!outcome.ok) {
        toast.error(outcome.error);
        return;
      }
      setSavedJson(json);
      router.refresh();
    });
  }

  return (
    <div className={cn("grid grid-cols-1 gap-4 p-5 md:grid-cols-2", className)}>
      {keys.length === 0 ? (
        <p className="type-body text-text-secondary md:col-span-2">
          {readOnly
            ? "Aucun réseau dans cette version."
            : "Aucun réseau déclaré : coche ceux du client dans les livrables mensuels, juste au-dessus, et une rangée apparaîtra ici pour chacun."}
        </p>
      ) : (
        keys.map((key) => (
          <label key={key} className="flex flex-col gap-1.5">
            <span className="type-overline text-text-secondary">
              {labels[key] ?? key}
            </span>
            <textarea
              value={drafts[key] ?? ""}
              disabled={readOnly}
              rows={3}
              placeholder={
                readOnly ? "—" : `Règles d'écriture pour ${labels[key] ?? key}.`
              }
              onChange={(event) =>
                setDrafts((current) => ({
                  ...current,
                  [key]: event.target.value,
                }))
              }
              onBlur={persist}
              className="focus-visible:ring-ring w-full resize-y rounded-md border border-border-line bg-surface px-3 py-2 type-caption text-text-primary focus-visible:ring-2 focus-visible:outline-none"
            />
          </label>
        ))
      )}
    </div>
  );
}

function clean(rules: ContextPlatformRules): ContextPlatformRules {
  return Object.fromEntries(
    Object.entries(rules)
      .map(([key, value]) => [key, value.trim()] as const)
      .filter(([, value]) => value.length > 0),
  );
}
