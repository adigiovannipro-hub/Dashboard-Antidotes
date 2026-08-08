import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  DataProvider,
  DataSource,
  SocialPlatform,
} from "@/lib/supabase/database.types";

/** Fenêtre de synchronisation, bornes incluses, jours AAAA-MM-JJ en UTC. */
export type SyncWindow = {
  from: string;
  to: string;
};

/** Un compte que le jeton d'agence peut lire — alimente le sélecteur admin. */
export type ConnectorAsset = {
  externalId: string;
  name: string;
  detail?: string;
};

export type ConnectorSyncReport = {
  rows: number;
  warnings: string[];
};

export type ConnectorSyncOptions = {
  source: DataSource;
  window: SyncWindow;
  admin: SupabaseClient<Database>;
};

/**
 * Un connecteur par provider. `listAssets` sert l'écran d'admin — choisir le
 * compte dans une liste au lieu de recopier un identifiant — et `sync` ingère
 * la fenêtre demandée en upsert idempotent par identifiant externe.
 */
export type Connector = {
  provider: DataProvider;
  listAssets: () => Promise<ConnectorAsset[]>;
  sync: (options: ConnectorSyncOptions) => Promise<ConnectorSyncReport>;
};

export const PROVIDER_LABELS: Record<DataProvider, string> = {
  meta_ads: "Meta Ads",
  meta_organic: "Meta organique (remplacé)",
  instagram_organic: "Instagram organique",
  facebook_organic: "Facebook organique",
  tiktok_organic: "TikTok organique",
  tiktok_ads: "TikTok Ads",
  linkedin_organic: "LinkedIn organique",
  linkedin_ads: "LinkedIn Ads",
  ga4: "Site — GA4",
};

/** Les providers payants — leur fenêtre de resynchronisation est plus large. */
export const ADS_PROVIDERS: readonly DataProvider[] = [
  "meta_ads",
  "tiktok_ads",
  "linkedin_ads",
];

/** Plateforme d'affichage d'un provider organique (courbe d'abonnés, écrans). */
export const PROVIDER_PLATFORM: Partial<Record<DataProvider, SocialPlatform>> = {
  instagram_organic: "instagram",
  facebook_organic: "facebook",
  tiktok_organic: "tiktok",
  linkedin_organic: "linkedin",
};
