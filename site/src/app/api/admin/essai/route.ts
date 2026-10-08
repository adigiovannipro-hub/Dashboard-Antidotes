import { z } from "zod";

import { sendMail } from "@/lib/composio";
import { composioEnabled, env } from "@/lib/env";
import { json, secretMatches } from "@/lib/http/request";
import { bookingConfirmation, leadWelcome } from "@/lib/mail/templates";
import { SITE_URL } from "@/i18n/locale";

export const dynamic = "force-dynamic";

/**
 * L'essai par la vraie chaîne : envoie à une adresse de test les deux
 * courriels que reçoit un prospect, par le code du produit et la boîte
 * réelle. `?cle=…&vers=adresse&langue=fr|en`.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (!secretMatches(url.searchParams.get("cle"), env().ADMIN_SECRET)) return new Response("Introuvable", { status: 404 });
  if (!composioEnabled()) return json({ ok: false, erreur: "COMPOSIO_API_KEY absente." }, 400);
  const to = z.string().email().safeParse(url.searchParams.get("vers"));
  if (!to.success) return json({ ok: false, erreur: "Paramètre `vers` invalide." }, 400);
  const locale = url.searchParams.get("langue") === "en" ? "en" : "fr";
  const start = new Date(Date.now() + 2 * 86_400_000);
  start.setUTCMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60_000);
  const mails = [
    leadWelcome(locale, { firstName: "Test", continueUrl: `${SITE_URL}/?note=1#note` }),
    bookingConfirmation(locale, {
      firstName: "Test",
      start,
      end,
      prospectTimeZone: "Europe/Paris",
      ownerTimeZone: env().OWNER_TIMEZONE,
      meetUrl: "https://meet.google.com/essai-antidotes",
      icsUrl: `${SITE_URL}/api/reservation/00000000000000000000000000000000/ics`,
      googleUrl: "https://calendar.google.com/",
      cancelUrl: `${SITE_URL}/rdv/00000000000000000000000000000000`,
    }),
  ];
  const sent: string[] = [];
  for (const mail of mails) {
    const result = await sendMail({ to: to.data, subject: `[ESSAI] ${mail.subject}`, html: mail.html, text: mail.text });
    sent.push(result.id ?? "sans identifiant");
  }
  return json({ ok: true, envoyes: sent });
}
