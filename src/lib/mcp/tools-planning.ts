import "server-only";

import { getClientContext } from "@/lib/context/get-client-context";
import { TEXT_FIELD_LABELS, isContextTextField } from "@/lib/context/types";
import {
  FORMAT_LABELS,
  PLATFORM_LABELS,
  STATUS_LABELS,
  type PlanningFormat,
  type PlanningPlatform,
  type PlanningStatus,
} from "@/lib/planning/types";
import { readReportingFacts } from "@/lib/production/generate";
import { EMPTY_FACTS, renderReportingFacts } from "@/lib/production/reporting-facts";
import { PUBLISH_BLOCKER_LABELS, publishPlan } from "@/lib/publishing/readiness";
import { VISUALS_BUCKET } from "@/lib/planning/storage";

import type { ToolDefinition } from "./protocol";
import {
  admin,
  type Admin,
  clientArg,
  findMonth,
  findWorkspace,
  listWorkspaces,
  logPlanning,
  moderationClientIds,
  monthArg,
  ownerContext,
  rows,
  text,
} from "./shared";
import { parseDay, parseMonth, resolveEditableStatus, resolveFormat } from "./values";
import { formatSubjectBlock } from "./planning-format";
import {
  VISUAL_URL_TTL_SECONDS,
  collectVisuals,
  storagePaths,
  visualLines,
} from "./visuals";

/**
 * Les clients : contexte, planning, FAQ, reporting.
 *
 * Les écritures suivent les gestes de l'application et s'écrivent au journal
 * du sujet comme eux. Aucune ne valide, ne publie ni ne supprime : le circuit
 * de validation du client reste dans l'application, et `scheduled`
 * (« Programmé ») déclenche la publication automatique de 16h00, heure de Bali.
 */

type SubjectLine = {
  id: string;
  lane_id: string;
  month_id: string;
  workspace_id: string;
  name: string;
  status: PlanningStatus;
  format: PlanningFormat;
  scheduled_on: string | null;
  wording: string | null;
  sponsoring: number | null;
  visual_urls: string[] | null;
  position: number;
};

async function subjectById(id: unknown): Promise<SubjectLine> {
  const found = rows<SubjectLine>(
    await admin()
      .from("planning_subjects")
      .select(
        "id, lane_id, month_id, workspace_id, name, status, format, scheduled_on, wording, sponsoring, visual_urls, position",
      )
      .eq("id", text(id))
      .is("deleted_at", null),
    "Lecture de la publication",
  )[0];
  if (!found) throw new Error("Publication introuvable (ou à la corbeille). L'identifiant vient de lire_planning.");
  return found;
}

function blockersOf(subject: SubjectLine): string {
  const plan = publishPlan({
    format: subject.format,
    wording: subject.wording,
    visual_urls: subject.visual_urls ?? [],
  });
  if ("story" in plan) return "story : publication manuelle";
  if (plan.ready) return "prête à publier";
  return `bloquée : ${plan.blockers.map((blocker) => PUBLISH_BLOCKER_LABELS[blocker]).join(", ")}`;
}

/**
 * Des URL signées d'une heure pour des chemins du bucket privé, en un seul
 * appel. Un chemin que le stockage ne connaît plus n'a simplement pas
 * d'entrée : la ligne le dira, l'outil ne tombe pas pour un fichier perdu.
 */
async function signVisualPaths(client: Admin, paths: string[]): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  if (paths.length === 0) return signed;
  const { data } = await client.storage
    .from(VISUALS_BUCKET)
    .createSignedUrls(paths, VISUAL_URL_TTL_SECONDS);
  for (const entry of data ?? []) {
    if (entry.signedUrl && entry.path && !entry.error) signed.set(entry.path, entry.signedUrl);
  }
  return signed;
}

export const PLANNING_TOOLS: ToolDefinition[] = [
  {
    name: "lister_clients",
    description: "Liste les espaces clients du tableau de bord : identifiant (slug) et nom.",
    inputSchema: { type: "object", properties: {} },
    readOnly: true,
    run: async () => {
      const all = await listWorkspaces(admin());
      return { text: all.map((row) => `- ${row.name} (${row.slug})`).join("\n") || "Aucun client." };
    },
  },

  {
    name: "lire_contexte",
    description:
      "Le contexte éditorial d'un client — marque, piliers, livrables, ton, règles par réseau, interdits, exemples validés, faits sourcés, consignes du mois — tel qu'il est injecté dans les générations du tableau de bord.",
    inputSchema: { type: "object", properties: { client: clientArg }, required: ["client"] },
    readOnly: true,
    run: async (args) => {
      const client = admin();
      const workspace = await findWorkspace(client, args.client);
      const bundle = await getClientContext({ workspaceId: workspace.id, client });
      return { text: bundle.injected || "Contexte vide pour ce client." };
    },
  },

  {
    name: "modifier_contexte",
    description:
      "Modifie le contexte d'un client, sur sa version active. Trois gestes : remplacer un champ texte (champ = main_context « La marque », audience « Cibles », tone_of_voice, restrictions « Interdits », client_feedback « Retours du client ») ; ajouter un exemple validé (exemple + reseau) ; ajouter un fait sourcé (fait + source, daté du jour). Lire le contexte d'abord : un champ remplacé l'est en entier.",
    inputSchema: {
      type: "object",
      properties: {
        client: clientArg,
        champ: {
          type: "string",
          enum: ["main_context", "audience", "tone_of_voice", "restrictions", "client_feedback"],
          description: "Le champ texte à remplacer.",
        },
        valeur: { type: "string", description: "Le nouveau texte complet du champ." },
        exemple: { type: "string", description: "Un texte publié et validé par le client, à ajouter aux exemples." },
        reseau: { type: "string", description: "Le réseau de l'exemple (Instagram, LinkedIn…)." },
        fait: { type: "string", description: "Un fait vérifiable sur la marque, à ajouter aux faits sourcés." },
        source: { type: "string", description: "D'où vient le fait (URL, document, échange)." },
      },
      required: ["client"],
    },
    readOnly: false,
    run: async (args) => {
      const client = admin();
      const workspace = await findWorkspace(client, args.client);
      const owner = await ownerContext(client);
      const active = rows<{
        id: string;
        validated_examples: unknown;
        sourced_facts: unknown;
      }>(
        await client
          .from("client_context")
          .select("id, validated_examples, sourced_facts")
          .eq("workspace_id", workspace.id)
          .eq("is_active", true),
        "Lecture du contexte",
      )[0];

      const patch: Record<string, unknown> = {};
      const done: string[] = [];
      const field = text(args.champ);
      if (field) {
        if (!isContextTextField(field)) return { text: `Champ inconnu : ${field}.`, isError: true };
        patch[field] = text(args.valeur) || null;
        done.push(`« ${TEXT_FIELD_LABELS[field]} » remplacé`);
      }
      if (text(args.exemple)) {
        const examples = Array.isArray(active?.validated_examples) ? active.validated_examples : [];
        if (examples.length >= 10) {
          return { text: "Dix exemples validés au plus : en retirer un dans l'application d'abord.", isError: true };
        }
        patch.validated_examples = [...examples, { reseau: text(args.reseau), texte: text(args.exemple) }];
        done.push("exemple validé ajouté");
      }
      if (text(args.fait)) {
        const facts = Array.isArray(active?.sourced_facts) ? active.sourced_facts : [];
        patch.sourced_facts = [
          ...facts,
          { fait: text(args.fait), source: text(args.source), verifie_le: new Date().toISOString().slice(0, 10) },
        ];
        done.push("fait sourcé ajouté");
      }
      if (done.length === 0) {
        return { text: "Rien à écrire : donner champ + valeur, exemple, ou fait.", isError: true };
      }

      // L'édition ne versionne jamais, comme à l'écran : le versionnage est
      // réservé à la régénération et à la restauration.
      const { error } = active
        ? await client.from("client_context").update(patch as never).eq("id", active.id)
        : await client
            .from("client_context")
            .insert({ workspace_id: workspace.id, created_by: owner.userId, ...patch } as never);
      if (error) throw new Error(`Écriture du contexte : ${error.message}`);
      return { text: `${workspace.name} : ${done.join(", ")}.` };
    },
  },

  {
    name: "lire_planning",
    description:
      "Le planning éditorial d'un client pour un mois : chaque publication avec son identifiant, réseau, sujet, statut, type, date, wording (caption ou brief d'intention), sponsorisation, nombre de visuels puis une ligne par visuel (ordre, type, URL signée valable une heure), retours, et ce qui bloquerait sa publication automatique. Pour voir les images elles-mêmes : lire_visuels.",
    inputSchema: {
      type: "object",
      properties: { client: clientArg, mois: monthArg },
      required: ["client", "mois"],
    },
    readOnly: true,
    run: async (args) => {
      const month = parseMonth(args.mois);
      const client = admin();
      const workspace = await findWorkspace(client, args.client);
      const found = await findMonth(client, workspace.id, month);
      if (!found) return { text: `Aucun mois ${month.slice(0, 7)} dans le planning de ${workspace.name}.` };

      const [laneResult, subjectResult] = await Promise.all([
        client.from("planning_lanes").select("id, name, platform, position").eq("month_id", found.monthId),
        client
          .from("planning_subjects")
          .select(
            "id, lane_id, month_id, workspace_id, name, status, format, scheduled_on, wording, sponsoring, visual_urls, position",
          )
          .eq("month_id", found.monthId)
          .eq("workspace_id", workspace.id)
          .is("deleted_at", null),
      ]);
      const lanes = rows<{ id: string; name: string; platform: PlanningPlatform; position: number }>(
        laneResult,
        "Lecture des réseaux",
      ).sort((a, b) => a.position - b.position);
      const subjects = rows<SubjectLine>(subjectResult, "Lecture des publications");

      const comments = subjects.length
        ? rows<{ subject_id: string }>(
            await client
              .from("planning_comments")
              .select("subject_id")
              .in("subject_id", subjects.map((subject) => subject.id)),
            "Lecture des retours",
          )
        : [];
      const commentCount = new Map<string, number>();
      for (const comment of comments) {
        commentCount.set(comment.subject_id, (commentCount.get(comment.subject_id) ?? 0) + 1);
      }
      const signed = await signVisualPaths(
        client,
        storagePaths(subjects.flatMap((subject) => subject.visual_urls ?? [])),
      );

      const blocks = lanes.map((lane) => {
        const lines = subjects
          .filter((subject) => subject.lane_id === lane.id)
          .sort((a, b) => a.position - b.position)
          .map((subject) =>
            formatSubjectBlock({
              id: subject.id,
              name: subject.name,
              statusLabel: STATUS_LABELS[subject.status] ?? subject.status,
              formatLabel: FORMAT_LABELS[subject.format] ?? subject.format,
              scheduledOn: subject.scheduled_on,
              sponsoring: subject.sponsoring,
              visualCount: (subject.visual_urls ?? []).length,
              commentCount: commentCount.get(subject.id) ?? 0,
              blockers: blockersOf(subject),
              wording: subject.wording,
              visualLines: visualLines(subject.visual_urls ?? [], signed),
            }),
          );
        return [`## ${lane.name} (${PLATFORM_LABELS[lane.platform] ?? lane.platform})`, ...lines].join("\n\n");
      });

      return { text: [`# ${workspace.name} — ${month.slice(0, 7)}`, ...blocks].join("\n\n") };
    },
  },

  {
    name: "lire_visuels",
    description:
      "Les visuels d'une publication du planning, en images : dans l'ordre du carrousel, en JPEG, 1 568 px de côté au plus pour un visuel seul et 1 080 px pour un lot. Une vidéo rend sa première image et son URL signée valable une heure ; un PDF, son URL signée. index (à partir de 1) pour ne demander qu'un visuel — c'est aussi la reprise quand un lot trop lourd s'arrête en route.",
    inputSchema: {
      type: "object",
      properties: {
        publication_id: { type: "string", description: "Identifiant (lire_planning)." },
        index: {
          type: "integer",
          description: "Le visuel à rendre seul, à partir de 1 (l'ordre de lire_planning). Absent : tous.",
        },
      },
      required: ["publication_id"],
    },
    readOnly: true,
    run: async (args) => {
      const subject = await subjectById(args.publication_id);
      const client = admin();
      return collectVisuals({
        name: subject.name || "(sans sujet)",
        visualUrls: subject.visual_urls ?? [],
        index: args.index,
        storage: {
          download: async (path) => {
            const { data, error } = await client.storage.from(VISUALS_BUCKET).download(path);
            if (error || !data) return null;
            return new Uint8Array(await data.arrayBuffer());
          },
          sign: (paths) => signVisualPaths(client, paths),
        },
      });
    },
  },

  {
    name: "lire_retours_publication",
    description: "Le fil de retours (agence et client) d'une publication du planning.",
    inputSchema: {
      type: "object",
      properties: { publication_id: { type: "string", description: "Identifiant (lire_planning)." } },
      required: ["publication_id"],
    },
    readOnly: true,
    run: async (args) => {
      const subject = await subjectById(args.publication_id);
      const comments = rows<{ author_id: string | null; scope: string; body: string; created_at: string }>(
        await admin()
          .from("planning_comments")
          .select("author_id, scope, body, created_at")
          .eq("subject_id", subject.id)
          .eq("workspace_id", subject.workspace_id)
          .order("created_at"),
        "Lecture des retours",
      );
      if (comments.length === 0) return { text: `Aucun retour sur « ${subject.name} ».` };
      const authors = new Map(
        rows<{ id: string; full_name: string | null; email: string | null }>(
          await admin()
            .from("profiles")
            .select("id, full_name, email")
            .in("id", [...new Set(comments.map((c) => c.author_id).filter((id): id is string => Boolean(id)))]),
          "Lecture des auteurs",
        ).map((profile) => [profile.id, profile.full_name || profile.email || "?"]),
      );
      return {
        text: comments
          .map(
            (comment) =>
              `[${comment.created_at.slice(0, 16).replace("T", " ")}] ${(comment.author_id && authors.get(comment.author_id)) || "?"} (${comment.scope}) : ${comment.body}`,
          )
          .join("\n"),
      };
    },
  },

  {
    name: "ecrire_wording",
    description:
      "Remplace le wording (la caption) d'une publication du planning, tracé au journal du sujet. L'identifiant vient de lire_planning. Le statut ne change pas : la validation du client reste dans l'application.",
    inputSchema: {
      type: "object",
      properties: {
        publication_id: { type: "string", description: "Identifiant de la publication (lire_planning)." },
        texte: { type: "string", description: "Le wording complet, tel qu'il sera publié." },
      },
      required: ["publication_id", "texte"],
    },
    readOnly: false,
    run: async (args) => {
      const client = admin();
      const subject = await subjectById(args.publication_id);
      const owner = await ownerContext(client);
      const wording = text(args.texte);
      const { error } = await client
        .from("planning_subjects")
        .update({ wording, updated_at: new Date().toISOString() } as never)
        .eq("id", subject.id)
        .eq("workspace_id", subject.workspace_id);
      if (error) throw new Error(`Écriture refusée : ${error.message}`);
      await logPlanning(client, {
        workspaceId: subject.workspace_id,
        actorId: owner.userId,
        entries: [{ subjectId: subject.id, field: "wording", before: subject.wording, after: wording }],
      });
      return { text: `Wording posé sur « ${subject.name} » (${wording.length} caractères).` };
    },
  },

  {
    name: "ajouter_intention",
    description:
      "Ajoute une publication au planning d'un client, statut « En cours » : un sujet, son réseau, son type, sa date et le brief (angle, déroulé de créa, texte visuel) qui va dans la colonne Wording. Le mois et le réseau doivent déjà exister dans le planning.",
    inputSchema: {
      type: "object",
      properties: {
        client: clientArg,
        mois: monthArg,
        reseau: {
          type: "string",
          description: "Nom du réseau tel qu'affiché dans le planning (ex. META, TIKTOK, LinkedIn).",
        },
        sujet: { type: "string", description: "Le sujet, court (il passe en majuscules)." },
        brief: { type: "string", description: "Le brief : angle, déroulé de créa, texte visuel." },
        type: {
          type: "string",
          description: "Type de contenu.",
          enum: ["post", "carrousel", "reel", "story", "video"],
        },
        date: { type: "string", description: "Date de publication AAAA-MM-JJ, dans le mois (facultatif)." },
      },
      required: ["client", "mois", "reseau", "sujet", "brief"],
    },
    readOnly: false,
    run: async (args) => {
      const month = parseMonth(args.mois);
      const date = text(args.date) ? parseDay(args.date) : null;
      if (date && date.slice(0, 7) !== month.slice(0, 7)) {
        return { text: `La date ${date} n'est pas dans ${month.slice(0, 7)}.`, isError: true };
      }
      const client = admin();
      const workspace = await findWorkspace(client, args.client);
      const found = await findMonth(client, workspace.id, month);
      if (!found) return { text: `Le mois ${month.slice(0, 7)} n'existe pas dans le planning.`, isError: true };

      const lanes = rows<{ id: string; name: string; platform: string }>(
        await client.from("planning_lanes").select("id, name, platform").eq("month_id", found.monthId),
        "Lecture des réseaux",
      );
      const wanted = text(args.reseau).toLowerCase();
      const lane = lanes.find(
        (candidate) => candidate.name.toLowerCase() === wanted || candidate.platform === wanted,
      );
      if (!lane) {
        return {
          text: `Réseau « ${text(args.reseau)} » absent de ce mois. Réseaux : ${lanes.map((l) => l.name).join(", ") || "aucun"}.`,
          isError: true,
        };
      }

      const { count, error: countError } = await client
        .from("planning_subjects")
        .select("id", { count: "exact", head: true })
        .eq("lane_id", lane.id);
      if (countError) throw new Error(`Lecture du réseau : ${countError.message}`);

      const owner = await ownerContext(client);
      const name = text(args.sujet).toUpperCase();
      const created = rows<{ id: string }>(
        await client
          .from("planning_subjects")
          .insert({
            lane_id: lane.id,
            month_id: found.monthId,
            board_id: found.boardId,
            workspace_id: workspace.id,
            name,
            // Consigne : toute publication posée par le connecteur naît « En cours ».
            status: "in_progress",
            format: resolveFormat(args.type),
            scheduled_on: date,
            wording: text(args.brief),
            // Après les lignes posées : l'ordre manuel du board est une donnée de travail.
            position: count ?? 0,
            updated_by: owner.userId,
          } as never)
          .select("id"),
        "Intention refusée",
      )[0];
      if (!created) throw new Error("Intention refusée : aucune ligne créée.");
      await logPlanning(client, {
        workspaceId: workspace.id,
        actorId: owner.userId,
        entries: [{ subjectId: created.id, field: "created", after: name }],
      });

      return { text: `« ${name} » posé dans ${lane.name}, ${month.slice(0, 7)}, statut En cours (id ${created.id}).` };
    },
  },

  {
    name: "modifier_publication",
    description:
      "Modifie une publication du planning : sujet, date (dans son mois), type ou statut. Chaque changement s'écrit au journal du sujet. Les statuts « Validé », « Programmé » et « Publié » sont refusés : la validation appartient au client, et « Programmé » déclenche la publication automatique de 16h00 (heure de Bali).",
    inputSchema: {
      type: "object",
      properties: {
        publication_id: { type: "string", description: "Identifiant de la publication (lire_planning)." },
        sujet: { type: "string", description: "Nouveau sujet (passe en majuscules)." },
        date: { type: "string", description: "Nouvelle date AAAA-MM-JJ, dans le même mois." },
        type: { type: "string", description: "Nouveau type de contenu.", enum: ["post", "carrousel", "reel", "story", "video"] },
        statut: {
          type: "string",
          description:
            "Nouveau statut, en clé ou en libellé : En cours, Wording à faire, À valider, En attente, Non retenu, En brouillon.",
        },
      },
      required: ["publication_id"],
    },
    readOnly: false,
    run: async (args) => {
      // Le refus de « Validé » passe avant toute lecture : il ne dépend de rien.
      const status = text(args.statut) ? resolveEditableStatus(args.statut) : null;
      const client = admin();
      const subject = await subjectById(args.publication_id);
      const patch: Record<string, unknown> = {};

      if (text(args.sujet)) patch.name = text(args.sujet).toUpperCase();
      if (text(args.type)) patch.format = resolveFormat(args.type);
      if (status) patch.status = status;
      if (text(args.date)) {
        const date = parseDay(args.date);
        const month = rows<{ month: string }>(
          await client.from("planning_months").select("month").eq("id", subject.month_id),
          "Lecture du mois",
        )[0]?.month;
        if (month && month.slice(0, 7) !== date.slice(0, 7)) {
          return {
            text: `${date} sort du mois de la publication (${month.slice(0, 7)}) : la déplacer se fait dans l'application.`,
            isError: true,
          };
        }
        patch.scheduled_on = date;
      }

      const changed = Object.entries(patch).filter(
        ([field, value]) => (subject as unknown as Record<string, unknown>)[field] !== value,
      );
      if (changed.length === 0) return { text: "Rien ne change." };

      const owner = await ownerContext(client);
      const { error } = await client
        .from("planning_subjects")
        .update({ ...Object.fromEntries(changed), updated_at: new Date().toISOString() } as never)
        .eq("id", subject.id)
        .eq("workspace_id", subject.workspace_id);
      if (error) throw new Error(`Écriture refusée : ${error.message}`);
      await logPlanning(client, {
        workspaceId: subject.workspace_id,
        actorId: owner.userId,
        entries: changed.map(([field, value]) => ({
          subjectId: subject.id,
          field,
          before: (subject as unknown as Record<string, unknown>)[field],
          after: value,
        })),
      });
      return { text: `« ${subject.name} » : ${changed.map(([field]) => field).join(", ")} modifié.` };
    },
  },

  {
    name: "commenter_publication",
    description:
      "Ajoute un retour au fil d'une publication du planning, au nom de l'agence. Le client le lit sur son planning ; aucun courriel n'est envoyé.",
    inputSchema: {
      type: "object",
      properties: {
        publication_id: { type: "string", description: "Identifiant de la publication (lire_planning)." },
        texte: { type: "string", description: "Le retour." },
        portee: { type: "string", enum: ["general", "visual", "wording"], description: "Sur quoi porte le retour." },
      },
      required: ["publication_id", "texte"],
    },
    readOnly: false,
    run: async (args) => {
      const client = admin();
      const subject = await subjectById(args.publication_id);
      const owner = await ownerContext(client);
      const scope = ["general", "visual", "wording"].includes(text(args.portee)) ? text(args.portee) : "general";
      const { error } = await client.from("planning_comments").insert({
        subject_id: subject.id,
        workspace_id: subject.workspace_id,
        author_id: owner.userId,
        scope,
        body: text(args.texte),
      } as never);
      if (error) throw new Error(`Retour refusé : ${error.message}`);
      return { text: `Retour ajouté sur « ${subject.name} ».` };
    },
  },

  {
    name: "lire_faq",
    description:
      "La FAQ de modération d'un client : identifiant, sujet, thème, question type, réponse validée et état de validation par le client.",
    inputSchema: { type: "object", properties: { client: clientArg }, required: ["client"] },
    readOnly: true,
    run: async (args) => {
      const client = admin();
      const workspace = await findWorkspace(client, args.client);
      const ids = await moderationClientIds(client, workspace.id);
      if (ids.length === 0) return { text: `${workspace.name} n'a pas de FAQ.` };

      const [entryResult, categoryResult] = await Promise.all([
        client
          .from("faq_entries")
          .select("id, title, question_canonical, answer_fr, answer_tiktok, category_id, client_review")
          .in("client_id", ids)
          .is("deleted_at", null),
        client.from("faq_categories").select("id, name").in("client_id", ids),
      ]);
      const categories = new Map(
        rows<{ id: string; name: string }>(categoryResult, "Lecture des thèmes").map((c) => [c.id, c.name]),
      );
      const entries = rows<{
        id: string;
        title: string | null;
        question_canonical: string;
        answer_fr: string | null;
        answer_tiktok: string | null;
        category_id: string | null;
        client_review: string | null;
      }>(entryResult, "Lecture de la FAQ");
      if (entries.length === 0) return { text: `La FAQ de ${workspace.name} est vide.` };

      return {
        text: entries
          .map((entry) =>
            [
              `## ${entry.title ?? entry.question_canonical.slice(0, 60)}`,
              `id : ${entry.id}`,
              `thème : ${(entry.category_id && categories.get(entry.category_id)) || "—"} · validation client : ${entry.client_review ?? "—"}`,
              `question : ${entry.question_canonical}`,
              `réponse : ${entry.answer_fr ?? "—"}`,
              entry.answer_tiktok ? `réponse TikTok : ${entry.answer_tiktok}` : null,
            ]
              .filter(Boolean)
              .join("\n"),
          )
          .join("\n\n"),
      };
    },
  },

  {
    name: "modifier_faq",
    description:
      "Crée ou corrige une entrée de la FAQ de modération d'un client. Avec entree_id : corrige les champs donnés. Sans : crée l'entrée (question obligatoire). Le thème se donne par son nom, il doit exister.",
    inputSchema: {
      type: "object",
      properties: {
        client: clientArg,
        entree_id: { type: "string", description: "Identifiant de l'entrée à corriger (lire_faq). Absent : création." },
        sujet: { type: "string", description: "Titre court (ex. « BON CADEAU »)." },
        question: { type: "string", description: "La question type." },
        reponse: { type: "string", description: "La réponse validée." },
        reponse_tiktok: { type: "string", description: "La version courte pour TikTok." },
        theme: { type: "string", description: "Nom du thème existant." },
      },
      required: ["client"],
    },
    readOnly: false,
    run: async (args) => {
      const client = admin();
      const workspace = await findWorkspace(client, args.client);
      const ids = await moderationClientIds(client, workspace.id);
      const clientId = ids[0];
      if (!clientId) return { text: `${workspace.name} n'a pas de FAQ.`, isError: true };

      const row: Record<string, unknown> = {};
      if (text(args.sujet)) row.title = text(args.sujet);
      if (text(args.question)) {
        row.question_canonical = text(args.question);
        // Une question modifiée perd son vecteur : le passage du matin la réindexe.
        row.embedding_source = null;
        row.embedding = null;
      }
      if (text(args.reponse)) row.answer_fr = text(args.reponse);
      if (text(args.reponse_tiktok)) row.answer_tiktok = text(args.reponse_tiktok);
      if (text(args.theme)) {
        const categories = rows<{ id: string; name: string }>(
          await client.from("faq_categories").select("id, name").in("client_id", ids),
          "Lecture des thèmes",
        );
        const theme = categories.find((c) => c.name.toLowerCase() === text(args.theme).toLowerCase());
        if (!theme) {
          return {
            text: `Thème « ${text(args.theme)} » inconnu. Thèmes : ${categories.map((c) => c.name).join(", ") || "aucun"}.`,
            isError: true,
          };
        }
        row.category_id = theme.id;
      }

      const entryId = text(args.entree_id);
      if (entryId) {
        if (Object.keys(row).length === 0) return { text: "Rien à corriger.", isError: true };
        const updated = rows<{ id: string }>(
          await client
            .from("faq_entries")
            .update({ ...row, updated_at: new Date().toISOString() } as never)
            .eq("id", entryId)
            .in("client_id", ids)
            .is("deleted_at", null)
            .select("id"),
          "Correction refusée",
        );
        if (updated.length === 0) return { text: "Entrée introuvable pour ce client.", isError: true };
        return { text: `Entrée corrigée (${Object.keys(row).filter((k) => !k.startsWith("embedding")).join(", ")}).` };
      }

      if (!row.question_canonical) return { text: "Une création demande une question.", isError: true };
      const owner = await ownerContext(client);
      const created = rows<{ id: string }>(
        await client
          .from("faq_entries")
          .insert({ client_id: clientId, created_by: owner.userId, ...row } as never)
          .select("id"),
        "Création refusée",
      )[0];
      return { text: `Entrée créée dans la FAQ de ${workspace.name} (id ${created?.id}).` };
    },
  },

  {
    name: "lire_reporting",
    description:
      "Les chiffres d'un client pour un mois et leur variation sur le mois précédent : publicité (dépense, portée, achats, CPA, ROAS) et organique par réseau (abonnés, portée, engagement, meilleures et pires publications).",
    inputSchema: {
      type: "object",
      properties: { client: clientArg, mois: monthArg },
      required: ["client", "mois"],
    },
    readOnly: true,
    run: async (args) => {
      const month = parseMonth(args.mois);
      const client = admin();
      const workspace = await findWorkspace(client, args.client);
      const measures = await readReportingFacts(client, workspace.id, month);
      const body = renderReportingFacts({ ...EMPTY_FACTS, ...measures, month });
      return { text: body.trim() || `Aucun chiffre pour ${workspace.name} en ${month.slice(0, 7)}.` };
    },
  },

  {
    name: "lire_synthese_mensuelle",
    description:
      "Le compte rendu mensuel interne d'un client (bilan du mois écrit par la phase Reporting), pour un mois donné ou les plus récents.",
    inputSchema: {
      type: "object",
      properties: { client: clientArg, mois: { ...monthArg, description: "Mois AAAA-MM (facultatif : les trois derniers)." } },
      required: ["client"],
    },
    readOnly: true,
    run: async (args) => {
      const client = admin();
      const workspace = await findWorkspace(client, args.client);
      let query = client
        .from("client_reports")
        .select("target_month, report, has_ads_data, has_organic_data")
        .eq("workspace_id", workspace.id)
        .order("target_month", { ascending: false })
        .limit(3);
      if (text(args.mois)) query = query.eq("target_month", parseMonth(args.mois));
      const reports = rows<{ target_month: string; report: string; has_ads_data: boolean; has_organic_data: boolean }>(
        await query,
        "Lecture des synthèses",
      );
      if (reports.length === 0) return { text: `Aucune synthèse pour ${workspace.name}.` };
      return {
        text: reports
          .map(
            (report) =>
              `# ${workspace.name} — ${report.target_month.slice(0, 7)} (pub : ${report.has_ads_data ? "oui" : "non"}, organique : ${report.has_organic_data ? "oui" : "non"})\n\n${report.report}`,
          )
          .join("\n\n---\n\n"),
      };
    },
  },
];

