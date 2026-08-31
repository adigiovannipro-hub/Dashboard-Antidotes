"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Archive,
  CalendarDays,
  Plug,
  Plus,
  Search,
  Table2,
  Trash2,
  X,
} from "lucide-react";

import {
  addYearBoard,
  bulkMoveSubjects,
  createMonth,
  deleteBoard,
} from "@/app/actions/planning";
import {
  ArchiveDialog,
  DeleteBoardDialog,
  MoveDialog,
} from "@/components/planning/board-dialogs";
import { BulkBar } from "@/components/planning/bulk-bar";
import { ConnexionsDialog } from "@/components/planning/connexions-dialog";
import { FeedPreview } from "@/components/planning/feed-preview";
import { panelZIndex } from "@/components/planning/panel-layers";
import { useCellAction } from "@/components/planning/cells";
import {
  PillIndicator,
  useOptimisticPill,
  usePillIndicator,
} from "@/components/ds/pill-indicator";
import { LinkPending } from "@/components/ds/route-progress";
import { CalendarView } from "@/components/planning/calendar-view";
import { LabelsDialog } from "@/components/planning/column-menus";
import { MonthGroup } from "@/components/planning/month-group";
import { SubjectDrawer } from "@/components/planning/subject-drawer";
import type { Scope } from "@/components/planning/subject-row";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ColumnDef } from "@/lib/planning/columns";
import { applyWidths } from "@/lib/planning/columns";
import { monthGroupLabel } from "@/lib/planning/monday-mapping";
import { countSubjects, filterMonths } from "@/lib/planning/search";
import type {
  InstagramProfile,
  SocialAccountRow,
  SocialSelection,
} from "@/lib/social/types";
import {
  PREFERENCE_MAX_AGE,
  planningViewCookie,
  serializePlanningView,
  type PlanningSort,
  type PlanningView,
  type SortableColumnKey,
} from "@/lib/ui-preferences";
import type {
  MonthWithLanes,
  PlanningActivity,
  PlanningBoard,
  PlanningMonth,
  PlanningOwner,
  SubjectRow,
} from "@/lib/planning/types";
import { cn } from "@/lib/utils";

/**
 * Le tableau d'une année.
 *
 * Les états d'écran vivent ici et nulle part ailleurs : la sélection multiple
 * (la barre du bas), le tri de la colonne Date, la recherche — ⌘F est
 * intercepté, on cherche des publications, pas du texte de page — et la
 * publication ouverte. Celle-ci est **locale d'abord** : le panneau s'ouvre et
 * se ferme sans attendre le serveur, l'URL suit pour qu'un lien partagé
 * rouvre le même panneau, et le journal d'activité arrive quand il arrive.
 */
export function PlanningBoardView({
  scope,
  boards,
  board,
  months,
  columns,
  owners,
  drawer,
  archived,
  trash,
  currentMonthKey,
  workspaceSlug,
  workspaceName,
  instagramProfile,
  isOwner,
  socialAccounts,
  socialSelection,
  socialNetworks,
  metaConfigured,
  view,
}: {
  scope: Scope;
  boards: PlanningBoard[];
  board: PlanningBoard;
  months: MonthWithLanes[];
  columns: ColumnDef[];
  owners: PlanningOwner[];
  /** La publication ouverte et son journal, résolus côté serveur. */
  drawer: { subject: SubjectRow; activity: PlanningActivity[] } | null;
  archived: SubjectRow[];
  trash: { subjects: SubjectRow[]; months: PlanningMonth[] };
  currentMonthKey: string;
  workspaceSlug: string;
  /** Le nom du client — c'est lui qui s'affiche en tête du feed, pas le nom
      du tableau : la grille montre le profil de la marque. */
  workspaceName: string;
  /** La vitrine du compte Instagram branché, pour l'en-tête du feed. */
  instagramProfile: InstagramProfile | null;
  /** Affecter un compte engage une publication : réservé à l'agence. */
  isOwner: boolean;
  /** L'inventaire de l'agence. Vide pour un client : il porte le nom des
      comptes des autres. */
  socialAccounts: SocialAccountRow[];
  /** Le compte retenu par cet espace, réseau par réseau. */
  socialSelection: SocialSelection;
  /** Les réseaux déclarés aux livrables : ils font les lignes des connexions. */
  socialNetworks: string[];
  /** `META_APP_ID` renseignée : sans elle, le dialogue explique quoi faire. */
  metaConfigured: boolean;
  /** L'état de lecture relu du cookie : tri, mois ouverts, réseaux repliés. */
  view: PlanningView;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { run, pending } = useCellAction();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  /**
   * L'état de lecture du tableau, mémorisé dans un cookie : on revient sur le
   * planning tel qu'on l'a laissé. Chaque changement réécrit le cookie — pas
   * de bouton « enregistrer la vue », c'est une préférence, pas une donnée.
   */
  const [savedView, setSavedView] = useState<PlanningView>(view);
  const remember = useCallback(
    (patch: Partial<PlanningView>) => {
      setSavedView((current) => {
        const next = { ...current, ...patch };
        document.cookie = `${planningViewCookie(scope.workspace, scope.board)}=${serializePlanningView(
          next,
        )}; path=/; max-age=${PREFERENCE_MAX_AGE}; samesite=lax`;
        return next;
      });
    },
    [scope.workspace, scope.board],
  );

  const sort = savedView.sort;
  const setSort = useCallback(
    (next: PlanningSort) => remember({ sort: next }),
    [remember],
  );
  // Le cycle d'un clic sur la flèche d'un en-tête : croissant, décroissant,
  // retour à l'ordre manuel. Changer de colonne repart en croissant.
  const toggleSort = useCallback(
    (column: SortableColumnKey) => {
      if (sort === "position" || sort.column !== column) {
        setSort({ column, direction: "asc" });
      } else if (sort.direction === "asc") {
        setSort({ column, direction: "desc" });
      } else {
        setSort("position");
      }
    },
    [sort, setSort],
  );
  // Largeurs en cours de drag : le tableau suit le pointeur sans attendre la
  // base, qui reçoit la valeur finale au relâchement.
  const [widthPreview, setWidthPreview] = useState<Record<string, number>>({});
  const effectiveColumns = applyWidths(columns, widthPreview);

  // Les boîtes du tableau : étiquettes d'une colonne, déplacement, archives,
  // corbeille.
  const [editingColumn, setEditingColumn] = useState<ColumnDef | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [feedMonth, setFeedMonth] = useState<string | null>(null);

  /**
   * Le retour du branchement Meta est un **événement d'arrivée** : il se lit
   * une fois, au montage. L'URL est nettoyée juste après — recharger ne doit
   * pas rejouer le message — et ce nettoyage ne doit pas refermer la boîte
   * qu'il vient d'ouvrir, d'où la lecture à l'état initial plutôt qu'un effet.
   */
  const [connexionReturn] = useState(() => {
    const done = searchParams.get("connecte");
    if (done) return { ok: true, message: done };
    const failed = searchParams.get("erreur");
    if (failed) return { ok: false, message: failed };
    return null;
  });
  const [connexionsOpen, setConnexionsOpen] = useState(connexionReturn !== null);

  /**
   * L'ordre d'empilement des deux panneaux.
   *
   * Le dernier demandé passe devant — feed ouvert depuis un mois, puis une
   * publication ouverte depuis une case, puis le feed rappelé au premier plan.
   * Deux niveaux figés ne sauraient pas rendre ce va-et-vient.
   */
  const [layers, setLayers] = useState({ feed: 1, subject: 2 });
  const raise = useCallback((panel: "feed" | "subject") => {
    setLayers((current) => {
      const top = Math.max(current.feed, current.subject);
      if (current[panel] === top) return current;
      return { ...current, [panel]: top + 1 };
    });
  }, []);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  /**
   * Le panneau, sans aller-retour : `panel` prime sur l'URL. Ouvrir pose
   * l'état local puis pousse l'URL ; fermer joue la glissade de sortie puis
   * nettoie. `undefined` : suivre le serveur (arrivée par lien partagé).
   */
  const [panel, setPanel] = useState<
    { id: string | null; focus: boolean } | undefined
  >(undefined);
  const [panelClosing, setPanelClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Le verdict du branchement s'annonce en toast, puis disparaît de l'URL.
  useEffect(() => {
    if (!connexionReturn) return;
    if (connexionReturn.ok) toast.success(connexionReturn.message);
    else toast.error(connexionReturn.message);

    const next = new URLSearchParams(window.location.search);
    next.delete("connecte");
    next.delete("erreur");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [connexionReturn, pathname, router]);

  // ⌘F / Ctrl+F saute dans le champ de recherche : sur un planning, chercher
  // veut dire chercher un sujet ou un wording — pas le « rechercher dans la
  // page » du navigateur.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const openSubject = useCallback(
    (subjectId: string, focusRetours?: boolean) => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      setPanelClosing(false);
      setPanel({ id: subjectId, focus: !!focusRetours });
      raise("subject");
      const next = new URLSearchParams(searchParams.toString());
      next.set("sujet", subjectId);
      if (focusRetours) next.set("focus", "retour");
      else next.delete("focus");
      router.push(`${pathname}?${next}`, { scroll: false });
    },
    [pathname, router, searchParams, raise],
  );

  const closeDrawer = useCallback(() => {
    // La glissade d'abord, le démontage ensuite — et l'URL en dernier, pour
    // que la fermeture ne dépende pas du serveur.
    setPanelClosing(true);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setPanel({ id: null, focus: false });
      setPanelClosing(false);
      const next = new URLSearchParams(searchParams.toString());
      next.delete("sujet");
      next.delete("focus");
      router.push(`${pathname}?${next}`, { scroll: false });
    }, 180);
  }, [pathname, router, searchParams]);

  const toggleSelect = useCallback((subjectId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
  }, []);

  const toggleLane = useCallback((subjectIds: string[], selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of subjectIds) {
        if (selected) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const present = new Set(months.map((month) => month.month));
  const year = board.year ?? new Date().getUTCFullYear();
  const missing = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}-01`;
    return present.has(month) ? null : month;
  }).filter((month): month is string => month !== null);

  const searching = search.trim().length > 0;
  const visibleMonths = filterMonths(months, search);
  const resultCount = searching ? countSubjects(visibleMonths) : 0;

  // La publication ouverte : l'état local prime, l'URL sert d'arrivée.
  const activeId = panel !== undefined ? panel.id : (drawer?.subject.id ?? null);
  const activeFocus =
    panel !== undefined ? panel.focus : searchParams.get("focus") === "retour";
  const activeSubject = activeId
    ? (months
        .flatMap((month) => month.lanes.flatMap((lane) => lane.subjects))
        .find((subject) => subject.id === activeId) ??
      (drawer?.subject.id === activeId ? drawer.subject : null))
    : null;
  // Le journal n'existe que côté serveur : tant que l'URL n'a pas rattrapé le
  // clic, l'onglet Activités affiche son chargement.
  const activeActivity =
    activeId && drawer?.subject.id === activeId ? drawer.activity : null;

  // Échap ferme le panneau — sauf quand la visionneuse plein écran est
  // ouverte : elle se ferme elle-même, en premier.
  useEffect(() => {
    if (!activeSubject) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector("[data-lightbox]")) return;
      closeDrawer();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeSubject, closeDrawer]);

  // Le cadre de l'application fournit déjà la marge de page : en ajouter une
  // ici décalait le planning de tous les autres écrans.
  return (
    <div className="min-w-0 flex-1 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BoardTabs boards={boards} current={board} workspaceSlug={workspaceSlug} />

        {/* La recherche : sujets et wordings, accents et casse pliés. Puis
            les archives et la corbeille du tableau. */}
        <div className="flex items-center gap-2">
          {searching ? (
            <span className="text-muted-foreground text-xs tabular-nums">
              {resultCount} résultat{resultCount > 1 ? "s" : ""}
            </span>
          ) : null}
          <div className="relative">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
              aria-hidden
            />
            {/* `text` et non `search` : Chrome ajouterait sa propre croix à
                côté de la nôtre. */}
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSearch("");
                  event.currentTarget.blur();
                }
              }}
              aria-label="Rechercher dans le planning"
              placeholder="Rechercher (⌘F)"
              className="border-border bg-background focus-visible:ring-brand h-9 w-56 rounded-md border pr-7 pl-8 text-sm focus-visible:ring-2 focus-visible:outline-none"
            />
            {searching ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Effacer la recherche"
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </div>

          {/* Tableau ou calendrier : le choix se mémorise avec le reste de la
              vue. La FAQ n'a pas de calendrier. */}
          {board.kind === "editorial" ? (
            <button
              type="button"
              onClick={() =>
                remember({
                  mode: savedView.mode === "calendrier" ? "tableau" : "calendrier",
                })
              }
              aria-pressed={savedView.mode === "calendrier"}
              className="border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:ring-brand inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              {savedView.mode === "calendrier" ? (
                <>
                  <Table2 className="size-4" strokeWidth={1.75} aria-hidden />
                  Tableau
                </>
              ) : (
                <>
                  <CalendarDays className="size-4" strokeWidth={1.75} aria-hidden />
                  Calendrier
                </>
              )}
            </button>
          ) : null}

          {/* Le branchement des comptes du client : c'est d'ici qu'on y va,
              puisque c'est ici qu'on en a besoin. Réservé à l'agence — la
              boîte montre l'inventaire, qui nomme les comptes des autres
              clients. */}
          {isOwner ? (
            <button
              type="button"
              onClick={() => setConnexionsOpen(true)}
              title="Choisir les comptes sur lesquels ce client publie"
              className="border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:ring-brand inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <Plug className="size-4" strokeWidth={1.75} aria-hidden />
              Connexions
            </button>
          ) : null}

          <HeaderIconButton
            label={`Archives et corbeille (${archived.length + trash.subjects.length + trash.months.length})`}
            count={archived.length + trash.subjects.length + trash.months.length}
            onClick={() => setArchiveOpen(true)}
          >
            <Archive className="size-4" strokeWidth={1.75} aria-hidden />
          </HeaderIconButton>
          {/* La corbeille d'en-tête a changé de métier : elle supprime
              l'année entière. Owner seulement — la RLS le dit aussi — et
              jamais sur la FAQ, qui n'est pas un millésime. */}
          {isOwner && board.kind === "editorial" ? (
            <HeaderIconButton
              label={`Supprimer l'année ${board.year ?? board.name} et le tableau complet`}
              count={0}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
            </HeaderIconButton>
          ) : null}
        </div>
      </div>

      {months.length === 0 ? (
        <p className="type-body rounded-lg border border-dashed border-border p-10 text-center text-text-secondary">
          Ce tableau est vide. Ajoutez un mois pour commencer.
        </p>
      ) : savedView.mode === "calendrier" &&
        board.kind === "editorial" &&
        !searching ? (
        // Une recherche bascule sur la pile des mois : un résultat doit se
        // montrer ligne à ligne, pas se deviner dans une case de calendrier.
        <CalendarView
          months={months}
          initialMonthKey={currentMonthKey}
          onOpenSubject={openSubject}
        />
      ) : searching && visibleMonths.length === 0 ? (
        <p className="type-body rounded-lg border border-dashed border-border p-10 text-center text-text-secondary">
          Rien ne correspond à « {search.trim()} » — ni dans les sujets, ni dans
          les wordings.
        </p>
      ) : (
        // Douze mois espacés de 20 px se lisaient comme douze cartes
        // flottantes, chacune du même poids — dont onze vides. Serrés, ils
        // forment une pile qu'on parcourt, et le mois ouvert s'en détache.
        <div className="space-y-1.5">
          {visibleMonths.map((month) => (
            <MonthGroup
              key={month.id}
              scope={scope}
              month={month}
              isOwner={isOwner}
              workspaceId={board.workspace_id}
              columns={effectiveColumns}
              owners={owners}
              sort={sort}
              onSort={toggleSort}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleLane={toggleLane}
              onOpenSubject={openSubject}
              onEditLabels={setEditingColumn}
              onPreviewFeed={() => {
                setFeedMonth(month.month);
                raise("feed");
              }}
              onResizePreview={(columnId, width) =>
                setWidthPreview((current) =>
                  width === null
                    ? Object.fromEntries(
                        Object.entries(current).filter(([id]) => id !== columnId),
                      )
                    : { ...current, [columnId]: width },
                )
              }
              // Le mois en cours est ouvert, les autres repliés : c'est celui
              // qu'on vient regarder neuf fois sur dix — jusqu'à ce qu'on en
              // ouvre d'autres, et le cookie s'en souvient. Une recherche
              // déplie tout : un résultat caché n'existe pas.
              defaultOpen={
                savedView.months === null
                  ? month.month === currentMonthKey
                  : savedView.months.includes(month.month.slice(0, 7))
              }
              onOpenChange={(open) =>
                remember({
                  months: monthKeysAfter(
                    savedView,
                    months,
                    currentMonthKey,
                    month.month,
                    open,
                  ),
                })
              }
              closedLanes={savedView.closedLanes}
              onLaneOpenChange={(laneId, open) =>
                remember({
                  closedLanes: open
                    ? savedView.closedLanes.filter((id) => id !== laneId)
                    : [...new Set([...savedView.closedLanes, laneId])],
                })
              }
              forceOpen={searching}
            />
          ))}
        </div>
      )}

      {missing.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={pending}
            className="type-caption focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-text-secondary transition-colors hover:bg-muted/40 hover:text-text-primary focus-visible:ring-2 focus-visible:outline-none"
          >
            <Plus className="size-3.5" aria-hidden />
            Ajouter un mois
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-44 min-w-44">
            {missing.map((month) => (
              <DropdownMenuItem
                key={month}
                onClick={() =>
                  run(() => createMonth(scope, { boardId: board.id, month }))
                }
              >
                {monthGroupLabel(month)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <BulkBar
        scope={scope}
        selectedIds={selectedIds}
        columns={effectiveColumns}
        owners={owners}
        onClear={() => setSelectedIds(new Set())}
        onRequestMove={() => setMoveOpen(true)}
      />

      {activeSubject ? (
        <SubjectDrawer
          // La clé porte aussi le focus : re-cliquer l'icône de retours d'un
          // panneau déjà ouvert remonte le curseur dans le champ.
          key={`${activeSubject.id}${activeFocus ? "-retours" : ""}`}
          scope={scope}
          subject={activeSubject}
          columns={effectiveColumns}
          owners={owners}
          activity={activeActivity}
          autoFocusComment={activeFocus}
          closing={panelClosing}
          zIndex={panelZIndex(layers.subject)}
          onClose={closeDrawer}
        />
      ) : null}

      {/* --- Les boîtes du tableau --- */}
      {editingColumn ? (
        <LabelsDialog
          scope={scope}
          column={editingColumn}
          open
          onOpenChange={(next) => {
            if (!next) setEditingColumn(null);
          }}
        />
      ) : null}

      {feedMonth ? (
        <FeedPreview
          months={months}
          monthKey={feedMonth}
          profile={instagramProfile}
          workspaceName={workspaceName}
          zIndex={panelZIndex(layers.feed)}
          onOpenSubject={openSubject}
          onClose={() => setFeedMonth(null)}
        />
      ) : null}

      <ConnexionsDialog
        workspaceSlug={workspaceSlug}
        workspaceName={workspaceName}
        accounts={socialAccounts}
        selection={socialSelection}
        networks={socialNetworks}
        metaConfigured={metaConfigured}
        open={connexionsOpen && isOwner}
        onOpenChange={setConnexionsOpen}
      />

      <MoveDialog
        months={months}
        open={moveOpen}
        onOpenChange={setMoveOpen}
        onPick={(laneId) => {
          setMoveOpen(false);
          run(() =>
            bulkMoveSubjects(scope, { subjectIds: [...selectedIds], laneId }),
          );
        }}
      />

      <ArchiveDialog
        scope={scope}
        archived={archived}
        trashSubjects={trash.subjects}
        trashMonths={trash.months}
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
      />

      <DeleteBoardDialog
        scope={scope}
        boardName={board.year ? String(board.year) : board.name}
        monthCount={months.length}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDelete={async () => {
          const result = await deleteBoard(scope);
          if (result.ok) {
            toast.success("Tableau supprimé.");
            // Navigation dure : la porte du planning résout le tableau par
            // défaut restant, et l'état local de celui qui vient de mourir
            // n'a plus rien à dire.
            window.location.href = `/espace/${workspaceSlug}/planning`;
          } else {
            toast.error(result.error);
          }
        }}
      />
    </div>
  );
}

/**
 * La liste des mois ouverts après un pli ou un dépli.
 *
 * Au premier geste, le cookie ne dit encore rien : on part de la photo du
 * défaut — le mois en cours — sans quoi replier ce mois-là n'écrirait rien et
 * il rouvrirait au rechargement.
 */
function monthKeysAfter(
  view: PlanningView,
  months: MonthWithLanes[],
  currentMonthKey: string,
  month: string,
  open: boolean,
): string[] {
  const key = (value: string) => value.slice(0, 7);
  const base =
    view.months ??
    months
      .filter((candidate) => candidate.month === currentMonthKey)
      .map((candidate) => key(candidate.month));

  return open
    ? [...new Set([...base, key(month)])]
    : base.filter((candidate) => candidate !== key(month));
}

/** Un bouton d'en-tête avec sa pastille de compte — archives, corbeille. */
function HeaderIconButton({
  label,
  count,
  onClick,
  children,
}: {
  label: string;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:ring-brand relative flex size-9 items-center justify-center rounded-md border transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      {children}
      {count > 0 ? (
        <span className="bg-accent-ink absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[9px] font-bold text-white tabular-nums">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </button>
  );
}

export function BoardTabs({
  boards,
  current,
  workspaceSlug,
}: {
  boards: PlanningBoard[];
  current: PlanningBoard;
  workspaceSlug: string;
}) {
  const { active: activeId, select } = useOptimisticPill(current.id);
  const { listRef, box, measured } = usePillIndicator<HTMLUListElement>(activeId);

  // La FAQ d'abord, puis les années dans l'ordre : la FAQ est un repère fixe,
  // les millésimes défilent à sa droite — et le « + » de l'année suivante
  // ferme la rangée.
  const ordered = [...boards].sort(
    (a, b) =>
      (a.kind === "faq" ? 0 : 1) - (b.kind === "faq" ? 0 : 1) ||
      (a.year ?? 0) - (b.year ?? 0),
  );

  // Volontairement plus léger que les onglets de section, juste au-dessus :
  // deux rangées de pastilles identiques donneraient le même poids à deux
  // niveaux de navigation différents. Ici, un simple soulignement — mais il
  // **glisse** d'un tableau à l'autre, et il part au clic : c'est le même
  // geste qu'au-dessus, dans le vocabulaire de ce niveau-ci.
  return (
    <nav aria-label="Tableaux">
      <ul
        ref={listRef}
        className="relative flex items-center gap-4 border-b border-border"
      >
        <PillIndicator box={box} variant="underline" />

        {ordered.map((board) => {
          const active = activeId === board.id;
          return (
            <li key={board.id} data-pill={board.id}>
              <Link
                href={`/espace/${workspaceSlug}/planning/${board.slug}`}
                // La route réelle, pas le choix optimiste : rien n'annonce une
                // page où l'on n'est pas encore.
                aria-current={board.id === current.id ? "page" : undefined}
                onClick={() => select(board.id)}
                className={cn(
                  "type-label focus-visible:ring-ring relative -mb-px block border-b-2 px-0.5 pb-2.5 transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
                  active
                    ? // Sans mesure — premier rendu, JavaScript absent — c'est
                      // la bordure du lien qui souligne, comme avant.
                      cn("text-text-primary", measured ? "border-transparent" : "border-text-primary")
                    : "border-transparent text-text-secondary hover:text-text-primary",
                )}
              >
                <LinkPending />
                {/* La navigation dit déjà « Planning Éditorial » : répéter le
                    nom complet ferait doublon, l'année suffit à distinguer les
                    tableaux. */}
                {board.year ? String(board.year) : board.name}
              </Link>
            </li>
          );
        })}

        <AddYearTab boards={boards} current={current} workspaceSlug={workspaceSlug} />
      </ul>
    </nav>
  );
}

/**
 * « + 2027 » au bout des onglets : prolonge le planning d'une année.
 *
 * La configuration suit — colonnes, étiquettes — jamais le contenu, comme la
 * duplication d'un espace. Le bouton n'apparaît que si un tableau éditorial
 * millésimé existe, et disparaît dès que l'année suivante est là.
 */
function AddYearTab({
  boards,
  current,
  workspaceSlug,
}: {
  boards: PlanningBoard[];
  current: PlanningBoard;
  workspaceSlug: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const years = boards
    .map((board) => board.year)
    .filter((year): year is number => year !== null);
  if (years.length === 0) return null;

  const nextYear = Math.max(...years) + 1;
  if (years.includes(nextYear)) return null;

  const create = async () => {
    setPending(true);
    try {
      const result = await addYearBoard({
        workspace: workspaceSlug,
        board: current.slug,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      router.push(`/espace/${workspaceSlug}/planning/${result.slug}`);
    } finally {
      setPending(false);
    }
  };

  return (
    <li>
      <button
        type="button"
        onClick={create}
        disabled={pending}
        className="type-label text-text-secondary hover:text-text-primary focus-visible:ring-ring relative -mb-px flex items-center gap-1 border-b-2 border-transparent px-0.5 pb-2.5 transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
        title={`Créer le tableau ${nextYear} — colonnes et étiquettes reprises, mois vides`}
      >
        <Plus aria-hidden strokeWidth={1.75} className="size-3.5" />
        {pending ? "Création…" : String(nextYear)}
      </button>
    </li>
  );
}
