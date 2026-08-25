import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getViewer, getWorkspace } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { serializeTokens } from "@/lib/connectors/youtube/credentials";
import { exchangeCode, listChannels, YOUTUBE_SCOPES } from "@/lib/social/youtube";
import { createAdminClient } from "@/lib/supabase/server";
import { YOUTUBE_STATE_COOKIE, redirectUri } from "../route";
import { isDirectConnectEnabled } from "@/lib/social/direct-connect";

/**
 * Retour de Google : on échange le code, puis on enregistre les chaînes que le
 * compte autorisé administre.
 *
 * Le jeton de rafraîchissement est la pièce maîtresse : sans lui, la
 * connexion meurt au bout d'une heure. C'est `access_type=offline` +
 * `prompt=consent` au départ qui le garantit, et il est stocké chiffré à côté
 * de la chaîne, jamais dans l'inventaire lui-même.
 */

export const dynamic = "force-dynamic";

function back(path: string, message: string, ok = false): NextResponse {
  const url = new URL(path, publicEnv.NEXT_PUBLIC_SITE_URL);
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
  // Bascule Composio : le chemin direct est fermé. 404 et non 403 — la route
  // n'a plus lieu d'être, il n'y a pas de droit à réclamer.
  if (!isDirectConnectEnabled()) return new NextResponse(null, { status: 404 });

  const url = new URL(request.url);
  const store = await cookies();
  const cookie = store.get(YOUTUBE_STATE_COOKIE)?.value;

  // Sans le cookie, on ignore de quel espace partait la demande : impossible
  // de savoir où renvoyer, et rien n'a été enregistré.
  if (!cookie) return new NextResponse(null, { status: 400 });
  store.delete(YOUTUBE_STATE_COOKIE);

  const [expected, workspaceSlug, path] = cookie.split("|");
  const received = url.searchParams.get("state") ?? "";
  if (!expected || !workspaceSlug || !path || !statesMatch(received, expected)) {
    return new NextResponse(null, { status: 400 });
  }

  // Google renvoie `error=access_denied` quand l'utilisateur refuse.
  const denied = url.searchParams.get("error");
  if (denied) {
    return back(
      path,
      denied === "access_denied"
        ? "Autorisation refusée : rien n'a été branché."
        : `Google a refusé la connexion (${denied}).`,
    );
  }

  const code = url.searchParams.get("code");
  if (!code) return back(path, "Google n'a pas rendu de code d'autorisation.");

  try {
    const [viewer, workspace] = await Promise.all([
      getViewer(),
      getWorkspace(workspaceSlug),
    ]);
    if (!viewer || !workspace || workspace.role !== "owner") {
      return new NextResponse(null, { status: 404 });
    }

    const tokens = await exchangeCode({ code, redirectUri: redirectUri() });
    if (!tokens.refreshToken) {
      // Sans jeton permanent, la connexion mourrait dans l'heure. Mieux vaut
      // refuser que d'enregistrer un branchement qui cessera seul.
      return back(
        path,
        "Google n'a pas rendu de jeton de rafraîchissement. Retirer l'accès d'Antidotes dans le compte Google, puis relancer la connexion.",
      );
    }

    const channels = await listChannels(tokens.accessToken);
    if (channels.length === 0) {
      return back(
        path,
        "Ce compte Google n'administre aucune chaîne YouTube.",
      );
    }

    const now = new Date().toISOString();
    const rows = channels.map((channel) => ({
      // L'inventaire appartient à l'agence, comme pour Meta.
      org_id: workspace.org_id,
      kind: "youtube" as const,
      external_id: channel.id,
      username: channel.handle,
      display_name: channel.title,
      avatar_url: channel.avatarUrl,
      biography: channel.description,
      followers_count: channel.subscriberCount,
      media_count: channel.videoCount,
      parent_external_id: null,
      status: "connected" as const,
      last_error: null,
      last_synced_at: now,
      connected_by: viewer.user.id,
      updated_at: now,
    }));

    // `createAdminClient` : l'écriture porte des jetons et se fait après une
    // garde d'owner explicite — l'un des trois usages admis.
    const admin = createAdminClient();
    const { data: saved, error } = await admin
      .from("social_accounts")
      .upsert(rows as never, { onConflict: "org_id,kind,external_id" })
      .select("id, external_id");
    if (error) throw new Error(error.message);

    // Le même compte Google autorise toutes ses chaînes : un seul jeu de
    // jetons, recopié pour chacune.
    const blob = serializeTokens(tokens);
    const secrets = ((saved ?? []) as unknown as { id: string }[]).map((row) => ({
      account_id: row.id,
      org_id: workspace.org_id,
      credentials_encrypted: blob,
      token_expires_at: tokens.expiresAt,
      scopes: YOUTUBE_SCOPES,
      updated_at: now,
    }));

    const { error: secretError } = await admin
      .from("social_account_secrets")
      .upsert(secrets as never, { onConflict: "account_id" });
    if (secretError) throw new Error(secretError.message);

    return back(
      path,
      `${rows.length} chaîne${rows.length > 1 ? "s" : ""} YouTube branchée${rows.length > 1 ? "s" : ""}.`,
      true,
    );
  } catch (error) {
    return back(path, (error as Error).message);
  }
}
