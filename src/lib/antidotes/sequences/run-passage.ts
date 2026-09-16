import "server-only";

import { randomUUID } from "node:crypto";

import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { withoutDemoEnrollments } from "./demo-guard";
import { createGmailMailer } from "./mailer";
import { runSequencesPassage, type PassageReport } from "./passage";
import { createObserver } from "./personalize";
import { createPassageStore } from "./store";

/**
 * Un passage complet, tel que le script GitHub (`pnpm sequences:passage`) et
 * le bouton « Passer maintenant » l'exécutent : la boîte Gmail des Reçus,
 * l'observateur Claude s'il a sa clé, la base en `service_role` — et la garde
 * contre les inscriptions de démonstration (`demo-guard.ts`), **ici** et non
 * dans le seul script : le bouton est le chemin normal pour écrire à un
 * prospect, c'est donc lui qui doit être gardé le premier. Une seule
 * composition, deux appelants.
 */
export async function runSequencesPassageNow(
  options: { limits?: { threads?: number; personalize?: number; send?: number } } = {},
): Promise<PassageReport & { mailbox: string | null; demo: number }> {
  const admin = createAdminClient();
  const gmail = await createGmailMailer();
  // Par identifiant : une même inscription de démo est écartée aux fils
  // comme aux envois, et ne compte qu'une fois.
  const demo = new Set<string>();
  const store = withoutDemoEnrollments(createPassageStore(admin), (bundle) => {
    demo.add(bundle.enrollment.id);
  });
  const report = await runSequencesPassage({
    store,
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
  return { ...report, mailbox: gmail.ok ? gmail.mailer.ownAddress : null, demo: demo.size };
}
