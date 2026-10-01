import "server-only";

import { headers } from "next/headers";

import { publicEnv } from "@/lib/env";

/**
 * Le domaine sur lequel renvoyer un lien d'accès : celui d'où la demande est
 * partie.
 *
 * `NEXT_PUBLIC_SITE_URL` vaut `http://localhost:3000` par défaut, et un
 * environnement où elle n'est pas posée renvoyait les liens vers localhost —
 * c'est pour cela que l'ancien formulaire de connexion lisait déjà l'origine
 * du navigateur. Côté serveur, l'origine est dans les en-têtes de la
 * requête ; la variable ne sert que de dernier recours.
 */
export async function siteOrigin(): Promise<string> {
  const list = await headers();
  const origin = list.get("origin");
  if (origin && /^https?:\/\/[^/]+$/.test(origin)) return origin;

  const host = list.get("x-forwarded-host") ?? list.get("host");
  if (host && /^[a-z0-9.-]+(:\d+)?$/i.test(host)) {
    const proto = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }

  return publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
}
