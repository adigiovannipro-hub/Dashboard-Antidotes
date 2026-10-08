import "server-only";

import { publicEnv, serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";

import { isDueNow } from "./readiness";

/**
 * Lance le passage de publication sur-le-champ quand une ligne vient d'être
 * armée alors que la fenêtre du jour est déjà ouverte.
 *
 * `pg_cron` n'appelle la route qu'à 16h00 à Bali : une ligne passée
 * « Programmé » à 17h, ou redatée à aujourd'hui depuis « Mon travail »,
 * attendait sinon les filets de GitHub, qui arrivent des heures en retard —
 * parfois après minuit à Paris, donc le lendemain. Ici, l'action du planning
 * appelle la même route que `pg_cron`, avec le même jeton : même verrou, même
 * heure limite, même relais. Rien de neuf n'est publié par ce chemin, il ne
 * fait qu'avancer l'heure du passage.
 *
 * Appelé dans `after()` : un échec s'écrit au journal et ne remonte jamais à
 * l'écran — la ligne reste armée, le passage suivant la reprend.
 */
export async function triggerPublicationIfDue(subjectIds: string[]): Promise<void> {
  if (subjectIds.length === 0) return;
  const now = new Date();

  try {
    const { data, error } = await createAdminClient()
      .from("planning_subjects")
      .select("status, scheduled_on")
      .in("id", subjectIds)
      .is("deleted_at", null)
      .is("archived_at", null);
    if (error) throw new Error(`Lecture des sujets : ${error.message}`);

    const rows = (data ?? []) as unknown as { status: string; scheduled_on: string | null }[];
    if (!rows.some((row) => isDueNow(row, now))) return;

    await callPublicationRoute();
  } catch (error) {
    console.error("[publication immédiate]", (error as Error).message);
  }
}

/**
 * « Publier » depuis le planning : un sujet, tous les réseaux de son couloir,
 * tout de suite. Un reel met une à deux minutes à s'encoder chez Instagram —
 * plus que ce qu'une action serveur du planning a devant elle (60 s) — donc
 * le travail part dans la route, qui a cinq minutes et rend la main aussitôt.
 * Lève une erreur si la route refuse : l'écran doit le dire.
 */
export async function requestSubjectPublication(subject: {
  subjectId: string;
  workspaceId: string;
}): Promise<void> {
  await callPublicationRoute(subject);
}

async function callPublicationRoute(body?: { subjectId: string; workspaceId: string }) {
  const { PUBLICATION_CRON_SECRET } = serverEnv("PUBLICATION_CRON_SECRET");
  const response = await fetch(new URL("/api/cron/publier", publicEnv.NEXT_PUBLIC_SITE_URL), {
    method: "POST",
    headers: {
      authorization: `Bearer ${PUBLICATION_CRON_SECRET}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Route de publication : ${response.status}`);
}
