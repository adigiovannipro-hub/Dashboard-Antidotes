import { calendarConnected } from "@/lib/booking/calendar";
import { connectLink, findAccount } from "@/lib/composio";
import { composioEnabled, env } from "@/lib/env";
import { json, secretMatches } from "@/lib/http/request";
import { SITE_URL } from "@/i18n/locale";

export const dynamic = "force-dynamic";

/**
 * Le branchement de l'agenda Google, réservé au propriétaire : avec la clé
 * d'administration, la route demande un lien d'autorisation à Composio et y
 * envoie — une fois l'accord donné, l'agenda est lu et écrit. Sans Composio,
 * elle dit ce qui manque. `?etat=1` ne fait que décrire l'état.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (!secretMatches(url.searchParams.get("cle"), env().ADMIN_SECRET)) return new Response("Introuvable", { status: 404 });
  if (!composioEnabled()) {
    return json({ ok: false, etat: "COMPOSIO_API_KEY absente : poser la clé du projet Composio dans les variables Vercel, puis rouvrir ce lien." });
  }
  if (url.searchParams.get("etat")) {
    const [calendar, gmail] = await Promise.all([calendarConnected(), findAccount("gmail").catch(() => null)]);
    return json({ ok: true, agenda: calendar ? "branché" : "à brancher", gmail: gmail ? "branché" : "à brancher" });
  }
  try {
    const link = await connectLink("googlecalendar", `${SITE_URL}/api/admin/calendrier?cle=${encodeURIComponent(env().ADMIN_SECRET)}&etat=1`);
    return Response.redirect(link, 302);
  } catch (error) {
    return json({ ok: false, etat: error instanceof Error ? error.message : String(error) }, 500);
  }
}
