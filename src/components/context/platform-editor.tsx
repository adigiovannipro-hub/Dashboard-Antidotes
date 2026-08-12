"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { savePlatformRules } from "@/app/actions/context";
import { safeAction } from "@/lib/context/safe-action";
import { PLATFORM_KEYS, type ContextPlatformRules } from "@/lib/context/types";
import { cn } from "@/lib/utils";

/**
 * Les règles d'écriture par réseau : format, longueur, emojis, hashtags,
 * tutoiement ou vouvoiement, mentions obligatoires. Une rangée par réseau,
 * sauvegardée au blur.
 */
export function PlatformEditor({
  workspaceSlug,
  platforms,
  readOnly,
  className,
}: {
  workspaceSlug: string;
  platforms: ContextPlatformRules;
  readOnly: boolean;
  className?: string;
}) {
  const router = useRouter();

  // Les quatre réseaux de base d'abord, puis ceux que la donnée porte en plus.
  const keys = useMemo(() => {
    const extras = Object.keys(platforms).filter(
      (key) => !(PLATFORM_KEYS as readonly string[]).includes(key),
    );
    return [...PLATFORM_KEYS, ...extras.sort()];
  }, [platforms]);

  const [drafts, setDrafts] = useState<ContextPlatformRules>(() =>
    Object.fromEntries(keys.map((key) => [key, platforms[key] ?? ""])),
  );
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(clean(drafts)));
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
    <section
      className={cn("rounded-lg border border-border bg-surface shadow-card", className)}
    >
      <div className="border-b border-border px-5 py-4">
        <h3 className="type-h3">Règles par plateforme</h3>
        <p className="type-caption mt-0.5 text-text-secondary">
          Format d&apos;écriture, longueur, emojis, hashtags, tutoiement ou vouvoiement,
          mentions obligatoires, réseau par réseau.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
        {keys.map((key) => (
          <label key={key} className="flex flex-col gap-1.5">
            <span className="type-overline text-text-secondary">{key}</span>
            <textarea
              value={drafts[key] ?? ""}
              disabled={readOnly}
              rows={3}
              placeholder={readOnly ? "—" : `Règles d'écriture pour ${key}.`}
              onChange={(event) =>
                setDrafts((current) => ({ ...current, [key]: event.target.value }))
              }
              onBlur={persist}
              className="focus-visible:ring-ring w-full resize-y rounded-md border border-border-line bg-surface px-3 py-2 type-caption text-text-primary focus-visible:ring-2 focus-visible:outline-none"
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function clean(rules: ContextPlatformRules): ContextPlatformRules {
  return Object.fromEntries(
    Object.entries(rules)
      .map(([key, value]) => [key, value.trim()] as const)
      .filter(([, value]) => value.length > 0),
  );
}
