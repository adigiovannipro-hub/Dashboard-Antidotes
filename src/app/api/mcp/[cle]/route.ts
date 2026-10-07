import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { missingServerEnv, serverEnv } from "@/lib/env";
import { handleBody } from "@/lib/mcp/protocol";
import { MCP_TOOLS } from "@/lib/mcp/tools";

/**
 * Le connecteur MCP du tableau de bord, pour Claude (claude.ai → Paramètres →
 * Connecteurs → Ajouter un connecteur personnalisé).
 *
 * L'accès tient dans l'adresse : `/api/mcp/<MCP_SECRET>`. Un connecteur
 * personnalisé n'envoie aucun en-tête choisi par l'utilisateur, et un serveur
 * OAuth complet — découverte, enregistrement dynamique, jetons — serait un
 * chantier pour un seul utilisateur. La clé fait au moins 32 caractères,
 * elle se compare à temps constant, et la faire tourner sur Vercel coupe
 * l'accès au prochain appel. Mauvaise clé ou clé absente : 404, comme un
 * module interne — rien n'indique qu'il y a quelque chose ici.
 */

export const dynamic = "force-dynamic";
// sharp (lire_visuels) est un module natif : jamais en Edge.
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(key: string): boolean {
  if (missingServerEnv("MCP_SECRET").length > 0) return false;
  const expected = Buffer.from(serverEnv("MCP_SECRET").MCP_SECRET);
  const provided = Buffer.from(key);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

type Params = Promise<{ cle: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  const { cle } = await params;
  if (!authorized(cle)) return new NextResponse(null, { status: 404 });

  const response = await handleBody(await request.text(), MCP_TOOLS);
  // Que des notifications : rien à répondre, accusé de réception.
  if (response === null) return new NextResponse(null, { status: 202 });
  return NextResponse.json(response);
}

/** Pas de flux serveur → client : le transport le permet, le connecteur s'en passe. */
export async function GET(_request: Request, { params }: { params: Params }) {
  const { cle } = await params;
  if (!authorized(cle)) return new NextResponse(null, { status: 404 });
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
