import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptSecret, encryptSecret } from "@/lib/moderation/crypto";
import {
  getMessageMeta,
  listMessages,
  refreshAccessToken,
} from "@/lib/recus/gmail";

import {
  EMAIL_SKIP_LABELS,
  planEmailTasks,
  type EmailMessage,
} from "./emails";
import type { FathomWorkspace } from "./fathom";

/**
 * L'étape Mails du passage quotidien de « Mon travail ».
 *
 * Elle réutilise la boîte Gmail déjà connectée pour les Reçus — même jeton,
 * même chiffrement — plutôt que de demander un second branchement pour la même
 * adresse. Sans boîte connectée, l'étape ne s'exécute pas et le dit : la
 * dégradation est prévue, pas subie, et le reste du cron continue.
 *
 * La requête porte la règle produit : `is:unread` — un mail ouvert dans Gmail
 * est traité et ne reviendra jamais — borné à la boîte de réception et aux
 * trois derniers jours, car un non-lu de la semaine passée n'est plus une
 * urgence du matin ; l'idempotence par message fait le reste.
 */

const GMAIL_QUERY = "in:inbox is:unread category:primary newer_than:3d";

/** Assez pour un matin chargé, sans déverser une boîte à l'abandon. */
const MAX_MESSAGES = 25;

export type EmailReport = {
  ok: boolean;
  raison?: string;
  boite?: string;
  nonLus?: number;
  planifiees?: number;
  creees?: number;
  ecartees?: Record<string, number>;
  sansClient?: string[];
};

export async function syncEmailTasks(options: {
  admin: SupabaseClient;
  orgId: string;
  today: string;
}): Promise<EmailReport> {
  const { data: sourceRows, error: sourcesError } = await options.admin
    .from("receipt_sources")
    .select("id, email_address, credentials_encrypted")
    .eq("org_id", options.orgId)
    .not("credentials_encrypted", "is", null)
    .limit(1);
  if (sourcesError) {
    throw new Error(`Lecture des boîtes : ${sourcesError.message}`);
  }

  const source = (sourceRows ?? [])[0] as
    | { id: string; email_address: string; credentials_encrypted: string }
    | undefined;
  if (!source) {
    return {
      ok: true,
      raison: "Aucune boîte Gmail connectée (module Reçus) — étape ignorée.",
    };
  }

  // Même précaution que les Reçus : Google ne renvoie pas toujours un nouveau
  // refresh token, on ne remplace le stocké que s'il en arrive un.
  const refreshToken = decryptSecret(source.credentials_encrypted);
  const tokens = await refreshAccessToken(refreshToken);
  if (tokens.refreshToken && tokens.refreshToken !== refreshToken) {
    await options.admin
      .from("receipt_sources")
      .update({ credentials_encrypted: encryptSecret(tokens.refreshToken) })
      .eq("id", source.id);
  }

  const refs = await listMessages({
    accessToken: tokens.accessToken,
    query: GMAIL_QUERY,
    maxResults: MAX_MESSAGES,
  });

  // Les messages déjà transformés en tâche sont écartés avant tout
  // téléchargement d'en-têtes : c'est ce qui rend le passage quotidien gratuit.
  const { data: knownRows, error: knownError } = await options.admin
    .from("work_tasks")
    .select("dedupe_key")
    .eq("org_id", options.orgId)
    .eq("source", "email")
    .in("dedupe_key", refs.map((ref) => `email:${ref.id}`));
  if (knownError) throw new Error(`Lecture des tâches : ${knownError.message}`);
  const known = new Set(
    (knownRows ?? []).map((row) => (row as { dedupe_key: string }).dedupe_key),
  );

  const messages: EmailMessage[] = [];
  for (const ref of refs) {
    if (known.has(`email:${ref.id}`)) continue;
    messages.push(await getMessageMeta(tokens.accessToken, ref.id));
  }

  const { data: workspaceRows, error: workspacesError } = await options.admin
    .from("workspaces")
    .select("id, slug, name")
    .eq("org_id", options.orgId)
    .eq("type", "client");
  if (workspacesError) {
    throw new Error(`Lecture des espaces : ${workspacesError.message}`);
  }

  const plan = planEmailTasks({
    orgId: options.orgId,
    today: options.today,
    messages,
    workspaces: (workspaceRows ?? []) as unknown as FathomWorkspace[],
  });

  let created = 0;
  if (plan.tasks.length > 0) {
    const { data, error } = await options.admin
      .from("work_tasks")
      .upsert(plan.tasks as never, {
        onConflict: "org_id,dedupe_key",
        // Une tâche déjà cochée ou supprimée ne ressuscite pas.
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) throw new Error(`Écriture des tâches : ${error.message}`);
    created = data?.length ?? 0;
  }

  return {
    ok: true,
    boite: source.email_address,
    nonLus: refs.length,
    planifiees: plan.tasks.length,
    creees: created,
    ecartees: labelled(plan.skipped),
    sansClient: plan.withoutClient,
  };
}

/**
 * Efface les tâches importées des mails, avant de réimporter.
 *
 * Sert surtout à purger les tâches **simulées** du seed de démonstration, qui
 * portent la même source : `?purge=email`, jamais déclenché par l'ordonnanceur.
 */
export async function purgeEmailTasks(options: {
  admin: SupabaseClient;
  orgId: string;
}): Promise<number> {
  const { data, error } = await options.admin
    .from("work_tasks")
    .delete()
    .eq("org_id", options.orgId)
    .eq("source", "email")
    .select("id");
  if (error) throw new Error(`Purge des tâches mail : ${error.message}`);
  return data?.length ?? 0;
}

/** Les compteurs d'écart, en français, et sans les zéros. */
function labelled(skipped: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [reason, count] of Object.entries(skipped)) {
    if (count === 0) continue;
    out[EMAIL_SKIP_LABELS[reason as keyof typeof EMAIL_SKIP_LABELS] ?? reason] =
      count;
  }
  return out;
}
