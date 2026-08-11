"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ClipboardList,
  Compass,
  Download,
  File,
  Globe,
  Image as ImageIcon,
  Loader2,
  Palette,
  PenLine,
  RefreshCw,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";

import {
  deleteAsset,
  toggleAssetInclude,
  updateAssetSummary,
  uploadAssets,
} from "@/app/actions/context";
import { Panel, PanelHeader, PanelRows } from "@/components/ds/surface";
import { Button, buttonVariants } from "@/components/ui/button";
import { assetUploadError } from "@/lib/context/storage";
import {
  ASSET_TYPE_LABELS,
  ASSET_TYPES,
  type ClientAsset,
  type ClientAssetType,
} from "@/lib/context/types";
import { formatOctets } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Le bloc Documents : dépôt en glisser-déposer, une ligne par pièce avec sa
 * case d'injection, son résumé extrait, et les actions au survol. Les
 * documents restent stockés — ils ne sont jamais supprimés automatiquement
 * après extraction.
 */

const TYPE_ICONS: Record<ClientAssetType, LucideIcon> = {
  website: Globe,
  questionnaire: ClipboardList,
  strategy: Compass,
  lookbook: ImageIcon,
  guidelines: Palette,
  benchmark: BarChart3,
  other: File,
};

export function DocumentsPanel({
  workspaceSlug,
  assets,
  downloads,
}: {
  workspaceSlug: string;
  assets: ClientAsset[];
  downloads: Record<string, string>;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<ClientAssetType>("other");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, startUpload] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [, startRowAction] = useTransition();

  function triggerExtraction(assetId: string, force = false) {
    void fetch("/api/contexte/extraction", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace: workspaceSlug, assetId, force }),
    }).catch(() => undefined);
  }

  function handleFiles(list: FileList | null) {
    const files = [...(list ?? [])];
    if (files.length === 0) return;

    const problem = assetUploadError(files);
    if (problem) {
      toast.error(problem);
      return;
    }

    const formData = new FormData();
    formData.set("type", uploadType);
    for (const file of files) formData.append("file", file);

    startUpload(async () => {
      const outcome = await uploadAssets({ workspace: workspaceSlug }, formData);
      if (!outcome.ok) {
        toast.error(outcome.error);
        return;
      }
      toast.success(outcome.message);
      // L'analyse part en arrière-plan, la liste montre « Analyse en cours ».
      for (const assetId of outcome.assetIds) triggerExtraction(assetId);
      router.refresh();
    });
  }

  function toggleInclude(asset: ClientAsset) {
    startRowAction(async () => {
      const outcome = await toggleAssetInclude(
        { workspace: workspaceSlug },
        { assetId: asset.id, include: !asset.include_in_context },
      );
      if (!outcome.ok) toast.error(outcome.error);
      router.refresh();
    });
  }

  function saveSummary(asset: ClientAsset) {
    startRowAction(async () => {
      const outcome = await updateAssetSummary(
        { workspace: workspaceSlug },
        { assetId: asset.id, summary: summaryDraft },
      );
      if (!outcome.ok) {
        toast.error(outcome.error);
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  function remove(asset: ClientAsset) {
    if (!window.confirm(`Supprimer « ${asset.name} » et son résumé ?`)) return;
    startRowAction(async () => {
      const outcome = await deleteAsset(
        { workspace: workspaceSlug },
        { assetId: asset.id },
      );
      if (!outcome.ok) {
        toast.error(outcome.error);
        return;
      }
      toast.success(outcome.message ?? "Document supprimé.");
      router.refresh();
    });
  }

  function reanalyze(asset: ClientAsset) {
    triggerExtraction(asset.id, true);
    toast.info(`Analyse relancée pour « ${asset.name} ».`);
    // Laisser à la route le temps de passer la ligne en « running », puis la
    // page enchaîne sur son propre rafraîchissement périodique.
    setTimeout(() => router.refresh(), 800);
  }

  return (
    <Panel>
      <PanelHeader
        title="Documents"
        count={assets.length}
        description="La case active l'injection du résumé dans les prompts."
      />

      <div className="px-5 pt-5">
        <div
          role="button"
          tabIndex={0}
          aria-label="Déposer des documents"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            handleFiles(event.dataTransfer.files);
          }}
          className={cn(
            "focus-visible:ring-ring flex flex-col items-center gap-2 rounded-lg border border-dashed px-5 py-8 text-center transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
            dragOver
              ? "border-accent-ink bg-accent-subtle/40"
              : "border-border-strong bg-surface-sunken hover:border-accent-ink/60",
          )}
        >
          {uploading ? (
            <Loader2
              aria-hidden
              strokeWidth={1.75}
              className="size-5 animate-spin text-text-secondary"
            />
          ) : (
            <UploadCloud aria-hidden strokeWidth={1.75} className="size-5 text-text-tertiary" />
          )}
          <p className="type-body text-text-primary">
            {uploading
              ? "Envoi en cours…"
              : "Glisser-déposer des documents ici, ou cliquer pour choisir."}
          </p>
          <p className="type-caption text-text-secondary">
            PDF, DOCX, texte, CSV ou image, 50 Mo par fichier. L&apos;analyse démarre
            toute seule après le dépôt.
          </p>
          <label
            className="mt-1 flex items-center gap-2"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="type-caption text-text-secondary">Type des fichiers :</span>
            <select
              value={uploadType}
              onChange={(event) => setUploadType(event.target.value as ClientAssetType)}
              className="focus-visible:ring-ring h-8 rounded-md border border-border-line bg-surface px-2 type-caption text-text-primary focus-visible:ring-2 focus-visible:outline-none"
            >
              {ASSET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ASSET_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              handleFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      </div>

      {assets.length === 0 ? (
        <p className="px-5 py-5 type-body text-text-secondary">
          Aucun document pour le moment. Le brief peut s&apos;écrire à la main, mais la
          régénération a besoin d&apos;au moins un document analysé.
        </p>
      ) : (
        <PanelRows className="mt-5 border-t border-border">
          {assets.map((asset) => {
            const Icon = TYPE_ICONS[asset.type];
            const analyzing =
              asset.extraction_status === "pending" || asset.extraction_status === "running";
            const editing = editingId === asset.id;
            const downloadUrl = downloads[asset.storage_path];

            return (
              <div key={asset.id} className="group flex items-start gap-3 px-5 py-4">
                <input
                  type="checkbox"
                  checked={asset.include_in_context}
                  onChange={() => toggleInclude(asset)}
                  aria-label={`Injecter « ${asset.name} » dans les prompts`}
                  className="mt-1 size-4 shrink-0 accent-accent-ink"
                />
                <Icon
                  aria-hidden
                  strokeWidth={1.75}
                  className="mt-0.5 size-4 shrink-0 text-text-tertiary"
                />

                <div className="min-w-0 flex-1">
                  <p className="type-body font-medium break-all text-text-primary">
                    {asset.name}
                  </p>

                  {analyzing ? (
                    <p className="mt-1 flex items-center gap-1.5 type-caption text-text-secondary">
                      <Loader2 aria-hidden strokeWidth={1.75} className="size-3.5 animate-spin" />
                      Analyse en cours
                    </p>
                  ) : asset.extraction_status === "error" ? (
                    <p className="mt-1 type-caption text-danger-ink">
                      {asset.extraction_error ?? "Analyse en échec."}
                    </p>
                  ) : editing ? (
                    <div className="mt-2 flex flex-col gap-2">
                      <textarea
                        autoFocus
                        value={summaryDraft}
                        rows={5}
                        onChange={(event) => setSummaryDraft(event.target.value)}
                        aria-label={`Résumé de « ${asset.name} »`}
                        className="focus-visible:ring-ring w-full resize-y rounded-md border border-border-line bg-surface px-3 py-2 type-caption text-text-primary focus-visible:ring-2 focus-visible:outline-none"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveSummary(asset)}>
                          Enregistrer
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          Annuler
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 type-caption leading-relaxed whitespace-pre-wrap text-text-secondary">
                      {asset.summary ?? "Pas encore de résumé."}
                      {asset.summary_edited_manually ? (
                        <span className="ml-1.5 text-text-secondary/80">
                          (retouché à la main)
                        </span>
                      ) : null}
                    </p>
                  )}
                </div>

                <p className="hidden shrink-0 text-right type-caption text-text-secondary md:block">
                  {formatOctets(asset.size_bytes)}
                  <br />
                  {ASSET_TYPE_LABELS[asset.type]}
                </p>

                <div className="flex shrink-0 items-center gap-0.5 md:opacity-0 md:transition-opacity md:duration-(--motion-duration) md:ease-standard md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                  {downloadUrl ? (
                    <a
                      href={downloadUrl}
                      download={asset.name}
                      aria-label={`Télécharger « ${asset.name} »`}
                      className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                    >
                      <Download aria-hidden strokeWidth={1.75} />
                    </a>
                  ) : null}
                  {!analyzing ? (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Modifier le résumé de « ${asset.name} »`}
                      onClick={() => {
                        setEditingId(asset.id);
                        setSummaryDraft(asset.summary ?? "");
                      }}
                    >
                      <PenLine aria-hidden strokeWidth={1.75} />
                    </Button>
                  ) : null}
                  {!analyzing ? (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Relancer l'analyse de « ${asset.name} »`}
                      onClick={() => reanalyze(asset)}
                    >
                      <RefreshCw aria-hidden strokeWidth={1.75} />
                    </Button>
                  ) : null}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Supprimer « ${asset.name} »`}
                    onClick={() => remove(asset)}
                  >
                    <Trash2 aria-hidden strokeWidth={1.75} />
                  </Button>
                </div>
              </div>
            );
          })}
        </PanelRows>
      )}
    </Panel>
  );
}
