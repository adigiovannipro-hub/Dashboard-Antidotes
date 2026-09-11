import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ColumnDef, ColumnOverride } from "./columns";
import { resolveColumns } from "./columns";
import { signedVisualUrls } from "./visual-urls";
import type {
  BoardSettings,
  FaqEntry,
  LaneWithSubjects,
  MonthWithLanes,
  PlanningActivity,
  PlanningBoard,
  PlanningComment,
  PlanningFormat,
  PlanningLane,
  PlanningMonth,
  PlanningOwner,
  PlanningPlatform,
  PlanningStatus,
  PlanningSubject,
  ResolvedVisual,
  SubjectRow,
} from "./types";
import { DEFAULT_AD_OBJECTIVES } from "./types";

/**
 * Lectures du Planning Éditorial.
 *
 * Toutes passent par le client porteur de la session : la RLS fait le
 * cloisonnement entre espaces, il n'y a aucun `where workspace_id` défensif à
 * ajouter. Les filtres présents servent à cibler, pas à protéger.
 */

function toBoard(row: unknown): PlanningBoard {
  const board = row as PlanningBoard & { settings: Partial<BoardSettings> | null };
  return {
    ...board,
    settings: {
      ad_objectives: board.settings?.ad_objectives ?? DEFAULT_AD_OBJECTIVES,
    },
  };
}

export async function listBoards(workspaceId: string): Promise<PlanningBoard[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("planning_boards")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("position");

  return (data ?? []).map(toBoard);
}

export async function getBoard(
  workspaceId: string,
  slug: string,
): Promise<PlanningBoard | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("planning_boards")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("slug", slug)
    .maybeSingle();

  return data ? toBoard(data) : null;
}

/**
 * Le tableau de FAQ d'un espace, cherché par son genre et non par son slug.
 *
 * Il n'a plus d'URL à lui depuis que la FAQ est une page du menu : la page en
 * a besoin pour le repli des espaces sans client de modération, et rien ne
 * garantit que le tableau s'appelle « faq » chez tout le monde.
 */
export async function getFaqBoard(workspaceId: string): Promise<PlanningBoard | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("planning_boards")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("kind", "faq")
    .limit(1)
    .maybeSingle();

  return data ? toBoard(data) : null;
}

/**
 * Contenu complet d'un tableau : mois → couloirs → publications, plus les
 * archives et la corbeille — tirés de la même lecture.
 *
 * Quatre requêtes à plat plutôt qu'une requête imbriquée. PostgREST sait
 * imbriquer, mais le typage des jointures est perdu (`Relationships: []`) et
 * l'assemblage en mémoire reste lisible pour les volumes en jeu — quelques
 * centaines de lignes par année.
 *
 * Archives et corbeille se trient **en mémoire**, pas dans la requête : un
 * `is("deleted_at", null)` sur une base où la migration 0031 n'est pas encore
 * passée renverrait une erreur silencieuse, donc un tableau vide. Ici, une
 * colonne absente vaut « visible », et l'écran survit à une base en retard.
 */
export async function getBoardContent(board: PlanningBoard): Promise<{
  months: MonthWithLanes[];
  owners: PlanningOwner[];
  columns: ColumnDef[];
  /** Publications archivées, hors corbeille. */
  archived: SubjectRow[];
  /** La corbeille : publications supprimées, mois supprimés. */
  trash: { subjects: SubjectRow[]; months: PlanningMonth[] };
}> {
  const supabase = await createClient();

  const [{ data: months }, { data: lanes }, { data: subjects }, { data: overrides }] =
    await Promise.all([
      supabase
        .from("planning_months")
        .select("*")
        .eq("board_id", board.id)
        .order("position"),
      supabase
        .from("planning_lanes")
        .select("*")
        .eq("board_id", board.id)
        .order("position"),
      supabase
        .from("planning_subjects")
        .select("*")
        .eq("board_id", board.id)
        .order("position"),
      supabase
        .from("planning_columns")
        .select("*")
        .eq("board_id", board.id)
        .order("position"),
    ]);

  const monthRows = (months ?? []) as unknown as PlanningMonth[];
  const laneRows = (lanes ?? []) as unknown as PlanningLane[];
  const subjectRows = (subjects ?? []) as unknown as PlanningSubject[];
  const columnRows = (overrides ?? []) as unknown as ColumnOverride[];

  const [owners, commentsById, visualsById] = await Promise.all([
    listWorkspaceMembers(board.workspace_id),
    loadComments(subjectRows.map((subject) => subject.id)),
    resolveVisuals(subjectRows),
  ]);

  const ownerById = new Map(owners.map((owner) => [owner.id, owner]));
  const monthById = new Map(monthRows.map((month) => [month.id, month]));
  const deletedMonthIds = new Set(
    monthRows.filter((month) => month.deleted_at).map((month) => month.id),
  );

  const subjectsByLane = new Map<string, SubjectRow[]>();
  const archived: SubjectRow[] = [];
  const trashSubjects: SubjectRow[] = [];

  for (const subject of subjectRows) {
    const lane = laneRows.find((candidate) => candidate.id === subject.lane_id);
    if (!lane) continue;

    const row: SubjectRow = {
      ...subject,
      platform: lane.platform,
      lane_name: lane.name,
      month_key: monthById.get(subject.month_id)?.month ?? "",
      owner: subject.owner_id ? (ownerById.get(subject.owner_id) ?? null) : null,
      comments: (commentsById.get(subject.id) ?? []).map((comment) => ({
        ...comment,
        author: comment.author_id ? (ownerById.get(comment.author_id) ?? null) : null,
      })),
      visuals: visualsById.get(subject.id) ?? [],
      updater: subject.updated_by
        ? (ownerById.get(subject.updated_by) ?? null)
        : null,
      // Formaté ici, côté serveur : un rendu client qui lirait l'horloge serait
      // impur et divergerait à l'hydratation.
      updated_label: formatUpdateLabel(subject.updated_at),
    };

    // La partition — corbeille, archives, tableau. Un sujet d'un mois supprimé
    // suit son mois : il reviendra avec lui, pas ligne à ligne.
    if (row.deleted_at) {
      trashSubjects.push(row);
      continue;
    }
    if (deletedMonthIds.has(row.month_id)) continue;
    if (row.archived_at) {
      archived.push(row);
      continue;
    }

    const bucket = subjectsByLane.get(subject.lane_id);
    if (bucket) bucket.push(row);
    else subjectsByLane.set(subject.lane_id, [row]);
  }

  // L'ordre du tableau est l'ordre manuel — celui du drag & drop. Le tri par
  // date reste disponible depuis l'en-tête de la colonne Date.
  for (const bucket of subjectsByLane.values()) {
    bucket.sort((a, b) => a.position - b.position);
  }

  const lanesByMonth = new Map<string, LaneWithSubjects[]>();
  for (const lane of laneRows) {
    const entry: LaneWithSubjects = {
      ...lane,
      subjects: subjectsByLane.get(lane.id) ?? [],
    };
    const bucket = lanesByMonth.get(lane.month_id);
    if (bucket) bucket.push(entry);
    else lanesByMonth.set(lane.month_id, [entry]);
  }

  return {
    months: monthRows
      .filter((month) => !month.deleted_at)
      .map((month) => ({
        ...month,
        lanes: lanesByMonth.get(month.id) ?? [],
      })),
    owners,
    columns: resolveColumns(columnRows, {
      adObjectives: board.settings.ad_objectives,
    }),
    archived: archived.sort((a, b) =>
      (b.archived_at ?? "").localeCompare(a.archived_at ?? ""),
    ),
    trash: {
      subjects: trashSubjects.sort((a, b) =>
        (b.deleted_at ?? "").localeCompare(a.deleted_at ?? ""),
      ),
      months: monthRows.filter((month) => month.deleted_at),
    },
  };
}

/**
 * « il y a 2 h », « 12 juil. » — le vocabulaire de la colonne Last update.
 *
 * Relatif en deçà de 24 h, absolu au-delà : « il y a 43 jours » ne dit rien,
 * une date si.
 */
function formatUpdateLabel(timestamp: string): string {
  const at = new Date(timestamp).getTime();
  const hours = (Date.now() - at) / 3_600_000;

  if (hours < 1) return "à l'instant";
  if (hours < 24) return `il y a ${Math.floor(hours)} h`;

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Paris",
  }).format(at);
}

/** Le journal d'activité d'une publication, du plus récent au plus ancien. */
export async function listActivity(subjectId: string): Promise<PlanningActivity[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("planning_activity")
    .select("*")
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false })
    .limit(60);

  const rows = (data ?? []) as unknown as PlanningActivity[];
  if (rows.length === 0) return [];

  const actorIds = [
    ...new Set(rows.map((row) => row.actor_id).filter((id): id is string => !!id)),
  ];
  const { data: profiles } = actorIds.length
    ? await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url")
        .in("id", actorIds)
    : { data: [] };

  const byId = new Map(
    ((profiles ?? []) as unknown as PlanningOwner[]).map((p) => [p.id, p]),
  );

  return rows.map((row) => ({
    ...row,
    actor: row.actor_id ? (byId.get(row.actor_id) ?? null) : null,
    created_label: formatUpdateLabel(row.created_at),
  }));
}

/**
 * Les personnes rattachées à l'espace, pour la colonne Propriétaire.
 *
 * `profiles` n'est lisible que pour soi-même et pour l'owner de
 * l'organisation : un contributeur ne verra donc que lui dans le sélecteur.
 * C'est la politique en place, et elle n'est pas contournée ici.
 */
export async function listWorkspaceMembers(
  workspaceId: string,
): Promise<PlanningOwner[]> {
  const supabase = await createClient();

  // Les rattachés à l'espace, plus les owners de l'organisation — ces derniers
  // n'ont pas de ligne dans `memberships` mais sont bien les propriétaires
  // habituels des publications.
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("org_id")
    .eq("id", workspaceId)
    .maybeSingle();

  const [{ data: memberships }, { data: orgMembers }] = await Promise.all([
    supabase.from("memberships").select("user_id").eq("workspace_id", workspaceId),
    workspace
      ? supabase
          .from("organization_members")
          .select("user_id")
          .eq("org_id", workspace.org_id)
          .eq("role", "owner")
      : Promise.resolve({ data: [] as { user_id: string }[] }),
  ]);

  const ids = [
    ...new Set([
      ...(memberships ?? []).map((row) => row.user_id),
      ...(orgMembers ?? []).map((row) => row.user_id),
    ]),
  ];
  if (ids.length === 0) return [];

  // `profiles` reste filtré par sa propre politique : un contributeur ne voit
  // que lui-même, et le sélecteur se réduit en conséquence.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url")
    .in("id", ids)
    .order("full_name");

  return (profiles ?? []) as unknown as PlanningOwner[];
}

/**
 * Retours client, groupés par publication.
 *
 * Chargés d'un bloc avec le tableau plutôt qu'à l'ouverture de chaque fil : ils
 * se comptent en dizaines sur une année, et le compteur de la colonne « + » a
 * besoin du total de toute façon.
 */
async function loadComments(
  subjectIds: string[],
): Promise<Map<string, PlanningComment[]>> {
  const grouped = new Map<string, PlanningComment[]>();
  if (subjectIds.length === 0) return grouped;

  const supabase = await createClient();
  const { data } = await supabase
    .from("planning_comments")
    .select("*")
    .in("subject_id", subjectIds)
    .order("created_at");

  for (const raw of (data ?? []) as unknown as PlanningComment[]) {
    // `?? []` : tant que la migration 0030 n'est pas appliquée, la colonne
    // `mentions` n'existe pas et la ligne arrive sans elle.
    const row = { ...raw, mentions: raw.mentions ?? [] };
    const bucket = grouped.get(row.subject_id);
    if (bucket) bucket.push(row);
    else grouped.set(row.subject_id, [row]);
  }
  return grouped;
}

/**
 * Transforme les chemins de stockage en URL affichables.
 *
 * Le bucket est privé : les URL sont signées — mais **pas à chaque rendu**.
 * Elles viennent de `signedVisualUrls`, qui les garde stables une semaine :
 * une URL qui change à chaque affichage rendait le cache du navigateur
 * inutilisable, et la page re-téléchargeait tous les visuels à chaque visite.
 * Les valeurs déjà en `http` — un visuel importé depuis Monday — passent
 * telles quelles.
 *
 * Exportée pour « Mon travail », qui réplique les lignes du jour sur la page
 * d'accueil et doit afficher les mêmes visuels sans dupliquer cette logique.
 */
export async function resolveVisuals(
  subjects: PlanningSubject[],
): Promise<Map<string, ResolvedVisual[]>> {
  const resolved = new Map<string, ResolvedVisual[]>();

  const paths = [
    ...new Set(
      subjects.flatMap((subject) =>
        subject.visual_urls.filter((url) => !url.startsWith("http")),
      ),
    ),
  ];

  // Un appel par chemin et non un batch : c'est la clé du Data Cache. Après
  // le premier rendu, tout vient du cache sans toucher au Storage.
  const signed = new Map(
    await Promise.all(
      paths.map(
        async (path) => [path, await signedVisualUrls(path)] as const,
      ),
    ),
  );

  for (const subject of subjects) {
    resolved.set(
      subject.id,
      subject.visual_urls.map((path) => ({
        path,
        url: path.startsWith("http") ? path : (signed.get(path)?.url ?? ""),
        previewUrl: path.startsWith("http")
          ? null
          : (signed.get(path)?.previewUrl ?? null),
        name: decodeURIComponent(path.split("/").pop() ?? path),
      })),
    );
  }

  return resolved;
}

export async function listComments(subjectId: string): Promise<PlanningComment[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("planning_comments")
    .select("*")
    .eq("subject_id", subjectId)
    .order("created_at");

  const comments = (data ?? []) as unknown as PlanningComment[];
  if (comments.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url")
    .in(
      "id",
      comments.map((comment) => comment.author_id).filter((id): id is string => !!id),
    );

  const byId = new Map(
    ((profiles ?? []) as unknown as PlanningOwner[]).map((p) => [p.id, p]),
  );

  return comments.map((comment) => ({
    ...comment,
    mentions: comment.mentions ?? [],
    author: comment.author_id ? (byId.get(comment.author_id) ?? null) : null,
  }));
}

export async function listFaqEntries(boardId: string): Promise<FaqEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("planning_faq_entries")
    .select("*")
    .eq("board_id", boardId)
    .order("position");

  return (data ?? []) as unknown as FaqEntry[];
}

/** Publications d'un tableau, aplaties, pour les analyses transverses. */
export function flattenSubjects(months: MonthWithLanes[]): SubjectRow[] {
  return months.flatMap((month) => month.lanes.flatMap((lane) => lane.subjects));
}

export type { PlanningFormat, PlanningPlatform, PlanningStatus };
