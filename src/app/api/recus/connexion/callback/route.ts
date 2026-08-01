import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { publicEnv } from "@/lib/env";
import { encryptSecret } from "@/lib/moderation/crypto";
import { getReceiptsContext } from "@/lib/recus/access";
import { exchangeCode, getConnectedAddress, GMAIL_SCOPES } from "@/lib/recus/gmail";
import { createAdminClient } from "@/lib/supabase/server";
import { DEFAULT_SOURCE_SETTINGS } from "@/lib/recus/types";
import { OAUTH_STATE_COOKIE, redirectUri } from "../route";

/** Retour de Google : on échange le code, on chiffre, on enregistre la boîte. */

export const dynamic = "force-dynamic";

function back(message: string, ok = false): NextResponse {
  const url = new URL("/entreprise/recus", publicEnv.NEXT_PUBLIC_SITE_URL);
  url.searchParams.set(ok ? "connecte" : "erreur", message);
  return NextResponse.redirect(url);
}

function statesMatch(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const context = await getReceiptsContext();
  if (!context?.canDecide) return new NextResponse(null, { status: 404 });

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error");

  if (denied) return back("Connexion refusée côté Google.");
  if (!code || !state) return back("Réponse de Google incomplète.");

  const store = await cookies();
  const expected = store.get(OAUTH_STATE_COOKIE)?.value;
  store.delete(OAUTH_STATE_COOKIE);

  if (!expected || !statesMatch(state, expected)) {
    return back("Session de connexion expirée. Recommencer.");
  }

  try {
    const tokens = await exchangeCode({ code, redirectUri: redirectUri() });

    /* Sans refresh token, la connexion ne survivrait pas à l'heure qui vient.
       Cela arrive quand le compte a déjà autorisé l'application : la parade est
       `prompt=consent` côté demande, mais mieux vaut échouer clairement ici que
       d'enregistrer une boîte qui cessera de fonctionner sans prévenir. */
    if (!tokens.refreshToken) {
      return back(
        "Google n'a pas renvoyé de jeton de rafraîchissement. Révoquer l'accès dans le compte Google, puis recommencer.",
      );
    }

    const missing = GMAIL_SCOPES.filter((scope) => !tokens.scopes.includes(scope));
    if (missing.length > 0) {
      return back(
        "Toutes les autorisations n'ont pas été accordées : la lecture et l'envoi sont tous deux nécessaires.",
      );
    }

    const address = await getConnectedAddress(tokens.accessToken);

    const admin = createAdminClient();
    const { error } = await admin.from("receipt_sources").upsert(
      {
        org_id: context.orgId,
        provider: "gmail",
        email_address: address,
        credentials_encrypted: encryptSecret(tokens.refreshToken),
        granted_scopes: tokens.scopes,
        token_expires_at: tokens.expiresAt.toISOString(),
        status: "connected",
        last_error: null,
        settings: DEFAULT_SOURCE_SETTINGS as never,
      } as never,
      { onConflict: "org_id,email_address" },
    );
    if (error) return back(`Enregistrement impossible : ${error.message}`);

    await admin.from("receipt_events").insert({
      org_id: context.orgId,
      action: "source.connected",
      after: { email: address } as never,
    });

    return back(address, true);
  } catch (error) {
    return back(error instanceof Error ? error.message : "Connexion impossible.");
  }
}
