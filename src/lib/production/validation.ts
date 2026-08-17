import "server-only";

import { publicEnv } from "@/lib/env";
import { buildValidationMime } from "@/lib/planning/notify-mime";
import { getGmailTransport } from "@/lib/planning/notify";
import { sendMessage } from "@/lib/recus/gmail";
import { monthLabel } from "@/lib/reporting/period";
import { createAdminClient } from "@/lib/supabase/server";
import { listWorkspacePartners } from "@/lib/workspaces/queries";

/**
 * « Envoyer en validation » — le geste qui remplace l'ancienne phase
 * Programmation de la carte cockpit.
 *
 * La programmation n'avait plus rien à programmer : la publication part toute
 * seule à 16h dès qu'un post est validé et daté. Ce qui manquait au cycle,
 * c'est le moment où le **client** entre en scène : quand les contenus sont
 * rédigés, on le prévient que son planning est prêt à relire. Un courriel
 * depuis la boîte de l'agence — celle que le client connaît — et la phase se
 * clôt sur l'envoi, pas sur une promesse.
 */

export type ValidationOutcome = {
  sent: string[];
  failed: string[];
  reason?: string;
};

export async function sendPlanningValidation(options: {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  orgId: string;
  /** Premier jour du mois cible, `YYYY-MM-01` — celui de la carte. */
  targetMonth: string;
}): Promise<ValidationOutcome> {
  const partners = await listWorkspacePartners(options.workspaceId);
  const recipients = [
    ...new Set(
      partners
        .map((partner) => partner.email)
        .filter((email) => email.includes("@")),
    ),
  ];

  if (recipients.length === 0) {
    return {
      sent: [],
      failed: [],
      reason:
        "Aucun partenaire invité sur cet espace — inviter le client d'abord, depuis les trois points du rail.",
    };
  }

  const gmail = await getGmailTransport();
  if (!gmail.ok) {
    return { sent: [], failed: recipients, reason: gmail.reason };
  }

  const label = monthLabel(options.targetMonth.slice(0, 7));
  const link = `${publicEnv.NEXT_PUBLIC_SITE_URL}/espace/${options.workspaceSlug}/planning`;

  const sent: string[] = [];
  const failed: string[] = [];
  let lastError: string | undefined;

  for (const recipient of recipients) {
    try {
      await sendMessage({
        accessToken: gmail.transport.accessToken,
        mime: buildValidationMime({
          from: gmail.transport.from,
          to: recipient,
          workspaceName: options.workspaceName,
          monthLabel: label,
          link,
        }),
      });
      sent.push(recipient);
    } catch (error) {
      failed.push(recipient);
      lastError = (error as Error).message;
    }
  }

  // La phase ne se clôt que si au moins un courriel est parti : un envoi
  // entièrement raté n'est pas une validation demandée.
  if (sent.length > 0) {
    const admin = createAdminClient();
    const { error } = await admin.from("client_phases").upsert(
      {
        org_id: options.orgId,
        workspace_id: options.workspaceId,
        phase: "programmation",
        target_month: options.targetMonth,
        status: "done",
        completed_at: new Date().toISOString(),
      } as never,
      { onConflict: "workspace_id,phase,target_month" },
    );
    if (error) {
      return {
        sent,
        failed,
        reason: `Courriel parti, mais la phase n'a pas pu être clôturée : ${error.message}`,
      };
    }
  }

  return {
    sent,
    failed,
    reason: sent.length === 0 ? lastError : undefined,
  };
}
