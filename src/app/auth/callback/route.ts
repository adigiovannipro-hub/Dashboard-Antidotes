import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { claimEnrollments } from "@/lib/academy/claim";
import { createSessionClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Point d'atterrissage du magic link.
 *
 * Deux formes sont acceptées :
 *   • `?code=…` — flux PKCE, quand le lien est ouvert dans le navigateur qui a
 *     demandé la connexion (le vérificateur est dans ses cookies) ;
 *   • `token_hash` + `type` — vérification directe, qui fonctionne même si le
 *     lien est ouvert ailleurs : sur le téléphone alors que la demande venait
 *     de l'ordinateur, par exemple.
 *
 * Et deux méthodes : le GET des courriels de Supabase, et le POST du bouton
 * de `/auth/acces`, par lequel passent les liens d'accès à une formation —
 * un jeton posté n'est jamais consommé par l'aperçu d'une messagerie.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  return handle(request, {
    code: searchParams.get("code"),
    tokenHash: searchParams.get("token_hash"),
    type: searchParams.get("type"),
    next: searchParams.get("suivant"),
  });
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : null;
  };
  return handle(request, {
    code: null,
    tokenHash: field("token_hash"),
    type: field("type"),
    next: field("suivant"),
  });
}

const OTP_TYPES: readonly EmailOtpType[] = [
  "invite",
  "magiclink",
  "signup",
  "recovery",
  "email_change",
  "email",
];

function asOtpType(value: string | null): EmailOtpType | null {
  return OTP_TYPES.find((candidate) => candidate === value) ?? null;
}

async function handle(
  request: NextRequest,
  input: {
    code: string | null;
    tokenHash: string | null;
    type: string | null;
    next: string | null;
  },
) {
  const { origin } = request.nextUrl;
  const next = input.next ?? "/";
  // `next` vient de l'URL : on n'accepte qu'un chemin interne, jamais une
  // redirection vers un domaine tiers.
  const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const supabase = await createSessionClient();
  const type = asOtpType(input.type);

  let failed: string | null = null;
  let userId: string | null = null;
  let email: string | null = null;

  if (input.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(input.code);
    if (error) failed = "lien-invalide";
    userId = data.user?.id ?? null;
    email = data.user?.email ?? null;
  } else if (input.tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: input.tokenHash,
      type,
    });
    if (error) failed = "lien-invalide";
    userId = data.user?.id ?? null;
    email = data.user?.email ?? null;
  } else {
    failed = "code-manquant";
  }

  if (failed) {
    /* Un second clic sur un lien déjà consommé arrive avec la session que le
       premier a ouverte : dire « déjà utilisé » à quelqu'un de connecté
       serait lui fermer une porte ouverte. On le laisse passer. */
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) return NextResponse.redirect(`${origin}${destination}`, 303);
    return NextResponse.redirect(`${origin}/auth/erreur?raison=${failed}`, 303);
  }

  /* Les inscriptions Academy posées à cette adresse après la création du
     compte attendent encore : `handle_new_user()` ne tourne qu'une fois. La
     connexion est le moment de les raccrocher — avant la redirection, sinon
     la formation répondrait 404 à la personne qui vient d'entrer. */
  if (userId && email) await claimEnrollments({ userId, email });

  // 303 : après un POST, le navigateur doit repartir en GET.
  return NextResponse.redirect(`${origin}${destination}`, 303);
}
