import { NextResponse, after } from "next/server";

import { getViewer, getWorkspace } from "@/lib/auth";
import { AGENCY_TOOLKIT_LABELS, isAgencyToolkit } from "@/lib/composio/agency";
import { importLinkedinInventory, syncWorkspaceLinkedin } from "@/lib/connectors/linkedin/sync";
import {
  importTiktokAdsInventory,
  syncWorkspaceTiktokAds,
} from "@/lib/connectors/tiktok-ads/sync";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * L'inventaire LinkedIn ou TikTok Ads, relevé chez Composio.
 *
 * Deux portes : le bouton « Relever » de Connexions, et le retour de
 * l'autorisation (`branche=1`), où Composio ramène après un branchement.
 * Dans le second cas, la collecte de l'espace repart aussitôt, en tâche de
 * fond : rebrancher sans relancer laissait l'erreur à l'écran jusqu'au cron
 * du lendemain — c'est ce qui faisait croire que la reconnexion n'avait servi
 * à rien.
 *
 * Rien n'est affecté au passage : le choix du compte reste un geste
 * explicite dans Connexions.
 *
 * Module interne : 404 et non 403 à qui n'est pas propriétaire.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const workspaceSlug = url.searchParams.get("espace");
  const reseau = url.searchParams.get("reseau") ?? "";
  if (!workspaceSlug || !isAgencyToolkit(reseau)) {
    return new NextResponse(null, { status: 404 });
  }

  const workspace = await getWorkspace(workspaceSlug);
  if (!workspace || workspace.role !== "owner") {
    return new NextResponse(null, { status: 404 });
  }

  const asked = url.searchParams.get("retour") ?? "";
  const target = new URL(
    asked.startsWith(`/espace/${workspaceSlug}/`) ? asked : `/espace/${workspaceSlug}`,
    url.origin,
  );
  const label = AGENCY_TOOLKIT_LABELS[reseau];
  const branche = url.searchParams.get("branche") === "1";

  /* Composio dit « failed » quand l'autorisation a été refusée ou abandonnée.
     Seuls les échecs explicites arrêtent : un statut inconnu laisse
     l'inventaire trancher, puisqu'il relit de toute façon les comptes. */
  const status = url.searchParams.get("status")?.toLowerCase() ?? null;
  if (branche && status && ["failed", "failure", "error", "cancelled", "canceled"].includes(status)) {
    target.searchParams.set("erreur", `Branchement ${label} interrompu chez Composio (${status}).`);
    return NextResponse.redirect(target);
  }

  const admin = createAdminClient();
  const viewer = await getViewer();

  /* Une clé Composio absente lève avant tout appel : elle doit revenir à
     l'écran comme une erreur lisible, pas comme une page d'erreur. */
  const importing: Promise<{ count: number } | { error: string }> =
    reseau === "linkedin"
      ? importLinkedinInventory({
          admin,
          orgId: workspace.org_id,
          workspaceId: workspace.id,
          connectedBy: viewer?.user.id ?? null,
        }).then((result) => ("error" in result ? result : { count: result.pages }))
      : importTiktokAdsInventory({
          admin,
          orgId: workspace.org_id,
          connectedBy: viewer?.user.id ?? null,
        }).then((result) => ("error" in result ? result : { count: result.accounts }));

  const outcome = await importing.catch((error: unknown) => ({
    error: `Inventaire ${label} indisponible : ${error instanceof Error ? error.message : "erreur"}`,
  }));

  if ("error" in outcome) {
    target.searchParams.set("erreur", outcome.error);
    return NextResponse.redirect(target);
  }

  const noun =
    reseau === "linkedin"
      ? outcome.count > 1
        ? "pages LinkedIn"
        : "page LinkedIn"
      : outcome.count > 1
        ? "comptes publicitaires TikTok"
        : "compte publicitaire TikTok";

  let message = `${outcome.count} ${noun} dans l'inventaire.`;

  if (branche) {
    const kind = reseau === "linkedin" ? "linkedin" : "tiktok_ad_account";
    const { data: link } = await admin
      .from("workspace_social_accounts")
      .select("account_id")
      .eq("workspace_id", workspace.id)
      .eq("kind", kind)
      .maybeSingle();

    if (link) {
      after(async () => {
        if (reseau === "linkedin") {
          await syncWorkspaceLinkedin({ admin, workspaceId: workspace.id });
        } else {
          await syncWorkspaceTiktokAds({ admin, workspaceId: workspace.id });
        }
      });
      message = `${label} branché — ${message} La collecte de ${workspace.name} est relancée : les chiffres arrivent d'ici une minute.`;
    } else {
      message = `${label} branché — ${message} Choisir le compte de ${workspace.name} ci-dessous.`;
    }
  }

  target.searchParams.set("connecte", message);
  return NextResponse.redirect(target);
}
