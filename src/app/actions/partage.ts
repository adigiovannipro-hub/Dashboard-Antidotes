"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Les liens de partage public du Reporting.
 *
 * Le geste le plus demandé d'un rapport : « envoie-moi le lien ». Le lien
 * porte un jeton opaque de 64 hexdigits — c'est lui le droit d'accès, la page
 * `/partage/[token]` le résout hors de toute session. La période est figée
 * (`date_mode: fixed`) : un rapport mensuel envoyé ne bouge plus.
 */

export type PartageResult =
  | { ok: true; message: string; url: string }
  | { ok: false; error: string };

const createInput = z.object({
  workspace: z.string().min(1),
  dashboard: z.string().min(1),
  du: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  au: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function createShareLink(input: {
  workspace: string;
  dashboard: string;
  du: string;
  au: string;
}): Promise<PartageResult> {
  const parsed = createInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  try {
    const workspace = await getWorkspace(parsed.data.workspace);
    // Partager engage le client : owner seulement, message neutre sinon.
    if (!workspace || workspace.role !== "owner") {
      return { ok: false, error: "Action indisponible." };
    }

    const supabase = await createClient();
    const { data: dashboard } = await supabase
      .from("dashboards")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("slug", parsed.data.dashboard)
      .maybeSingle();
    if (!dashboard) return { ok: false, error: "Tableau de bord introuvable." };

    const token = randomBytes(32).toString("hex");
    const { error } = await supabase.from("share_links").insert({
      dashboard_id: (dashboard as { id: string }).id,
      workspace_id: workspace.id,
      token,
      date_mode: "fixed",
      date_from: parsed.data.du,
      date_to: parsed.data.au,
    } as never);
    if (error) return { ok: false, error: error.message };

    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    revalidatePath(`/espace/${workspace.slug}`);
    return {
      ok: true,
      message: "Lien de partage créé et copié.",
      url: `${base}/partage/${token}`,
    };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export async function revokeShareLink(input: {
  workspace: string;
  token: string;
}): Promise<PartageResult> {
  const parsed = z
    .object({ workspace: z.string().min(1), token: z.string().min(16) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Requête incomplète." };

  try {
    const workspace = await getWorkspace(parsed.data.workspace);
    if (!workspace || workspace.role !== "owner") {
      return { ok: false, error: "Action indisponible." };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("share_links")
      .update({ revoked_at: new Date().toISOString() } as never)
      .eq("workspace_id", workspace.id)
      .eq("token", parsed.data.token);
    if (error) return { ok: false, error: error.message };

    return { ok: true, message: "Lien révoqué.", url: "" };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
