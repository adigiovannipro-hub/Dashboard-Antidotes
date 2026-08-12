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
 * Les livrables mensuels : sur quels réseaux, combien de publications de
 * chaque nature **sur chacun**, et quand les intentions partent.
 *
 * Le volume se compte réseau par réseau parce qu'il se contracte comme ça.
 * Un total global ne disait pas ce qu'on doit à Instagram ni à LinkedIn, et
 * la génération ne pouvait pas répartir sans deviner.
 *
 * C'est du contractuel, pas de la marque : la régénération depuis les
 * documents n'y touche jamais. Un modèle qui déduirait « 12 posts par mois »
 * d'une stratégie écrirait un engagement à la place du client.
 */

/** La quantité reste un texte tant qu'on tape : vider le champ doit être possible. */
type LineDraft = { categorie: string; quantiteText: string };
type NetworkDraft = { nom: string; lines: LineDraft[] };

const FIELD_CLASS =
  "focus-visible:ring-ring rounded-md border border-border-line bg-surface px-3 py-2 type-caption text-text-primary focus-visible:ring-2 focus-visible:outline-none";

const toDraft = (line: { categorie: string; quantite: number }): LineDraft => ({
  categorie: line.categorie,
  quantiteText: String(line.quantite),
});

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
  const [nouveauReseau, setNouveauReseau] = useState("");
  const [reseaux, setReseaux] = useState<NetworkDraft[]>(
    deliverables.reseaux.map((network) => ({
      nom: network.nom,
      lines: network.publications.map(toDraft),
    })),
  );
  const [orphelins, setOrphelins] = useState<LineDraft[]>(
    deliverables.publications.map(toDraft),
  );
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(deliverables));
  const [, startSave] = useTransition();

  function build(next: {
    reseaux?: NetworkDraft[];
    orphelins?: LineDraft[];
    intentions?: string;
  }): ContextDeliverables {
    const lines = (drafts: LineDraft[]) =>
      drafts.map((line) => ({
        categorie: line.categorie,
        quantite: Number(line.quantiteText.replace(",", ".")),
      }));

    return normalizeDeliverables({
      intentions: next.intentions ?? intentions,
      reseaux: (next.reseaux ?? reseaux).map((network) => ({
        nom: network.nom,
        publications: lines(network.lines),
      })),
      publications: lines(next.orphelins ?? orphelins),
    });
  }

  function persist(next: Parameters<typeof build>[0] = {}) {
    const value = build(next);
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

  /** Modifie une ligne, dans un réseau (`index`) ou hors réseau (`null`). */
  function updateLine(index: number | null, line: number, patch: Partial<LineDraft>) {
    if (index === null) {
      setOrphelins((current) =>
        current.map((entry, i) => (i === line ? { ...entry, ...patch } : entry)),
      );
      return;
    }
    setReseaux((current) =>
      current.map((network, i) =>
        i === index
          ? {
              ...network,
              lines: network.lines.map((entry, j) =>
                j === line ? { ...entry, ...patch } : entry,
              ),
            }
          : network,
      ),
    );
  }

  function removeLine(index: number | null, line: number) {
    if (index === null) {
      const next = orphelins.filter((_, i) => i !== line);
      setOrphelins(next);
      persist({ orphelins: next });
      return;
    }
    const next = reseaux.map((network, i) =>
      i === index
        ? { ...network, lines: network.lines.filter((_, j) => j !== line) }
        : network,
    );
    setReseaux(next);
    persist({ reseaux: next });
  }

  function addLine(index: number) {
    setReseaux((current) =>
      current.map((network, i) =>
        i === index
          ? { ...network, lines: [...network.lines, { categorie: "", quantiteText: "1" }] }
          : network,
      ),
    );
  }

  /**
   * Bascule un réseau. Le décocher emporte ses quantités : on demande
   * confirmation dès qu'il y a quelque chose à perdre, un clic de trop ne
   * doit pas effacer un contrat.
   */
  function toggleReseau(nom: string) {
    const key = networkKey(nom);
    const existing = reseaux.find((network) => networkKey(network.nom) === key);

    if (existing) {
      if (
        existing.lines.length > 0 &&
        !window.confirm(
          `Retirer ${existing.nom} ? Ses ${existing.lines.length} catégorie${existing.lines.length > 1 ? "s" : ""} de publication seront supprimées.`,
        )
      ) {
        return;
      }
      const next = reseaux.filter((network) => networkKey(network.nom) !== key);
      setReseaux(next);
      persist({ reseaux: next });
      return;
    }

    const next = [...reseaux, { nom, lines: [] }];
    setReseaux(next);
    persist({ reseaux: next });
  }

  function addReseau() {
    const nom = nouveauReseau.trim();
    setNouveauReseau("");
    if (nom.length === 0) return;
    if (reseaux.some((network) => networkKey(network.nom) === networkKey(nom))) return;

    const next = [...reseaux, { nom, lines: [] }];
    setReseaux(next);
    persist({ reseaux: next });
  }

  // Les suggestions, plus ce que le client porte déjà en propre.
  const chips = [
    ...NETWORK_SUGGESTIONS,
    ...reseaux
      .map((network) => network.nom)
      .filter(
        (nom) =>
          !NETWORK_SUGGESTIONS.some((entry) => networkKey(entry) === networkKey(nom)),
      ),
  ];

  const courant = build({});
  const total = totalPublications(courant);

  return (
    <section
      className={cn("rounded-lg border border-border bg-surface shadow-card", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h3 className="type-h3">Livrables mensuels</h3>
          <p className="type-caption mt-0.5 text-text-secondary">
            Les réseaux du client et ce qui est dû sur chacun, avec la date de livraison
            des intentions. Tout part dans les prompts au même titre que le fond.
          </p>
        </div>
        {total > 0 ? (
          <p className="type-label shrink-0 text-text-primary">
            <span className="tabular-nums">{formatValue(total, "integer")}</span>{" "}
            <span className="font-normal text-text-secondary">
              publication{total > 1 ? "s" : ""} par mois
            </span>
          </p>
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

        {(readOnly ? reseaux.map((network) => network.nom) : chips).map((nom) => {
          const actif = reseaux.some((network) => networkKey(network.nom) === networkKey(nom));
          return (
            <button
              key={nom}
              type="button"
              disabled={readOnly}
              aria-pressed={actif}
              onClick={() => toggleReseau(nom)}
              className={cn(
                "focus-visible:ring-ring rounded-pill border px-3 py-1 type-caption transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
                actif
                  ? "border-accent-ink bg-accent-subtle font-medium text-accent-ink"
                  : "border-border-line bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary",
              )}
            >
              {nom}
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

      {reseaux.length === 0 && orphelins.length === 0 ? (
        <p className="type-body px-5 py-4 text-text-secondary">
          {readOnly
            ? "Aucun livrable dans cette version."
            : "Aucun réseau déclaré : coche ceux du client ci-dessus, puis pose ce qui est dû sur chacun."}
        </p>
      ) : null}

      {reseaux.map((network, index) => (
        <NetworkGroup
          key={networkKey(network.nom)}
          titre={network.nom}
          total={courant.reseaux[index]?.publications.reduce(
            (somme, line) => somme + line.quantite,
            0,
          )}
          lines={network.lines}
          readOnly={readOnly}
          onUpdate={(line, patch) => updateLine(index, line, patch)}
          onBlur={() => persist()}
          onRemove={(line) => removeLine(index, line)}
          onAdd={() => addLine(index)}
        />
      ))}

      {orphelins.length > 0 ? (
        <NetworkGroup
          titre="Hors réseau"
          hint="Repris d'un contrat écrit avant la répartition. À déplacer sur un réseau, ou à laisser tel quel."
          total={courant.publications.reduce((somme, line) => somme + line.quantite, 0)}
          lines={orphelins}
          readOnly={readOnly}
          onUpdate={(line, patch) => updateLine(null, line, patch)}
          onBlur={() => persist()}
          onRemove={(line) => removeLine(null, line)}
        />
      ) : null}

      <label className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-4">
        <span className="type-overline shrink-0 text-text-secondary">
          Livraison des intentions
        </span>
        <input
          value={intentions}
          disabled={readOnly}
          placeholder={readOnly ? "—" : "le 20 du mois précédent"}
          onChange={(event) => setIntentions(event.target.value)}
          onBlur={() => persist()}
          className={cn(FIELD_CLASS, "w-full min-w-0 flex-1 sm:w-auto")}
        />
      </label>
    </section>
  );
}

/** Un réseau et ses quantités, ou le bloc de ce qui n'est rattaché à aucun. */
function NetworkGroup({
  titre,
  hint,
  total,
  lines,
  readOnly,
  onUpdate,
  onBlur,
  onRemove,
  onAdd,
}: {
  titre: string;
  hint?: string;
  total?: number;
  lines: LineDraft[];
  readOnly: boolean;
  onUpdate: (line: number, patch: Partial<LineDraft>) => void;
  onBlur: () => void;
  onRemove: (line: number) => void;
  /** Absent sur le bloc « hors réseau » : on n'y crée rien de nouveau. */
  onAdd?: () => void;
}) {
  return (
    <div className="border-t border-border px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="type-label text-text-primary">{titre}</p>
        {total !== undefined && total > 0 ? (
          <p className="type-caption text-text-secondary">
            <span className="tabular-nums">{total}</span> par mois
          </p>
        ) : null}
      </div>
      {hint ? <p className="type-caption mt-0.5 text-text-secondary">{hint}</p> : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {lines.length === 0 ? (
          <p className="type-caption text-text-secondary">
            {readOnly ? "—" : "Aucune quantité posée sur ce réseau."}
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
                aria-label={`Quantité, ${titre}, ligne ${index + 1}`}
                onChange={(event) => onUpdate(index, { quantiteText: event.target.value })}
                onBlur={onBlur}
                className="focus-visible:ring-ring w-9 rounded-sm bg-transparent px-1 py-1 type-label text-center font-medium text-text-primary tabular-nums focus-visible:ring-2 focus-visible:outline-none"
              />
              <input
                value={line.categorie}
                disabled={readOnly}
                list="categories-de-publication"
                placeholder="Catégorie"
                aria-label={`Catégorie, ${titre}, ligne ${index + 1}`}
                onChange={(event) => onUpdate(index, { categorie: event.target.value })}
                onBlur={onBlur}
                className="focus-visible:ring-ring w-28 rounded-sm bg-transparent px-1 py-1 type-caption text-text-primary focus-visible:ring-2 focus-visible:outline-none"
              />
              {!readOnly ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Retirer ${line.categorie || `la ligne ${index + 1}`} de ${titre}`}
                  onClick={() => onRemove(index)}
                >
                  <X aria-hidden strokeWidth={1.75} />
                </Button>
              ) : null}
            </div>
          ))
        )}

        {!readOnly && onAdd ? (
          <Button size="sm" variant="ghost" data-icon="inline-start" onClick={onAdd}>
            <Plus aria-hidden strokeWidth={1.75} />
            Ajouter une catégorie
          </Button>
        ) : null}
      </div>
    </div>
  );
}
