import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getViewer, getWorkspace } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { encryptSecret } from "@/lib/moderation/crypto";
import {
  exchangeCode,
  listAdAccounts,
  listPages,
  META_SCOPES,
} from "@/lib/social/meta";
import type { SocialAccountKind } from "@/lib/social/types";
import { createAdminClient } from "@/lib/supabase/server";
import { META_STATE_COOKIE, redirectUri } from "../route";

/**
 * Retour de Meta : on échange le code, puis on enregistre d'un coup tout ce
 * que le client a autorisé — ses Pages, les comptes Instagram rattachés, ses
 * comptes publicitaires.
 *
 * Un branchement, trois usages : publier sur la Page, publier et prévisualiser
 * sur Instagram, alimenter le Reporting. Redemander l'autorisation trois fois
 * ferait fuir le client à la deuxième.
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
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error_description");

  const store = await cookies();
  const cookie = store.get(META_STATE_COOKIE)?.value;
  store.delete(META_STATE_COOKIE);

  // Espace et chemin de retour viennent du cookie, pas de l'URL : ils n'ont
  // pas pu être changés en route.
  const [expected, slug, path] = (cookie ?? "").split("|");
  if (!expected || !slug || !path) {
    return new NextResponse(null, { status: 404 });
  }

  const viewer = await getViewer();
  const workspace = await getWorkspace(slug);
  if (!viewer || !workspace || workspace.role !== "owner") {
    return new NextResponse(null, { status: 404 });
  }

  if (denied) return back(path, `Connexion refusée côté Meta : ${denied}`);
  if (!code || !state) return back(path, "Réponse de Meta incomplète.");
  if (!statesMatch(state, expected)) {
    return back(path, "Session de connexion expirée. Recommencer.");
  }

  try {
    const tokens = await exchangeCode({ code, redirectUri: redirectUri() });
    const [pages, adAccounts] = await Promise.all([
      listPages(tokens.accessToken),
      listAdAccounts(tokens.accessToken),
    ]);

    if (pages.length === 0 && adAccounts.length === 0) {
      return back(
        path,
        "Aucune Page ni compte publicitaire n'a été partagé pendant l'autorisation.",
      );
    }

    type Upsert = {
      workspace_id: string;
      kind: SocialAccountKind;
      external_id: string;
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
      biography: string | null;
      followers_count: number | null;
      media_count: number | null;
      credentials_encrypted: string | null;
      token_expires_at: string | null;
      scopes: string[];
      parent_external_id: string | null;
      status: "connected";
      last_error: null;
      last_synced_at: string;
      connected_by: string;
      updated_at: string;
    };

    const now = new Date().toISOString();
    const base = {
      workspace_id: workspace.id,
      scopes: META_SCOPES,
      status: "connected" as const,
      last_error: null,
      last_synced_at: now,
      connected_by: viewer.user.id,
      updated_at: now,
      token_expires_at: tokens.expiresAt?.toISOString() ?? null,
    };

    const rows: Upsert[] = [];

    for (const page of pages) {
      rows.push({
        ...base,
        kind: "facebook_page",
        external_id: page.id,
        username: null,
        display_name: page.name,
        avatar_url: null,
        biography: null,
        followers_count: null,
        media_count: null,
        // Le jeton **de Page** : c'est lui qui publie.
        credentials_encrypted: encryptSecret(page.accessToken),
        parent_external_id: null,
      });

      if (page.instagram) {
        rows.push({
          ...base,
          kind: "instagram",
          external_id: page.instagram.id,
          username: `@${page.instagram.username}`,
          display_name: page.instagram.name ?? page.instagram.username,
          avatar_url: page.instagram.profilePictureUrl,
          biography: page.instagram.biography,
          followers_count: page.instagram.followersCount,
          media_count: page.instagram.mediaCount,
          // Instagram publie avec le jeton de sa Page, pas avec le sien.
          credentials_encrypted: encryptSecret(page.accessToken),
          parent_external_id: page.id,
        });
      }
    }

    for (const account of adAccounts) {
      rows.push({
        ...base,
        kind: "meta_ad_account",
        external_id: account.id,
        username: null,
        display_name: account.name,
        avatar_url: null,
        biography: null,
        followers_count: null,
        media_count: null,
        credentials_encrypted: encryptSecret(tokens.accessToken),
        parent_external_id: null,
      });
    }

    // `createAdminClient` : la table porte des jetons, et l'écriture se fait
    // après une garde d'owner explicite — c'est l'un des trois usages admis.
    const admin = createAdminClient();
    const { error } = await admin
      .from("social_accounts")
      .upsert(rows as never, { onConflict: "workspace_id,kind,external_id" });

    if (error) throw new Error(error.message);

    const instagram = rows.filter((row) => row.kind === "instagram").length;
    return back(
      path,
      `${rows.length} compte${rows.length > 1 ? "s" : ""} branché${rows.length > 1 ? "s" : ""}${
        instagram > 0 ? `, dont ${instagram} Instagram` : ""
      }.`,
      true,
    );
  } catch (error) {
    return back(path, (error as Error).message);
  }
}
