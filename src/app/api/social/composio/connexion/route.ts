import { NextResponse } from "next/server";

import { getWorkspace } from "@/lib/auth";
import {
  AGENCY_TOOLKIT_LABELS,
  isAgencyToolkit,
  startAgencyConnection,
} from "@/lib/composio/agency";

/**
 * Brancher — ou rebrancher — LinkedIn et TikTok Ads depuis Connexions.
 *
 * L'autorisation vit chez Composio, mais **le lien se demande ici**, avec la
 * clé du projet de l'application : un compte branché depuis le tableau de
 * bord de Composio atterrit dans l'espace personnel, que l'application ne
 * voit pas (vécu le 1/10/2026 — LinkedIn rebranché et TikTok Ads ajouté par
 * ce chemin, l'application lisait toujours l'ancien jeton révoqué).
 *
 * Composio ramène ensuite sur `/api/social/composio/inventaire`, qui importe
 * les pages ou les comptes publicitaires et relance la collecte de l'espace.
 *
 * Module interne : 404 et non 403 à qui n'est pas propriétaire.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const workspaceSlug = url.searchParams.get("espace");
  const reseau = url.searchParams.get("reseau") ?? "";
  if (!workspaceSlug || !isAgencyToolkit(reseau)) {
    return new NextResponse(null, { status: 404 });
  }

  // Brancher engage l'inventaire de l'agence : réservé à l'agence.
  const workspace = await getWorkspace(workspaceSlug);
  if (!workspace || workspace.role !== "owner") {
    return new NextResponse(null, { status: 404 });
  }

  const asked = url.searchParams.get("retour") ?? "";
  const retour = asked.startsWith(`/espace/${workspaceSlug}/`)
    ? asked
    : `/espace/${workspaceSlug}`;

  /* L'origine de la requête et non `NEXT_PUBLIC_SITE_URL` : sur une preview,
     la variable désigne la production, et Composio ramènerait sur une route
     qui n'y existe pas encore. */
  const callback = new URL("/api/social/composio/inventaire", url.origin);
  callback.searchParams.set("espace", workspaceSlug);
  callback.searchParams.set("reseau", reseau);
  callback.searchParams.set("retour", retour);
  callback.searchParams.set("branche", "1");

  try {
    const redirectUrl = await startAgencyConnection({
      toolkit: reseau,
      callbackUrl: callback.toString(),
    });
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    const back = new URL(retour, url.origin);
    back.searchParams.set(
      "erreur",
      `Lien ${AGENCY_TOOLKIT_LABELS[reseau]} indisponible : ${(error as Error).message}`,
    );
    return NextResponse.redirect(back);
  }
}
