import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getViewer, getWorkspace } from "@/lib/auth";
import { extractAssetSummary } from "@/lib/context/extraction";
import { ASSETS_BUCKET } from "@/lib/context/storage";
import type { ClientAsset } from "@/lib/context/types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/* L'analyse d'un gros document découpé enchaîne plusieurs appels au modèle.
   Même valeur que le cron des Reçus — et même réserve, non tranchée : le plan
   Hobby plafonne plus bas, à vérifier au premier vrai passage. */
export const maxDuration = 300;

const bodySchema = z.object({
  workspace: z.string().min(1),
  assetId: z.uuid(),
  /* `force` : réanalyse demandée explicitement — elle seule a le droit
     d'écraser un résumé retouché à la main. */
  force: z.boolean().optional(),
});

/**
 * Extraction du résumé d'un document, déclenchée en arrière-plan après le
 * dépôt. Module interne : tout accès non-owner rend 404, jamais 403 — un
 * client ne doit pas apprendre l'existence du Contexte en tombant sur un
 * « accès refusé ».
 */
export async function POST(request: Request) {
  // Le contrôle d'accès vient en premier, avant tout travail.
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corps illisible." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Corps invalide." }, { status: 400 });
  }

  const workspace = await getWorkspace(parsed.data.workspace);
  if (!workspace || workspace.role !== "owner") {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("client_assets")
    .select("*")
    .eq("id", parsed.data.assetId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  const asset = data as unknown as ClientAsset | null;
  if (!asset) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  if (asset.extraction_status === "running") {
    return NextResponse.json({ ok: false, error: "Analyse déjà en cours." });
  }
  if (asset.summary_edited_manually && !parsed.data.force) {
    return NextResponse.json({
      ok: false,
      error: "Résumé retouché à la main : relancer explicitement pour l'écraser.",
    });
  }

  await supabase
    .from("client_assets")
    .update({ extraction_status: "running", extraction_error: null })
    .eq("id", asset.id);

  try {
    const { data: file, error: downloadError } = await supabase.storage
      .from(ASSETS_BUCKET)
      .download(asset.storage_path);
    if (downloadError || !file) {
      throw new Error(downloadError?.message ?? "Fichier introuvable dans le stockage.");
    }

    const content = Buffer.from(await file.arrayBuffer());
    const outcome = await extractAssetSummary({
      name: asset.name,
      type: asset.type,
      mimeType: asset.mime_type ?? "",
      content,
    });

    if (outcome.ok) {
      await supabase
        .from("client_assets")
        .update({
          summary: outcome.summary,
          summary_edited_manually: false,
          extraction_status: "done",
          extraction_error: null,
        })
        .eq("id", asset.id);
    } else {
      await supabase
        .from("client_assets")
        .update({ extraction_status: "error", extraction_error: outcome.error })
        .eq("id", asset.id);
    }

    revalidatePath(`/espace/${workspace.slug}/contexte`);
    return NextResponse.json(
      outcome.ok ? { ok: true } : { ok: false, error: outcome.error },
    );
  } catch (error) {
    // L'échec est écrit sur la ligne : la liste affiche la cause, jamais un
    // spinner éternel.
    const message = (error as Error).message;
    await supabase
      .from("client_assets")
      .update({ extraction_status: "error", extraction_error: message })
      .eq("id", asset.id);

    revalidatePath(`/espace/${workspace.slug}/contexte`);
    return NextResponse.json({ ok: false, error: message });
  }
}
