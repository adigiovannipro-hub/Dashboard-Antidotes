import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, MessagesSquare, ReceiptText } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { requireViewer, type WorkspaceAccess } from "@/lib/auth";
import { getModerationContext } from "@/lib/moderation/access";
import { isModerationVisible } from "@/lib/moderation/permissions";
import { getReceiptsContext } from "@/lib/recus/access";
import type { WorkspaceType } from "@/lib/supabase/database.types";

const TYPE_LABELS: Record<WorkspaceType, string> = {
  client: "Client",
  business: "Entreprise",
  personal: "Perso",
};

/** Clients d'abord : c'est pour eux qu'on ouvre la plateforme. */
const TYPE_ORDER: Record<WorkspaceType, number> = {
  client: 0,
  business: 1,
  personal: 2,
};

export default async function HubPage() {
  const viewer = await requireViewer();

  // Les outils internes, ceux qui ne vivent pas dans un espace client. Le
  // Planning Éditorial n'en fait pas partie : il appartient à l'espace du
  // client, à côté de son Reporting. La RLS a déjà filtré — un client du
  // dashboard n'a aucun rattachement, donc aucun outil, et n'apprend pas leur
  // existence.
  const [moderation, receipts] = await Promise.all([
    getModerationContext(),
    getReceiptsContext(),
  ]);

  const tools = [
    isModerationVisible(moderation.access)
      ? {
          href: "/moderation",
          title: "Modération",
          description: "Messages et commentaires, réponses validées à la main",
          icon: MessagesSquare,
        }
      : null,
    receipts !== null
      ? {
          href: "/entreprise/recus",
          title: "Reçus",
          description: "Factures reçues par mail, rapprochées d'Airwallex",
          icon: ReceiptText,
        }
      : null,
  ].filter((tool) => tool !== null);

  // Un client n'a qu'un seul espace : lui présenter un hub d'un seul élément
  // serait une étape pour rien. Quelqu'un qui a aussi des outils internes, en
  // revanche, a bien besoin du hub pour les atteindre.
  if (viewer.workspaces.length === 1 && tools.length === 0) {
    redirect(`/espace/${viewer.workspaces[0]!.slug}`);
  }

  const workspaces = [...viewer.workspaces].sort(
    (a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.name.localeCompare(b.name),
  );

  return (
    <>
      <AppHeader viewer={viewer} />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 p-6 md:p-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Espaces</h1>
          <p className="text-muted-foreground text-sm">
            {viewer.workspaces.length === 0
              ? "Aucun espace ne vous est encore attribué."
              : "Chaque espace porte le planning et les chiffres d'un client — ou les vôtres."}
          </p>
        </div>

        {viewer.workspaces.length === 0 ? (
          <EmptyState email={viewer.email} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((workspace) => (
              <li key={workspace.id}>
                <WorkspaceCard workspace={workspace} />
              </li>
            ))}
          </ul>
        )}

        {tools.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Outils internes
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <li key={tool.href}>
                  <Link
                    href={tool.href}
                    className="group border-border hover:border-foreground/20 focus-visible:ring-ring flex items-center gap-3 rounded-xl border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
                      <tool.icon
                        className="text-muted-foreground size-4"
                        aria-hidden
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {tool.title}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {tool.description}
                      </span>
                    </span>
                    <ArrowRight
                      className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </>
  );
}

function WorkspaceCard({ workspace }: { workspace: WorkspaceAccess }) {
  return (
    <Link
      href={`/espace/${workspace.slug}`}
      className="group border-border bg-card hover:border-foreground/20 focus-visible:ring-ring flex items-center gap-3 rounded-xl border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <span
        aria-hidden
        className="bg-muted-foreground/20 flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
        style={
          workspace.accent_color
            ? { backgroundColor: workspace.accent_color }
            : undefined
        }
      >
        {workspace.name[0]?.toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{workspace.name}</span>
        <span className="text-muted-foreground block text-xs">
          {TYPE_LABELS[workspace.type]}
        </span>
      </span>
      <ArrowRight
        className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}

function EmptyState({ email }: { email: string }) {
  return (
    <div className="border-border text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
      <p>
        Le compte <span className="text-foreground font-medium">{email}</span>{" "}
        n&apos;a encore accès à aucun espace.
      </p>
      <p className="mt-1">
        Un accès doit être accordé à cette adresse depuis l&apos;administration.
      </p>
    </div>
  );
}
