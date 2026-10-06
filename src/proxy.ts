import { NextResponse, type NextRequest } from "next/server";

import { isVitrineHost, routeVitrine, VITRINE_PAGE } from "@/lib/domains";
import { publicEnv } from "@/lib/env";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  /* La vitrine passe avant la session : elle ne sert que des pages publiques,
     et un aller-retour Supabase par visite n'y vérifierait rien. */
  if (isVitrineHost(request.headers.get("host"))) {
    const route = routeVitrine(
      request.nextUrl.pathname,
      request.nextUrl.search,
      publicEnv.NEXT_PUBLIC_SITE_URL,
    );
    if (route.kind === "page") {
      return NextResponse.rewrite(new URL(VITRINE_PAGE, request.url));
    }
    if (route.kind === "served") return NextResponse.next();
    // 307 et non 308 : la landing reprendra un jour certains de ces chemins.
    return NextResponse.redirect(route.url, 307);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    /* Tout sauf les assets statiques et les images, dont le passage par le
       proxy ne ferait qu'ajouter de la latence.

       `.txt` en fait partie, et pas seulement pour la latence : c'est la
       forme des **fichiers de vérification de propriété** que réclament les
       plateformes (TikTok, Google) pour prouver qu'un domaine est bien à
       nous. Servis derrière le proxy, ils redirigeraient vers `/login` le
       jour où l'accès se referme — et la vérification tomberait sans
       prévenir, puisque ces plateformes la rejouent périodiquement. */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)",
  ],
};
