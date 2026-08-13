import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getWorkspace } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { buildConsentUrl, metaConfigured } from "@/lib/social/meta";

/**
 * Départ du branchement Meta d'un espace client.
 *
 * L'état anti-rejeu est tiré au hasard et déposé dans un cookie `httpOnly` ; le
 * retour vérifie qu'il correspond. Sans cela, un tiers pourrait faire aboutir
 * un consentement sur *ses* Pages dans *votre* session, et le planning
 * publierait chez lui en croyant publier chez le client.
 *
 * L'espace visé et le chemin de retour voyagent dans le même cookie : ni l'un
 * ni l'autre ne peut être changé en cours de route par l'URL de retour.
 */

export const dynamic = "force-dynamic";

export const META_STATE_COOKIE = "social_meta_state";

export function redirectUri(): string {
  return `${publicEnv.NEXT_PUBLIC_SITE_URL}/api/social/meta/connexion/callback`;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const workspaceSlug = params.get("espace");
  if (!workspaceSlug) return new NextResponse(null, { status: 404 });

  // On revient là d'où l'on vient — le tableau, pas une page d'atterrissage.
  // Le chemin est borné à l'espace visé : un `retour` fabriqué ne peut pas
  // faire rebondir ailleurs.
  const asked = params.get("retour") ?? "";
  const back = asked.startsWith(`/espace/${workspaceSlug}/`)
    ? asked
    : `/espace/${workspaceSlug}/planning`;

  // Brancher un compte engage un jeton : réservé à l'agence. 404 et non 403 —
  // un client n'apprend pas l'existence de l'écran en s'y heurtant.
  const workspace = await getWorkspace(workspaceSlug);
  if (!workspace || workspace.role !== "owner") {
    return new NextResponse(null, { status: 404 });
  }

  if (!metaConfigured()) {
    const url = new URL(back, publicEnv.NEXT_PUBLIC_SITE_URL);
    url.searchParams.set("erreur", "Application Meta non configurée.");
    return NextResponse.redirect(url);
  }

  const state = randomBytes(32).toString("base64url");

  const store = await cookies();
  store.set(META_STATE_COOKIE, `${state}|${workspaceSlug}|${back}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/social/meta/connexion",
    maxAge: 600,
  });

  return NextResponse.redirect(
    buildConsentUrl({ redirectUri: redirectUri(), state }),
  );
}
