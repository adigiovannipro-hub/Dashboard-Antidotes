import "server-only";

import { timingSafeEqual } from "node:crypto";

import { rateCheck } from "@/lib/db";

/** L'adresse du visiteur telle que Vercel la transmet, sinon « inconnue ». */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "inconnue";
}

/** Un seau par adresse et par geste ; au-delà de la limite, on refuse. */
export async function allow(request: Request, gesture: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    return await rateCheck(`${gesture}:${clientIp(request)}`, limit, windowSeconds);
  } catch {
    // La base indisponible n'est pas une raison de refuser : la route échouera
    // d'elle-même plus loin, avec une erreur plus utile.
    return true;
  }
}

/** Lit un corps JSON, `null` s'il est absent ou illisible. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Comparaison à temps constant d'un secret porté par l'appel. */
export function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
