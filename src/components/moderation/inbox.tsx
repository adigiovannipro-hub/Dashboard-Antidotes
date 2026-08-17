"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Inbox as InboxIcon, Search } from "lucide-react";

import { Panel } from "@/components/ds/surface";
import { ConversationList } from "@/components/moderation/conversation-list";
import { ConversationThread } from "@/components/moderation/conversation-thread";
import {
  InboxFilterBar,
  type ClientChip,
} from "@/components/moderation/inbox-filter-bar";
import { ShortcutsHint } from "@/components/moderation/shortcuts-hint";
import { ModerationSyncButton } from "@/components/moderation/sync-button";
import { Input } from "@/components/ui/input";
import type {
  ChannelConnectionSummary,
  InboxCounters,
} from "@/lib/moderation/queries";
import type {
  Conversation,
  Draft,
  InboxView,
  ModerationMessage,
  ModerationRole,
  StatusGroup,
} from "@/lib/moderation/types";
import { cn } from "@/lib/utils";

/**
 * L'inbox de modération, croisée tous clients.
 *
 * Le modèle est la Boîte de réception Meta Business Suite, en mieux rangé :
 * les canaux en onglets au sommet avec leurs compteurs, les clients et les
 * statuts juste dessous, puis deux volets — la liste, le fil. Pas de bande de
 * mesures : les compteurs vivent sur les filtres qu'ils qualifient.
 *
 * Conçue pour traiter cent messages en dix minutes : le clavier fait tout, et
 * la navigation entre conversations ne recharge que le volet de droite.
 */
export function Inbox({
  clients,
  role,
  conversations,
  counters,
  connections,
  view,
  statusGroup,
  clientSlug,
  unreadOnly,
  highPriorityOnly,
  search: initialSearch,
  selectedId,
  threadOpen,
  thread,
}: {
  clients: ClientChip[];
  role: ModerationRole;
  conversations: Conversation[];
  counters: InboxCounters;
  connections: ChannelConnectionSummary[];
  view: InboxView;
  statusGroup: StatusGroup;
  clientSlug: string | null;
  unreadOnly: boolean;
  highPriorityOnly: boolean;
  search: string;
  selectedId: string | null;
  /** Vrai quand l'URL porte `?conv=` : sur mobile, le fil couvre la liste. */
  threadOpen: boolean;
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
  const [search, setSearch] = useState(initialSearch);

  const clientById = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients],
  );

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

  const closeThread = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("conv");
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const move = useCallback(
    (delta: number) => {
      if (conversations.length === 0) return;
      const base = selectedIndex === -1 ? 0 : selectedIndex;
      const next = Math.min(Math.max(base + delta, 0), conversations.length - 1);
      goTo(conversations[next]!.id);
    },
    [conversations, goTo, selectedIndex],
  );

  // Raccourcis de navigation. Les actions (valider, refuser, ignorer, mettre
  // en attente) sont gérées par le fil, qui seul connaît le brouillon courant.
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

  // L'état du relevé : le plus récent passage, et les canaux en panne.
  const lastPolledAt = connections.reduce<string | null>(
    (latest, connection) =>
      connection.last_polled_at && (!latest || connection.last_polled_at > latest)
        ? connection.last_polled_at
        : latest,
    null,
  );
  const failing = connections.filter((connection) => connection.last_error);

  const selectedClient = thread.conversation
    ? clientById.get(thread.conversation.client_id)
    : undefined;

  if (clients.length === 0) {
    // Le module avant la première synchronisation — visible de l'owner seul.
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border bg-surface-sunken px-5 py-4">
        <InboxIcon
          aria-hidden
          strokeWidth={1.75}
          className="size-5 shrink-0 text-text-tertiary"
        />
        <p className="type-body min-w-0 flex-1 text-text-secondary">
          Rien n&apos;est encore relevé. Brancher un compte Instagram ou une
          Page dans Connexions, sur le Planning d&apos;un espace, puis lancer
          le premier relevé — ensuite, il tourne chaque heure tout seul.
        </p>
        <ModerationSyncButton />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <InboxFilterBar
        clients={clients}
        counters={counters}
        view={view}
        statusGroup={statusGroup}
        clientSlug={clientSlug}
        unreadOnly={unreadOnly}
        highPriorityOnly={highPriorityOnly}
        trailing={
          <>
            {failing.length > 0 ? (
              <span
                className="type-caption inline-flex items-center gap-1 font-medium text-danger-ink"
                title={failing[0]!.last_error ?? undefined}
              >
                <AlertTriangle className="size-3.5" strokeWidth={1.75} aria-hidden />
                {failing.length > 1
                  ? `${failing.length} canaux en erreur`
                  : "canal en erreur"}
              </span>
            ) : lastPolledAt ? (
              <span className="type-caption hidden text-text-secondary lg:inline">
                Relevé {relativeTime(lastPolledAt)}
              </span>
            ) : null}

            <form onSubmit={submitSearch} className="relative">
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
                className="w-44 pl-9 xl:w-64"
              />
            </form>

            {role === "owner" ? <ModerationSyncButton /> : null}
            <ShortcutsHint />
          </>
        }
      />

      {/* Les deux volets dans une seule surface. Sur mobile, un seul à la
          fois : la liste, puis le fil quand une conversation est ouverte. À
          partir de lg, le panneau est borné à l'écran : chaque volet défile
          chez lui et les actions du fil restent sous la main — cent messages
          ne font pas cent écrans de page. */}
      <Panel className="flex min-h-0 flex-1 overflow-hidden lg:h-[calc(100dvh-14.75rem)] lg:min-h-96 lg:flex-none">
        <div
          className={cn(
            "min-h-0 w-full overflow-y-auto border-border md:w-96 md:shrink-0 md:border-r",
            threadOpen ? "hidden md:block" : "block",
          )}
        >
          <ConversationList
            conversations={conversations}
            clients={clientById}
            showClient={clientSlug === null && clients.length > 1}
            selectedId={selectedId}
            emptyMessage={
              view === "messages"
                ? "Les messages privés ne sont pas encore branchés — leur permission Meta n'est pas demandée. Les commentaires, eux, sont relevés chaque heure."
                : "Aucune conversation ne correspond à ces filtres."
            }
            onSelect={goTo}
          />
        </div>

        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 flex-col",
            threadOpen ? "flex" : "hidden md:flex",
          )}
        >
          <ConversationThread
            key={thread.conversation?.id ?? "empty"}
            clientSlug={selectedClient?.slug ?? null}
            clientName={selectedClient?.name ?? null}
            role={role}
            conversation={thread.conversation}
            messages={thread.messages}
            draft={thread.draft}
            onAdvance={() => move(1)}
            onBack={closeThread}
          />
        </div>
      </Panel>
    </div>
  );
}

function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.round(hours / 24)} j`;
}
