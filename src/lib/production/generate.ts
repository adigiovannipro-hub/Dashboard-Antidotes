import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { getClientContext } from "@/lib/context/get-client-context";
import { EMPTY_DELIVERABLES, normalizeDeliverables } from "@/lib/context/deliverables";
import type { ContextDeliverables } from "@/lib/context/types";
import {
  EXCLUDED_STATUSES,
  FORMAT_LABELS,
  PLATFORM_LABELS,
  type PlanningFormat,
  type PlanningPlatform,
} from "@/lib/planning/types";
import {
  computeQuotas,
  renderExisting,
  renderQuotas,
  type ExistingPublication,
} from "./quotas";
import { needsContent } from "./wording-state";
import { schedulePublications, type SchedulablePost } from "@/lib/scheduling/publish";
import { createAdminClient } from "@/lib/supabase/server";
import { monthLabelLower, shiftMonth } from "./phases";
import { renderPrompt } from "./prompts";
import type {
  GenerationJob,
  GenerationJobResult,
  GenerationJobStatus,
} from "./types";

/**
 * Le worker des jobs de génération.
 *
 * Lancé après la réponse HTTP (`after()` de Next) ou par la route de reprise :
 * il n'a pas de session, donc tout passe par le client admin — comme un cron.
 * Et comme un cron, chaque `error` Supabase est testé : une table muette ne
 * doit pas produire un « rien à faire » rassurant.
 *
 * Le modèle est celui de tout le reste du projet. Le cahier des charges
 * demandait sonnet pour tenir le coût d'un appel par sujet ; l'écart estimé
 * est de l'ordre d'un euro par client et par mois (une douzaine de contenus,
 * un plan de mois, un reporting), et les intentions comme les contenus sont
 * le cœur du métier — c'est le mauvais endroit où économiser. À confirmer sur
 * la facture réelle du premier mois complet.
 */
export const GENERATION_MODEL = "claude-opus-5";

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

type PhaseOutcome = {
  status: GenerationJobStatus;
  result: GenerationJobResult;
  error: string | null;
  progressCurrent: number;
  progressTotal: number;
  /** La phase du cycle peut-elle être marquée « terminée » ? */
  phaseDone: boolean;
};

export async function runGenerationJob(jobId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("generation_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error || !data) {
    console.error(`[production] job ${jobId} introuvable :`, error?.message);
    return;
  }

  const job = data as unknown as GenerationJob;
  // Idempotence : un second réveil sur un job déjà pris ne fait rien.
  if (job.status !== "pending") return;

  await supabase
    .from("generation_jobs")
    .update({ status: "running", started_at: new Date().toISOString() } as never)
    .eq("id", jobId);

  let outcome: PhaseOutcome;
  try {
    outcome = await runPhase(supabase, job);
  } catch (caught) {
    outcome = {
      status: "error",
      result: {},
      error: caught instanceof Error ? caught.message : "Erreur inattendue.",
      progressCurrent: 0,
      progressTotal: 0,
      phaseDone: false,
    };
  }

  // Un arrêt demandé pendant le travail prime sur le verdict : sans cette
  // relecture, une phase sans point d'arrêt intermédiaire — un seul appel au
  // modèle — écraserait `cancelled` par `done` et la carte se contredirait.
  const cancelled = await isCancelled(supabase, jobId);
  const finalStatus: GenerationJobStatus = cancelled ? "cancelled" : outcome.status;

  const { error: saveError } = await supabase
    .from("generation_jobs")
    .update({
      status: finalStatus,
      result: outcome.result,
      error_message: cancelled ? null : outcome.error,
      progress_current: outcome.progressCurrent,
      progress_total: outcome.progressTotal,
      finished_at: new Date().toISOString(),
    } as never)
    .eq("id", jobId);
  if (saveError) {
    console.error(`[production] job ${jobId} : sauvegarde impossible :`, saveError.message);
  }

  // Une phase arrêtée en route n'est pas une phase faite, même si le travail
  // abattu avant l'arrêt était complet à cet instant.
  if (!cancelled && outcome.phaseDone && outcome.status === "done") {
    const { error: phaseError } = await supabase.from("client_phases").upsert(
      {
        org_id: job.org_id,
        workspace_id: job.workspace_id,
        phase: job.phase,
        target_month: job.target_month,
        status: "done",
        completed_at: new Date().toISOString(),
      } as never,
      { onConflict: "workspace_id,phase,target_month" },
    );
    if (phaseError) {
      console.error(`[production] phase ${job.phase} non clôturée :`, phaseError.message);
    }
  }
}

/**
 * Le job a-t-il été arrêté depuis la carte ?
 *
 * Relu entre deux unités de travail, jamais gardé en mémoire : l'arrêt vient
 * d'une autre requête HTTP, la base est le seul endroit où les deux se
 * croisent. Une lecture en échec ne vaut pas un arrêt — on continue plutôt
 * que d'abandonner un travail à cause d'un aller-retour raté.
 */
async function isCancelled(supabase: SupabaseAdmin, jobId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("generation_jobs")
    .select("status")
    .eq("id", jobId)
    .maybeSingle();
  if (error) {
    console.error(`[production] statut du job ${jobId} illisible :`, error.message);
    return false;
  }
  return (data as { status: GenerationJobStatus } | null)?.status === "cancelled";
}

function runPhase(supabase: SupabaseAdmin, job: GenerationJob): Promise<PhaseOutcome> {
  switch (job.phase) {
    case "intentions":
      return runIntentions(supabase, job);
    case "wording":
      return runWording(supabase, job);
    case "programmation":
      return runProgrammation(supabase, job);
    case "reporting":
      return runReporting(supabase, job);
  }
}

// --- Appel au modèle ---------------------------------------------------------

/**
 * Profondeur de réflexion, phase par phase.
 *
 * C'est **le** levier de latence de ce module. `claude-sonnet-4-6` réfléchit à
 * l'effort `high` quand on ne dit rien, et la réflexion se paie sur le même
 * budget que la réponse : un `max_tokens` serré finit consommé en réflexion,
 * le modèle rend un bloc de pensée sans bloc de texte, et la génération échoue
 * après plusieurs minutes sans rien produire. On fixe donc l'effort
 * explicitement, et on donne de la marge au budget.
 */
type GenerationEffort = "low" | "medium" | "high";

/**
 * Un appel, un texte. Le prompt système vient d'un fichier markdown éditable :
 * pas de sortie structurée imposée par l'API, le format fait partie du prompt
 * — un JSON toléré aux clôtures près est extrait par `parseModelJson`.
 *
 * Toujours en flux : au-delà d'une quinzaine de milliers de jetons, une
 * requête non diffusée expire côté SDK avant la fin de la génération. Le flux
 * ne change rien au résultat — `finalMessage()` recolle le message — mais il
 * supprime toute une classe de coupures silencieuses.
 */
async function callClaude(options: {
  system: string;
  user: string;
  maxTokens: number;
  effort: GenerationEffort;
}): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY absente : la génération ne peut pas tourner.");
  }

  const anthropic = new Anthropic();
  const response = await anthropic.messages
    .stream({
      model: GENERATION_MODEL,
      max_tokens: options.maxTokens,
      thinking: { type: "adaptive" },
      output_config: { effort: options.effort },
      system: options.system,
      messages: [{ role: "user", content: options.user }],
    })
    .finalMessage();

  // Un refus des classificateurs arrive en HTTP 200 : lire le contenu sans
  // vérifier `stop_reason` planterait plus loin, en silence.
  if (response.stop_reason === "refusal") {
    throw new Error("Génération refusée par les garde-fous du modèle.");
  }

  const block = response.content.find((entry) => entry.type === "text");

  // Le budget épuisé se dit, et se dit précisément : « sans bloc de texte
  // exploitable » envoyait chercher un bug de parsing là où il n'y a qu'une
  // limite trop basse pour la réflexion demandée.
  if (response.stop_reason === "max_tokens") {
    throw new Error(
      block
        ? `Réponse coupée à ${options.maxTokens} jetons : sortie incomplète.`
        : `Les ${options.maxTokens} jetons ont été consommés en réflexion, sans rédaction. Baisser l'effort ou relever la limite.`,
    );
  }

  if (!block || block.type !== "text") {
    throw new Error("Réponse du modèle sans bloc de texte exploitable.");
  }
  return block.text;
}

/** Extrait le JSON d'une réponse, clôtures markdown tolérées. */
function parseModelJson<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Dernier recours : la première structure JSON complète du texte.
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf("]"), cleaned.lastIndexOf("}"));
    if (start === -1 || end <= start) {
      throw new Error("La réponse du modèle n'est pas un JSON lisible.");
    }
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  }
}

// --- Lectures partagées ------------------------------------------------------

type MonthRow = { id: string; month: string; label: string };
type SubjectRow = {
  id: string;
  lane_id: string;
  month_id: string;
  name: string;
  status: string;
  format: string;
  scheduled_on: string | null;
  wording: string | null;
  visual_urls: string[];
  custom: Record<string, string | number | boolean | null>;
};

async function getEditorialBoard(
  supabase: SupabaseAdmin,
  workspaceId: string,
): Promise<{ id: string } | null> {
  const { data } = await supabase
    .from("planning_boards")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("kind", "editorial")
    .order("position")
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function getMonths(
  supabase: SupabaseAdmin,
  boardId: string,
  months: string[],
): Promise<MonthRow[]> {
  const { data } = await supabase
    .from("planning_months")
    .select("id, month, label")
    .eq("board_id", boardId)
    .in("month", months)
    .is("deleted_at", null);
  return (data ?? []) as unknown as MonthRow[];
}

async function getSubjects(
  supabase: SupabaseAdmin,
  monthIds: string[],
): Promise<SubjectRow[]> {
  if (monthIds.length === 0) return [];
  const { data } = await supabase
    .from("planning_subjects")
    .select("id, lane_id, month_id, name, status, format, scheduled_on, wording, visual_urls, custom")
    .in("month_id", monthIds)
    .is("deleted_at", null)
    .is("archived_at", null)
    .limit(1000);
  return ((data ?? []) as unknown as SubjectRow[]).filter(
    (subject) => !EXCLUDED_STATUSES.includes(subject.status as never),
  );
}

async function getLanePlatforms(
  supabase: SupabaseAdmin,
  monthIds: string[],
): Promise<Map<string, PlanningPlatform>> {
  if (monthIds.length === 0) return new Map();
  const { data } = await supabase
    .from("planning_lanes")
    .select("id, platform")
    .in("month_id", monthIds);
  return new Map(
    ((data ?? []) as unknown as { id: string; platform: PlanningPlatform }[]).map(
      (lane) => [lane.id, lane.platform],
    ),
  );
}

/**
 * Les livrables mensuels déclarés au Contexte — le volume dû par réseau.
 *
 * Lus en direct plutôt que par `getClientContext()`, qui les met à plat en
 * prose : le calcul du reste à produire a besoin des chiffres, pas de leur
 * phrase. Contexte absent ou illisible ⇒ aucun volume déclaré, et le prompt
 * le dit au modèle plutôt que de lui souffler un total inventé.
 */
async function getDeliverables(
  supabase: SupabaseAdmin,
  workspaceId: string,
): Promise<ContextDeliverables> {
  const { data, error } = await supabase
    .from("client_context")
    .select("deliverables")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    console.error("[production] livrables du contexte illisibles :", error.message);
    return EMPTY_DELIVERABLES;
  }
  return normalizeDeliverables((data as { deliverables?: unknown } | null)?.deliverables);
}

/** Les 30 dernières accroches publiées, numérotées — la liste anti-répétition. */
async function recentHooks(
  supabase: SupabaseAdmin,
  workspaceId: string,
): Promise<string> {
  const { data } = await supabase
    .from("wording_history")
    .select("hook")
    .eq("workspace_id", workspaceId)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(30);
  return ((data ?? []) as unknown as { hook: string }[])
    .map((row, index) => `${index + 1}. ${row.hook}`)
    .join("\n");
}

/** « septembre 2026 » — le mois cible tel que les prompts le reçoivent. */
function fullMonthLabel(targetMonth: string): string {
  return `${monthLabelLower(targetMonth.slice(0, 7))} ${targetMonth.slice(0, 4)}`;
}

function formatLabelOf(format: string): string {
  return FORMAT_LABELS[format as PlanningFormat] ?? format.toUpperCase();
}

function platformLabelOf(platform: PlanningPlatform | undefined): string {
  return platform ? PLATFORM_LABELS[platform] : "AUTRE";
}

/**
 * La colonne « Intention » du tableau : c'est là que la génération dépose
 * l'angle de chaque sujet — pas dans `wording`, qui reste la caption finale
 * et le compteur des « wordings restants ». Créée au premier besoin.
 */
async function ensureIntentionColumn(
  supabase: SupabaseAdmin,
  boardId: string,
  workspaceId: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("planning_columns")
    .select("id")
    .eq("board_id", boardId)
    .eq("label", "Intention")
    .is("builtin_key", null)
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("planning_columns")
    .insert({
      board_id: boardId,
      workspace_id: workspaceId,
      builtin_key: null,
      type: "text",
      label: "Intention",
      position: 90,
    } as never)
    .select("id")
    .single();
  if (error) {
    console.error("[production] colonne Intention impossible :", error.message);
    return null;
  }
  return created?.id ?? null;
}

function intentionOf(subject: SubjectRow, columnId: string | null): string {
  if (columnId) {
    const value = subject.custom?.[columnId];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return subject.name;
}

// --- Phase : intentions ------------------------------------------------------

/** Ce que le modèle doit rendre pour chaque intention. */
type GeneratedIntention = {
  reseau?: string;
  sujet?: string;
  type?: string;
  template?: string;
  theme?: string;
  date?: string;
  intention?: string;
  sponso?: boolean;
  objectif?: string;
};

const PLATFORM_BY_LABEL: Record<string, PlanningPlatform> = {
  META: "meta",
  INSTAGRAM: "instagram",
  FACEBOOK: "facebook",
  LINKEDIN: "linkedin",
  TIKTOK: "tiktok",
  YOUTUBE: "youtube",
  X: "x",
  PINTEREST: "pinterest",
  SNAPCHAT: "snapchat",
};

const FORMAT_BY_LABEL: Record<string, PlanningFormat> = {
  REELS: "reel",
  REEL: "reel",
  POST: "post",
  STORY: "story",
  STORIE: "story",
  CARROUSEL: "carousel",
  CAROUSEL: "carousel",
  VIDEO: "video",
};

async function runIntentions(
  supabase: SupabaseAdmin,
  job: GenerationJob,
): Promise<PhaseOutcome> {
  const board = await getEditorialBoard(supabase, job.workspace_id);
  if (!board) {
    return failure("Aucun planning éditorial pour cet espace : créer le tableau d'abord.");
  }

  const context = await getClientContext({ workspaceId: job.workspace_id });

  // L'historique des trois mois précédant le mois cible, tel qu'exigé par le
  // prompt : sujets, formats, dates — la matière de la rotation des templates.
  const monthKey = job.target_month.slice(0, 7);
  const historyKeys = [-3, -2, -1].map((delta) => `${shiftMonth(monthKey, delta)}-01`);
  const historyMonths = await getMonths(supabase, board.id, historyKeys);
  const historySubjects = await getSubjects(
    supabase,
    historyMonths.map((month) => month.id),
  );
  const lanePlatforms = await getLanePlatforms(
    supabase,
    historyMonths.map((month) => month.id),
  );

  const historique = historyMonths
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((month) => {
      const rows = historySubjects
        .filter((subject) => subject.month_id === month.id)
        .sort((a, b) => (a.scheduled_on ?? "").localeCompare(b.scheduled_on ?? ""))
        .map(
          (subject) =>
            `- ${subject.scheduled_on ?? "sans date"} · ${platformLabelOf(lanePlatforms.get(subject.lane_id))} · ${formatLabelOf(subject.format)} · « ${subject.name} »`,
        );
      return `### ${fullMonthLabel(month.month)}\n${rows.join("\n") || "- (aucune publication)"}`;
    })
    .join("\n\n");

  // --- Ce qui est déjà posé sur le mois cible -------------------------------
  // Le point décisif de cette phase : le mois n'est presque jamais vide. Des
  // lignes sont saisies à la main, et la génération doit combler l'écart avec
  // le contrat, pas repartir de zéro et livrer le double.
  const targetMonths = await getMonths(supabase, board.id, [job.target_month]);
  const targetMonthIds = targetMonths.map((month) => month.id);
  const [targetSubjects, targetLanes, deliverables, hooks] = await Promise.all([
    getSubjects(supabase, targetMonthIds),
    getLanePlatforms(supabase, targetMonthIds),
    getDeliverables(supabase, job.workspace_id),
    recentHooks(supabase, job.workspace_id),
  ]);

  const existing: ExistingPublication[] = targetSubjects.map((subject) => ({
    platform: targetLanes.get(subject.lane_id) ?? null,
    format: subject.format as PlanningFormat,
    name: subject.name,
    scheduledOn: subject.scheduled_on,
    status: subject.status,
  }));
  const quotas = computeQuotas(deliverables, existing);

  // Contrat renseigné et déjà honoré : ne rien produire est la bonne réponse,
  // et elle ne coûte pas un appel au modèle.
  if (quotas.duTotal > 0 && quotas.resteTotal === 0) {
    return {
      status: "done",
      result: {
        summary: `Le planning de ${fullMonthLabel(job.target_month)} couvre déjà les ${quotas.duTotal} publications dues : rien à ajouter.`,
      },
      error: null,
      progressCurrent: 0,
      progressTotal: 0,
      phaseDone: true,
    };
  }

  const system = renderPrompt("intentions", {
    client_context: context.client_context,
    client_assets_summaries: context.client_assets_summaries,
    historique,
    target_month: fullMonthLabel(job.target_month),
    deja_planifie: renderExisting(existing),
    reste_a_produire: renderQuotas(quotas),
    accroches_historique: hooks,
    contraintes: context.contraintes,
    marronniers: context.marronniers,
  });

  const attendu =
    quotas.resteTotal > 0
      ? ` Tu dois produire exactement ${quotas.resteTotal} intention${quotas.resteTotal > 1 ? "s" : ""}, en complément de ce qui est déjà au planning.`
      : "";
  const text = await callClaude({
    system,
    user: `Produis maintenant les intentions de ${fullMonthLabel(job.target_month)}, au format de sortie demandé.${attendu}`,
    // Un mois entier de planning tient rarement sous 12 000 jetons une fois la
    // réflexion payée sur le même budget : c'est ce plafond qui rendait des
    // réponses sans texte.
    maxTokens: 32000,
    effort: "medium",
  });

  const items = parseModelJson<GeneratedIntention[]>(text).filter(
    (item): item is GeneratedIntention & { sujet: string } =>
      typeof item?.sujet === "string" && item.sujet.trim() !== "",
  );
  if (items.length === 0) {
    return failure("Le modèle n'a produit aucune intention exploitable.");
  }

  // --- Insertion dans le planning : mois, réseaux, sujets -------------------
  let monthId = targetMonths[0]?.id ?? null;
  if (!monthId) {
    const { data: lastMonth } = await supabase
      .from("planning_months")
      .select("position")
      .eq("board_id", board.id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: createdMonth, error: monthError } = await supabase
      .from("planning_months")
      .insert({
        board_id: board.id,
        workspace_id: job.workspace_id,
        label: monthLabelLower(monthKey).toUpperCase(),
        month: job.target_month,
        position: (lastMonth?.position ?? -1) + 1,
      } as never)
      .select("id")
      .single();
    if (monthError || !createdMonth) {
      return failure(`Création du mois impossible : ${monthError?.message ?? "?"}`);
    }
    monthId = createdMonth.id;
  }

  const intentionColumnId = await ensureIntentionColumn(
    supabase,
    board.id,
    job.workspace_id,
  );

  const laneIds = new Map<PlanningPlatform, string>();
  const laneOf = async (platform: PlanningPlatform): Promise<string | null> => {
    const known = laneIds.get(platform);
    if (known) return known;
    const { data: existingLane } = await supabase
      .from("planning_lanes")
      .select("id")
      .eq("month_id", monthId!)
      .eq("platform", platform)
      .limit(1)
      .maybeSingle();
    if (existingLane) {
      laneIds.set(platform, existingLane.id);
      return existingLane.id;
    }
    const { data: createdLane, error: laneError } = await supabase
      .from("planning_lanes")
      .insert({
        month_id: monthId,
        board_id: board.id,
        workspace_id: job.workspace_id,
        platform,
        name: PLATFORM_LABELS[platform],
        position: laneIds.size,
      } as never)
      .select("id")
      .single();
    if (laneError || !createdLane) {
      console.error("[production] création de réseau impossible :", laneError?.message);
      return null;
    }
    laneIds.set(platform, createdLane.id);
    return createdLane.id;
  };

  const createdIds: string[] = [];
  // Après les lignes déjà posées, pas par-dessus : deux sujets à la position 0
  // se rangent dans un ordre arbitraire, et l'ordre manuel du board est une
  // donnée de travail.
  let position = existing.length;
  for (const item of items) {
    const platform = PLATFORM_BY_LABEL[(item.reseau ?? "").toUpperCase()] ?? "other";
    const format = FORMAT_BY_LABEL[(item.type ?? "").toUpperCase()] ?? "other";
    const laneId = await laneOf(platform);
    if (!laneId) continue;

    const date =
      item.date && item.date.startsWith(monthKey) ? item.date : null;
    const intentionText = [
      item.template ? `Template : ${item.template}` : null,
      item.theme ? `Thème : ${item.theme}` : null,
      item.intention ?? null,
    ]
      .filter(Boolean)
      .join("\n");

    const { data: createdSubject, error: subjectError } = await supabase
      .from("planning_subjects")
      .insert({
        lane_id: laneId,
        month_id: monthId,
        board_id: board.id,
        workspace_id: job.workspace_id,
        name: item.sujet.toUpperCase(),
        status: "idea",
        format,
        scheduled_on: date,
        ad_objective: item.objectif ?? null,
        ad_status: item.sponso ? "todo" : null,
        custom:
          intentionColumnId && intentionText
            ? { [intentionColumnId]: intentionText }
            : {},
        position: position++,
      } as never)
      .select("id")
      .single();

    if (subjectError) {
      console.error("[production] intention non insérée :", subjectError.message);
      continue;
    }
    if (createdSubject) createdIds.push(createdSubject.id);
  }

  if (createdIds.length === 0) {
    return failure("Aucune intention n'a pu être insérée dans le planning.");
  }

  return {
    status: "done",
    result: {
      created_subject_ids: createdIds,
      summary: `${createdIds.length} intentions posées dans le planning de ${fullMonthLabel(job.target_month)}.`,
    },
    error: null,
    progressCurrent: createdIds.length,
    progressTotal: items.length,
    phaseDone: true,
  };
}

// --- Phase : wording ---------------------------------------------------------

type GeneratedWording = {
  wording?: string;
  accroche?: string;
  contenu_crea?: string | null;
  texte_visuel?: string | null;
  slides?: { titre?: string; sous_titre?: string; visuel?: string }[] | null;
};

/** Les sujets passent par lots de quatre : un échec n'arrête pas les autres. */
const WORDING_BATCH_SIZE = 4;

/**
 * La consigne de sortie propre au format.
 *
 * Une Story n'a pas de légende : ce qui compte est ce qui s'affiche à l'écran,
 * écran par écran. Lui faire produire une caption remplirait la colonne d'un
 * texte que personne ne publiera jamais.
 */
function formatInstruction(format: PlanningFormat): string {
  switch (format) {
    case "story":
      return [
        "Ce sujet est une STORY. Il n'y a donc AUCUNE légende à écrire.",
        "Mets dans `wording` le contenu de la story, écran par écran : pour chaque écran, le texte affiché à l'image (court, lisible en une seconde), l'intention visuelle, et l'interaction si elle s'y prête (sondage, question, curseur, lien).",
        "Cale ce contenu sur la stratégie, les piliers de contenu et les exemples de créa du brief.",
        "Laisse `contenu_crea` et `slides` à null. `accroche` doit valoir null : une story n'alimente pas l'historique des accroches.",
      ].join("\n");
    case "carousel":
      return [
        "Ce sujet est un CARROUSEL. Produis la légende dans `wording`, et le déroulé slide par slide dans `slides` : titre, sous-titre et indication visuelle pour chacune, dernière slide en CTA.",
        "Mets dans `contenu_crea` ce qui doit apparaître sur la créa au-delà des slides, s'il y a lieu.",
      ].join("\n");
    case "reel":
    case "video":
      return [
        "Ce sujet est une VIDÉO ou un REEL. Produis la légende dans `wording`.",
        "Mets dans `contenu_crea` ce que la vidéo doit montrer et dire : accroche des trois premières secondes, déroulé, chute.",
        "`texte_visuel` porte le texte incrusté à l'image, 6 mots maximum.",
      ].join("\n");
    default:
      return [
        "Ce sujet est une publication fixe. Produis la légende dans `wording`.",
        "Mets dans `contenu_crea` ce qui doit apparaître sur le visuel : message principal, éléments à représenter, mentions obligatoires s'il y en a.",
      ].join("\n");
  }
}

async function runWording(
  supabase: SupabaseAdmin,
  job: GenerationJob,
): Promise<PhaseOutcome> {
  const board = await getEditorialBoard(supabase, job.workspace_id);
  if (!board) {
    return failure("Aucun planning éditorial pour cet espace.");
  }

  const months = await getMonths(supabase, board.id, [job.target_month]);
  const subjects = await getSubjects(supabase, months.map((month) => month.id));
  if (subjects.length === 0) {
    return failure(
      `Aucune intention pour ${fullMonthLabel(job.target_month)} : générer d'abord les intentions.`,
    );
  }

  const missing = subjects.filter((subject) =>
    needsContent({
      status: subject.status,
      hasWording: (subject.wording ?? "").trim() !== "",
    }),
  );
  if (missing.length === 0) {
    return {
      status: "done",
      result: { summary: "Tous les contenus étaient déjà rédigés." },
      error: null,
      progressCurrent: 0,
      progressTotal: 0,
      phaseDone: true,
    };
  }

  const [context, lanePlatforms, hooks] = await Promise.all([
    getClientContext({ workspaceId: job.workspace_id }),
    getLanePlatforms(supabase, months.map((month) => month.id)),
    recentHooks(supabase, job.workspace_id),
  ]);

  const intentionColumnId = await ensureIntentionColumn(
    supabase,
    board.id,
    job.workspace_id,
  );

  await supabase
    .from("generation_jobs")
    .update({ progress_total: missing.length } as never)
    .eq("id", job.id);

  let done = 0;
  const failedIds: string[] = [];

  const processSubject = async (subject: SubjectRow): Promise<void> => {
    const platform = lanePlatforms.get(subject.lane_id);
    const format = subject.format as PlanningFormat;
    const isStory = format === "story";

    // Le brief saisi à la main dans la colonne Wording. C'est une consigne de
    // rédaction, pas un livrable : le texte final le remplace.
    const brief = (subject.wording ?? "").trim();

    const system = renderPrompt("wording", {
      client_context: context.client_context,
      client_assets_summaries: context.client_assets_summaries,
      platform_rules: context.platform_rules,
      reseau: platformLabelOf(platform),
      type: formatLabelOf(subject.format),
      template: subject.name,
      date: subject.scheduled_on ?? "Non datée",
      intention: intentionOf(subject, intentionColumnId),
      brief_existant: brief,
      consigne_format: formatInstruction(format),
      accroches_historique: hooks,
    });

    const text = await callClaude({
      system,
      user: isStory
        ? "Produis maintenant le contenu de la story, au format de sortie demandé."
        : "Rédige maintenant la version finale, au format de sortie demandé.",
      maxTokens: 8000,
      effort: "medium",
    });
    const generated = parseModelJson<GeneratedWording>(text);
    if (!generated.wording || generated.wording.trim() === "") {
      throw new Error(isStory ? "Contenu de story vide." : "Wording vide.");
    }

    // La caption d'abord ; les textes de créa suivent dans la même cellule,
    // derrière un séparateur — le board n'a pas de colonne dédiée aux créas.
    // Une story n'a que son contenu : rien à empiler derrière.
    const sections = [generated.wording.trim()];
    if (!isStory && generated.contenu_crea) {
      sections.push(`---\nContenu de la créa : ${generated.contenu_crea}`);
    }
    if (!isStory && generated.texte_visuel) {
      sections.push(`---\nTexte visuel : ${generated.texte_visuel}`);
    }
    if (!isStory && generated.slides && generated.slides.length > 0) {
      const slides = generated.slides
        .map(
          (slide, index) =>
            `Slide ${index + 1} : ${slide.titre ?? ""}${slide.sous_titre ? ` — ${slide.sous_titre}` : ""}${slide.visuel ? ` (visuel : ${slide.visuel})` : ""}`,
        )
        .join("\n");
      sections.push(`---\n${slides}`);
    }

    const { error: updateError } = await supabase
      .from("planning_subjects")
      .update({ wording: sections.join("\n\n"), status: "to_validate" } as never)
      .eq("id", subject.id);
    if (updateError) throw new Error(updateError.message);

    // Une story n'a pas d'accroche publiée : l'historiser polluerait la liste
    // anti-répétition avec des textes qui ne sont jamais des légendes.
    if (!isStory && generated.accroche && generated.accroche.trim() !== "") {
      await supabase.from("wording_history").insert({
        org_id: job.org_id,
        workspace_id: job.workspace_id,
        subject_id: subject.id,
        hook: generated.accroche.trim(),
        full_wording: generated.wording.trim(),
        platform: platform ?? null,
        published_at: subject.scheduled_on,
      } as never);
    }
  };

  for (let index = 0; index < missing.length; index += WORDING_BATCH_SIZE) {
    const batch = missing.slice(index, index + WORDING_BATCH_SIZE);
    const settled = await Promise.allSettled(batch.map(processSubject));
    settled.forEach((entry, offset) => {
      if (entry.status === "fulfilled") done += 1;
      else {
        failedIds.push(batch[offset]!.id);
        console.error(
          `[production] wording en échec (${batch[offset]!.name}) :`,
          entry.reason instanceof Error ? entry.reason.message : entry.reason,
        );
      }
    });
    await supabase
      .from("generation_jobs")
      .update({ progress_current: done } as never)
      .eq("id", job.id);

    // Point d'arrêt : c'est ici, et nulle part ailleurs, que « Arrêter »
    // arrête vraiment. Le lot en vol va au bout — quatre appels au plus — car
    // rien ne permet d'annuler une requête déjà partie chez le modèle.
    if (index + WORDING_BATCH_SIZE < missing.length && (await isCancelled(supabase, job.id))) {
      return {
        status: "cancelled",
        result: {
          failed_subject_ids: failedIds.length > 0 ? failedIds : undefined,
          summary: `Arrêté après ${done} wording${done > 1 ? "s" : ""} sur ${missing.length}.`,
        },
        error: null,
        progressCurrent: done,
        progressTotal: missing.length,
        phaseDone: false,
      };
    }
  }

  const status: GenerationJobStatus =
    failedIds.length === 0 ? "done" : done > 0 ? "partial" : "error";

  return {
    status,
    result: {
      failed_subject_ids: failedIds.length > 0 ? failedIds : undefined,
      summary:
        failedIds.length === 0
          ? `${done} wording${done > 1 ? "s" : ""} rédigé${done > 1 ? "s" : ""}.`
          : `${done} rédigé${done > 1 ? "s" : ""}, ${failedIds.length} en échec — relancer pour reprendre.`,
    },
    error:
      status === "error" ? "Aucun wording n'a pu être rédigé." : null,
    progressCurrent: done,
    progressTotal: missing.length,
    phaseDone: failedIds.length === 0,
  };
}

// --- Phase : programmation ---------------------------------------------------

async function runProgrammation(
  supabase: SupabaseAdmin,
  job: GenerationJob,
): Promise<PhaseOutcome> {
  const board = await getEditorialBoard(supabase, job.workspace_id);
  if (!board) {
    return failure("Aucun planning éditorial pour cet espace.");
  }

  const months = await getMonths(supabase, board.id, [job.target_month]);
  const subjects = await getSubjects(supabase, months.map((month) => month.id));
  const validated = subjects.filter((subject) => subject.status === "validated");
  if (validated.length === 0) {
    return failure("Aucun post validé client à programmer.");
  }

  const lanePlatforms = await getLanePlatforms(
    supabase,
    months.map((month) => month.id),
  );

  const outcome = await schedulePublications(
    validated.map(
      (subject): SchedulablePost => ({
        subjectId: subject.id,
        workspaceId: job.workspace_id,
        platform: platformLabelOf(lanePlatforms.get(subject.lane_id)),
        name: subject.name,
        scheduledOn: subject.scheduled_on,
        wording: subject.wording,
        visualUrls: subject.visual_urls ?? [],
      }),
    ),
  );

  // Le stub ne programme rien pour de vrai : le job aboutit, mais la phase
  // n'est pas clôturée et aucun statut de publication ne change. Pas de faux
  // positif.
  return {
    status: "done",
    result: {
      summary: `Stub : ${outcome.accepted.length} post${outcome.accepted.length > 1 ? "s" : ""} seraient programmés${outcome.rejected.length > 0 ? `, ${outcome.rejected.length} incomplet${outcome.rejected.length > 1 ? "s" : ""} (date ou wording manquant)` : ""} — API de publication non branchée.`,
    },
    error: null,
    progressCurrent: outcome.accepted.length,
    progressTotal: validated.length,
    phaseDone: false,
  };
}

// --- Phase : reporting -------------------------------------------------------

async function runReporting(
  supabase: SupabaseAdmin,
  job: GenerationJob,
): Promise<PhaseOutcome> {
  const board = await getEditorialBoard(supabase, job.workspace_id);
  if (!board) {
    return failure("Aucun planning éditorial pour cet espace.");
  }

  const monthKey = job.target_month.slice(0, 7);
  const previousKey = `${shiftMonth(monthKey, -1)}-01`;
  const months = await getMonths(supabase, board.id, [job.target_month, previousKey]);
  const analyzedMonth = months.find((month) => month.month === job.target_month);
  if (!analyzedMonth) {
    return failure(`Aucun planning pour ${fullMonthLabel(job.target_month)} : rien à analyser.`);
  }

  const subjects = await getSubjects(supabase, months.map((month) => month.id));
  const lanePlatforms = await getLanePlatforms(
    supabase,
    months.map((month) => month.id),
  );

  const describeMonth = (monthId: string | undefined): string => {
    if (!monthId) return "Aucune donnée.";
    const rows = subjects.filter((subject) => subject.month_id === monthId);
    if (rows.length === 0) return "Aucune publication.";

    const byPlatform = new Map<string, { total: number; published: number }>();
    for (const subject of rows) {
      const label = platformLabelOf(lanePlatforms.get(subject.lane_id));
      const entry = byPlatform.get(label) ?? { total: 0, published: 0 };
      entry.total += 1;
      if (subject.status === "published") entry.published += 1;
      byPlatform.set(label, entry);
    }
    return [...byPlatform.entries()]
      .map(
        ([label, entry]) =>
          `- ${label} : ${entry.published} publié${entry.published > 1 ? "s" : ""} sur ${entry.total} prévu${entry.total > 1 ? "s" : ""}`,
      )
      .join("\n");
  };

  const publishedRows = subjects
    .filter(
      (subject) => subject.month_id === analyzedMonth.id && subject.status === "published",
    )
    .sort((a, b) => (a.scheduled_on ?? "").localeCompare(b.scheduled_on ?? ""));

  const postsData =
    publishedRows
      .map(
        (subject) =>
          `- ${subject.scheduled_on ?? "sans date"} · ${platformLabelOf(lanePlatforms.get(subject.lane_id))} · ${formatLabelOf(subject.format)} · « ${subject.name} » — performances chiffrées non disponibles`,
      )
      .join("\n") || "Aucune publication publiée ce mois.";

  const context = await getClientContext({ workspaceId: job.workspace_id });
  const previousMonth = months.find((month) => month.month === previousKey);

  const system = renderPrompt("reporting", {
    client_context: context.client_context,
    target_month: fullMonthLabel(job.target_month),
    metrics: `Volumes issus du planning éditorial (les données de portée et d'engagement des régies ne sont pas encore branchées) :\n${describeMonth(analyzedMonth.id)}`,
    posts_data: postsData,
    metrics_previous: describeMonth(previousMonth?.id),
    objectifs: context.objectifs,
  });

  const report = await callClaude({
    system,
    user: `Rédige maintenant le compte rendu de ${fullMonthLabel(job.target_month)}, selon la structure demandée.`,
    maxTokens: 24000,
    effort: "medium",
  });

  return {
    status: "done",
    result: {
      report,
      summary: `Reporting de ${fullMonthLabel(job.target_month)} généré.`,
    },
    error: null,
    progressCurrent: 1,
    progressTotal: 1,
    phaseDone: true,
  };
}

// --- Utilitaires -------------------------------------------------------------

function failure(message: string): PhaseOutcome {
  return {
    status: "error",
    result: { summary: message },
    error: message,
    progressCurrent: 0,
    progressTotal: 0,
    phaseDone: false,
  };
}
