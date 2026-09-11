"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare, MessageSquarePlus } from "lucide-react";

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
  VisualsCell,
  WordingCell,
  useCellAction,
} from "@/components/planning/cells";
import { PlatformIcon } from "@/components/planning/platform-icon";
import { objectiveLabels } from "@/lib/planning/columns";
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

/** Les objectifs du tableau d'origine, aux couleurs du board. */
function objectiveChipOptions(objectives: string[]) {
  return objectiveLabels(objectives).map((label) => ({
    value: label.id,
    label: label.label,
    color: label.color,
  }));
}

/**
 * Gabarit desktop, dans l'ordre du planning :
 * client, réseau, sujet, retours, statut, type, date, visuel, wording,
 * sponso, objectif, ads.
 *
 * Les largeurs sont **celles du board** (`BUILTIN_WIDTHS` de
 * `lib/planning/columns.ts`), recopiées et non importées : les lignes viennent
 * de N tableaux dont chacun redimensionne ses colonnes comme il veut, et
 * appeler `gridTemplate(columns)` ferait danser l'alignement d'un client à
 * l'autre. Ici, une colonne tombe au même endroit pour tout le monde.
 *
 * `items-stretch` et non `items-center` : les étiquettes colorées remplissent
 * leur case bord à bord, comme au board — un aplat centré dans une case plus
 * haute que lui laisse deux bandes blanches au-dessus et au-dessous.
 *
 * En dessous de `md`, la ligne se replie en trois niveaux — repère, sujet,
 * puis date et statut. Les colonnes publicitaires et la caption sortent de
 * l'affichage : sur un téléphone, la question est « est-ce parti ? ».
 */
export const PUBLICATION_GRID =
  "md:grid md:grid-cols-[minmax(100px,0.8fr)_44px_minmax(230px,2fr)_40px_132px_120px_108px_76px_minmax(170px,1.2fr)_96px_128px_108px] md:items-stretch";

/**
 * Largeur minimale sous laquelle les douze colonnes se chevauchent — la somme
 * des pistes ci-dessus. Le tableau défile dans son panneau au-delà, comme le
 * board : les largeurs du planning priment sur l'absence de barre de défilement.
 */
export const PUBLICATION_MIN_WIDTH = "md:min-w-[84.5rem]";

/**
 * L'alignement d'un en-tête suit celui de son contenu : du texte se cale à
 * gauche, une étiquette pleine largeur reste centrée. Copié de `headerAlign`
 * du board — « SUJET » centré au-dessus de titres calés à gauche est un
 * décalage que l'œil paie à chaque ligne.
 */
const HEADERS: { label: string; align: "start" | "center" }[] = [
  { label: "Client", align: "start" },
  { label: "Réseau", align: "center" },
  { label: "Sujet", align: "start" },
  { label: "", align: "center" },
  { label: "Statut", align: "center" },
  { label: "Type", align: "center" },
  { label: "Date", align: "center" },
  { label: "Visuel", align: "center" },
  { label: "Wording", align: "center" },
  { label: "Sponso", align: "center" },
  { label: "Objectif", align: "center" },
  { label: "Ads", align: "center" },
];

/** L'en-tête du tableau, qui partage le gabarit des lignes. */
export function PublicationHeader() {
  return (
    <div
      className={cn(
        // Mêmes filets que le board — pleins et verticaux — et même padding
        // par cellule, pour que l'en-tête et les lignes restent alignés.
        "type-overline border-border-strong bg-surface-sunken [&>*+*]:border-border-strong hidden border-b px-2 text-text-secondary [&>*+*]:border-l",
        PUBLICATION_GRID,
        PUBLICATION_MIN_WIDTH,
      )}
    >
      {HEADERS.map((header, index) => (
        <span
          key={header.label || `piste-${index}`}
          className={cn(
            "flex min-w-0 items-center px-1 py-1.5",
            header.align === "center" ? "justify-center" : "justify-start",
          )}
        >
          <span className="truncate">{header.label}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Une cellule du tableau, aux marges du board.
 *
 * `flush` : aucune marge autour du contenu — le mode des étiquettes, dont
 * l'aplat coloré remplit le rectangle entier, du filet de gauche au filet de
 * droite. Il ne vaut qu'avec `items-stretch` sur la grille : seul, il rend
 * pire qu'un aplat centré.
 */
function Cell({
  className,
  flush,
  children,
}: {
  className?: string;
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        flush ? "flex min-w-0 items-stretch" : "flex min-w-0 items-center px-1 py-1.5",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Une ligne du tableau — l'allure et la mécanique du board.
 *
 * Elle s'arrête là : ni poignée de glissement, ni coche de sélection, ni tri
 * au clic. Ce tableau n'est pas le board, c'est la liste du jour ; ce qui se
 * range, se sélectionne et se trie se fait sur le planning du client.
 */
export function PublicationRowView({ row }: { row: Row }) {
  const router = useRouter();
  const { run, pending } = useCellAction();
  const scope = { workspace: row.workspace.slug, board: row.board_slug };

  const edit = (field: EditableField, value: unknown) =>
    run(() => updateSubject(scope, { subjectId: row.subject.id, field, value }));

  // Le panneau du post vit sur le planning : les retours et le clic sur le
  // visuel y renvoient, publication déjà ouverte.
  const planningHref = (focus?: "retour") =>
    `/espace/${row.workspace.slug}/planning/${row.board_slug}?sujet=${row.subject.id}${
      focus ? "&focus=retour" : ""
    }`;

  return (
    <div
      className={cn(
        // Filets pleins et verticaux, comme au board : sur le blanc du
        // tableau, un `border/50` disparaissait et les cellules flottaient
        // sans grille. Le padding vertical est passé aux cellules — c'est lui
        // qui donne sa hauteur à la ligne, et les aplats doivent la remplir.
        "group/row border-border-strong md:[&>*+*]:border-border-strong flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-2 py-1 transition-colors md:gap-x-0 md:py-0 md:[&>*+*]:border-l",
        "hover:bg-surface-sunken",
        PUBLICATION_GRID,
        PUBLICATION_MIN_WIDTH,
        pending && "opacity-60",
      )}
    >
      {/* Pas de pastille de date ici : la colonne « Date » la porte déjà, et
          la doubler amputait le nom du client — « Bondet » devenait « B. ». */}
      <Cell>
        <WorkspaceChip workspace={row.workspace} boardSlug={row.board_slug} />
      </Cell>

      {/* La pastille de marque plutôt que le nom du réseau en capitales : à
          l'échelle d'une liste, une tache de couleur se balaie, un mot se lit. */}
      <Cell className="justify-center">
        <PlatformIcon platform={row.platform} />
        <span className="sr-only">{row.lane_name}</span>
      </Cell>

      {/* `min-w-0` : un `<input>` porte une largeur intrinsèque d'une vingtaine
          de caractères, et une cellule de grille ne descend pas sous le
          minimum de son contenu. Sans lui, le sujet débordait sous la pastille
          de statut. */}
      <Cell className="basis-full md:basis-auto">
        <TextCell
          value={row.subject.name}
          ariaLabel={`Sujet de la publication de ${row.workspace.name}`}
          placeholder="Sujet…"
          className="font-medium"
          onCommit={(next) => edit("name", next)}
        />
      </Cell>

      {/* Les retours du board, comptés — le clic ouvre le panneau du planning
          directement sur le fil. */}
      <Cell className="hidden justify-center md:flex">
        <Link
          href={planningHref("retour")}
          aria-label={`Retours sur ${row.subject.name || "la publication"} (${row.comments_count})`}
          className={cn(
            "hover:bg-muted focus-visible:ring-brand relative flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-2",
            row.comments_count > 0 ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {row.comments_count > 0 ? (
            <>
              <MessageSquare className="size-3.5" aria-hidden />
              <span className="bg-accent-ink absolute -top-0.5 -right-0.5 flex size-3 items-center justify-center rounded-full text-[8px] font-bold text-white tabular-nums">
                {row.comments_count}
              </span>
            </>
          ) : (
            <MessageSquarePlus className="size-3.5 opacity-40" aria-hidden />
          )}
        </Link>
      </Cell>

      <Cell flush className="w-[8.5rem] md:w-auto">
        <ChipSelect<string>
          value={row.subject.status === "idea" ? null : row.subject.status}
          options={STATUS_OPTIONS}
          ariaLabel={`Statut de la publication de ${row.workspace.name}`}
          allowClear
          fill
          onSelect={(next) => edit("status", next ?? "idea")}
        />
      </Cell>

      <Cell flush className="hidden md:flex">
        <ChipSelect<string>
          value={row.subject.format === "other" ? null : row.subject.format}
          options={FORMAT_OPTIONS}
          ariaLabel="Type de contenu"
          allowClear
          fill
          onSelect={(next) => edit("format", next ?? "other")}
        />
      </Cell>

      {/* Le planning n'a pas d'heure de publication : la date est l'échéance.
          En retard, elle s'encre en rouge. */}
      <Cell className="w-[7.5rem] md:w-auto">
        <DateCell
          value={row.subject.scheduled_on}
          late={row.late}
          onCommit={(next) => edit("scheduled_on", next)}
        />
      </Cell>

      {/* Comme la caption : une vignette de 56 px ne vaut pas une ligne entière
          sur un téléphone, où la question est « est-ce parti ? ». Le clic
          ouvre le post sur son planning, comme au board. */}
      <Cell className="hidden md:flex">
        <VisualsCell
          visuals={row.visuals}
          subjectName={row.subject.name}
          uploading={pending}
          onOpen={() => router.push(planningHref())}
          onUpload={(files) =>
            run(() => uploadVisualsFromBrowser(scope, row.subject.id, files))
          }
          onRemove={(path) =>
            run(() => removeVisual(scope, { subjectId: row.subject.id, path }))
          }
        />
      </Cell>

      <Cell className="hidden md:flex">
        <WordingCell
          value={row.subject.wording}
          subjectName={row.subject.name}
          onCommit={(next) => edit("wording", next)}
        />
      </Cell>

      <Cell className="hidden md:flex">
        <NumberCell
          value={row.subject.sponsoring}
          ariaLabel="Budget de sponsorisation"
          onCommit={(next) => edit("sponsoring", next)}
        />
      </Cell>

      {/* Étiquettes colorées, comme au board — pas une liste de texte nu. */}
      <Cell flush className="hidden md:flex">
        <ChipSelect<string>
          value={row.subject.ad_objective}
          options={objectiveChipOptions(row.objectives)}
          ariaLabel="Objectif de l'annonce"
          allowClear
          fill
          onSelect={(next) => edit("ad_objective", next)}
        />
      </Cell>

      <Cell flush className="hidden md:flex">
        <ChipSelect<string>
          value={row.subject.ad_status}
          options={AD_STATUS_OPTIONS}
          ariaLabel="Statut de l'annonce"
          allowClear
          fill
          onSelect={(next) => edit("ad_status", next)}
        />
      </Cell>
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
