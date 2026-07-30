"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Clock, Search } from "lucide-react";

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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* En-tête : sélecteur de client, compteur global, ancienneté. */}
      <div className="border-border flex flex-wrap items-center gap-3 border-b px-4 py-2">
        <nav className="flex items-center gap-1" aria-label="Clients">
          {clients.map((candidate) => (
            <Link
              key={candidate.id}
              href={`/moderation/${candidate.slug}`}
              aria-current={candidate.id === client.id ? "page" : undefined}
              className={cn(
                "rounded-md px-2.5 py-1 text-sm transition-colors",
                candidate.id === client.id
                  ? "bg-card text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {candidate.name}
            </Link>
          ))}
        </nav>

        <span
          className="bg-brand-mint text-heading rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
          title="Conversations à gérer"
        >
          {counters.actionable} à gérer
        </span>

        {counters.highPriority > 0 ? (
          <span className="text-brand-red inline-flex items-center gap-1 text-xs font-medium">
            <AlertTriangle className="size-3.5" aria-hidden />
            {counters.highPriority} signalées
          </span>
        ) : null}

        {/* Ancienneté du plus vieux message : le seul signal d'alerte en V1,
            puisqu'il n'y a volontairement aucune notification externe. */}
        {staleHours !== null ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs",
              staleHours > 24 ? "text-brand-red font-medium" : "text-muted-foreground",
            )}
          >
            <Clock className="size-3.5" aria-hidden />
            Plus ancien : {formatAge(staleHours)}
          </span>
        ) : null}

        <form onSubmit={submitSearch} className="relative ml-auto">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            aria-hidden
          />
          <Input
            ref={searchRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher   /"
            aria-label="Rechercher une conversation"
            className="h-8 w-56 pl-8"
          />
        </form>

        <ShortcutsHint />
      </div>

      <div className="flex min-h-0 flex-1">
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
      </div>
    </div>
  );
}

function formatAge(hours: number): string {
  if (hours < 1) return "moins d'une heure";
  if (hours < 24) return `${Math.floor(hours)} h`;
  return `${Math.floor(hours / 24)} j`;
}
