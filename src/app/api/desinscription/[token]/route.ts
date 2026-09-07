import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/server";

/**
 * La désinscription — le seul geste qu'un prospect fait sur Antidotes.
 *
 * Route **publique** (`PUBLIC_PATHS`), résolue par le jeton du contact, en
 * `service_role` : la personne qui clique n'a pas de compte, et n'en aura
 * jamais. Un jeton inconnu répond 404 sans rien dire de plus.
 *
 * Deux façons d'arriver ici, toutes deux en POST — un GET suffirait à un
 * robot d'aperçu pour désinscrire quelqu'un qui n'a rien demandé :
 *   • le bouton de la page `/desinscription/[token]` (formulaire) ;
 *   • le geste « Se désabonner » de la messagerie, qui poste
 *     `List-Unsubscribe=One-Click` (RFC 8058) sur l'URL de l'en-tête.
 *
 * L'écriture est idempotente : `opted_out` ne redescend jamais (trigger), un
 * second clic répond la même chose que le premier.
 */

export const dynamic = "force-dynamic";

const TOKEN = /^[0-9a-f]{32}$/;

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN.test(token)) return new NextResponse(null, { status: 404 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("antidotes_contacts")
    .select("id, org_id, prospect_id, opted_out")
    .eq("unsubscribe_token", token)
    .maybeSingle();
  const contact = data as unknown as
    | { id: string; org_id: string; prospect_id: string; opted_out: boolean }
    | null;
  if (!contact) return new NextResponse(null, { status: 404 });

  const contentType = request.headers.get("content-type") ?? "";
  const body = contentType.includes("application/x-www-form-urlencoded")
    ? await request.text().catch(() => "")
    : "";
  const oneClick = body.includes("List-Unsubscribe=One-Click");

  if (!contact.opted_out) {
    const { error } = await admin
      .from("antidotes_contacts")
      .update({ opted_out: true } as never)
      .eq("id", contact.id);
    if (error) {
      return NextResponse.json({ ok: false, error: "Désinscription impossible pour le moment." }, { status: 500 });
    }
    await admin.from("antidotes_interactions").insert({
      org_id: contact.org_id,
      prospect_id: contact.prospect_id,
      contact_id: contact.id,
      type: "opt_out",
      payload: { source: oneClick ? "one_click" : "page" },
    } as never);
  }

  if (oneClick) return NextResponse.json({ ok: true });
  const url = new URL(`/desinscription/${token}?fait=1`, request.url);
  return NextResponse.redirect(url, { status: 303 });
}
