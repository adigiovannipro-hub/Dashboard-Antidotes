"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, MessageSquare, Plus, Search, Trash2 } from "lucide-react";

import {
  createFaqEntry,
  deleteFaqEntry,
  setFaqClientReview,
  setFaqEntryCategory,
  updateFaqEntryField,
} from "@/app/actions/moderation";
import { ConfirmDialog } from "@/components/ds/confirm-dialog";
import { FaqCommentThread } from "@/components/faq/faq-comment-thread";
import { ThemeChip, ThemeLabelsDialog, themeColor } from "@/components/faq/themes";
import { StatusPill, type StatusTone } from "@/components/ds/status-pill";
import {
  ChipSelect,
  LastUpdateCell,
  TextCell,
  WordingCell,
  useCellAction,
  type ChipOption,
} from "@/components/planning/cells";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDayFr } from "@/lib/format";
import type { FaqCategory, FaqComment, FaqEntry } from "@/lib/moderation/types";
import type { PlanningOwner } from "@/lib/planning/types";
import { cn } from "@/lib/utils";

/**
 * La FAQ du client, en tableur.
 *
 * Elle vivait dans la section Planning, sous forme de board `kind = 'faq'`,
 * et chaque ligne s'ouvrait dans un panneau latéral. Le retour d'écran du
 * 11/09 a tranché l'inverse : c'est une page du menu de l'espace, et **tout
 * s'édite dans la cellule** — un panneau pour changer un mot dans une réponse
 * est un aller-retour de trop quand on en relit soixante-dix.
 *
 * Les données restent celles de la Modération (`faq_entries`) : chaque
 * correction validée dans l'inbox enrichit ce tableau toute seule.
 */

/* Neuf colonnes : les sept du board Monday, plus le fil de discussion et la
   suppression. La dernière reste posée pour le client — une colonne qui
   apparaît et disparaît décalerait tout le tableau d'un rôle à l'autre. */
const GRID =
  "grid grid-cols-[minmax(180px,1.3fr)_132px_minmax(180px,1.3fr)_minmax(200px,1.5fr)_minmax(160px,1.1fr)_108px_124px_44px_40px] items-stretch";

type SortKey = "title" | "theme" | "updated";

const REVIEW_TONES: Record<"approved" | "rejected" | "pending", StatusTone> = {
  approved: "positive",
  rejected: "danger",
  pending: "warning",
};

const REVIEW_LABELS: Record<"approved" | "rejected" | "pending", string> = {
  approved: "Validé",
  rejected: "Refusé",
  pending: "À valider",
};

export function FaqTable({
  clientId,
  entries,
  categories,
  comments,
  members,
  isOwner,
  openEntryId,
}: {
  clientId: string;
  entries: FaqEntry[];
  categories: FaqCategory[];
  comments: FaqComment[];
  members: PlanningOwner[];
  isOwner: boolean;
  /** `?entree=` : le lien d'un fil de modération ou d'un e-mail ouvre son fil. */
  openEntryId: string | null;
}) {
  const { run, pending } = useCellAction();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "theme",
    desc: false,
  });
  const [openThread, setOpenThread] = useState<string | null>(openEntryId);
  const [themesOpen, setThemesOpen] = useState(false);
  const [toDelete, setToDelete] = useState<FaqEntry | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘F ramène au tableau : la recherche du navigateur ne connaît pas les
  // réponses tronquées à la ligne.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "f") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const threadsByEntry = useMemo(() => {
    const map = new Map<string, FaqComment[]>();
    for (const comment of comments) {
      map.set(comment.entry_id, [...(map.get(comment.entry_id) ?? []), comment]);
    }
    return map;
  }, [comments]);

  const themeOptions: ChipOption<string>[] = useMemo(
    () =>
      categories.map((category) => ({
        value: category.id,
        label: category.name,
        color: themeColor(category),
      })),
    [categories],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = needle
      ? entries.filter((entry) =>
          [
            entry.title ?? "",
            entry.question_canonical,
            entry.answer_fr ?? "",
            entry.answer_tiktok ?? "",
            categoryById.get(entry.category_id ?? "")?.name ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(needle),
        )
      : [...entries];

    const factor = sort.desc ? -1 : 1;
    const nameOf = (entry: FaqEntry) => entry.title || entry.question_canonical;

    return rows.sort((a, b) => {
      if (sort.key === "updated") {
        return (a.updated_at < b.updated_at ? -1 : 1) * factor;
      }
      if (sort.key === "theme") {
        // « ￿ » range les sans-thème en fin de liste, quel que soit le sens.
        const left = categoryById.get(a.category_id ?? "")?.name ?? "￿";
        const right = categoryById.get(b.category_id ?? "")?.name ?? "￿";
        const byTheme = left.localeCompare(right, "fr") * factor;
        return byTheme !== 0 ? byTheme : nameOf(a).localeCompare(nameOf(b), "fr");
      }
      return nameOf(a).localeCompare(nameOf(b), "fr") * factor;
    });
  }, [entries, query, sort, categoryById]);

  const header = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() =>
        setSort((current) =>
          current.key === key ? { key, desc: !current.desc } : { key, desc: false },
        )
      }
      className={cn(
        // `uppercase` répété : un bouton est un contrôle de formulaire et
        // n'hérite pas du `text-transform` de la rangée.
        "hover:text-foreground focus-visible:ring-brand flex items-center gap-0.5 rounded px-1.5 py-1 text-left uppercase transition-colors focus-visible:ring-2 focus-visible:outline-none",
        sort.key === key && "text-foreground",
      )}
    >
      {label}
      {sort.key === key ? (
        sort.desc ? (
          <ArrowDown className="size-3" aria-hidden />
        ) : (
          <ArrowUp className="size-3" aria-hidden />
        )
      ) : null}
    </button>
  );

  return (
    <div className="min-w-0 flex-1 space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            aria-hidden
          />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher (⌘F)"
            aria-label="Rechercher dans la FAQ"
            className="border-border focus-visible:ring-brand h-8 w-full rounded-md border bg-transparent pr-2 pl-8 text-sm outline-none focus-visible:ring-2"
          />
        </div>
        <span className="type-caption text-text-secondary">
          {filtered.length}/{entries.length}
        </span>
      </div>

      <div className="border-border-strong overflow-x-auto rounded-md border">
        <div className="min-w-[1160px]">
          <div
            className={cn(
              "border-border-strong bg-card/60 text-muted-foreground border-b px-2 py-1 text-[10px] font-medium tracking-wide uppercase",
              GRID,
              "items-center",
            )}
          >
            {header("title", "Sujet")}
            <span className="px-1.5 text-center">Thème</span>
            <span className="px-1.5">Question</span>
            <span className="px-1.5">Réponse</span>
            <span className="px-1.5">Réponse TikTok</span>
            <span className="px-1.5 text-center">Client</span>
            {header("updated", "Mise à jour")}
            {/* Deux colonnes d'actions : l'intitulé vit sur le bouton de
                chaque ligne, où le lecteur d'écran le trouve. */}
            <span />
            <span />
          </div>

          {filtered.length === 0 ? (
            <p className="text-muted-foreground px-3 py-10 text-center text-sm">
              {entries.length === 0
                ? "Aucun élément de langage."
                : "Rien ne correspond à la recherche."}
            </p>
          ) : (
            filtered.map((entry) => {
              const thread = threadsByEntry.get(entry.id) ?? [];
              const category = categoryById.get(entry.category_id ?? "") ?? null;
              const open = openThread === entry.id;

              return (
                <div key={entry.id} className="border-border-strong border-b">
                  <div
                    className={cn(
                      "hover:bg-muted/40 min-h-9 px-2 text-sm transition-colors",
                      GRID,
                      !entry.active && "opacity-55",
                    )}
                  >
                    {isOwner ? (
                      <TextCell
                        value={entry.title ?? ""}
                        ariaLabel="Sujet"
                        placeholder="Nouveau sujet…"
                        className="self-center font-medium"
                        onCommit={(next) =>
                          run(() =>
                            updateFaqEntryField({
                              clientId,
                              entryId: entry.id,
                              field: "title",
                              value: next,
                            }),
                          )
                        }
                      />
                    ) : (
                      <span className="self-center truncate px-1.5 font-medium">
                        {entry.title || entry.question_canonical}
                      </span>
                    )}

                    {isOwner ? (
                      <ChipSelect
                        value={entry.category_id}
                        options={themeOptions}
                        allowClear
                        fill
                        ariaLabel={`Thème de ${entry.title || entry.question_canonical}`}
                        onEditLabels={() => setThemesOpen(true)}
                        onSelect={(next) =>
                          run(() =>
                            setFaqEntryCategory({
                              clientId,
                              entryId: entry.id,
                              categoryId: next,
                            }),
                          )
                        }
                      />
                    ) : (
                      <span className="flex min-w-0 items-center justify-center px-1.5">
                        {category ? (
                          <ThemeChip
                            name={category.name}
                            color={themeColor(category)}
                          />
                        ) : (
                          <span className="text-text-tertiary text-xs">—</span>
                        )}
                      </span>
                    )}

                    {isOwner ? (
                      <TextCell
                        value={entry.question_canonical}
                        ariaLabel="Question"
                        placeholder="La question posée…"
                        className="text-text-secondary self-center"
                        onCommit={(next) =>
                          run(() =>
                            updateFaqEntryField({
                              clientId,
                              entryId: entry.id,
                              field: "question",
                              value: next,
                            }),
                          )
                        }
                      />
                    ) : (
                      <span className="text-text-secondary self-center truncate px-1.5">
                        {entry.question_canonical || "—"}
                      </span>
                    )}

                    <span className="flex min-w-0 items-center">
                      <WordingCell
                        value={entry.answer_fr}
                        subjectName={entry.title || entry.question_canonical}
                        fieldName="Réponse"
                        placeholder="La réponse de référence."
                        readOnly={!isOwner}
                        onCommit={(next) =>
                          run(() =>
                            updateFaqEntryField({
                              clientId,
                              entryId: entry.id,
                              field: "answerFr",
                              value: next ?? "",
                            }),
                          )
                        }
                      />
                    </span>

                    <span className="flex min-w-0 items-center">
                      <WordingCell
                        value={entry.answer_tiktok}
                        subjectName={entry.title || entry.question_canonical}
                        fieldName="Réponse TikTok"
                        placeholder="La version courte, si elle diffère."
                        readOnly={!isOwner}
                        onCommit={(next) =>
                          run(() =>
                            updateFaqEntryField({
                              clientId,
                              entryId: entry.id,
                              field: "answerTiktok",
                              value: next ?? "",
                            }),
                          )
                        }
                      />
                    </span>

                    <span className="flex items-center justify-center px-1.5">
                      <ReviewCell
                        review={entry.client_review}
                        onVerdict={(verdict) =>
                          run(() => setFaqClientReview({ entryId: entry.id, verdict }))
                        }
                      />
                    </span>

                    <span className="flex items-center px-1.5">
                      <LastUpdateCell
                        updater={null}
                        label={formatDayFr(entry.updated_at.slice(0, 10))}
                      />
                    </span>

                    <span className="flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => setOpenThread(open ? null : entry.id)}
                        aria-expanded={open}
                        aria-label={`Fil de ${entry.title || entry.question_canonical}`}
                        className={cn(
                          "hover:bg-muted focus-visible:ring-brand relative flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-2",
                          open ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        <MessageSquare className="size-4" strokeWidth={1.75} aria-hidden />
                        {thread.length > 0 ? (
                          // `bg-primary` et non `--accent-ink` : l'encre
                          // d'accent s'inverse en sombre et le blanc posé
                          // dessus tombe à 1,39:1.
                          <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full text-[9px] font-bold tabular-nums">
                            {thread.length > 9 ? "9+" : thread.length}
                          </span>
                        ) : null}
                      </button>
                    </span>

                    <span className="flex items-center justify-center">
                      {isOwner ? (
                        <button
                          type="button"
                          onClick={() => setToDelete(entry)}
                          aria-label={`Supprimer ${entry.title || entry.question_canonical}`}
                          className="text-muted-foreground hover:text-danger-ink focus-visible:ring-brand flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-2"
                        >
                          <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden />
                        </button>
                      ) : null}
                    </span>
                  </div>

                  {open ? (
                    <div className="bg-muted/20 border-border-strong border-t px-4 py-3">
                      <FaqCommentThread
                        entryId={entry.id}
                        comments={thread}
                        members={members}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })
          )}

          {isOwner ? (
            // En bas du tableau, comme sur Monday : on ajoute une ligne à la
            // suite de celles qu'on vient de lire, pas au-dessus.
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => createFaqEntry({ clientId }))}
              className="text-muted-foreground hover:text-foreground hover:bg-muted/40 focus-visible:ring-brand flex w-full items-center gap-1.5 px-3 py-2 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <Plus className="size-3.5" aria-hidden />
              Ajouter un élément
            </button>
          ) : null}
        </div>
      </div>

      <ThemeLabelsDialog
        clientId={clientId}
        categories={categories}
        open={themesOpen}
        onOpenChange={setThemesOpen}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(next) => {
          if (!next) setToDelete(null);
        }}
        title={`Supprimer ${toDelete?.title || toDelete?.question_canonical || "cet élément"}`}
        description="L'élément quitte la FAQ et la modération cesse de s'en servir. Son historique d'apprentissage, lui, reste en base."
        confirmLabel="Supprimer l'élément"
        onConfirm={async () => {
          const entry = toDelete;
          setToDelete(null);
          if (entry) {
            await run(() => deleteFaqEntry({ clientId, entryId: entry.id }));
          }
        }}
      />
    </div>
  );
}

/**
 * La colonne Client : le verdict du client sur l'élément de langage.
 *
 * C'est devenu la seule validation — « Demander la validation » côté agence a
 * disparu, il ajoutait une étape pour dire ce que l'écran montre déjà. Sans
 * verdict, la pastille dit « À valider » : c'est l'état de départ de tout
 * élément, pas une absence d'information.
 */
function ReviewCell({
  review,
  onVerdict,
}: {
  review: FaqEntry["client_review"];
  onVerdict: (verdict: "approved" | "rejected") => void;
}) {
  const key = review ?? "pending";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Validation du client"
        className="focus-visible:ring-brand rounded-pill outline-none focus-visible:ring-2"
      >
        <StatusPill tone={REVIEW_TONES[key]}>{REVIEW_LABELS[key]}</StatusPill>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 min-w-40">
        <DropdownMenuItem onClick={() => onVerdict("approved")}>Valider</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onVerdict("rejected")}>Refuser</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
