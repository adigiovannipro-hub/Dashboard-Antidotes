import "server-only";

import { randomUUID } from "node:crypto";

import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { createGmailMailer } from "./mailer";
import { runSequencesPassage, type PassageReport } from "./passage";
import { createObserver } from "./personalize";
import { createPassageStore } from "./store";

/**
 * Un passage complet, tel que le script horaire et la route « Passer
 * maintenant » l'exécutent : la boîte Gmail des Reçus, l'observateur Claude
 * s'il a sa clé, la base en `service_role`.
 */
export async function runSequencesPassageNow(
  options: { limits?: { threads?: number; personalize?: number; send?: number } } = {},
): Promise<PassageReport & { mailbox: string | null }> {
  const admin = createAdminClient();
  const gmail = await createGmailMailer();
  const report = await runSequencesPassage({
    store: createPassageStore(admin),
    mailer: gmail.ok ? gmail.mailer : null,
    observer: createObserver(),
    siteUrl: publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, ""),
    now: () => new Date(),
    uuid: () => randomUUID(),
    limits: options.limits,
  });
  if (!gmail.ok && report.blockedBy === "Aucune boîte Gmail connectée.") {
    report.blockedBy = gmail.reason;
  }
  return { ...report, mailbox: gmail.ok ? gmail.mailer.ownAddress : null };
}
