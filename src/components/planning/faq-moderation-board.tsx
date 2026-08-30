"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

import {
  deleteFaqEntry,
  saveFaqEntry,
  setFaqClientReview,
  submitFaqForReview,
} from "@/app/actions/moderation";
import { BoardTabs } from "@/components/planning/planning-board";
import { StatusPill } from "@/components/ds/status-pill";
import { formatDayFr } from "@/lib/format";
import type { FaqEntry } from "@/lib/moderation/types";
import type { PlanningBoard } from "@/lib/planning/types";
import { cn } from "@/lib/utils";

/**
 * La FAQ du client, dans le Planning — le miroir du board Monday
 * « FAQ MODÉRATION », au même endroit que l'original : l'onglet FAQ à côté du
 * planning éditorial. La page à part a été essayée et refusée — la FAQ est un
 * tableau de la section Planning, pas un module de plus dans le rail.
 *
 * La ligne est volontairement compacte, comme sur Monday : titre, thème en
 * étiquette colorée, question et réponses tronquées à la ligne. Tout le
 * contenu se lit et s'édite dans le panneau qui s'ouvre au clic — afficher
 * les réponses entières faisait des lignes de douze hauteurs différentes,
 * illisibles en balayage.
 *
 * Les données sont celles de la Modération (`faq_entries`) : chaque correction
 * validée dans l'inbox enrichit ce tableau toute seule, et la bulle Client
 * porte le circuit de validation des éléments de langage.
 */

type Category = { id: string; name: string };

const GRID =
  "grid grid-cols-[minmax(190px,1.1fr)_120px_minmax(200px,1.4fr)_minmax(220px,1.6fr)_minmax(170px,1.2fr)_96px_92px] items-center gap-x-2";

/* La palette des étiquettes de thème — celle de Monday, que l'équipe lit
   depuis des années. L'encre est fixée par teinte, jamais calculée : chaque
   couple a été choisi lisible. L'attribution par empreinte du nom rend la
   couleur stable pour toujours, sans colonne en base. */
const THEME_TONES: { bg: string; ink: string }[] = [
  { bg: "#c4c4c4", ink: "#1A1A1A" },
  { bg: "#ffcb00", ink: "#1A1A1A" },
  { bg: "#fdab3d", ink: "#1A1A1A" },
  { bg: "#a25ddc", ink: "#FFFFFF" },
  { bg: "#579bfc", ink: "#FFFFFF" },
  { bg: "#00c875", ink: "#1A1A1A" },
  { bg: "#e2445c", ink: "#FFFFFF" },
  { bg: "#66ccff", ink: "#1A1A1A" },
  { bg: "#ff642e", ink: "#FFFFFF" },
  { bg: "#7f5347", ink: "#FFFFFF" },
];

function themeTone(name: string): { bg: string; ink: string } {
  const normalized = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  // « Général » garde le gris de Monday, quel que soit son rang de hachage.
  if (normalized === "general") return THEME_TONES[0]!;
  let hash = 0;
  for (const char of normalized) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return THEME_TONES[1 + (hash % (THEME_TONES.length - 1))]!;
}

function ThemeChip({ name }: { name: string }) {
  const tone = themeTone(name);
  return (
    <span
      className="inline-block max-w-full truncate rounded-sm px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase"
      style={{ backgroundColor: tone.bg, color: tone.ink }}
    >
      {name}
    </span>
  );
}

function ReviewBubble({ review }: { review: FaqEntry["client_review"] }) {
  if (!review) return <span className="text-text-tertiary px-1 text-xs">—</span>;
  const tone =
    review === "approved" ? "positive" : review === "rejected" ? "danger" : "warning";
  const label =
    review === "approved" ? "Validé" : review === "rejected" ? "Refusé" : "À valider";
  return <StatusPill tone={tone}>{label}</StatusPill>;
}

type SortKey = "title" | "theme" | "updated";

export function FaqModerationBoard({
  boards,
  board,
  workspaceSlug,
  clientId,
  entries,
  categories,
  isOwner,
  openEntryId,
}: {
  boards: PlanningBoard[];
  board: PlanningBoard;
  workspaceSlug: string;
  clientId: string;
  entries: FaqEntry[];
  categories: Category[];
  isOwner: boolean;
  /** `?entree=` : le lien depuis un fil de modération ouvre l'entrée. */
  openEntryId: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "theme",
    desc: false,
  });
  const [openId, setOpenId] = useState<string | "new" | null>(openEntryId);
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘F ramène au tableau, comme sur le planning : la recherche du navigateur
  // ne connaît pas les réponses repliées dans les panneaux.
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

  const categoryName = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
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
            categoryName.get(entry.category_id ?? "") ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(needle),
        )
      : [...entries];

    const factor = sort.desc ? -1 : 1;
    return rows.sort((a, b) => {
      if (sort.key === "updated") {
        return (a.updated_at < b.updated_at ? -1 : 1) * factor;
      }
      if (sort.key === "theme") {
        const left = categoryName.get(a.category_id ?? "") ?? "￿";
        const right = categoryName.get(b.category_id ?? "") ?? "￿";
        const byTheme = left.localeCompare(right, "fr") * factor;
        if (byTheme !== 0) return byTheme;
        return (a.title ?? a.question_canonical).localeCompare(
          b.title ?? b.question_canonical,
          "fr",
        );
      }
      return (
        (a.title ?? a.question_canonical).localeCompare(
          b.title ?? b.question_canonical,
          "fr",
        ) * factor
      );
    });
  }, [entries, query, sort, categoryName]);

  const openEntry =
    openId && openId !== "new"
      ? (entries.find((entry) => entry.id === openId) ?? null)
      : null;

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
        // n'hérite pas du text-transform de la rangée.
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
    <div className="min-w-0 flex-1 p-4 md:p-6">
      <BoardTabs boards={boards} current={board} workspaceSlug={workspaceSlug} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
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
            className="border-border focus-visible:ring-brand h-8 w-full rounded-md border bg-transparent pl-8 pr-2 text-sm outline-none focus-visible:ring-2"
          />
        </div>
        <span className="type-caption text-text-secondary">
          {filtered.length}/{entries.length}
        </span>
        {isOwner ? (
          <button
            type="button"
            onClick={() => setOpenId("new")}
            className="bg-primary text-primary-foreground focus-visible:ring-brand ml-auto inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
          >
            <Plus className="size-3.5" aria-hidden />
            Ajouter
          </button>
        ) : null}
      </div>

      <div className="border-border-strong overflow-x-auto rounded-md border">
        <div className="min-w-[1080px]">
          <div
            className={cn(
              "border-border-strong bg-card/60 text-muted-foreground border-b px-2 py-1 text-[10px] font-medium tracking-wide uppercase",
              GRID,
            )}
          >
            {header("title", "Élément")}
            {header("theme", "Thème")}
            <span className="px-1.5">Question</span>
            <span className="px-1.5">Réponse</span>
            <span className="px-1.5">Réponse TikTok</span>
            <span className="px-1.5">Client</span>
            {header("updated", "Mise à jour")}
          </div>

          {filtered.length === 0 ? (
            <p className="text-muted-foreground px-3 py-10 text-center text-sm">
              {entries.length === 0
                ? "Aucun élément de langage. La FAQ se remplit à la main, ou toute seule quand la Modération corrige une réponse."
                : "Rien ne correspond à la recherche."}
            </p>
          ) : (
            filtered.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setOpenId(entry.id)}
                className={cn(
                  "border-border-strong hover:bg-muted/40 focus-visible:ring-brand w-full border-b px-2 py-1.5 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  GRID,
                  !entry.active && "opacity-55",
                )}
              >
                <span className="truncate px-1.5 font-medium">
                  {entry.title || entry.question_canonical}
                </span>
                <span className="min-w-0 px-1.5">
                  {entry.category_id && categoryName.get(entry.category_id) ? (
                    <ThemeChip name={categoryName.get(entry.category_id)!} />
                  ) : (
                    <span className="text-text-tertiary text-xs">—</span>
                  )}
                </span>
                <span className="text-text-secondary truncate px-1.5">
                  {entry.question_canonical}
                </span>
                <span className="text-text-secondary truncate px-1.5">
                  {entry.answer_fr ?? "—"}
                </span>
                <span className="text-text-secondary truncate px-1.5">
                  {entry.answer_tiktok ?? "—"}
                </span>
                <span className="px-1.5">
                  <ReviewBubble review={entry.client_review} />
                </span>
                <span className="text-text-secondary px-1.5 text-xs tabular-nums">
                  {formatDayFr(entry.updated_at.slice(0, 10))}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {openId ? (
        <EntryPanel
          key={openId}
          clientId={clientId}
          entry={openEntry}
          categoryNameOf={(id) => (id ? (categoryName.get(id) ?? "") : "")}
          categories={categories}
          isOwner={isOwner}
          onClose={() => {
            setOpenId(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Le panneau d'une entrée — lecture complète et édition, comme le panneau
 * d'une publication du planning. `entry === null` crée une entrée neuve.
 */
function EntryPanel({
  clientId,
  entry,
  categories,
  categoryNameOf,
  isOwner,
  onClose,
}: {
  clientId: string;
  entry: FaqEntry | null;
  categories: Category[];
  categoryNameOf: (id: string | null) => string;
  isOwner: boolean;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(entry?.title ?? "");
  const [theme, setTheme] = useState(categoryNameOf(entry?.category_id ?? null));
  const [question, setQuestion] = useState(entry?.question_canonical ?? "");
  const [answerFr, setAnswerFr] = useState(entry?.answer_fr ?? "");
  const [answerTiktok, setAnswerTiktok] = useState(entry?.answer_tiktok ?? "");
  const [active, setActive] = useState(entry?.active ?? true);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const act = (work: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const result = await work();
      if (result.ok) {
        toast.success(result.message ?? "Enregistré.");
        onClose();
      } else {
        toast.error(result.error ?? "Échec.");
      }
    });

  const save = () =>
    act(() =>
      saveFaqEntry({
        clientId,
        entryId: entry?.id ?? null,
        title: title.trim(),
        categoryName: theme.trim(),
        question: question.trim(),
        answerFr: answerFr.trim(),
        answerTiktok: answerTiktok.trim(),
        active,
      }),
    );

  const field =
    "border-border focus-visible:ring-brand w-full rounded-md border bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 disabled:opacity-60";

  return (
    <div
      className="fixed inset-0 z-40 bg-black/20"
      onClick={onClose}
      role="presentation"
    >
      <aside
        className="bg-surface border-border absolute inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-y-auto border-l shadow-xl"
        onClick={(event) => event.stopPropagation()}
        aria-label={entry ? "Élément de langage" : "Nouvel élément de langage"}
      >
        <header className="border-border flex items-center gap-3 border-b px-5 py-3">
          <h2 className="type-h3 min-w-0 flex-1 truncate">
            {entry ? entry.title || entry.question_canonical : "Nouvel élément"}
          </h2>
          {entry ? <ReviewBubble review={entry.client_review} /> : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-text-secondary hover:text-text-primary focus-visible:ring-brand rounded p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <X className="size-4" strokeWidth={1.75} aria-hidden />
          </button>
        </header>

        <div className="flex-1 space-y-4 px-5 py-4">
          <label className="block space-y-1">
            <span className="type-overline text-text-secondary">Élément</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={!isOwner}
              placeholder="BON CADEAU REPORT"
              className={field}
            />
          </label>

          <label className="block space-y-1">
            <span className="type-overline text-text-secondary">Thème</span>
            <input
              value={theme}
              onChange={(event) => setTheme(event.target.value)}
              disabled={!isOwner}
              list="faq-themes"
              placeholder="Général"
              className={field}
            />
            <datalist id="faq-themes">
              {categories.map((category) => (
                <option key={category.id} value={category.name} />
              ))}
            </datalist>
          </label>

          <label className="block space-y-1">
            <span className="type-overline text-text-secondary">Question</span>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              disabled={!isOwner}
              rows={3}
              className={cn(field, "resize-y")}
            />
          </label>

          <label className="block space-y-1">
            <span className="type-overline text-text-secondary">Réponse</span>
            <textarea
              value={answerFr}
              onChange={(event) => setAnswerFr(event.target.value)}
              disabled={!isOwner}
              rows={6}
              className={cn(field, "resize-y")}
            />
          </label>

          <label className="block space-y-1">
            <span className="type-overline text-text-secondary">Réponse TikTok</span>
            <textarea
              value={answerTiktok}
              onChange={(event) => setAnswerTiktok(event.target.value)}
              disabled={!isOwner}
              rows={3}
              placeholder="La version courte, si elle diffère."
              className={cn(field, "resize-y")}
            />
          </label>

          {isOwner ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
                className="accent-accent-ink size-4"
              />
              Utilisée par la modération
            </label>
          ) : null}

          {entry ? (
            <p className="type-caption text-text-secondary">
              {entry.monday_item_id
                ? "Importée de Monday"
                : entry.correction_count > 0
                  ? "Née d'une correction de modération"
                  : "Saisie à la main"}
              {" · "}
              {entry.usage_count} usage{entry.usage_count > 1 ? "s" : ""}
              {entry.client_reviewed_at
                ? ` · verdict client le ${formatDayFr(entry.client_reviewed_at.slice(0, 10))}`
                : ""}
            </p>
          ) : null}
        </div>

        <footer className="border-border flex flex-wrap items-center gap-2 border-t px-5 py-3">
          {isOwner ? (
            <>
              <button
                type="button"
                onClick={save}
                disabled={pending || question.trim() === ""}
                className="bg-primary text-primary-foreground focus-visible:ring-brand inline-flex h-9 items-center rounded-md px-4 text-sm font-medium transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
              >
                {pending ? "Enregistrement…" : "Enregistrer"}
              </button>
              {entry && entry.client_review !== "pending" ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    act(() => submitFaqForReview({ clientId, entryIds: [entry.id] }))
                  }
                  className="border-border text-text-primary hover:bg-muted/60 focus-visible:ring-brand inline-flex h-9 items-center rounded-md border px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                >
                  Demander la validation
                </button>
              ) : null}
              {entry ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm("Supprimer cet élément de langage ?")) return;
                    act(() => deleteFaqEntry({ clientId, entryId: entry.id }));
                  }}
                  className="text-danger-ink hover:bg-danger/10 focus-visible:ring-brand ml-auto inline-flex h-9 items-center rounded-md px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                >
                  Supprimer
                </button>
              ) : null}
            </>
          ) : entry && entry.client_review === "pending" ? (
            <>
              <span className="type-caption text-text-secondary mr-auto">
                Cet élément de langage vous est soumis.
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  act(() =>
                    setFaqClientReview({ entryId: entry.id, verdict: "approved" }),
                  )
                }
                className="bg-accent-ink focus-visible:ring-brand inline-flex h-9 items-center rounded-md px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
              >
                Valider
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  act(() =>
                    setFaqClientReview({ entryId: entry.id, verdict: "rejected" }),
                  )
                }
                className="border-border text-danger-ink hover:bg-danger/10 focus-visible:ring-brand inline-flex h-9 items-center rounded-md border px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
              >
                Refuser
              </button>
            </>
          ) : null}
        </footer>
      </aside>
    </div>
  );
}
