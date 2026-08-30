import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MetaDashboard } from "@/components/viz/meta-dashboard";
import { OrganicDashboard } from "@/components/viz/organic-dashboard";
import { PrintButton } from "@/components/viz/print-button";
import { WebDashboard } from "@/components/viz/web-dashboard";
import { formatDayFr } from "@/lib/format";
import { getAdsData, getOrganicData } from "@/lib/reporting/queries";
import { getWebData } from "@/lib/web/queries";
import { signLogoUrls } from "@/lib/workspaces/logos";
import { createAdminClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

/**
 * Le rapport partagé — la page publique du produit.
 *
 * Pas de session, pas de rail : le jeton **est** le droit d'accès, résolu en
 * admin (le chemin `/partage` est public dans le proxy). Ce qui s'affiche est
 * strictement ce que le client verrait chez lui — chiffres et graphiques —
 * sans aucun levier : ni synchronisation, ni réglages, ni synthèse interne.
 * La période est celle figée à la création du lien : un rapport envoyé ne
 * change plus sous les yeux de son lecteur.
 */

export const dynamic = "force-dynamic";

type Params = Promise<{ token: string }>;
type Query = Promise<{ reseau?: string }>;

type ShareContext = {
  workspaceId: string;
  workspaceName: string;
  logoPath: string | null;
  range: { from: string; to: string };
};

async function resolveShare(params: Params): Promise<ShareContext | null> {
  const { token } = await params;
  // Un jeton est 64 hexdigits : refuser tôt évite une requête par scan.
  if (!/^[0-9a-f]{32,128}$/.test(token)) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("share_links")
    .select("workspace_id, date_mode, date_from, date_to, expires_at, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;

  const link = data as {
    workspace_id: string;
    date_mode: string;
    date_from: string | null;
    date_to: string | null;
    expires_at: string | null;
    revoked_at: string | null;
  };
  if (link.revoked_at) return null;
  if (link.expires_at && new Date(link.expires_at) < new Date()) return null;

  const { data: workspace } = await admin
    .from("workspaces")
    .select("id, name, logo_url")
    .eq("id", link.workspace_id)
    .maybeSingle();
  if (!workspace) return null;

  // `fixed` porte sa période ; `rolling` suit le dernier mois complet.
  let range: { from: string; to: string };
  if (link.date_mode === "fixed" && link.date_from && link.date_to) {
    range = { from: link.date_from, to: link.date_to };
  } else {
    const now = new Date();
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    range = {
      from: first.toISOString().slice(0, 10),
      to: last.toISOString().slice(0, 10),
    };
  }

  const row = workspace as { id: string; name: string; logo_url: string | null };
  return {
    workspaceId: row.id,
    workspaceName: row.name,
    logoPath: row.logo_url,
    range,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const share = await resolveShare(params);
  return {
    title: share ? `Rapport · ${share.workspaceName}` : "Rapport",
    robots: { index: false, follow: false },
  };
}

const NETWORKS = [
  { key: "meta-ads", label: "Meta Ads" },
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "site-web", label: "Site Web" },
] as const;

type ShareNetwork = (typeof NETWORKS)[number]["key"];

export default async function PartagePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Query;
}) {
  const share = await resolveShare(params);
  if (!share) notFound();

  const { reseau } = await searchParams;
  const admin = createAdminClient();
  const { range } = share;

  const period = {
    label: `du ${formatDayFr(range.from)} au ${formatDayFr(range.to)}`,
    comparison: "la période précédente",
  };

  // Seuls les onglets qui portent des chiffres s'affichent : un rapport
  // partagé ne montre jamais un écran vide à expliquer.
  const [ads, instagram, facebook, web] = await Promise.all([
    getAdsData({ workspaceId: share.workspaceId, range, reader: admin }),
    getOrganicData({
      workspaceId: share.workspaceId,
      platform: "instagram",
      range,
      reader: admin,
    }),
    getOrganicData({
      workspaceId: share.workspaceId,
      platform: "facebook",
      range,
      reader: admin,
    }),
    getWebData({ workspaceId: share.workspaceId, range, reader: admin }),
  ]);

  const available: { key: ShareNetwork; label: string }[] = NETWORKS.filter(
    ({ key }) =>
      (key === "meta-ads" && ads.hasData) ||
      (key === "instagram" && instagram.hasData) ||
      (key === "facebook" && facebook.hasData) ||
      (key === "site-web" && web.hasData),
  );

  const network: ShareNetwork =
    available.find((entry) => entry.key === reseau)?.key ??
    available[0]?.key ??
    "meta-ads";

  const logos = await signLogoUrls([share.logoPath]);
  const logoUrl = share.logoPath ? (logos.get(share.logoPath) ?? null) : null;

  return (
    <main className="page-partage mx-auto max-w-6xl space-y-5 px-4 py-8 md:px-8">
      <header className="flex flex-wrap items-center gap-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL signée
          <img src={logoUrl} alt="" className="size-11 rounded-md object-contain" />
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="type-h2 text-text-primary">{share.workspaceName}</h1>
          <p className="type-caption text-text-secondary">
            Rapport {period.label} · partagé par Antidotes
          </p>
        </div>
        <PrintButton />
      </header>

      {available.length > 1 ? (
        <nav aria-label="Réseaux" className="print-cacher flex flex-wrap gap-1.5">
          {available.map((entry) => (
            <a
              key={entry.key}
              href={entry.key === available[0]?.key ? "?" : `?reseau=${entry.key}`}
              aria-current={entry.key === network ? "page" : undefined}
              className={cn(
                "type-label focus-visible:ring-ring rounded-pill px-3 py-1.5 transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
                entry.key === network
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface text-text-secondary hover:text-text-primary border border-border",
              )}
            >
              {entry.label}
            </a>
          ))}
        </nav>
      ) : null}

      {network === "meta-ads" && ads.hasData ? (
        <MetaDashboard
          adSets={ads.adSets}
          total={ads.total}
          previousTotal={ads.previousTotal}
          age={ads.age}
          gender={ads.gender}
          regions={ads.regions}
          followers={ads.followers}
          period={period}
        />
      ) : network === "instagram" && instagram.hasData ? (
        <OrganicDashboard
          network="instagram"
          posts={instagram.posts}
          total={instagram.total}
          previousTotal={instagram.previousTotal}
          followers={instagram.followers}
          followersNow={instagram.followersNow}
          period={period}
        />
      ) : network === "facebook" && facebook.hasData ? (
        <OrganicDashboard
          network="facebook"
          posts={facebook.posts}
          total={facebook.total}
          previousTotal={facebook.previousTotal}
          followers={facebook.followers}
          followersNow={facebook.followersNow}
          period={period}
        />
      ) : network === "site-web" && web.hasData ? (
        <WebDashboard data={web} period={period} />
      ) : (
        <p className="type-body rounded-lg border border-dashed border-border p-10 text-center text-text-secondary">
          Aucune donnée sur cette période.
        </p>
      )}
    </main>
  );
}
