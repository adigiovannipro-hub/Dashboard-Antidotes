import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href={`/moderation/${client.slug}`}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Retour à l&apos;inbox
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            FAQ · {client.name}
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {entries.length} entrées. C&apos;est la base sur laquelle chaque
            brouillon est construit.
          </p>
        </div>

        {/* Réglages de ton : ils conditionnent chaque génération. */}
        <dl className="bg-card grid gap-x-6 gap-y-1 rounded-lg p-3 text-xs sm:grid-cols-2">
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
        </dl>
      </div>

      <FaqTable
        entries={entries}
        categories={(categories ?? []) as { id: string; name: string }[]}
        highlightId={entree ?? null}
        canEdit={context.access.role !== "viewer"}
      />
    </main>
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
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground font-medium">{children}</dd>
    </div>
  );
}
