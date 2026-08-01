import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicEnv } from "@/lib/env";

/**
 * Chemins accessibles sans session. Tout le reste redirige vers /login.
 *
 * `/api/cron` n'est pas une exception à l'authentification, c'en est une autre
 * forme : ces routes sont appelées par un ordonnanceur, qui n'a pas de session,
 * et se protègent elles-mêmes en comparant `CRON_SECRET` à temps constant. Les
 * laisser ici sans cette note inviterait à les croire ouvertes.
 */
const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/auth/erreur",
  "/partage",
  "/api/cron",
];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  );
}

/**
 * Rafraîchit la session à chaque requête et ferme l'application aux visiteurs
 * non authentifiés. C'est une barrière de confort : l'isolation réelle des
 * données reste assurée par la RLS, côté base.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // `getUser()` et non `getSession()` : seul le premier revalide le jeton
  // auprès de Supabase. Se fier au cookie seul serait usurpable.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("suivant", pathname);
    return NextResponse.redirect(redirect);
  }

  if (user && pathname === "/login") {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  return response;
}
