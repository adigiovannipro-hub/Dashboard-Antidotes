"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { saveDeliverables } from "@/app/actions/context";
import { normalizeDeliverables, totalPublications } from "@/lib/context/deliverables";
import { safeAction } from "@/lib/context/safe-action";
import { Button } from "@/components/ui/button";
import {
  DELIVERABLE_CATEGORIES,
  NETWORK_SUGGESTIONS,
  networkKey,
  type ContextDeliverables,
} from "@/lib/context/types";
import { formatValue } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Les livrables mensuels : sur quels réseaux, combien de publications, de
 * quelle nature, et quand les intentions partent.
 *
 * C'est du contractuel, pas de la marque : la régénération depuis les
 * documents n'y touche jamais. Un modèle qui déduirait « 12 posts par mois »
 * d'une stratégie écrirait un engagement à la place du client.
 *
 * Les réseaux se déclarent ici et nulle part ailleurs : ce sont eux qui
 * commandent les rangées des règles par plateforme, qui proposaient jusqu'ici
 * les quatre mêmes réseaux à tout le monde.
 */

/** La quantité reste un texte tant qu'on tape : vider le champ doit être possible. */
type LineDraft = { categorie: string; quantiteText: string };

const FIELD_CLASS =
  "focus-visible:ring-ring rounded-md border border-border-line bg-surface px-3 py-2 type-caption text-text-primary focus-visible:ring-2 focus-visible:outline-none";

export function DeliverablesEditor({
  workspaceSlug,
  deliverables,
  readOnly,
  className,
}: {
  workspaceSlug: string;
  deliverables: ContextDeliverables;
  readOnly: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [intentions, setIntentions] = useState(deliverables.intentions);
  const [reseaux, setReseaux] = useState<string[]>(deliverables.reseaux);
  const [nouveauReseau, setNouveauReseau] = useState("");
  const [lines, setLines] = useState<LineDraft[]>(
    deliverables.publications.map((line) => ({
      categorie: line.categorie,
      quantiteText: String(line.quantite),
    })),
  );
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(deliverables));
  const [, startSave] = useTransition();

  function persist(
    nextLines: LineDraft[],
    nextIntentions: string,
    nextReseaux: string[] = reseaux,
  ) {
    const value = normalizeDeliverables({
      intentions: nextIntentions,
      publications: nextLines.map((line) => ({
        categorie: line.categorie,
        quantite: Number(line.quantiteText.replace(",", ".")),
      })),
      reseaux: nextReseaux,
    });

    const json = JSON.stringify(value);
    if (json === savedJson) return;

    startSave(async () => {
      const outcome = await safeAction(() =>
        saveDeliverables({ workspace: workspaceSlug }, { deliverables: value }),
      );
      if (!outcome.ok) {
        toast.error(outcome.error);
        return;
      }
      setSavedJson(json);
      router.refresh();
    });
  }

  function update(index: number, patch: Partial<LineDraft>) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function remove(index: number) {
    const next = lines.filter((_, i) => i !== index);
    setLines(next);
    persist(next, intentions);
  }

  /** Bascule un réseau. Un réseau saisi à la main disparaît en se décochant. */
  function toggleReseau(name: string) {
    const key = networkKey(name);
    const next = reseaux.some((entry) => networkKey(entry) === key)
      ? reseaux.filter((entry) => networkKey(entry) !== key)
      : [...reseaux, name];
    setReseaux(next);
    persist(lines, intentions, next);
  }

  function addReseau() {
    const name = nouveauReseau.trim();
    setNouveauReseau("");
    if (name.length === 0) return;
    if (reseaux.some((entry) => networkKey(entry) === networkKey(name))) return;

    const next = [...reseaux, name];
    setReseaux(next);
    persist(lines, intentions, next);
  }

  // Les suggestions, plus ce que le client porte déjà en propre.
  const chips = [
    ...NETWORK_SUGGESTIONS,
    ...reseaux.filter(
      (name) =>
        !NETWORK_SUGGESTIONS.some((entry) => networkKey(entry) === networkKey(name)),
    ),
  ];

  const total = totalPublications(
    normalizeDeliverables({
      intentions,
      publications: lines.map((line) => ({
        categorie: line.categorie,
        quantite: Number(line.quantiteText),
      })),
      reseaux,
    }),
  );

  return (
    <section
      className={cn("rounded-lg border border-border bg-surface shadow-card", className)}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h3 className="type-h3">Livrables mensuels</h3>
          <p className="type-caption mt-0.5 text-text-secondary">
            Les réseaux du client, ce qui est dû chaque mois, et la date de livraison des
            intentions. Tout part dans les prompts au même titre que le fond.
          </p>
        </div>
        {!readOnly ? (
          <Button
            size="sm"
            variant="outline"
            data-icon="inline-start"
            onClick={() =>
              setLines((current) => [...current, { categorie: "", quantiteText: "1" }])
            }
          >
            <Plus aria-hidden strokeWidth={1.75} />
            Ajouter une catégorie
          </Button>
        ) : null}
      </div>

      <datalist id="categories-de-publication">
        {DELIVERABLE_CATEGORIES.map((categorie) => (
          <option key={categorie} value={categorie} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-4">
        <span className="type-overline mr-1 shrink-0 text-text-secondary">Réseaux</span>

        {readOnly && reseaux.length === 0 ? (
          <span className="type-caption text-text-secondary">—</span>
        ) : null}

        {(readOnly ? reseaux : chips).map((name) => {
          const actif = reseaux.some((entry) => networkKey(entry) === networkKey(name));
          return (
            <button
              key={name}
              type="button"
              disabled={readOnly}
              aria-pressed={actif}
              onClick={() => toggleReseau(name)}
              className={cn(
                "focus-visible:ring-ring rounded-pill border px-3 py-1 type-caption transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
                actif
                  ? "border-accent-ink bg-accent-subtle font-medium text-accent-ink"
                  : "border-border-line bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary",
              )}
            >
              {name}
            </button>
          );
        })}

        {!readOnly ? (
          <input
            value={nouveauReseau}
            placeholder="Autre réseau"
            aria-label="Ajouter un réseau"
            onChange={(event) => setNouveauReseau(event.target.value)}
            onBlur={addReseau}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addReseau();
              }
            }}
            className="focus-visible:ring-ring w-28 rounded-pill border border-dashed border-border-line bg-surface px-3 py-1 type-caption text-text-primary focus-visible:ring-2 focus-visible:outline-none"
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 p-5">
        {lines.length === 0 ? (
          <p className="type-body text-text-secondary">
            {readOnly
              ? "Aucun livrable dans cette version."
              : "Aucun livrable renseigné : ajoute une catégorie, par exemple 4 posts fixes et 2 reels."}
          </p>
        ) : (
          lines.map((line, index) => (
            <div
              key={index}
              className="flex items-center gap-1 rounded-md border border-border-line bg-surface-sunken py-1 pr-1 pl-2"
            >
              <input
                value={line.quantiteText}
                disabled={readOnly}
                inputMode="numeric"
                aria-label={`Quantité, ligne ${index + 1}`}
                onChange={(event) => update(index, { quantiteText: event.target.value })}
                onBlur={() => persist(lines, intentions)}
                className="focus-visible:ring-ring w-9 rounded-sm bg-transparent px-1 py-1 type-label text-center font-medium text-text-primary tabular-nums focus-visible:ring-2 focus-visible:outline-none"
              />
              <input
                value={line.categorie}
                disabled={readOnly}
                list="categories-de-publication"
                placeholder="Catégorie"
                aria-label={`Catégorie, ligne ${index + 1}`}
                onChange={(event) => update(index, { categorie: event.target.value })}
                onBlur={() => persist(lines, intentions)}
                className="focus-visible:ring-ring w-28 rounded-sm bg-transparent px-1 py-1 type-caption text-text-primary focus-visible:ring-2 focus-visible:outline-none"
              />
              {!readOnly ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Retirer ${line.categorie || `la ligne ${index + 1}`}`}
                  onClick={() => remove(index)}
                >
                  <X aria-hidden strokeWidth={1.75} />
                </Button>
              ) : null}
            </div>
          ))
        )}

        {total > 0 ? (
          <p className="type-label ml-auto text-text-primary">
            <span className="tabular-nums">{formatValue(total, "integer")}</span>{" "}
            <span className="font-normal text-text-secondary">
              publication{total > 1 ? "s" : ""} par mois
            </span>
          </p>
        ) : null}
      </div>

      <label className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-4">
        <span className="type-overline shrink-0 text-text-secondary">
          Livraison des intentions
        </span>
        <input
          value={intentions}
          disabled={readOnly}
          placeholder={readOnly ? "—" : "le 20 du mois précédent"}
          onChange={(event) => setIntentions(event.target.value)}
          onBlur={() => persist(lines, intentions)}
          className={cn(FIELD_CLASS, "w-full min-w-0 flex-1 sm:w-auto")}
        />
      </label>
    </section>
  );
}
