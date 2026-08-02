import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Briefcase,
  CalendarRange,
  Lock,
  MessagesSquare,
  Users,
} from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { requireViewer, roleLabel, type WorkspaceAccess } from "@/lib/auth";
import { getModerationContext } from "@/lib/moderation/access";
import { isModerationVisible } from "@/lib/moderation/permissions";
import { getPlanningContext } from "@/lib/planning/access";
import { isPlanningVisible } from "@/lib/planning/permissions";
import type { WorkspaceType } from "@/lib/supabase/database.types";

const SECTIONS: { type: WorkspaceType; title: string; icon: typeof Users }[] = [
  { type: "client", title: "Clients", icon: Users },
  { type: "business", title: "Mon entreprise", icon: Briefcase },
  { type: "personal", title: "Perso", icon: Lock },
];

export default async function HubPage() {
  const viewer = await requireViewer();

  // Les deux modules internes. La RLS a déjà filtré : un client du dashboard de
  // reporting n'a aucun rattachement, donc aucun outil, et n'apprend pas leur
  // existence.
  const [moderation, planning] = await Promise.all([
    getModerationContext(),
    getPlanningContext(),
  ]);

  const tools = [
    isPlanningVisible(planning.access)
      ? {
          href: "/planning",
          title: "Planning Édito",
          description: "Les plannings éditoriaux Monday, mois par mois",
          icon: CalendarRange,
        }
      : null,
    isModerationVisible(moderation.access)
      ? {
          href: "/moderation",
          title: "Modération",
          description: "Messages et commentaires, réponses validées à la main",
          icon: MessagesSquare,
        }
      : null,
  ].filter((tool) => tool !== null);

  // Un client n'a qu'un seul espace : lui présenter un hub d'un seul élément
  // serait une étape pour rien. Quelqu'un qui a aussi des outils internes, en
  // revanche, a bien besoin du hub pour les atteindre.
  if (viewer.workspaces.length === 1 && tools.length === 0) {
    redirect(`/espace/${viewer.workspaces[0]!.slug}`);
  }

  return (
    <>
      <AppHeader viewer={viewer} />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-10 p-6 md:p-10">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Espaces</h1>
          <p className="text-muted-foreground text-sm">
            {viewer.workspaces.length === 0
              ? "Aucun espace ne vous est encore attribué."
              : `${viewer.workspaces.length} espaces accessibles.`}
          </p>
        </div>

        {viewer.workspaces.length === 0 ? <EmptyState email={viewer.email} /> : null}

        {SECTIONS.map(({ type, title, icon: Icon }) => {
          const workspaces = viewer.workspaces.filter(
            (workspace) => workspace.type === type,
          );
          if (workspaces.length === 0) return null;

          return (
            <section key={type} className="space-y-3">
              <h2 className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
                <Icon className="size-3.5" aria-hidden />
                {title}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {workspaces.map((workspace) => (
                  <li key={workspace.id}>
                    <WorkspaceCard workspace={workspace} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

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
                    className="group border-border hover:border-foreground/20 focus-visible:ring-ring block rounded-xl border p-5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <tool.icon
                        className="text-muted-foreground size-5"
                        aria-hidden
                      />
                      <ArrowRight
                        className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </div>
                    <p className="mt-4 font-medium">{tool.title}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {tool.description}
                    </p>
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
      className="group border-border bg-card hover:border-foreground/20 focus-visible:ring-ring block rounded-xl border p-5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden
          className="bg-muted size-8 shrink-0 rounded-lg"
          style={
            workspace.accent_color
              ? { backgroundColor: workspace.accent_color }
              : undefined
          }
        />
        <ArrowRight
          className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
      <p className="mt-4 font-medium">{workspace.name}</p>
      <Badge variant="secondary" className="mt-2">
        {roleLabel(workspace.role)}
      </Badge>
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
