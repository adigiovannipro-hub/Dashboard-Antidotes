import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
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
