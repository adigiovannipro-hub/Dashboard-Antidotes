import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { isEngagementSettled } from "./delivery";

type Client = SupabaseClient<Database>;

/**
 * Clôt les devis soldés parmi ceux dont une mensualité **vient** de passer
 * payée.
 *
 * Appelée au moment de la transition — par le rapprochement Airwallex et par
 * le bouton « Payée » — et jamais en balayage : un devis rouvert à la main
 * reste ouvert, jusqu'à ce qu'une autre de ses mensualités soit payée. Un
 * balayage le refermerait au passage suivant, et « Rouvrir le devis » ne
 * servirait à rien.
 *
 * Le statut seul change : les mensualités sont déjà toutes payées ou passées,
 * il n'y a rien à toucher — contrairement à « Terminer le devis », qui passe
 * les mois restants. Rend le nombre de devis clos.
 */
export async function closeSettledEngagements(
  client: Client,
  orgId: string,
  engagementIds: readonly string[],
): Promise<number> {
  const ids = [...new Set(engagementIds)];
  if (ids.length === 0) return 0;

  const { data, error } = await client
    .from("billing_installments")
    .select("engagement_id, status")
    .eq("org_id", orgId)
    .in("engagement_id", ids)
    .limit(5000);
  if (error) throw new Error(`Lecture des mensualités du devis : ${error.message}`);

  const byEngagement = new Map<string, { status: "pending" | "issued" | "paid" | "skipped" }[]>();
  for (const row of (data ?? []) as unknown as {
    engagement_id: string;
    status: "pending" | "issued" | "paid" | "skipped";
  }[]) {
    const list = byEngagement.get(row.engagement_id) ?? [];
    list.push({ status: row.status });
    byEngagement.set(row.engagement_id, list);
  }

  const settled = ids.filter((id) => isEngagementSettled(byEngagement.get(id) ?? []));
  if (settled.length === 0) return 0;

  /* `status = active` dans le filtre : un devis déjà terminé ne se réécrit
     pas, et le compte rendu ne ment pas sur ce qui a changé. */
  const { data: closed, error: closeError } = await client
    .from("billing_engagements")
    .update({ status: "ended" } as never)
    .eq("org_id", orgId)
    .eq("status", "active")
    .in("id", settled)
    .select("id");
  if (closeError) throw new Error(`Clôture du devis soldé : ${closeError.message}`);

  return closed?.length ?? 0;
}
