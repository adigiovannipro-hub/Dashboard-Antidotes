import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlugZap } from "lucide-react";

import { EmptyState } from "@/components/ds/empty-state";
import { StatusPill } from "@/components/ds/status-pill";
import { SectionHeader } from "@/components/ds/surface";
import { MetaDashboard } from "@/components/viz/meta-dashboard";
import { getWorkspace } from "@/lib/auth";
import {
  BONDET_AD_SETS,
  BONDET_AGE,
  BONDET_FOLLOWERS,
  BONDET_GENDER,
  BONDET_PERIOD,
  BONDET_PREVIOUS_TOTAL,
  BONDET_REGIONS,
  BONDET_TOTAL,
} from "@/lib/demo/bondet";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ workspace: string; dashboard: string }>;

async function load(params: Params) {
  const { workspace: workspaceSlug, dashboard: dashboardSlug } = await params;
  const workspace = await getWorkspace(workspaceSlug);
  if (!workspace) return null;

  const supabase = await createClient();
  const { data: dashboard } = await supabase
    .from("dashboards")
    .select("id, slug, name")
    .eq("workspace_id", workspace.id)
    .eq("slug", dashboardSlug)
    .maybeSingle();

  return dashboard ? { workspace, dashboard } : null;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const loaded = await load(params);
  if (!loaded) return { title: "Introuvable" };
  return { title: `${loaded.dashboard.name} · ${loaded.workspace.name}` };
}

export default async function DashboardPage({ params }: { params: Params }) {
  const loaded = await load(params);
  if (!loaded) notFound();

  const { workspace, dashboard } = loaded;

  // Aucune source n'est encore connectée : le dashboard tourne sur les données
  // de démonstration, calées sur le rapport Looker réel de juin 2026. Le
  // branchement de l'API Meta arrive à l'étape 6 et ne changera que l'origine
  // des données, pas la forme.
  // Le dashboard s'appelait « meta » avant de devenir « reporting » : les deux
  // slugs sont acceptés le temps que la migration 0008 soit passée partout.
  const isBondetMeta =
    workspace.slug === "bondet" &&
    (dashboard.slug === "reporting" || dashboard.slug === "meta");

  return (
    <div className="space-y-5">
      {/* Le nom de l'espace est déjà le titre de la page, porté par le cadre :
          le répéter ici volait deux lignes au contenu. Ne reste que ce que le
          cadre ne peut pas savoir — la période et l'origine des chiffres. */}
      <SectionHeader
        title={dashboard.name}
        description={`${BONDET_PERIOD.label} · comparé à ${BONDET_PERIOD.comparison}`}
        action={<StatusPill tone="info">Données de démonstration</StatusPill>}
      />

      {isBondetMeta ? (
        <MetaDashboard
          adSets={BONDET_AD_SETS}
          total={BONDET_TOTAL}
          previousTotal={BONDET_PREVIOUS_TOTAL}
          age={BONDET_AGE}
          gender={BONDET_GENDER}
          regions={BONDET_REGIONS}
          followers={BONDET_FOLLOWERS}
          period={BONDET_PERIOD}
        />
      ) : (
        <EmptyState
          icon={PlugZap}
          message="Aucune source de données n'est connectée à cet espace."
        />
      )}
    </div>
  );
}
