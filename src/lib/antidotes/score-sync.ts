import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { computeScore } from "./scoring";
import type { Campaign, Contact, Prospect } from "./types";

/**
 * Recalcule et persiste le score d'un prospect.
 *
 * Appelé après chaque écriture sur le prospect ou ses contacts : la formule
 * vit dans `scoring.ts`, pure et testée, et ce fichier n'est que le pont
 * entre la base et elle. Le client est passé en paramètre pour que l'action
 * qui vient d'écrire réutilise le sien.
 *
 * Un échec de lecture laisse le score tel quel : mieux vaut un score d'hier
 * qu'une action qui échoue après avoir déjà écrit le contact.
 */
export async function refreshProspectScore(
  supabase: SupabaseClient<Database>,
  options: { orgId: string; prospectId: string },
): Promise<number | null> {
  const [{ data: prospectRow }, { data: contactRows }] = await Promise.all([
    supabase
      .from("antidotes_prospects")
      .select("*")
      .eq("org_id", options.orgId)
      .eq("id", options.prospectId)
      .maybeSingle(),
    supabase
      .from("antidotes_contacts")
      .select("is_primary, outreach_channel")
      .eq("org_id", options.orgId)
      .eq("prospect_id", options.prospectId)
      .limit(100),
  ]);

  const prospect = prospectRow as unknown as Prospect | null;
  if (!prospect) return null;

  let campaign: Campaign | null = null;
  if (prospect.campaign_id) {
    const { data } = await supabase
      .from("antidotes_campaigns")
      .select("*")
      .eq("org_id", options.orgId)
      .eq("id", prospect.campaign_id)
      .maybeSingle();
    campaign = (data as unknown as Campaign | null) ?? null;
  }

  const score = computeScore({
    prospect: {
      ads_active: prospect.ads_active,
      sector: prospect.sector,
      size_signal: prospect.size_signal ?? {},
    },
    contacts: (contactRows ?? []) as unknown as Pick<
      Contact,
      "is_primary" | "outreach_channel"
    >[],
    campaign: campaign
      ? {
          filters: campaign.filters,
          reference_sector: campaign.filters?.reference_sector ?? null,
          reference_size: campaign.filters?.reference_size ?? null,
        }
      : null,
  });

  if (score !== prospect.score) {
    await supabase
      .from("antidotes_prospects")
      .update({ score })
      .eq("org_id", options.orgId)
      .eq("id", options.prospectId);
  }

  return score;
}
