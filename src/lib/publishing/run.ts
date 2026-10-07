import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { findClientAccount } from "@/lib/composio/agency";
import { decryptSecret } from "@/lib/moderation/crypto";
import type { Database } from "@/lib/supabase/database.types";
import { publishLinkedin, type LinkedinMedia } from "./linkedin-publish";
import { instagramUrls, loadMedia, toRgbJpeg, type MediaItem } from "./media";
import { publishFacebook, publishInstagram } from "./meta-publish";
import { pdfFromJpegs } from "./pdf-from-jpegs";
import {
  isPublishWindow,
  parisStamp,
  PUBLISH_BLOCKER_LABELS,
  PUBLISH_HOUR_PARIS,
  PUBLISH_TARGET_LABELS,
  publishPlan,
  publishTargets,
  targetPlan,
  type PublishTarget,
} from "./readiness";
import { fetchTiktokDraftState, sendTiktokDraft } from "./tiktok-publish";

/**
 * Le passage de publication automatique.
 *
 * Chaque jour **à partir de** 16h heure de Paris : tout sujet **validé** dont
 * la date est aujourd'hui part sur les réseaux de son couloir — Instagram et
 * Facebook en direct, LinkedIn sur le profil du client, TikTok **en
 * brouillon** dans l'application du compte. Le déclencheur est le statut
 * posé par l'agence — pas une file séparée à entretenir — et le verrou est la
 * table `planning_publications` : revendiquer un couple (sujet, réseau) est
 * une insertion sous contrainte d'unicité, deux passages concurrents ne
 * publieront jamais deux fois.
 *
 * Le sujet passe « Publié » quand **tous** les réseaux de son couloir sont
 * en ligne (`settleSubject`). Un brouillon TikTok n'est pas en ligne : la
 * ligne reste « Validé » — donc dans « À publier » — jusqu'à ce que quelqu'un
 * le publie depuis l'application, ce que chaque passage vérifie
 * (`followTiktokDrafts`), à toute heure.
 *
 * « À partir de » et non « à 16h pile » : un passage programmé de GitHub
 * arrive des heures en retard, et l'heure exacte n'offrait qu'une chance par
 * jour — voir `isPublishWindow`. Les passages suivants de la fenêtre
 * rattrapent, le verrou empêchant tout doublon.
 *
 * Un sujet en retard ne part pas : publier le 20 un post prévu le 12 sans
 * qu'un humain l'ait décidé serait pire que le trou. Il reste en rouge dans
 * « À publier », où il a déjà sa place.
 */

type Admin = SupabaseClient<Database>;

export type PublishReport = {
  paris: { date: string; hour: number };
  skipped?: string;
  published: { subject: string; target: PublishTarget; permalink: string | null }[];
  /** Brouillons TikTok envoyés ce passage — en attente du geste du client. */
  drafted: { subject: string; target: PublishTarget }[];
  errors: { subject: string; target: PublishTarget | null; error: string }[];
  ignored: { subject: string; reason: string }[];
};

type SubjectRow = {
  id: string;
  lane_id: string;
  workspace_id: string;
  name: string;
  format: string;
  wording: string | null;
  visual_urls: string[];
};

type MetaAccount = { channel: "meta"; externalId: string; token: string };
type ComposioAccount = { channel: "composio"; connectedAccountId: string; username: string | null };
export type TargetAccount = MetaAccount | ComposioAccount;

export type PublishOutcome =
  | { status: "success"; externalId: string; permalink: string | null }
  | { status: "awaiting"; externalId: string };

function fail(message: string): never {
  throw new Error(message);
}

/** Les comptes d'un espace, résolus une fois par passage. */
function accountResolver(admin: Admin) {
  const cache = new Map<string, Promise<TargetAccount | { error: string }>>();
  return (workspaceId: string, target: PublishTarget) => {
    const key = `${workspaceId}:${target}`;
    let found = cache.get(key);
    if (!found) {
      found = resolveAccount(admin, workspaceId, target);
      cache.set(key, found);
    }
    return found;
  };
}

export async function runScheduledPublishing(options: {
  admin: Admin;
  now?: Date;
  /** Publier même hors de 16h — le passage manuel. */
  force?: boolean;
}): Promise<PublishReport> {
  const { admin, force } = options;
  const now = options.now ?? new Date();
  const paris = parisStamp(now);
  const accountFor = accountResolver(admin);

  const report: PublishReport = {
    paris,
    published: [],
    drafted: [],
    errors: [],
    ignored: [],
  };

  // Les brouillons TikTok se suivent à toute heure : un client qui publie à
  // 9h doit voir sa ligne passer « Publié » au passage suivant, pas à 16h.
  // Un suivi en panne ne doit jamais empêcher Meta de publier.
  try {
    await followTiktokDrafts({ admin, now, report, accountFor });
  } catch (error) {
    report.errors.push({
      subject: "Brouillons TikTok",
      target: "tiktok",
      error: (error as Error).message,
    });
  }

  if (!isPublishWindow(paris.hour) && !force) {
    report.skipped = `Il est ${paris.hour}h à Paris — la publication part à partir de ${PUBLISH_HOUR_PARIS}h.`;
    return report;
  }

  // Règle des passages machine : chaque `error` Supabase est testé — une
  // table absente ne doit jamais ressembler à « rien à publier ».
  const { data: subjectRows, error: subjectsError } = await admin
    .from("planning_subjects")
    .select("id, lane_id, workspace_id, name, format, wording, visual_urls")
    .eq("status", "validated")
    .eq("scheduled_on", paris.date)
    // Une ligne à la corbeille ou archivée ne part jamais, même validée.
    .is("deleted_at", null)
    .is("archived_at", null);
  if (subjectsError) fail(`Lecture des sujets : ${subjectsError.message}`);

  const subjects = (subjectRows ?? []) as unknown as SubjectRow[];
  if (subjects.length === 0) return report;

  const platformByLane = await lanePlatforms(
    admin,
    subjects.map((subject) => subject.lane_id),
  );

  for (const subject of subjects) {
    const platform = platformByLane.get(subject.lane_id) ?? "other";
    const wanted = publishTargets(platform);

    if (wanted.length === 0) {
      report.ignored.push({
        subject: subject.name,
        reason: `le réseau « ${platform} » ne se publie pas automatiquement`,
      });
      continue;
    }

    const plan = publishPlan(subject);

    if (!plan.ready) {
      if ("story" in plan) {
        // Les stories se publient à la main — widgets impossibles par l'API.
        report.ignored.push({ subject: subject.name, reason: "story, publication manuelle" });
        continue;
      }
      const cause = plan.blockers
        .map((blocker) => PUBLISH_BLOCKER_LABELS[blocker])
        .join(" ; ");
      for (const target of wanted) {
        await recordFailure(admin, subject, target, cause);
      }
      report.errors.push({ subject: subject.name, target: null, error: cause });
      continue;
    }

    // Les fichiers ne se signent et ne se téléchargent qu'une fois par sujet,
    // et seulement si un réseau part vraiment.
    let media: Promise<MediaItem[]> | null = null;

    for (const target of wanted) {
      const ready = targetPlan(target, subject);
      if (!ready.ready) {
        const cause = ready.blockers.map((blocker) => PUBLISH_BLOCKER_LABELS[blocker]).join(" ; ");
        await recordFailure(admin, subject, target, cause);
        report.errors.push({ subject: subject.name, target, error: cause });
        continue;
      }

      const account = await accountFor(subject.workspace_id, target);
      if ("error" in account) {
        await recordFailure(admin, subject, target, account.error);
        report.errors.push({ subject: subject.name, target, error: account.error });
        continue;
      }

      const claimed = await claimPublication(admin, subject, target);
      if (!claimed) {
        // Déjà publié, en brouillon ou en cours ailleurs : le verrou a parlé.
        report.ignored.push({
          subject: subject.name,
          reason: `${PUBLISH_TARGET_LABELS[target]} déjà traité`,
        });
        continue;
      }

      try {
        media ??= loadMedia(admin, subject.visual_urls);
        const outcome = await publishToTarget({
          admin,
          target,
          account,
          subject,
          items: await media,
        });
        await closePublication(admin, subject, target, outcome);

        if (outcome.status === "awaiting") {
          report.drafted.push({ subject: subject.name, target });
        } else {
          report.published.push({ subject: subject.name, target, permalink: outcome.permalink });
        }
      } catch (error) {
        const cause = (error as Error).message;
        await markError(admin, subject, target, cause);
        report.errors.push({ subject: subject.name, target, error: cause });
      }
    }

    await settleSubject(admin, subject, wanted);
  }

  return report;
}

async function lanePlatforms(admin: Admin, laneIds: string[]): Promise<Map<string, string>> {
  const { data, error } = await admin
    .from("planning_lanes")
    .select("id, platform")
    .in("id", [...new Set(laneIds)]);
  if (error) fail(`Lecture des couloirs : ${error.message}`);
  return new Map(
    ((data ?? []) as { id: string; platform: string }[]).map((lane) => [lane.id, lane.platform]),
  );
}

/**
 * Publie un sujet sur un réseau — le même chemin pour le passage programmé
 * et pour l'essai (`publishTrial`), sans quoi l'essai ne prouverait que
 * lui-même.
 */
export async function publishToTarget(options: {
  admin: Admin;
  target: PublishTarget;
  account: TargetAccount;
  subject: SubjectRow;
  items: MediaItem[];
}): Promise<PublishOutcome> {
  const { admin, target, account, subject, items } = options;
  const caption = subject.wording?.trim() ?? "";

  if (target === "instagram" || target === "facebook") {
    if (account.channel !== "meta") fail("Compte Meta attendu.");
    if (target === "facebook") {
      const published = await publishFacebook({
        pageId: account.externalId,
        pageToken: account.token,
        caption,
        mediaUrls: items.map((item) => item.signedUrl),
      });
      return { status: "success", ...published };
    }

    // Instagram ne publie que du JPEG : les PNG des créas sont convertis.
    const { urls, cleanup } = await instagramUrls({
      admin,
      workspaceId: subject.workspace_id,
      subjectId: subject.id,
      items,
    });
    try {
      const published = await publishInstagram({
        igUserId: account.externalId,
        accessToken: account.token,
        caption,
        mediaUrls: urls,
      });
      return { status: "success", ...published };
    } finally {
      await cleanup();
    }
  }

  if (account.channel !== "composio") fail("Compte Composio attendu.");

  if (target === "tiktok") {
    const video = items[0]!;
    const { publishId } = await sendTiktokDraft({
      connectedAccountId: account.connectedAccountId,
      video: await video.read(),
      contentType: video.contentType,
    });
    return { status: "awaiting", externalId: publishId };
  }

  const published = await publishLinkedin({
    connectedAccountId: account.connectedAccountId,
    caption,
    media: await linkedinMedia(subject, items),
  });
  return { status: "success", ...published };
}

/** Le média LinkedIn d'un sujet : plusieurs images deviennent un PDF. */
async function linkedinMedia(subject: SubjectRow, items: MediaItem[]): Promise<LinkedinMedia> {
  const title = subject.name.trim() || "Publication";
  if (items.length === 1) {
    const only = items[0]!;
    const bytes = await only.read();
    if (only.kind === "video") return { type: "video", bytes, title };
    if (only.kind === "pdf") return { type: "document", bytes, title };
    // LinkedIn lit le JPEG, le PNG et le GIF ; le reste est converti.
    if (["image/jpeg", "image/png", "image/gif"].includes(only.contentType)) {
      return { type: "image", bytes, contentType: only.contentType };
    }
    return { type: "image", bytes: (await toRgbJpeg(bytes)).bytes, contentType: "image/jpeg" };
  }

  const pages = [];
  for (const item of items) {
    const jpeg = await toRgbJpeg(await item.read());
    pages.push({ jpeg: jpeg.bytes, width: jpeg.width, height: jpeg.height });
  }
  return { type: "document", bytes: pdfFromJpegs(pages), title };
}

/**
 * Le compte d'un espace pour un réseau, ou la raison de son absence.
 *
 * Instagram et Facebook : l'affectation de Connexions et le jeton chiffré.
 * TikTok et LinkedIn : l'affectation aussi — sans elle, rien ne dit que le
 * client a voulu publier là —, puis la connexion Composio de l'espace.
 */
async function resolveAccount(
  admin: Admin,
  workspaceId: string,
  target: PublishTarget,
): Promise<TargetAccount | { error: string }> {
  const kind =
    target === "instagram"
      ? "instagram"
      : target === "facebook"
        ? "facebook_page"
        : target === "tiktok"
          ? "tiktok"
          : "linkedin_profile";

  const missing = {
    error:
      target === "linkedin"
        ? "aucun profil LinkedIn affecté à l'espace — le brancher depuis Connexions (« Brancher LinkedIn (profil) »)"
        : `aucun compte ${PUBLISH_TARGET_LABELS[target]} affecté à l'espace — à faire depuis Connexions`,
  };

  const { data: link, error: linkError } = await admin
    .from("workspace_social_accounts")
    .select("account_id")
    .eq("workspace_id", workspaceId)
    .eq("kind", kind)
    .maybeSingle();
  if (linkError) fail(`Lecture des affectations : ${linkError.message}`);
  const accountId = (link as { account_id?: string } | null)?.account_id;
  if (!accountId) return missing;

  const { data: account, error: accountError } = await admin
    .from("social_accounts")
    .select("external_id, username")
    .eq("id", accountId)
    .single();
  if (accountError) fail(`Compte social : ${accountError.message}`);
  const social = account as { external_id: string; username: string | null };

  if (target === "tiktok" || target === "linkedin") {
    const connected = await findClientAccount(
      target === "tiktok" ? "tiktok" : "linkedin_profil",
      workspaceId,
    );
    if ("error" in connected) return connected;
    return { channel: "composio", connectedAccountId: connected.id, username: social.username };
  }

  const { data: secret, error: secretError } = await admin
    .from("social_account_secrets")
    .select("credentials_encrypted")
    .eq("account_id", accountId)
    .maybeSingle();
  if (secretError) fail(`Jeton du compte : ${secretError.message}`);
  const blob = (secret as { credentials_encrypted?: string } | null)?.credentials_encrypted;
  if (!blob) return { error: `jeton ${PUBLISH_TARGET_LABELS[target]} absent — rebrancher Meta depuis Connexions` };

  return { channel: "meta", externalId: social.external_id, token: decryptSecret(blob) };
}

/** Clôt la ligne de publication : en ligne, ou brouillon en attente. */
async function closePublication(
  admin: Admin,
  subject: Pick<SubjectRow, "id" | "workspace_id">,
  target: PublishTarget,
  outcome: PublishOutcome,
): Promise<void> {
  const { error } = await admin
    .from("planning_publications")
    .update({
      status: outcome.status,
      external_id: outcome.externalId,
      permalink: outcome.status === "success" ? outcome.permalink : null,
      error: null,
      finished_at: new Date().toISOString(),
    } as never)
    .eq("subject_id", subject.id)
    .eq("target", target);
  if (error) fail(`Clôture de la publication : ${error.message}`);

  if (outcome.status === "awaiting") {
    await logActivity(
      admin,
      subject,
      "publication_draft",
      null,
      `${PUBLISH_TARGET_LABELS[target]} — brouillon dans l'application, à publier depuis le téléphone (la légende est à coller depuis le planning)`,
    );
    return;
  }
  await logActivity(
    admin,
    subject,
    "publication",
    null,
    [PUBLISH_TARGET_LABELS[target], outcome.permalink].filter(Boolean).join(" — "),
  );
}

async function markError(
  admin: Admin,
  subject: Pick<SubjectRow, "id" | "workspace_id">,
  target: PublishTarget,
  cause: string,
): Promise<void> {
  await admin
    .from("planning_publications")
    .update({
      status: "error",
      error: cause,
      finished_at: new Date().toISOString(),
    } as never)
    .eq("subject_id", subject.id)
    .eq("target", target);
  await logActivity(
    admin,
    subject,
    "publication_error",
    null,
    `${PUBLISH_TARGET_LABELS[target]} — ${cause}`,
  );
}

/**
 * Le sujet passe « Publié » quand tous les réseaux de son couloir sont en
 * ligne — lu en base, pas déduit du passage : un réseau publié hier et
 * l'autre aujourd'hui font un sujet publié aujourd'hui, et un brouillon
 * TikTok ou une ligne en cours ailleurs n'en font pas un.
 *
 * `where status = 'validated'` : si l'agence a changé d'avis pendant le
 * passage, son geste gagne — on ne réécrit pas par-dessus.
 */
async function settleSubject(
  admin: Admin,
  subject: Pick<SubjectRow, "id" | "workspace_id">,
  wanted: PublishTarget[],
): Promise<void> {
  const { data, error } = await admin
    .from("planning_publications")
    .select("target, status")
    .eq("subject_id", subject.id);
  if (error) fail(`Lecture des publications : ${error.message}`);

  const online = new Set(
    ((data ?? []) as { target: PublishTarget; status: string }[])
      .filter((row) => row.status === "success")
      .map((row) => row.target),
  );
  if (!wanted.every((target) => online.has(target))) return;

  const { data: updated, error: statusError } = await admin
    .from("planning_subjects")
    .update({ status: "published", updated_at: new Date().toISOString() } as never)
    .eq("id", subject.id)
    .eq("status", "validated")
    .select("id");
  if (statusError) fail(`Statut du sujet : ${statusError.message}`);
  if ((updated ?? []).length === 0) return;

  await logActivity(admin, subject, "status", "validated", "published");
}

/** Au-delà, un brouillon resté dans l'application ne passera plus « Publié » tout seul. */
const DRAFT_FOLLOW_DAYS = 30;

/**
 * Le sort des brouillons TikTok : publiés depuis l'application, supprimés,
 * ou toujours en attente.
 */
async function followTiktokDrafts(options: {
  admin: Admin;
  now: Date;
  report: PublishReport;
  accountFor: ReturnType<typeof accountResolver>;
}): Promise<void> {
  const { admin, now, report, accountFor } = options;

  const { data: rows, error } = await admin
    .from("planning_publications")
    .select("subject_id, workspace_id, external_id, started_at")
    .eq("status", "awaiting")
    .eq("target", "tiktok");
  if (error) fail(`Lecture des brouillons TikTok : ${error.message}`);

  const drafts = (rows ?? []) as {
    subject_id: string;
    workspace_id: string;
    external_id: string | null;
    started_at: string;
  }[];
  if (drafts.length === 0) return;

  const { data: subjectRows, error: subjectsError } = await admin
    .from("planning_subjects")
    .select("id, lane_id, workspace_id, name")
    .in("id", drafts.map((draft) => draft.subject_id));
  if (subjectsError) fail(`Lecture des sujets en brouillon : ${subjectsError.message}`);
  const subjects = new Map(
    ((subjectRows ?? []) as { id: string; lane_id: string; workspace_id: string; name: string }[]).map(
      (subject) => [subject.id, subject],
    ),
  );
  const platformByLane = await lanePlatforms(
    admin,
    [...subjects.values()].map((subject) => subject.lane_id),
  );
  const oldest = now.getTime() - DRAFT_FOLLOW_DAYS * 86_400_000;

  for (const draft of drafts) {
    const subject = subjects.get(draft.subject_id);
    if (!subject) continue;
    const ref = { id: subject.id, workspace_id: subject.workspace_id };

    try {
      if (new Date(draft.started_at).getTime() < oldest) {
        await markError(
          admin,
          ref,
          "tiktok",
          `brouillon resté ${DRAFT_FOLLOW_DAYS} jours dans l'application sans être publié — le suivi s'arrête`,
        );
        continue;
      }

      const account = await accountFor(subject.workspace_id, "tiktok");
      if ("error" in account || account.channel !== "composio" || !draft.external_id) continue;

      const state = await fetchTiktokDraftState(account.connectedAccountId, draft.external_id);
      if (state.state === "waiting") continue;

      if (state.state === "failed") {
        await markError(admin, ref, "tiktok", state.reason);
        report.errors.push({ subject: subject.name, target: "tiktok", error: state.reason });
        continue;
      }

      const permalink = account.username
        ? state.postId
          ? `https://www.tiktok.com/@${account.username}/video/${state.postId}`
          : `https://www.tiktok.com/@${account.username}`
        : null;
      await closePublication(admin, ref, "tiktok", {
        status: "success",
        externalId: state.postId ?? draft.external_id,
        permalink,
      });
      report.published.push({ subject: subject.name, target: "tiktok", permalink });
      await settleSubject(admin, ref, publishTargets(platformByLane.get(subject.lane_id) ?? "other"));
    } catch (error) {
      // Un suivi raté se retente au passage suivant : la ligne reste en attente.
      report.errors.push({
        subject: subject.name,
        target: "tiktok",
        error: `suivi du brouillon — ${(error as Error).message}`,
      });
    }
  }
}

/**
 * L'essai : publier **un** sujet, par le même chemin que le passage, sur les
 * comptes d'un espace de test — sans verrou, sans toucher au statut du
 * sujet ni à son journal. C'est la preuve par la vraie chaîne qu'exige tout
 * ce qui part vers un client : `pnpm publier:essai`.
 */
export async function publishTrial(options: {
  admin: Admin;
  subjectId: string;
  /** L'espace dont les comptes reçoivent l'essai — jamais celui du client. */
  testWorkspaceId: string;
  targets?: PublishTarget[];
}): Promise<{ target: PublishTarget; outcome?: PublishOutcome; error?: string }[]> {
  const { admin } = options;
  const { data, error } = await admin
    .from("planning_subjects")
    .select("id, lane_id, workspace_id, name, format, wording, visual_urls")
    .eq("id", options.subjectId)
    .single();
  if (error) fail(`Sujet introuvable : ${error.message}`);
  const subject = data as unknown as SubjectRow;

  const platform = (await lanePlatforms(admin, [subject.lane_id])).get(subject.lane_id) ?? "other";
  const targets = options.targets ?? publishTargets(platform);
  if (targets.length === 0) fail(`Le réseau « ${platform} » ne se publie pas automatiquement.`);

  const plan = publishPlan(subject);
  if (!plan.ready) {
    fail(
      "story" in plan
        ? "Une story ne se publie pas automatiquement."
        : plan.blockers.map((blocker) => PUBLISH_BLOCKER_LABELS[blocker]).join(" ; "),
    );
  }

  // L'essai écrit sous l'espace de test : la copie JPEG d'Instagram aussi.
  const testSubject = { ...subject, workspace_id: options.testWorkspaceId };
  const accountFor = accountResolver(admin);
  const items = await loadMedia(admin, subject.visual_urls);
  const results: { target: PublishTarget; outcome?: PublishOutcome; error?: string }[] = [];

  for (const target of targets) {
    const ready = targetPlan(target, subject);
    if (!ready.ready) {
      results.push({
        target,
        error: ready.blockers.map((blocker) => PUBLISH_BLOCKER_LABELS[blocker]).join(" ; "),
      });
      continue;
    }
    const account = await accountFor(options.testWorkspaceId, target);
    if ("error" in account) {
      results.push({ target, error: account.error });
      continue;
    }
    try {
      results.push({
        target,
        outcome: await publishToTarget({ admin, target, account, subject: testSubject, items }),
      });
    } catch (caught) {
      results.push({ target, error: (caught as Error).message });
    }
  }
  return results;
}

/**
 * Revendique le couple (sujet, réseau). Vrai si ce passage le tient.
 *
 * Deux temps, chacun atomique : l'insertion sous contrainte d'unicité — le
 * cas nominal — puis, pour rejouer un échec passé, la reprise conditionnée
 * `where status = 'error'`. Une ligne `running` ou `success` n'est jamais
 * reprise : c'est elle, le verrou anti-double publication.
 */
async function claimPublication(
  admin: Admin,
  subject: Pick<SubjectRow, "id" | "workspace_id">,
  target: PublishTarget,
): Promise<boolean> {
  const { data: inserted, error } = await admin
    .from("planning_publications")
    .upsert(
      {
        subject_id: subject.id,
        workspace_id: subject.workspace_id,
        target,
        status: "running",
        started_at: new Date().toISOString(),
      } as never,
      { onConflict: "subject_id,target", ignoreDuplicates: true },
    )
    .select("id");
  if (error) fail(`Verrou de publication : ${error.message}`);
  if ((inserted ?? []).length > 0) return true;

  const { data: retried, error: retryError } = await admin
    .from("planning_publications")
    .update({
      status: "running",
      error: null,
      started_at: new Date().toISOString(),
      finished_at: null,
    } as never)
    .eq("subject_id", subject.id)
    .eq("target", target)
    .eq("status", "error")
    .select("id");
  if (retryError) fail(`Reprise de publication : ${retryError.message}`);
  return (retried ?? []).length > 0;
}

/** Un échec avant même d'appeler Meta — blocage, compte manquant. */
async function recordFailure(
  admin: Admin,
  subject: SubjectRow,
  target: PublishTarget,
  cause: string,
): Promise<void> {
  const claimed = await claimPublication(admin, subject, target);
  if (!claimed) return;

  const { error } = await admin
    .from("planning_publications")
    .update({
      status: "error",
      error: cause,
      finished_at: new Date().toISOString(),
    } as never)
    .eq("subject_id", subject.id)
    .eq("target", target);
  if (error) fail(`Trace d'échec : ${error.message}`);

  await logActivity(
    admin,
    subject,
    "publication_error",
    null,
    `${PUBLISH_TARGET_LABELS[target]} — ${cause}`,
  );
}

/** Une phrase au journal du sujet — c'est là que l'erreur devient visible. */
async function logActivity(
  admin: Admin,
  subject: Pick<SubjectRow, "id" | "workspace_id">,
  field: string,
  before: string | null,
  after: string,
): Promise<void> {
  const { error } = await admin.from("planning_activity").insert({
    subject_id: subject.id,
    workspace_id: subject.workspace_id,
    actor_id: null,
    field,
    before,
    after,
  } as never);
  if (error) fail(`Journal d'activité : ${error.message}`);
}
