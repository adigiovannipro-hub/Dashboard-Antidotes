"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Film, Rss } from "lucide-react";
import { toast } from "sonner";

import { renameRadarAccount, updateReferencePost } from "@/app/actions/antidotes-inbound";
import { NativeSelect } from "@/components/antidotes/controls";
import { PlatformChip } from "@/components/antidotes/inbound-chips";
import { useInboundUrl } from "@/components/antidotes/inbound-url";
import { EmptyState } from "@/components/ds/empty-state";
import { Panel, PanelBody } from "@/components/ds/surface";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/antidotes/dates";
import { formatEngagement } from "@/lib/antidotes/inbound/engagement";
import {
  applyContentFilters,
  type ContentFilters,
  type ContentSort,
} from "@/lib/antidotes/inbound/filters";
import type { InboundContent } from "@/lib/antidotes/inbound/queries";
import { POST_PLATFORM_LABELS, type PostPlatform } from "@/lib/antidotes/types";
import { formatValue } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Le tableau — l'écran de l'inbound, et plus une vue parmi six.
 *
 * Il se lit comme du Notion et se corrige comme un tableur : le réseau, la
 * date et l'auteur se modifient dans la cellule, parce que le relevé se
 * trompe et qu'attendre un passage pour corriger un nom n'a pas de sens. Le
 * texte, lui, s'édite dans le panneau : deux lignes de tableau ne suffisent
 * pas à relire un script.
 *
 * Les chiffres ne se modifient pas : ils viennent du réseau. Les saisir à la
 * main reviendrait à inventer une performance, ce que l'application ne fait
 * nulle part.
 *
 * Un clic sur la ligne ouvre le panneau — sans aller-retour serveur, tout est
 * déjà chargé.
 */

const PLATFORMS: PostPlatform[] = ["linkedin", "instagram", "youtube", "tiktok", "x"];

type Column = {
  label: string;
  sort?: ContentSort;
  align?: "right";
};

const COLUMNS: Column[] = [
  { label: "Réseau" },
  { label: "Date", sort: "date" },
  { label: "Auteur" },
  { label: "Contenu" },
  { label: "Vues", sort: "vues", align: "right" },
  { label: "Likes", sort: "likes", align: "right" },
  { label: "Comm.", sort: "commentaires", align: "right" },
  { label: "Part.", sort: "partages", align: "right" },
  { label: "Enreg.", sort: "enregistrements", align: "right" },
  { label: "Score", sort: "score", align: "right" },
];

export function InboundContentTable({
  contents,
  filters,
  now,
}: {
  contents: InboundContent[];
  filters: ContentFilters;
  /** L'instant de référence de la fenêtre, posé par le serveur : lu au rendu,
      il changerait à chaque passage et ferait glisser la période sous les pieds. */
  now: number;
}) {
  const { go } = useInboundUrl();
  const rows = useMemo(
    () =>
      applyContentFilters(
        contents.map((entry) => ({
          ...entry,
          platform: entry.post.platform,
          metrics: entry.post.metrics,
          published_at: entry.post.published_at,
          is_mine: entry.post.is_mine,
        })),
        filters,
        now,
      ),
    [contents, filters, now],
  );

  /* Un clic range du plus grand au plus petit ; le même clic sur la colonne
     déjà rangée retourne l'ordre. « Score » est le tri par défaut : il ne
     s'écrit pas dans l'URL, sinon chaque lien porterait un paramètre nul. */
  const nextSort = (sort: ContentSort): Record<string, string | null> => ({
    tri: sort === "score" ? null : sort,
    sens: filters.sort === sort && filters.direction === "desc" ? "asc" : null,
    post: null,
    brouillon: null,
  });

  if (rows.length === 0) {
    return (
      <Panel>
        <PanelBody>
          <EmptyState
            icon={contents.length === 0 ? Rss : Film}
            message={
              contents.length === 0
                ? "Rien de relevé pour l'instant : ajoutez un compte, puis « Relever maintenant »."
                : "Aucun contenu ne passe ces filtres. Élargissez la période ou baissez un seuil."
            }
          />
        </PanelBody>
      </Panel>
    );
  }

  return (
    <Panel>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[68rem] border-collapse">
          <thead>
            <tr className="border-b border-border-strong">
              {COLUMNS.map((column) => (
                <th
                  key={column.label}
                  scope="col"
                  className={cn(
                    "type-overline px-3 py-2 text-text-secondary",
                    column.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {column.sort ? (
                    <button
                      type="button"
                      onClick={() => go(nextSort(column.sort!))}
                      className={cn(
                        /* `uppercase` explicite : un `<button>` ne reçoit pas
                           le `text-transform` de son parent (feuille de style
                           du navigateur), et « Date » se lisait en minuscules
                           entre deux en-têtes capitalisés. */
                        "focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm uppercase hover:text-text-primary focus-visible:ring-2 focus-visible:outline-none",
                        filters.sort === column.sort && "text-text-primary",
                      )}
                    >
                      {column.label}
                      {filters.sort === column.sort ? (
                        filters.direction === "asc" ? (
                          <ArrowUp className="size-3" strokeWidth={2} aria-hidden />
                        ) : (
                          <ArrowDown className="size-3" strokeWidth={2} aria-hidden />
                        )
                      ) : null}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <ContentRow key={row.post.id} entry={row} />
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

type CellPatch = { platform?: PostPlatform; publishedAt?: string | null; authorHandle?: string | null };

function ContentRow({ entry }: { entry: InboundContent }) {
  const router = useRouter();
  const { go } = useInboundUrl();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<"platform" | "date" | "author" | null>(null);

  /* La cellule modifiée se pose tout de suite et le serveur confirme derrière
     — même mécanique que le kanban du pipeline. Sans ça, corriger un réseau
     ne se verrait qu'au rechargement suivant, et le geste paraîtrait perdu.
     L'état local retombe dès que la ligne rendue par le serveur porte la
     nouvelle valeur. */
  const [local, setLocal] = useState<CellPatch>({});
  const [seen, setSeen] = useState(entry.post);
  if (seen !== entry.post) {
    setSeen(entry.post);
    setLocal({});
  }

  const post = entry.post;
  const platform = local.platform ?? post.platform;
  const publishedAt = local.publishedAt !== undefined ? local.publishedAt : post.published_at;
  const author =
    local.authorHandle !== undefined
      ? local.authorHandle
      : post.is_mine
        ? "Moi"
        : (entry.account?.label ?? post.author_handle);
  const text = post.transcript?.trim() || post.content;

  const save = (patch: CellPatch) => {
    setEditing(null);
    setLocal((previous) => ({ ...previous, ...patch }));
    startTransition(async () => {
      /* Renommer l'auteur d'un post rattaché à un compte veillé renomme **le
         compte** : c'est lui que la colonne affiche, et ses vingt autres
         lignes portent le même nom. Écrire sur le post seul aurait été un
         geste sans effet visible, le libellé du compte primant à l'affichage. */
      const result =
        patch.authorHandle !== undefined && entry.account
          ? await renameRadarAccount({ accountId: entry.account.id, label: patch.authorHandle ?? "" })
          : await updateReferencePost({ postId: post.id, ...patch });
      if (result.ok) router.refresh();
      else {
        setLocal({});
        toast.error(result.error);
      }
    });
  };

  const open = () => go({ post: post.id, brouillon: null });

  /* Une cellule modifiable se signale au survol et nulle part ailleurs : une
     bordure au repos ferait de chaque ligne un formulaire. */
  const cell =
    "focus-visible:ring-ring w-full rounded-sm px-1 py-0.5 text-left transition-colors duration-(--motion-duration) ease-standard hover:bg-muted focus-visible:ring-2 focus-visible:outline-none";

  return (
    <tr
      onClick={open}
      className={cn(
        "cursor-pointer border-b border-border transition-colors duration-(--motion-duration) ease-standard last:border-0 hover:bg-muted/60",
        pending && "opacity-60",
      )}
    >
      <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
        {editing === "platform" ? (
          <NativeSelect
            size="small"
            autoFocus
            aria-label="Réseau"
            defaultValue={platform}
            onBlur={() => setEditing(null)}
            onChange={(event) => save({ platform: event.target.value as PostPlatform })}
          >
            {PLATFORMS.map((platform) => (
              <option key={platform} value={platform}>
                {POST_PLATFORM_LABELS[platform]}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <button
            type="button"
            onClick={() => setEditing("platform")}
            aria-label={`Réseau : ${POST_PLATFORM_LABELS[platform]}`}
            className={cn(cell, "inline-flex w-auto items-center gap-2")}
          >
            <PlatformChip platform={platform} mine={post.is_mine} />
            <span className="type-caption text-text-secondary">{POST_PLATFORM_LABELS[platform]}</span>
          </button>
        )}
      </td>

      <td className="px-3 py-2.5 whitespace-nowrap" onClick={(event) => event.stopPropagation()}>
        {editing === "date" ? (
          <Input
            type="date"
            autoFocus
            aria-label="Date de publication"
            defaultValue={publishedAt?.slice(0, 10) ?? ""}
            onBlur={(event) => save({ publishedAt: event.target.value || null })}
            className="h-8 w-40"
          />
        ) : (
          <button type="button" onClick={() => setEditing("date")} className={cn(cell, "type-caption tabular-nums text-text-secondary")}>
            {publishedAt ? formatDate(publishedAt) : "—"}
          </button>
        )}
      </td>

      <td className="max-w-48 px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
        {editing === "author" ? (
          <Input
            autoFocus
            aria-label="Auteur"
            defaultValue={author ?? ""}
            onBlur={(event) => save({ authorHandle: event.target.value.trim() || null })}
            className="h-8"
          />
        ) : (
          <button type="button" onClick={() => setEditing("author")} className={cn(cell, "type-label truncate text-text-primary")}>
            {author ?? "—"}
          </button>
        )}
      </td>

      <td className="max-w-lg px-3 py-2.5">
        <span className="type-body line-clamp-2 text-text-primary">{text}</span>
        {post.media_kind === "video" ? (
          <span className="type-caption mt-1 inline-flex items-center gap-1 text-text-secondary">
            <Film className="size-3.5" strokeWidth={1.75} aria-hidden />
            {post.transcript ? "Script" : "Vidéo"}
          </span>
        ) : null}
      </td>

      <Metric value={post.metrics.views} />
      <Metric value={post.metrics.likes} />
      <Metric value={post.metrics.comments} />
      <Metric value={post.metrics.shares} />
      <Metric value={post.metrics.saves} />
      <td className="px-3 py-2.5 text-right">
        <span className="type-label whitespace-nowrap text-text-primary tabular-nums">
          {formatEngagement(entry.score)}
        </span>
      </td>
    </tr>
  );
}

function Metric({ value }: { value: number | undefined }) {
  return (
    <td className="px-3 py-2.5 text-right">
      <span className="type-body whitespace-nowrap text-text-primary tabular-nums">
        {value === undefined ? "—" : formatValue(value, "integer")}
      </span>
    </td>
  );
}
