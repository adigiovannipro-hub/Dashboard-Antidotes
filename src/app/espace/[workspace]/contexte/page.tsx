import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContexteScreen } from "@/components/context/contexte-screen";
import { getWorkspace } from "@/lib/auth";
import { computeCompleteness } from "@/lib/context/completeness";
import { firstDayOfMonth } from "@/lib/context/freshness";
import { buildContextSections } from "@/lib/context/injected-context";
import {
  getActiveContext,
  getContextVersion,
  getGenerationSettings,
  listAssets,
  listContextVersions,
  listRecentAccroches,
  signAssetUrls,
} from "@/lib/context/queries";
import { monthLabelLower } from "@/lib/production/phases";

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
 * toutes les générations IA.
 *
 * **Owner seulement.** La page laissait entrer le contributeur quand toutes
 * les actions le refusaient (`guardOwner`) : la garde de page et la garde
 * d'action ne disaient pas la même chose, et un contributeur ouvrait un écran
 * entièrement éditable où chaque blur rendait « Action indisponible ». Les
 * deux sont alignées sur l'autorité qui tranche déjà, la RLS de 0033.
 * 404 et jamais 403 : un client ne doit pas apprendre que la page existe.
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
  if (!workspace || workspace.role !== "owner") notFound();

  const requestedVersion = versionParam ? Number.parseInt(versionParam, 10) : null;

  const [active, versions, assets, accroches, settings] = await Promise.all([
    getActiveContext(workspace.id),
    listContextVersions(workspace.id),
    listAssets(workspace.id),
    listRecentAccroches(workspace.id, { limit: 30 }),
    getGenerationSettings(workspace.id),
  ]);

  // Version consultée en lecture seule, seulement si elle diffère de l'active.
  const viewed =
    requestedVersion && requestedVersion !== active?.version
      ? await getContextVersion(workspace.id, requestedVersion)
      : null;

  const downloads = await signAssetUrls(assets.map((asset) => asset.storage_path));

  /* Le mois par défaut de l'aperçu est le mois **suivant** : pendant le mois M
     on prépare M+1, c'est le cycle du module Production. C'est lui qui décide
     si la consigne du mois part, donc l'aperçu doit le dire à l'identique. */
  const now = new Date();
  const targetMonth = firstDayOfMonth(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  );

  /* Les sections servies au modèle, mot pour mot. La modale les affiche et la
     génération en fait le `join` — une seule chaîne d'assemblage, c'est tout
     l'objet de la refonte. */
  const sections = buildContextSections({
    brief: active,
    assets,
    settings,
    accroches: accroches.map((entry) => entry.hook),
    targetMonth,
    now,
  });

  return (
    <ContexteScreen
      workspaceSlug={workspace.slug}
      active={active}
      viewed={viewed}
      versions={versions}
      assets={assets}
      downloads={downloads}
      settings={settings}
      sections={sections}
      targetMonth={targetMonth}
      targetMonthLabel={monthLabelLower(targetMonth.slice(0, 7))}
      completeness={computeCompleteness({ brief: active, settings })}
      accrochesCount={accroches.length}
    />
  );
}
