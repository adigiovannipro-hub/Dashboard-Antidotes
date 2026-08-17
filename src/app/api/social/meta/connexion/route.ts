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
  const url = new URL(request.url);
  const params = url.searchParams;
  const workspaceSlug = params.get("espace");
  if (!workspaceSlug) return new NextResponse(null, { status: 404 });

  /*
   * Le départ doit avoir lieu **sur le domaine où Meta reviendra**.
   *
   * `redirectUri()` est construite sur `NEXT_PUBLIC_SITE_URL` — c'est aussi
   * l'URL déclarée dans la console Meta, elle ne peut pas varier. Or le
   * cookie d'état, lui, se pose sur le domaine qui répond : parti depuis une
   * autre adresse du même déploiement (URL de prévisualisation, alias de
   * branche, domaine sans `www`), il n'existe pas au retour et le callback
   * refuse un état qu'il ne peut pas vérifier. On rebondit donc d'abord sur
   * l'adresse canonique.
   */
  const canonical = new URL(publicEnv.NEXT_PUBLIC_SITE_URL);
  if (url.host !== canonical.host) {
    const target = new URL(url.pathname + url.search, canonical);
    return NextResponse.redirect(target);
  }

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
    // `lax` et non `strict` : le retour est une navigation venue de
    // facebook.com, et `strict` retiendrait le cookie exactement là.
    sameSite: "lax",
    /* Racine et non le chemin de la route : le préfixe suffisait en théorie,
       mais le moindre écart de chemin fait disparaître le cookie et le retour
       échoue sans rien dire. Le contenu est un état à usage unique, `httpOnly`
       et vérifié à temps constant — l'élargir ne coûte rien. */
    path: "/",
    /* Une demi-heure : le consentement Meta demande parfois de se connecter,
       de choisir des Pages, de lire un avertissement. Dix minutes se sont
       montrées trop courtes dès qu'un dialogue partait de travers. */
    maxAge: 1800,
  });

  return NextResponse.redirect(
    buildConsentUrl({ redirectUri: redirectUri(), state }),
  );
}
