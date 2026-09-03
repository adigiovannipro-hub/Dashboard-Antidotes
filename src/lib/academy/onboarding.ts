import "server-only";

import { publicEnv } from "@/lib/env";
import { getGmailTransport } from "@/lib/planning/notify";
import { sendMessage } from "@/lib/recus/gmail";
import { createAdminClient } from "@/lib/supabase/server";
import { buildOnboardingMime, onboardingLink } from "./onboarding-email";

/**
 * L'envoi du courriel d'arrivée dans une formation.
 *
 * Deux étapes, et la seconde peut échouer sans que la première soit perdue :
 *
 * 1. **Fabriquer le lien de connexion.** `auth.admin.generateLink` crée le
 *    compte s'il n'existe pas et rend un `hashed_token` — le même mécanisme
 *    que le magic link du formulaire de connexion, sans passer par la boîte
 *    d'envoi de Supabase, dont le quota gratuit est de quelques messages par
 *    heure. On envoie nous-mêmes.
 *
 * 2. **Poster le message par la boîte Gmail des Reçus**, comme les retours du
 *    Planning et l'envoi en validation. C'est le transport de tout courriel
 *    sortant du produit : aucune clé de plus, aucun domaine à faire vérifier,
 *    aucun quota d'un service tiers — et surtout, le message part de l'adresse
 *    de l'agence, celle à laquelle une élève peut répondre.
 *
 * **Si aucune boîte n'est connectée, rien n'échoue** : le lien est rendu à
 * l'écran, à copier et envoyer à la main. C'est une dégradation prévue, pas
 * subie, et elle laisse le module utilisable même si le branchement Gmail
 * saute.
 */

export type OnboardingResult =
  | { ok: true; sent: boolean; link: string }
  | { ok: false; error: string };

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

  const gmail = await getGmailTransport();
  if (!gmail.ok) {
    // L'inscription est écrite, le lien est bon : seul le facteur manque.
    console.error(`[academy] courriel non envoyé : ${gmail.reason}`);
    return { ok: true, sent: false, link };
  }

  try {
    await sendMessage({
      accessToken: gmail.transport.accessToken,
      mime: buildOnboardingMime({
        from: gmail.transport.from,
        to: options.email,
        firstName: options.firstName,
        courseTitle: options.courseTitle,
        link,
        senderName: options.senderName,
      }),
    });
  } catch (error) {
    console.error(`[academy] envoi refusé par Gmail : ${(error as Error).message}`);
    return { ok: true, sent: false, link };
  }

  return { ok: true, sent: true, link };
}
