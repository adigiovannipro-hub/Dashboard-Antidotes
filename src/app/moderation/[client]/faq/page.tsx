import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Panel, PanelBody, PanelHeader, SectionHeader } from "@/components/ds/surface";
import { FaqTable } from "@/components/moderation/faq-table";
import { requireModerationClient } from "@/lib/moderation/access";
import { listFaqEntries } from "@/lib/moderation/queries";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ client: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { client: slug } = await params;
  const { client } = await requireModerationClient(slug);
  return { title: `FAQ · ${client.name}` };
}

export default async function FaqPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ entree?: string }>;
}) {
  const { client: slug } = await params;
  const { entree } = await searchParams;
  const { context, client } = await requireModerationClient(slug);

  const supabase = await createClient();
  const [entries, { data: categories }] = await Promise.all([
    listFaqEntries(client.id),
    supabase
      .from("faq_categories")
      .select("id, name")
      .eq("client_id", client.id)
      .order("position"),
  ]);

  const tone = client.tone_settings;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Link
          href={`/moderation?client=${client.slug}`}
          className="type-caption focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm text-text-secondary transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:outline-none"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Retour à l&apos;inbox
        </Link>

        <SectionHeader
          title={`FAQ · ${client.name}`}
          count={entries.length}
          description="La base sur laquelle chaque brouillon est construit."
        />
      </div>

      {/* Réglages de ton : ils conditionnent chaque génération, ils méritent
          donc d'être lus avant la table plutôt qu'à côté. */}
      <Panel>
        <PanelHeader
          title="Ton des réponses"
          description="Appliqué à chaque brouillon généré pour ce client."
        />
        <PanelBody className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <Setting label="Adresse">
            {tone.address === "tu" ? "Tutoiement" : "Vouvoiement"}
          </Setting>
          <Setting label="Emojis">
            {tone.emojis_allowed ? "Autorisés" : "Interdits"}
          </Setting>
          <Setting label="Longueur">
            {{ short: "Courte", medium: "Moyenne", long: "Longue" }[
              tone.target_length
            ] ?? tone.target_length}
          </Setting>
          <Setting label="Langues">
            {client.locales_active.map((l) => l.toUpperCase()).join(" · ")}
          </Setting>
        </PanelBody>
      </Panel>

      <FaqTable
        clientId={client.id}
        entries={entries}
        categories={(categories ?? []) as { id: string; name: string }[]}
        highlightId={entree ?? null}
        canEdit={context.access.role !== "viewer"}
      />
    </div>
  );
}

function Setting({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="type-overline text-text-secondary">{label}</dt>
      <dd className="type-label mt-1 text-text-primary">{children}</dd>
    </div>
  );
}
