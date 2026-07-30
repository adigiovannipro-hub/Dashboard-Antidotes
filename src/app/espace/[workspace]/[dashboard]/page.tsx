import type { Metadata } from "next";
import { notFound } from "next/navigation";

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
  const isBondetMeta = workspace.slug === "bondet" && dashboard.slug === "meta";

  return (
    <main className="space-y-5 p-5 md:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs">{workspace.name}</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight">
            {dashboard.name}
          </h1>
        </div>
        <p className="text-muted-foreground text-xs">
          {BONDET_PERIOD.label}
          <span className="bg-brand-mint text-heading ml-2 rounded px-1.5 py-0.5 text-[11px] font-medium">
            Données de démonstration
          </span>
        </p>
      </header>

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
        <div className="bg-card text-muted-foreground rounded-lg p-12 text-center text-sm">
          Aucune source de données n&apos;est connectée à cet espace.
        </div>
      )}
    </main>
  );
}
