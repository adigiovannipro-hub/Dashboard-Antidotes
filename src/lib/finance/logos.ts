import "server-only";

import { createAdminClient } from "@/lib/supabase/server";
import { domainCandidates, merchantKey } from "./merchant-logo";

/**
 * Récupération des logos de marchands, au fil de la synchronisation.
 *
 * Chaque marchand n'est cherché **qu'une fois** : la table
 * `finance_merchant_logos` journalise les tentatives, trouvées ou non, et
 * seuls les marchands jamais vus déclenchent un appel. Le coût de croisière
 * est donc zéro — quelques requêtes le jour où un nouveau marchand apparaît.
 *
 * La source est le service de favicons de Google, qui rend l'icône d'un
 * domaine sans exiger de clé. Pour un domaine inconnu il rend un globe
 * générique, toujours le même : on le récupère une fois par passage (sur un
 * domaine qui n'existe pas) et on écarte tout candidat dont les octets sont
 * identiques — sans ce garde-fou, chaque marchand inconnu recevrait un globe
 * en guise de logo.
 */

const FAVICON_ENDPOINT = "https://www.google.com/s2/favicons";
const FAVICON_SIZE = 128;
/** Borne par passage : un premier passage sur 60 marchands ne doit pas faire
    durer la synchronisation — les suivants rattraperont. */
const MAX_LOOKUPS_PER_RUN = 15;

const BUCKET = "merchant-logos";

async function fetchFavicon(domain: string): Promise<Buffer | null> {
  const response = await fetch(
    `${FAVICON_ENDPOINT}?domain=${encodeURIComponent(domain)}&sz=${FAVICON_SIZE}`,
  );
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

/** L'empreinte du globe générique — l'icône d'un domaine qui n'existe pas. */
async function defaultFaviconBytes(): Promise<Buffer | null> {
  return fetchFavicon("domaine-inexistant-antidotes-9c41.com");
}

export type LogoSyncReport = {
  looked_up: number;
  found: number;
};

export async function syncMerchantLogos(
  orgId: string,
  merchants: { merchant: string | null; merchant_raw: string | null }[],
): Promise<LogoSyncReport> {
  const admin = createAdminClient();

  // Un marchand = une clé ; la première orthographe rencontrée fait foi.
  const byKey = new Map<string, string>();
  for (const row of merchants) {
    const display = row.merchant ?? row.merchant_raw;
    const key = merchantKey(display);
    if (key && !byKey.has(key)) byKey.set(key, display!);
  }
  if (byKey.size === 0) return { looked_up: 0, found: 0 };

  const { data: existing, error } = await admin
    .from("finance_merchant_logos")
    .select("merchant_key")
    .eq("org_id", orgId);
  if (error) throw new Error(`Lecture des logos : ${error.message}`);

  const known = new Set(
    ((existing ?? []) as { merchant_key: string }[]).map((row) => row.merchant_key),
  );
  const pending = [...byKey.entries()]
    .filter(([key]) => !known.has(key))
    .slice(0, MAX_LOOKUPS_PER_RUN);
  if (pending.length === 0) return { looked_up: 0, found: 0 };

  const defaultBytes = await defaultFaviconBytes();
  let found = 0;

  for (const [key, display] of pending) {
    let storagePath: string | null = null;
    let matchedDomain: string | null = null;

    for (const domain of domainCandidates(display)) {
      const bytes = await fetchFavicon(domain);
      if (!bytes || bytes.length < 100) continue;
      if (defaultBytes && bytes.equals(defaultBytes)) continue;

      const path = `${orgId}/${key}.png`;
      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: "image/png", upsert: true });
      if (uploadError) break; // bucket absent : inutile d'insister ce passage-ci

      storagePath = path;
      matchedDomain = domain;
      found += 1;
      break;
    }

    /* La ligne s'écrit trouvée **ou non** : c'est elle qui empêche de
       retenter le même marchand à chaque passage. */
    await admin.from("finance_merchant_logos").upsert(
      {
        org_id: orgId,
        merchant_key: key,
        domain: matchedDomain,
        storage_path: storagePath,
        fetched_at: new Date().toISOString(),
      } as never,
      { onConflict: "org_id,merchant_key" },
    );
  }

  return { looked_up: pending.length, found };
}
