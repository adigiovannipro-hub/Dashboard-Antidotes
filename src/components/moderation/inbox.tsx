"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Clock, MailOpen, MessagesSquare, Search } from "lucide-react";

import { StatCard, StatGrid } from "@/components/ds/stat-card";
import { Panel } from "@/components/ds/surface";
import { ConversationThread } from "@/components/moderation/conversation-thread";
import { FilterRail } from "@/components/moderation/filter-rail";
import { ConversationList } from "@/components/moderation/conversation-list";
import { ShortcutsHint } from "@/components/moderation/shortcuts-hint";
import { Input } from "@/components/ui/input";
import type { InboxCounters, InboxFilters } from "@/lib/moderation/queries";
import type {
  Conversation,
  Draft,
  ModerationClient,
  ModerationMessage,
  ModerationRole,
} from "@/lib/moderation/types";
import { cn } from "@/lib/utils";

/**
 * Inbox de modération, trois colonnes.
 *
 * Conçue pour traiter cent messages en dix minutes : le clavier fait tout, la
 * souris n'est jamais nécessaire, et la navigation entre conversations ne
 * recharge que la colonne de droite.
 */
export function Inbox({
  clients,
  client,
  role,
  conversations,
  counters,
  filters,
  selectedId,
  thread,
}: {
  clients: ModerationClient[];
  client: ModerationClient;
  role: ModerationRole;
  conversations: Conversation[];
  counters: InboxCounters;
  filters: InboxFilters;
  selectedId: string | null;
  thread: {
    conversation: Conversation | null;
    messages: ModerationMessage[];
    draft: Draft | null;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState(filters.search ?? "");

  const selectedIndex = useMemo(
    () => conversations.findIndex((conversation) => conversation.id === selectedId),
    [conversations, selectedId],
  );

  const goTo = useCallback(
    (conversationId: string) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("conv", conversationId);
      router.push(`${pathname}?${next}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const move = useCallback(
    (delta: number) => {
      if (conversations.length === 0) return;
      const base = selectedIndex === -1 ? 0 : selectedIndex;
      const next = Math.min(Math.max(base + delta, 0), conversations.length - 1);
      goTo(conversations[next]!.id);
    },
    [conversations, goTo, selectedIndex],
  );

  // Raccourcis de navigation. Les actions (valider, refuser, ignorer, mettre en
  // attente) sont gérées par le fil de conversation, qui seul connaît le
  // brouillon courant.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.key === "Escape" && typing) {
        (target as HTMLElement).blur();
        return;
      }
      if (typing) return;

      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        move(1);
      } else if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        move(-1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [move]);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(searchParams.toString());
    if (search.trim()) next.set("q", search.trim());
    else next.delete("q");
    next.delete("conv");
    router.push(`${pathname}?${next}`);
  }

  const staleHours = counters.oldestActionableHours;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      {/* Le client se choisit en onglets, comme les sections d'un espace. */}
      <div className="flex flex-wrap items-center gap-3">
        {clients.length > 1 ? (
          <nav aria-label="Clients">
            <ul className="inline-flex items-center gap-1 rounded-pill bg-surface-sunken p-1">
              {clients.map((candidate) => (
                <li key={candidate.id}>
                  <Link
                    href={`/moderation/${candidate.slug}`}
                    aria-current={candidate.id === client.id ? "page" : undefined}
                    className={cn(
                      "type-caption focus-visible:ring-ring block rounded-pill px-3.5 py-1.5 font-medium transition-colors duration-(--motion-duration) ease-standard focus-visible:ring-2 focus-visible:outline-none",
                      candidate.id === client.id
                        ? "bg-primary text-primary-foreground"
                        : "text-text-secondary hover:text-text-primary",
                    )}
                  >
                    {candidate.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : (
          <h2 className="type-h2 text-text-primary">{client.name}</h2>
        )}

        <form onSubmit={submitSearch} className="relative ml-auto">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-tertiary"
            aria-hidden
          />
          <Input
            ref={searchRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher   /"
            aria-label="Rechercher une conversation"
            className="w-64 pl-9"
          />
        </form>

        <ShortcutsHint />
      </div>

      {/* La même bande de mesures que les autres modules : ce qui attend, ce
          qui alerte, ce qui n'a pas encore été ouvert, et depuis combien de
          temps le plus vieux message patiente — seul signal d'urgence en V1,
          puisqu'il n'y a volontairement aucune notification externe. */}
      <StatGrid>
        <StatCard
          label="À gérer"
          value={counters.actionable}
          context="conversations ouvertes"
          icon={MessagesSquare}
        />
        <StatCard
          label="Signalées"
          value={counters.highPriority}
          context={counters.highPriority > 0 ? "lecture humaine" : "rien de signalé"}
          tone={counters.highPriority > 0 ? "danger" : undefined}
          toneLabel={counters.highPriority > 0 ? "prioritaire" : undefined}
          icon={AlertTriangle}
        />
        <StatCard
          label="Non lus"
          value={counters.unread}
          context="jamais ouverts"
          icon={MailOpen}
        />
        <StatCard
          label="Plus ancien"
          value={staleHours === null ? "—" : formatAge(staleHours)}
          context={staleHours === null ? "rien en attente" : "sans réponse"}
          tone={staleHours !== null && staleHours > 24 ? "warning" : undefined}
          toneLabel={staleHours !== null && staleHours > 24 ? "à traiter" : undefined}
          icon={Clock}
        />
      </StatGrid>

      {/* Les trois colonnes dans une seule surface : posées à même le fond,
          elles se lisaient comme trois écrans juxtaposés plutôt que comme un
          poste de travail. */}
      <Panel className="flex min-h-0 flex-1">
        <FilterRail counters={counters} filters={filters} />

        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={goTo}
        />

        <ConversationThread
          key={thread.conversation?.id ?? "empty"}
          clientSlug={client.slug}
          role={role}
          conversation={thread.conversation}
          messages={thread.messages}
          draft={thread.draft}
          onAdvance={() => move(1)}
        />
      </Panel>
    </div>
  );
}

function formatAge(hours: number): string {
  if (hours < 1) return "moins d'une heure";
  if (hours < 24) return `${Math.floor(hours)} h`;
  return `${Math.floor(hours / 24)} j`;
}
