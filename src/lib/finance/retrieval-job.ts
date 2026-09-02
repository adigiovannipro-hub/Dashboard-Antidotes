import "server-only";

import { timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/lib/env";

/**
 * La garde des routes du passage extérieur — `/api/finance/invoices/*`.
 *
 * Même posture qu'un cron : un `Bearer` comparé à `CRON_SECRET` en temps
 * constant. Un `===` fuiterait, par sa durée, combien de caractères de tête
 * sont corrects. Le passage n'a pas de session, donc pas de RLS : les routes
 * écrivent avec la clé de service, et cette garde est tout ce qui les ferme.
 */
export function authorizedRetrievalJob(request: Request): boolean {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;

  const provided = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(serverEnv("CRON_SECRET").CRON_SECRET);
  // `timingSafeEqual` exige deux tampons de même taille ; une longueur
  // différente est déjà un refus, sans rien révéler de plus.
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
