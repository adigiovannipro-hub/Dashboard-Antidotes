import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getWorkspace } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { buildConsentUrl, youtubeConfigured } from "@/lib/social/youtube";

/**
 * Départ du branchement YouTube d'un espace client.
 *
 * Même mécanique que Meta, et pour les mêmes raisons : état anti-rejeu dans
 * un cookie `httpOnly`, départ forcé sur le domaine canonique — celui où
 * Google reviendra —, chemin de retour borné à l'espace visé.
 *
 * Une différence de fond avec Meta : Google autorise **un compte Google**, et
 * ce compte administre une ou plusieurs chaînes. L'autorisation se redemande
 * donc client par client, là où un seul login Meta couvre toute l'agence.
 */

export const dynamic = "force-dynamic";

export const YOUTUBE_STATE_COOKIE = "social_youtube_state";

export function redirectUri(): string {
  return `${publicEnv.NEXT_PUBLIC_SITE_URL}/api/social/youtube/connexion/callback`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;
  const workspaceSlug = params.get("espace");
  if (!workspaceSlug) return new NextResponse(null, { status: 404 });

  // Le cookie d'état se pose sur le domaine qui répond : parti d'une adresse
  // de prévisualisation, il n'existe pas au retour. On rebondit d'abord.
  const canonical = new URL(publicEnv.NEXT_PUBLIC_SITE_URL);
  if (url.host !== canonical.host) {
    return NextResponse.redirect(new URL(url.pathname + url.search, canonical));
  }

  const asked = params.get("retour") ?? "";
  const back = asked.startsWith(`/espace/${workspaceSlug}/`)
    ? asked
    : `/espace/${workspaceSlug}/planning`;

  // Brancher un compte engage un jeton : réservé à l'agence. 404 et non 403.
  const workspace = await getWorkspace(workspaceSlug);
  if (!workspace || workspace.role !== "owner") {
    return new NextResponse(null, { status: 404 });
  }

  if (!youtubeConfigured()) {
    const target = new URL(back, publicEnv.NEXT_PUBLIC_SITE_URL);
    target.searchParams.set(
      "erreur",
      "Identifiants Google absents — voir docs/youtube-connexion.md.",
    );
    return NextResponse.redirect(target);
  }

  const state = randomBytes(32).toString("base64url");
  const store = await cookies();
  store.set(YOUTUBE_STATE_COOKIE, `${state}|${workspaceSlug}|${back}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // `lax` : le retour est une navigation venue de google.com.
    sameSite: "lax",
    path: "/",
    maxAge: 1800,
  });

  return NextResponse.redirect(
    buildConsentUrl({ redirectUri: redirectUri(), state }),
  );
}
