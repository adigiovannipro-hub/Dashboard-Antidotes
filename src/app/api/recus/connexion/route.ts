import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { publicEnv } from "@/lib/env";
import { getReceiptsContext } from "@/lib/recus/access";
import { buildConsentUrl } from "@/lib/recus/gmail";

/**
 * Départ du branchement d'une boîte Gmail.
 *
 * L'état anti-rejeu est tiré au hasard et déposé dans un cookie `httpOnly` ; le
 * retour vérifie qu'il correspond. Sans cela, un tiers pourrait faire aboutir
 * un consentement sur *son* compte Google dans *votre* session, et le module
 * lirait sa boîte en croyant lire la vôtre.
 */

export const dynamic = "force-dynamic";

export const OAUTH_STATE_COOKIE = "recus_oauth_state";

export function redirectUri(): string {
  return `${publicEnv.NEXT_PUBLIC_SITE_URL}/api/recus/connexion/callback`;
}

export async function GET() {
  const context = await getReceiptsContext();
  if (!context?.canDecide) {
    // 404 et non 403 : le module ne se signale pas à qui n'y a pas droit.
    return new NextResponse(null, { status: 404 });
  }

  const state = randomBytes(32).toString("base64url");

  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/recus/connexion",
    maxAge: 600,
  });

  return NextResponse.redirect(buildConsentUrl({ redirectUri: redirectUri(), state }));
}
