import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptSecret } from "@/lib/moderation/crypto";
import { VISUALS_BUCKET } from "@/lib/planning/storage";
import type { Database } from "@/lib/supabase/database.types";
import { publishFacebook, publishInstagram } from "./meta-publish";
import {
  isPublishWindow,
  parisStamp,
  PUBLISH_BLOCKER_LABELS,
  PUBLISH_HOUR_PARIS,
  PUBLISH_TARGET_LABELS,
  publishPlan,
  publishTargets,
  type PublishTarget,
} from "./readiness";

/**
 * Le passage de publication automatique.
 *
 * Chaque jour **à partir de** 16h heure de Paris : tout sujet **validé** dont
 * la date est aujourd'hui part sur les réseaux de son couloir. Le déclencheur
 * est le statut posé par l'agence — pas une file séparée à entretenir — et le
 * verrou est la table `planning_publications` : revendiquer un couple
 * (sujet, réseau) est une insertion sous contrainte d'unicité, deux passages
 * concurrents ne publieront jamais deux fois.
 *
 * « À partir de » et non « à 16h pile » : un passage programmé de GitHub
 * saute près d'une fenêtre sur deux, et l'heure exacte n'offrait qu'une
 * chance par jour — voir `isPublishWindow`. Les passages suivants de la
 * fenêtre (quatre par jour) rattrapent, le verrou empêchant tout doublon.
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

type TargetAccount = { externalId: string; token: string };
type WorkspaceTargets = Partial<Record<PublishTarget, TargetAccount>>;

function fail(message: string): never {
  throw new Error(message);
}

export async function runScheduledPublishing(options: {
  admin: Admin;
  now?: Date;
  /** Publier même hors de 16h — le passage manuel. */
  force?: boolean;
}): Promise<PublishReport> {
  const { admin, force } = options;
  const paris = parisStamp(options.now ?? new Date());

  const report: PublishReport = {
    paris,
    published: [],
    errors: [],
    ignored: [],
  };

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
    .eq("scheduled_on", paris.date);
  if (subjectsError) fail(`Lecture des sujets : ${subjectsError.message}`);

  const subjects = (subjectRows ?? []) as unknown as SubjectRow[];
  if (subjects.length === 0) return report;

  const { data: laneRows, error: lanesError } = await admin
    .from("planning_lanes")
    .select("id, platform")
    .in("id", [...new Set(subjects.map((subject) => subject.lane_id))]);
  if (lanesError) fail(`Lecture des couloirs : ${lanesError.message}`);
  const platformByLane = new Map(
    ((laneRows ?? []) as { id: string; platform: string }[]).map((lane) => [
      lane.id,
      lane.platform,
    ]),
  );

  const targetsByWorkspace = new Map<string, WorkspaceTargets>();

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

    // Les comptes de l'espace, résolus une fois puis réutilisés.
    let targets = targetsByWorkspace.get(subject.workspace_id);
    if (!targets) {
      targets = await loadWorkspaceTargets(admin, subject.workspace_id);
      targetsByWorkspace.set(subject.workspace_id, targets);
    }

    // Les URL signées que Meta téléchargera — deux heures, le temps des
    // encodages les plus lents, et rien ne transite par ici.
    const paths = subject.visual_urls.filter((url) => !url.startsWith("http"));
    const signed = new Map<string, string>();
    if (paths.length > 0) {
      const { data: signedRows, error: signError } = await admin.storage
        .from(VISUALS_BUCKET)
        .createSignedUrls(paths, 7200);
      if (signError) fail(`Signature des visuels : ${signError.message}`);
      for (const entry of signedRows ?? []) {
        if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
      }
    }
    const mediaUrls = subject.visual_urls.map((url) =>
      url.startsWith("http") ? url : (signed.get(url) ?? ""),
    );

    if (mediaUrls.some((url) => url === "")) {
      const cause = "un visuel n'existe plus dans le stockage";
      for (const target of wanted) {
        await recordFailure(admin, subject, target, cause);
      }
      report.errors.push({ subject: subject.name, target: null, error: cause });
      continue;
    }

    let allSucceeded = true;

    for (const target of wanted) {
      const account = targets[target];

      if (!account) {
        const cause = `aucun compte ${PUBLISH_TARGET_LABELS[target]} affecté à l'espace — à faire depuis Connexions`;
        await recordFailure(admin, subject, target, cause);
        report.errors.push({ subject: subject.name, target, error: cause });
        allSucceeded = false;
        continue;
      }

      const claimed = await claimPublication(admin, subject, target);
      if (!claimed) {
        // Déjà publié ou en cours ailleurs : le verrou a parlé.
        report.ignored.push({
          subject: subject.name,
          reason: `${PUBLISH_TARGET_LABELS[target]} déjà traité`,
        });
        continue;
      }

      try {
        const caption = subject.wording?.trim() ?? "";
        const published =
          target === "instagram"
            ? await publishInstagram({
                igUserId: account.externalId,
                accessToken: account.token,
                caption,
                mediaUrls,
              })
            : await publishFacebook({
                pageId: account.externalId,
                pageToken: account.token,
                caption,
                mediaUrls,
              });

        const { error: doneError } = await admin
          .from("planning_publications")
          .update({
            status: "success",
            external_id: published.externalId,
            permalink: published.permalink,
            error: null,
            finished_at: new Date().toISOString(),
          } as never)
          .eq("subject_id", subject.id)
          .eq("target", target);
        if (doneError) fail(`Clôture de la publication : ${doneError.message}`);

        await logActivity(admin, subject, "publication", null, [
          PUBLISH_TARGET_LABELS[target],
          published.permalink,
        ]
          .filter(Boolean)
          .join(" — "));

        report.published.push({
          subject: subject.name,
          target,
          permalink: published.permalink,
        });
      } catch (error) {
        const cause = (error as Error).message;
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
        report.errors.push({ subject: subject.name, target, error: cause });
        allSucceeded = false;
      }
    }

    if (allSucceeded) {
      // `where status = 'validated'` : si l'agence a changé d'avis pendant le
      // passage, son geste gagne — on ne réécrit pas par-dessus.
      const { error: statusError } = await admin
        .from("planning_subjects")
        .update({ status: "published", updated_at: new Date().toISOString() } as never)
        .eq("id", subject.id)
        .eq("status", "validated");
      if (statusError) fail(`Statut du sujet : ${statusError.message}`);

      await logActivity(admin, subject, "status", "validated", "published");
    }
  }

  return report;
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
  subject: SubjectRow,
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
  subject: SubjectRow,
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

/** Les comptes publiables d'un espace : Instagram et Page, avec leur jeton. */
async function loadWorkspaceTargets(
  admin: Admin,
  workspaceId: string,
): Promise<WorkspaceTargets> {
  const targets: WorkspaceTargets = {};

  const { data: links, error: linksError } = await admin
    .from("workspace_social_accounts")
    .select("kind, account_id")
    .eq("workspace_id", workspaceId)
    .in("kind", ["instagram", "facebook_page"]);
  if (linksError) fail(`Lecture des affectations : ${linksError.message}`);

  for (const link of (links ?? []) as { kind: string; account_id: string }[]) {
    const { data: account, error: accountError } = await admin
      .from("social_accounts")
      .select("external_id")
      .eq("id", link.account_id)
      .single();
    if (accountError) fail(`Compte social : ${accountError.message}`);

    const { data: secret, error: secretError } = await admin
      .from("social_account_secrets")
      .select("credentials_encrypted")
      .eq("account_id", link.account_id)
      .maybeSingle();
    if (secretError) fail(`Jeton du compte : ${secretError.message}`);

    const blob = (secret as { credentials_encrypted?: string } | null)
      ?.credentials_encrypted;
    if (!blob) continue;

    const target: PublishTarget =
      link.kind === "instagram" ? "instagram" : "facebook";
    targets[target] = {
      externalId: (account as { external_id: string }).external_id,
      token: decryptSecret(blob),
    };
  }

  return targets;
}
