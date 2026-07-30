import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Point d'atterrissage du magic link.
 *
 * Deux formes sont acceptées :
 *   • `?code=…` — flux PKCE, quand le lien est ouvert dans le navigateur qui a
 *     demandé la connexion (le vérificateur est dans ses cookies) ;
 *   • `?token_hash=…&type=…` — vérification directe, qui fonctionne même si le
 *     lien est ouvert ailleurs : sur le téléphone alors que la demande venait
 *     de l'ordinateur, par exemple.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("suivant") ?? "/";

  const supabase = await createClient();

  let failed: string | null = null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) failed = "lien-invalide";
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) failed = "lien-invalide";
  } else {
    failed = "code-manquant";
  }

  if (failed) {
    return NextResponse.redirect(`${origin}/auth/erreur?raison=${failed}`);
  }

  // `next` vient de l'URL : on n'accepte qu'un chemin interne, jamais une
  // redirection vers un domaine tiers.
  const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return NextResponse.redirect(`${origin}${destination}`);
}
