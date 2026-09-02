import "server-only";

import { publicEnv, missingServerEnv, serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { buildOnboardingEmail, onboardingLink } from "./onboarding-email";

/**
 * L'envoi du courriel d'arrivée dans une formation.
 *
 * Deux étapes, et la seconde peut manquer sans que la première soit perdue :
 *
 * 1. **Fabriquer le lien de connexion.** `auth.admin.generateLink` crée le
 *    compte s'il n'existe pas et rend un `hashed_token` — le même mécanisme
 *    que le magic link du formulaire de connexion, sans passer par la boîte
 *    d'envoi de Supabase, dont le quota gratuit est de quelques messages par
 *    heure. On envoie nous-mêmes.
 *
 * 2. **Poster le message.** Par l'API HTTP de Resend, sans dépendance ajoutée :
 *    un `fetch` suffit, et le paquet npm n'apporterait qu'un habillage.
 *    3 000 messages par mois en gratuit, largement au-dessus du besoin.
 *
 * **Sans `RESEND_API_KEY`, rien n'échoue** : le lien est rendu à l'écran, à
 * copier et envoyer à la main. C'est une dégradation prévue, pas subie — et
 * elle laisse le module utilisable le jour de son installation, avant que le
 * domaine d'envoi soit vérifié.
 */

export type OnboardingResult =
  | { ok: true; sent: boolean; link: string }
  | { ok: false; error: string };

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** L'adresse d'expédition par défaut, quand aucune n'est configurée. */
const DEFAULT_FROM = "Antidotes Academy <onboarding@resend.dev>";

export async function sendCourseOnboarding(options: {
  email: string;
  firstName: string | null;
  courseTitle: string;
  courseSlug: string;
  senderName: string;
}): Promise<OnboardingResult> {
  const admin = createAdminClient();

  // `invite` sur un compte qui existe déjà répond « User already registered » :
  // on tente l'invitation, puis on retombe sur le lien de connexion simple.
  // L'ordre compte — `magiclink` sur une adresse inconnue échoue de son côté.
  let generated = await admin.auth.admin.generateLink({
    type: "invite",
    email: options.email,
  });
  let type = "invite";

  if (generated.error) {
    generated = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: options.email,
    });
    type = "magiclink";
  }

  if (generated.error || !generated.data.properties?.hashed_token) {
    return {
      ok: false,
      error: generated.error?.message ?? "Impossible de fabriquer le lien d'accès.",
    };
  }

  const link = onboardingLink({
    siteUrl: publicEnv.NEXT_PUBLIC_SITE_URL,
    tokenHash: generated.data.properties.hashed_token,
    type,
    courseSlug: options.courseSlug,
  });

  if (missingServerEnv("RESEND_API_KEY").length > 0) {
    return { ok: true, sent: false, link };
  }

  const { RESEND_API_KEY } = serverEnv("RESEND_API_KEY");
  const message = buildOnboardingEmail({
    firstName: options.firstName,
    courseTitle: options.courseTitle,
    link,
    senderName: options.senderName,
  });

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.ACADEMY_EMAIL_FROM || DEFAULT_FROM,
        to: [options.email],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });

    if (!response.ok) {
      // Le lien reste bon : l'inscription est faite, seul le facteur a
      // échoué. On le remonte plutôt que de le perdre.
      const detail = await response.text();
      return {
        ok: true,
        sent: false,
        link,
        // Pas de champ d'erreur ici : l'appelant affiche le lien et dit que
        // l'envoi n'a pas abouti. Le détail va au journal du serveur.
        ...logDelivery(response.status, detail),
      };
    }
  } catch (error) {
    return { ok: true, sent: false, link, ...logDelivery(0, String(error)) };
  }

  return { ok: true, sent: true, link };
}

/** Trace le refus côté serveur sans rien ajouter à la réponse. */
function logDelivery(status: number, detail: string): Record<string, never> {
  console.error(`[academy] envoi du courriel refusé (${status}) : ${detail}`);
  return {} as Record<string, never>;
}
