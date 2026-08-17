"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  attachLogo,
  duplicateWorkspace,
  prepareLogoUpload,
} from "@/app/actions/workspaces";
import { PendingLabel } from "@/components/ds/pending-label";
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
import { safeAction } from "@/lib/context/safe-action";
import {
  DELIVERABLE_CATEGORIES,
  NETWORK_SUGGESTIONS,
  networkKey,
} from "@/lib/context/types";

/**
 * Ouvrir un client, en une fois.
 *
 * Le dialogue ne demandait que le nom, et il fallait ensuite poser le logo,
 * créer les douze mois un par un, ajouter les réseaux dans chacun, puis les
 * redéclarer aux livrables et une troisième fois aux connexions. Quatre
 * saisies de la même chose, qui finissaient par diverger.
 *
 * Ici, **les réseaux se déclarent une fois** et servent partout : livrables du
 * Contexte, couloirs des douze mois, lignes de l'écran des connexions. C'est
 * le pré-contexte du client, et il n'a qu'une source.
 *
 * Le logo part après la création, pas avant : le chemin du fichier contient
 * l'identifiant de l'espace, qui n'existe pas tant qu'il n'est pas créé.
 */

/** La quantité reste un texte tant qu'on tape : vider le champ doit rester possible. */
type LineDraft = { categorie: string; quantiteText: string };
type NetworkDraft = { nom: string; lines: LineDraft[] };

const FIELD_CLASS =
  "focus-visible:ring-ring rounded-md border border-border-line bg-surface px-3 py-2 type-caption text-text-primary focus-visible:ring-2 focus-visible:outline-none";

export function DuplicateDialog({
  slug,
  name,
  onClose,
}: {
  slug: string;
  name: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState(`${name} (copie)`);
  const [year, setYear] = useState(new Date().getFullYear());
  const [intentions, setIntentions] = useState("");
  const [reseaux, setReseaux] = useState<NetworkDraft[]>([]);
  const [nouveau, setNouveau] = useState("");
  const [logo, setLogo] = useState<File | null>(null);

  const dejaPris = new Set(reseaux.map((reseau) => networkKey(reseau.nom)));

  const ajouterReseau = (nom: string) => {
    const propre = nom.trim();
    if (propre.length === 0 || dejaPris.has(networkKey(propre))) return;
    setReseaux((current) => [...current, { nom: propre, lines: [] }]);
    setNouveau("");
  };

  const majReseau = (index: number, patch: Partial<NetworkDraft>) => {
    setReseaux((current) =>
      current.map((reseau, i) => (i === index ? { ...reseau, ...patch } : reseau)),
    );
  };

  function soumettre() {
    start(async () => {
      const result = await safeAction(() =>
        duplicateWorkspace(
          { workspace: slug },
          {
            name: draft.trim(),
            year,
            intentions: intentions.trim(),
            reseaux: reseaux.map((reseau) => ({
              nom: reseau.nom.trim(),
              publications: reseau.lines
                .filter((line) => line.categorie.trim().length > 0)
                .map((line) => ({
                  categorie: line.categorie.trim(),
                  quantite: Number(line.quantiteText) || 0,
                })),
            })),
          },
        ),
      );

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const cree = result.slug;

      /* Le logo après coup, et sans faire échouer la duplication : l'espace
         existe déjà, ses mois et ses réseaux aussi. Un envoi d'image qui rate
         est un contretemps, pas une raison de tout perdre — on le dit, et le
         menu « Logo » de l'espace reste là pour recommencer. */
      if (logo && cree) {
        const pose = await poserLogo(cree, logo);
        if (!pose) {
          toast.warning(`${result.message} Le logo n'est pas passé : à reprendre depuis le menu de l'espace.`);
          onClose();
          if (cree) router.push(`/espace/${cree}`);
          router.refresh();
          return;
        }
      }

      toast.success(result.message);
      onClose();
      if (cree) router.push(`/espace/${cree}`);
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ouvrir un client à partir de {name}</DialogTitle>
          <DialogDescription>
            Copie la configuration : tableaux, colonnes, vocabulaire, tableaux
            de bord. Aucune publication, aucun document, aucun brief ne suit.
            Les réseaux déclarés ici deviennent les livrables du Contexte, les
            couloirs de chaque mois et les lignes de l&apos;écran des
            connexions.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto py-1">
          {/* --- Identité --- */}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="type-overline text-text-secondary">
                Nom du client
              </span>
              <Input
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                aria-label="Nom du client"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="type-overline text-text-secondary">Année</span>
              <select
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
                aria-label="Année des mois à créer"
                className="border-border-line focus-visible:ring-ring type-body h-10 rounded-md border bg-transparent px-2 outline-none focus-visible:ring-2"
              >
                {[year - 1, year, year + 1].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* --- Logo --- */}
          <div className="flex items-center gap-3">
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = "";
                setLogo(file);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => fileInput.current?.click()}
            >
              <ImageUp className="size-4" strokeWidth={1.75} aria-hidden />
              {logo ? "Changer le logo" : "Choisir un logo"}
            </Button>
            {/* Le nom d'un fichier se tronque — il peut être très long ; la
                consigne, elle, s'enroule : coupée, elle ne dit plus ce qui
                arrive quand on ne met pas de logo. */}
            {logo ? (
              <p className="type-caption text-text-secondary min-w-0 truncate">
                {logo.name}
              </p>
            ) : (
              <p className="type-caption text-text-secondary min-w-0">
                Facultatif — PNG, JPG, WebP ou SVG, 2 Mo. À défaut, la pastille
                de couleur.
              </p>
            )}
          </div>

          {/* --- Réseaux et livrables --- */}
          <div className="space-y-3">
            <div>
              <p className="type-overline text-text-secondary">
                Réseaux et livrables mensuels
              </p>
              <p className="type-caption text-text-secondary mt-1">
                Ce que tu dois au client chaque mois, réseau par réseau. C&apos;est
                du contractuel : rien ne le régénère ensuite.
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {NETWORK_SUGGESTIONS.filter(
                (suggestion) => !dejaPris.has(networkKey(suggestion)),
              ).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => ajouterReseau(suggestion)}
                  className="border-border-line hover:bg-surface-sunken focus-visible:ring-ring type-caption text-text-secondary rounded-pill border px-2.5 py-1 transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none"
                >
                  + {suggestion}
                </button>
              ))}
            </div>

            {reseaux.map((reseau, index) => (
              <NetworkCard
                key={`${reseau.nom}-${index}`}
                reseau={reseau}
                onRemove={() =>
                  setReseaux((current) => current.filter((_, i) => i !== index))
                }
                onChange={(patch) => majReseau(index, patch)}
              />
            ))}

            <div className="flex gap-2">
              <Input
                value={nouveau}
                placeholder="Un autre réseau…"
                aria-label="Ajouter un réseau"
                onChange={(event) => setNouveau(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  ajouterReseau(nouveau);
                }}
              />
              <Button
                variant="outline"
                type="button"
                disabled={nouveau.trim().length === 0}
                onClick={() => ajouterReseau(nouveau)}
              >
                <Plus className="size-4" strokeWidth={1.75} aria-hidden />
                Ajouter
              </Button>
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="type-overline text-text-secondary">
              Livraison des intentions
            </span>
            <Input
              value={intentions}
              placeholder="Le 20 du mois précédent"
              aria-label="Livraison des intentions"
              onChange={(event) => setIntentions(event.target.value)}
            />
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" type="button" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={draft.trim().length < 2 || pending}
            onClick={soumettre}
          >
            <PendingLabel pending={pending} busy="Création…">
              Créer le client
            </PendingLabel>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Envoie le logo dans le bucket du nouvel espace.
 *
 * Rend un booléen plutôt que de jeter : à ce stade l'espace est créé, et
 * l'appelant a mieux à faire que d'annuler — il le dit et continue.
 */
async function poserLogo(workspaceSlug: string, file: File): Promise<boolean> {
  const prepared = await safeAction(() =>
    prepareLogoUpload(
      { workspace: workspaceSlug },
      { name: file.name, type: file.type, size: file.size },
    ),
  );
  if (!prepared.ok) return false;

  const upload = await fetch(prepared.url, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  }).catch(() => null);
  if (!upload?.ok) return false;

  const attached = await safeAction(() =>
    attachLogo({ workspace: workspaceSlug }, { path: prepared.path }),
  );
  return attached.ok;
}

/** Un réseau et ce qu'on y publie : des lignes catégorie + quantité. */
function NetworkCard({
  reseau,
  onRemove,
  onChange,
}: {
  reseau: NetworkDraft;
  onRemove: () => void;
  onChange: (patch: Partial<NetworkDraft>) => void;
}) {
  const total = reseau.lines.reduce(
    (sum, line) => sum + (Number(line.quantiteText) || 0),
    0,
  );

  return (
    <div className="border-border-line rounded-md border p-3">
      <div className="flex items-center gap-2">
        <Input
          value={reseau.nom}
          aria-label="Nom du réseau"
          onChange={(event) => onChange({ nom: event.target.value })}
          className="h-8 flex-1"
        />
        <span className="type-caption text-text-secondary shrink-0 tabular-nums">
          {total} / mois
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Retirer ${reseau.nom}`}
          className="hover:bg-surface-sunken focus-visible:ring-ring text-text-secondary flex size-8 shrink-0 items-center justify-center rounded-md transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none"
        >
          <X className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      <div className="mt-2 space-y-1.5">
        {reseau.lines.map((line, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              list="categories-livrables"
              value={line.categorie}
              aria-label="Catégorie de publication"
              placeholder="Post fixe, Reels…"
              className={`${FIELD_CLASS} h-8 min-w-0 flex-1 py-0`}
              onChange={(event) =>
                onChange({
                  lines: reseau.lines.map((current, i) =>
                    i === index
                      ? { ...current, categorie: event.target.value }
                      : current,
                  ),
                })
              }
            />
            <input
              inputMode="numeric"
              value={line.quantiteText}
              aria-label="Quantité par mois"
              className={`${FIELD_CLASS} h-8 w-16 py-0 text-right tabular-nums`}
              onChange={(event) =>
                onChange({
                  lines: reseau.lines.map((current, i) =>
                    i === index
                      ? {
                          ...current,
                          quantiteText: event.target.value.replace(/\D/g, ""),
                        }
                      : current,
                  ),
                })
              }
            />
            <button
              type="button"
              aria-label="Retirer la ligne"
              onClick={() =>
                onChange({ lines: reseau.lines.filter((_, i) => i !== index) })
              }
              className="hover:bg-surface-sunken focus-visible:ring-ring text-text-secondary flex size-8 shrink-0 items-center justify-center rounded-md transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none"
            >
              <X className="size-4" strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            onChange({
              lines: [...reseau.lines, { categorie: "", quantiteText: "0" }],
            })
          }
          className="type-caption text-text-secondary hover:text-text-primary focus-visible:ring-ring rounded-sm px-1 py-0.5 focus-visible:ring-2 focus-visible:outline-none"
        >
          + Ajouter une ligne
        </button>
      </div>

      <datalist id="categories-livrables">
        {DELIVERABLE_CATEGORIES.map((categorie) => (
          <option key={categorie} value={categorie} />
        ))}
      </datalist>
    </div>
  );
}
