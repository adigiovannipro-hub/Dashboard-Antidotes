import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContexteScreen } from "@/components/context/contexte-screen";
import { getWorkspace } from "@/lib/auth";
import {
  buildInjectedContext,
  extractPlatformRules,
  renderAssetSummaries,
} from "@/lib/context/injected-context";
import {
  getActiveContext,
  getContextVersion,
  listAssets,
  listContextVersions,
  listRecentAccroches,
  signAssetUrls,
} from "@/lib/context/queries";
import { estimateTokens } from "@/lib/context/token-estimate";

/* La consolidation enchaîne des appels au modèle depuis une Server Action de
   cette page : lui laisser la même marge que la route d'extraction — même
   réserve non tranchée sur le plafond réel du plan Hobby. */
export const maxDuration = 300;

type Params = Promise<{ workspace: string }>;
type Search = Promise<{ version?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { workspace: slug } = await params;
  const workspace = await getWorkspace(slug);
  return { title: workspace ? `Contexte — ${workspace.name}` : "Contexte" };
}

/**
 * La page Contexte d'un espace client : la source de vérité qui alimente
 * toutes les générations IA. Ouverte au propriétaire et au contributeur, jamais
 * au client : pour lui elle n'existe pas — 404, jamais 403, et le lien de
 * navigation n'est pas rendu. La RLS de 0040 reste l'autorité derrière cette
 * garde.
 */
export default async function ContextePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const [{ workspace: slug }, { version: versionParam }] = await Promise.all([
    params,
    searchParams,
  ]);

  const workspace = await getWorkspace(slug);
  // Le contributeur écrit le brief ; le client n'a pas à le voir. 404 et
  // jamais 403 : un client ne doit pas apprendre que la page existe.
  if (!workspace || workspace.role === "client") notFound();

  const requestedVersion = versionParam ? Number.parseInt(versionParam, 10) : null;

  const [active, versions, assets, accroches] = await Promise.all([
    getActiveContext(workspace.id),
    listContextVersions(workspace.id),
    listAssets(workspace.id),
    listRecentAccroches(workspace.id, { limit: 30 }),
  ]);

  // Version consultée en lecture seule, seulement si elle diffère de l'active.
  const viewed =
    requestedVersion && requestedVersion !== active?.version
      ? await getContextVersion(workspace.id, requestedVersion)
      : null;

  const downloads = await signAssetUrls(assets.map((asset) => asset.storage_path));

  // Le compteur mesure exactement la chaîne servie aux générations.
  const injected = buildInjectedContext({
    brief: active,
    assetSummaries: renderAssetSummaries(assets),
    platformRules: extractPlatformRules(active),
  });

  return (
    <ContexteScreen
      workspaceSlug={workspace.slug}
      workspaceName={workspace.name}
      active={active}
      viewed={viewed}
      versions={versions}
      assets={assets}
      downloads={downloads}
      tokenEstimate={estimateTokens(injected)}
      accrochesCount={accroches.length}
    />
  );
}
