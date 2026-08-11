"use client";

import Link from "next/link";

import {
  removeVisual,
  updateSubject,
  type EditableField,
} from "@/app/actions/planning";
import {
  ChipSelect,
  DateCell,
  NumberCell,
  TextCell,
  TextSelect,
  VisualsCell,
  WordingCell,
  useCellAction,
} from "@/components/planning/cells";
import { uploadVisualsFromBrowser } from "@/lib/planning/upload-client";
import type { TaskWorkspace } from "@/lib/mon-travail/types";
import type { PublicationRow as Row } from "@/lib/mon-travail/types";
import {
  AD_STATUS_COLORS,
  AD_STATUS_LABELS,
  AD_STATUS_ORDER,
  FORMAT_COLORS,
  FORMAT_LABELS,
  FORMAT_ORDER,
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_ORDER,
} from "@/lib/planning/types";
import { cn } from "@/lib/utils";

/**
 * Une ligne d'« À publier » : la publication du planning éditorial, entière et
 * éditable, sur la page d'accueil.
 *
 * Les cellules sont **celles du planning** — même pastille de statut, même
 * dialogue de wording, mêmes visuels — et les écritures passent par les mêmes
 * actions, sur la même ligne en base. La synchronisation entre les deux vues
 * n'est pas un mécanisme : c'est l'absence de copie.
 *
 * L'ordre des colonnes est celui du board, à la lettre. Une ligne qui range
 * ses colonnes autrement oblige à réapprendre le même tableau deux fois ; et
 * c'est en les comparant qu'on a vu que la sponsorisation et l'objectif
 * publicitaire manquaient tout simplement ici.
 */

const STATUS_OPTIONS = STATUS_ORDER.filter((status) => status !== "idea").map(
  (status) => ({
    value: status,
    label: STATUS_LABELS[status],
    color: STATUS_COLORS[status],
  }),
);

const FORMAT_OPTIONS = FORMAT_ORDER.filter((format) => format !== "other").map(
  (format) => ({
    value: format,
    label: FORMAT_LABELS[format],
    color: FORMAT_COLORS[format],
  }),
);

const AD_STATUS_OPTIONS = AD_STATUS_ORDER.map((status) => ({
  value: status,
  label: AD_STATUS_LABELS[status],
  color: AD_STATUS_COLORS[status],
}));

/**
 * Gabarit desktop, dans l'ordre du planning :
 * client, réseau, sujet, statut, type, date, visuel, wording, sponso,
 * objectif, ads.
 *
 * En dessous de `md`, la ligne se replie en trois niveaux — repère, sujet,
 * puis date et statut. Les colonnes publicitaires et la caption sortent de
 * l'affichage : sur un téléphone, la question est « est-ce parti ? ».
 */
export const PUBLICATION_GRID =
  "md:grid md:grid-cols-[minmax(112px,0.8fr)_72px_minmax(120px,2.4fr)_118px_96px_122px_48px_minmax(96px,1fr)_64px_92px_80px] md:items-center md:gap-x-1";

/**
 * Largeur minimale sous laquelle les onze colonnes se chevauchent.
 *
 * Calée sous la largeur utile d'un écran de 1440 px — rail de 240 px et
 * marges déduites, il reste 1 152 px. À 74 rem, la colonne « Ads » tombait
 * hors champ et il fallait défiler pour voir qu'elle existait.
 */
export const PUBLICATION_MIN_WIDTH = "md:min-w-[68rem]";

/** L'en-tête du tableau, qui partage le gabarit des lignes. */
export function PublicationHeader() {
  return (
    <div
      className={cn(
        "type-overline hidden border-b border-border bg-surface-sunken px-2 py-1.5 text-text-secondary",
        PUBLICATION_GRID,
        PUBLICATION_MIN_WIDTH,
      )}
    >
      <span className="px-1.5">Client</span>
      <span className="px-1.5">Réseau</span>
      <span className="px-1.5">Sujet</span>
      <span className="text-center">Statut</span>
      <span className="text-center">Type</span>
      <span className="px-1.5">Date</span>
      <span className="text-center">Visuel</span>
      <span className="px-1.5">Wording</span>
      <span className="px-1.5 text-right">Sponso</span>
      <span className="px-1.5">Objectif</span>
      <span className="text-center">Ads</span>
    </div>
  );
}

/**
 * La ligne est identique dans « À publier » et dans « Archivé ».
 *
 * Elle y était voilée à 60 % ; le voile faisait tomber « INSTAGRAM » à 2,43:1
 * et l'encre blanche des pastilles à 1,56:1. Aucune opacité ne tient le seuil
 * sur du gris — le calcul plafonne à 0,92, autant dire rien. Ce qui dit
 * « c'est fait », c'est le titre de la section et la pastille « Publié ».
 */
export function PublicationRowView({ row }: { row: Row }) {
  const { run, pending } = useCellAction();
  const scope = { workspace: row.workspace.slug, board: row.board_slug };

  const edit = (field: EditableField, value: unknown) =>
    run(() => updateSubject(scope, { subjectId: row.subject.id, field, value }));

  return (
    <div
      className={cn(
        "group/row flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border/60 px-2 py-2.5 transition-colors md:py-1",
        "hover:bg-muted/40",
        PUBLICATION_GRID,
        PUBLICATION_MIN_WIDTH,
        pending && "opacity-60",
      )}
    >
      {/* Pas de pastille de date ici : la colonne « Date » la porte déjà, et
          la doubler amputait le nom du client — « Bondet » devenait « B. ». */}
      <WorkspaceChip workspace={row.workspace} boardSlug={row.board_slug} />

      <span className="type-overline truncate text-text-secondary">
        {row.lane_name}
      </span>

      {/* `min-w-0` : un `<input>` porte une largeur intrinsèque d'une vingtaine
          de caractères, et une cellule de grille ne descend pas sous le
          minimum de son contenu. Sans lui, le sujet débordait sous la pastille
          de statut. */}
      <div className="min-w-0 basis-full md:basis-auto">
        <TextCell
          value={row.subject.name}
          ariaLabel={`Sujet de la publication de ${row.workspace.name}`}
          placeholder="Sujet…"
          className="font-medium"
          onCommit={(next) => edit("name", next)}
        />
      </div>

      <div className="w-[8.5rem] md:w-full">
        <ChipSelect<string>
          value={row.subject.status === "idea" ? null : row.subject.status}
          options={STATUS_OPTIONS}
          ariaLabel={`Statut de la publication de ${row.workspace.name}`}
          allowClear
          onSelect={(next) => edit("status", next ?? "idea")}
        />
      </div>

      <div className="hidden md:block">
        <ChipSelect<string>
          value={row.subject.format === "other" ? null : row.subject.format}
          options={FORMAT_OPTIONS}
          ariaLabel="Type de contenu"
          allowClear
          onSelect={(next) => edit("format", next ?? "other")}
        />
      </div>

      {/* Le planning n'a pas d'heure de publication : la date est l'échéance. */}
      <div className="w-[7.5rem] md:w-full">
        <DateCell
          value={row.subject.scheduled_on}
          onCommit={(next) => edit("scheduled_on", next)}
        />
      </div>

      {/* Comme la caption : une vignette de 56 px ne vaut pas une ligne entière
          sur un téléphone, où la question est « est-ce parti ? ». */}
      <VisualsCell
        className="hidden md:flex"
        visuals={row.visuals}
        subjectName={row.subject.name}
        uploading={pending}
        onUpload={(files) =>
          run(() => uploadVisualsFromBrowser(scope, row.subject.id, files))
        }
        onRemove={(path) =>
          run(() => removeVisual(scope, { subjectId: row.subject.id, path }))
        }
      />

      <div className="hidden min-w-0 md:block">
        <WordingCell
          value={row.subject.wording}
          subjectName={row.subject.name}
          onCommit={(next) => edit("wording", next)}
        />
      </div>

      <div className="hidden md:block">
        <NumberCell
          value={row.subject.sponsoring}
          ariaLabel="Budget de sponsorisation"
          onCommit={(next) => edit("sponsoring", next)}
        />
      </div>

      <div className="hidden min-w-0 md:block">
        <TextSelect
          value={row.subject.ad_objective}
          options={row.objectives}
          ariaLabel="Objectif de l'annonce"
          onSelect={(next) => edit("ad_objective", next)}
        />
      </div>

      <div className="hidden md:block">
        <ChipSelect<string>
          value={row.subject.ad_status}
          options={AD_STATUS_OPTIONS}
          ariaLabel="Statut de l'annonce"
          allowClear
          onSelect={(next) => edit("ad_status", next)}
        />
      </div>
    </div>
  );
}

/** Le client de la ligne, cliquable vers son planning d'origine. */
function WorkspaceChip({
  workspace,
  boardSlug,
}: {
  workspace: TaskWorkspace;
  boardSlug: string;
}) {
  return (
    <Link
      href={`/espace/${workspace.slug}/planning/${boardSlug}`}
      className="focus-visible:ring-brand flex min-w-0 items-center gap-1.5 rounded-sm text-sm font-medium outline-none hover:underline focus-visible:ring-2"
      title={`Ouvrir le planning de ${workspace.name}`}
    >
      <span
        aria-hidden
        className="bg-muted size-2.5 shrink-0 rounded-full"
        style={
          workspace.accent_color
            ? { backgroundColor: workspace.accent_color }
            : undefined
        }
      />
      <span className="truncate">{workspace.name}</span>
    </Link>
  );
}
