"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { PlanningResult } from "@/app/actions/planning";
import { getViewer, getWorkspace } from "@/lib/auth";
import { findClientAccount } from "@/lib/composio/agency";
import { publishSubjectNow } from "@/lib/publishing/run";
import { fetchTiktokCreator } from "@/lib/publishing/tiktok-publish";
import {
  parseTiktokSettings,
  tiktokSettingsIssue,
  type TiktokCreator,
  type TiktokPostSettings,
} from "@/lib/publishing/tiktok-settings";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * Les gestes TikTok du panneau d'une publication : voir le compte de
 * destination et ce qu'il autorise, enregistrer les réglages que TikTok exige
 * de voir choisis par l'utilisateur, et publier tout de suite plutôt qu'à
 * 16h00. **L'agence seule** : le bloc n'est pas rendu au client, et ces
 * actions le refusent aussi — un client n'a pas à régler ni à déclencher une
 * publication.
 */

type Scope = { workspace: string; board: string };

async function guard(scope: Scope) {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Session expirée.");
  const workspace = await getWorkspace(scope.workspace);
  // Message neutre : ne pas confirmer l'existence d'un espace inaccessible.
  if (!workspace || workspace.role !== "owner") throw new Error("Action indisponible.");
  return { viewer, workspace };
}

function revalidate(scope: Scope) {
  revalidatePath(`/espace/${scope.workspace}/planning/${scope.board}`);
  revalidatePath("/");
}

export type TiktokCreatorResult =
  | { ok: true; creator: TiktokCreator }
  | { ok: false; error: string };

/** Le compte TikTok de l'espace et ce qu'il autorise — lu chez TikTok, à l'ouverture du bloc. */
export async function getTiktokCreator(scope: Scope): Promise<TiktokCreatorResult> {
  try {
    const { workspace } = await guard(scope);
    const account = await findClientAccount("tiktok", workspace.id);
    if ("error" in account) return { ok: false, error: account.error };
    return { ok: true, creator: await fetchTiktokCreator(account.id) };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

const SETTINGS = z.object({
  subjectId: z.uuid(),
  privacy: z.enum(["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"]),
  allowComment: z.boolean(),
  allowDuet: z.boolean(),
  allowStitch: z.boolean(),
  yourBrand: z.boolean(),
  brandedContent: z.boolean(),
});

/**
 * Enregistre les réglages — et, avec eux, l'accord avec la « Music Usage
 * Confirmation » affichée juste au-dessus du bouton : c'est ce geste qui le
 * donne, d'où l'horodatage.
 */
export async function saveTiktokSettings(
  scope: Scope,
  input: z.input<typeof SETTINGS>,
): Promise<PlanningResult> {
  const parsed = SETTINGS.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Réglages TikTok invalides." };
  const { subjectId, ...rest } = parsed.data;
  const issue = tiktokSettingsIssue(rest);
  if (issue) return { ok: false, error: `Réglages TikTok : ${issue}.` };

  try {
    const { viewer, workspace } = await guard(scope);
    const settings: TiktokPostSettings = { ...rest, consentedAt: new Date().toISOString() };
    const supabase = await createClient();

    // Filtre d'espace écrit en code, même si la RLS le porte déjà.
    const { data, error } = await supabase
      .from("planning_subjects")
      .update({ tiktok_settings: settings } as never)
      .eq("id", subjectId)
      .eq("workspace_id", workspace.id)
      .select("id");
    if (error) throw new Error(error.message);
    if ((data ?? []).length === 0) throw new Error("Publication introuvable.");

    await supabase.from("planning_activity").insert({
      subject_id: subjectId,
      workspace_id: workspace.id,
      actor_id: viewer.user.id,
      field: "tiktok_settings",
      before: null,
      after: null,
    } as never);

    revalidate(scope);
    return { ok: true, message: "Réglages TikTok enregistrés." };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/** Retire les réglages : la publication repart en brouillon. */
export async function clearTiktokSettings(
  scope: Scope,
  subjectId: string,
): Promise<PlanningResult> {
  if (!z.uuid().safeParse(subjectId).success) return { ok: false, error: "Publication introuvable." };
  try {
    const { workspace } = await guard(scope);
    const supabase = await createClient();
    const { error } = await supabase
      .from("planning_subjects")
      .update({ tiktok_settings: null } as never)
      .eq("id", subjectId)
      .eq("workspace_id", workspace.id);
    if (error) throw new Error(error.message);
    revalidate(scope);
    return { ok: true, message: "Réglages retirés : la vidéo partira en brouillon." };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/** Les réglages de la dernière publication TikTok réglée de l'espace — à reprendre d'un clic. */
export async function lastTiktokSettings(
  scope: Scope,
): Promise<TiktokPostSettings | null> {
  try {
    const { workspace } = await guard(scope);
    const supabase = await createClient();
    const { data } = await supabase
      .from("planning_subjects")
      .select("tiktok_settings")
      .eq("workspace_id", workspace.id)
      .not("tiktok_settings", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return parseTiktokSettings((data as { tiktok_settings?: unknown } | null)?.tiktok_settings);
  } catch {
    return null;
  }
}

/**
 * Publier tout de suite sur TikTok — l'agence seule. Le même chemin que le
 * passage de 16h00 : même verrou, même journal, même bascule de statut.
 */
export async function publishTiktokNow(
  scope: Scope,
  subjectId: string,
): Promise<PlanningResult> {
  if (!z.uuid().safeParse(subjectId).success) return { ok: false, error: "Publication introuvable." };
  try {
    const { workspace } = await guard(scope);

    const report = await publishSubjectNow({
      admin: createAdminClient(),
      subjectId,
      workspaceId: workspace.id,
      target: "tiktok",
    });
    revalidate(scope);

    const failed = report.errors[0];
    if (failed) return { ok: false, error: `TikTok : ${failed.error}` };
    if (report.published.length > 0) {
      return { ok: true, message: "Publié sur TikTok." };
    }
    const sent = report.drafted[0];
    if (sent?.kind === "draft") {
      return {
        ok: true,
        message: "Brouillon envoyé dans l'application TikTok : il reste à appuyer sur « publier ».",
      };
    }
    if (sent?.kind === "processing") {
      return {
        ok: true,
        message: "Vidéo envoyée à TikTok : elle peut mettre quelques minutes à apparaître sur le compte.",
      };
    }
    return { ok: false, error: report.ignored[0]?.reason ?? "Rien n'est parti." };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
