"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Inbox as InboxIcon, Search } from "lucide-react";
import { toast } from "sonner";

import {
  applyInboxGesture,
  markFilterAsRead,
  type InboxGesture,
} from "@/app/actions/moderation";
import { Panel } from "@/components/ds/surface";
import { ConversationList } from "@/components/moderation/conversation-list";
import { ConversationThread } from "@/components/moderation/conversation-thread";
import {
  InboxFilterBar,
  type ClientChip,
} from "@/components/moderation/inbox-filter-bar";
import { ShortcutsHint } from "@/components/moderation/shortcuts-hint";
import { SelectionBar } from "@/components/moderation/selection-bar";
import { ModerationSyncButton } from "@/components/moderation/sync-button";
import { Input } from "@/components/ui/input";
import type { InboxCounters, InboxSelection } from "@/lib/moderation/counters";
import type { InboxQuery } from "@/lib/moderation/filters";
import type { ChannelConnectionSummary } from "@/lib/moderation/queries";
import type {
  Conversation,
  Draft,
  ModerationChannel,
  ModerationMessage,
  ModerationRole,
} from "@/lib/moderation/types";
import { CHANNEL_LABELS } from "@/lib/moderation/types";
import { cn } from "@/lib/utils";
import { COMPOSIO_TRANSITION_NOTE } from "@/lib/social/direct-connect";

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
/** Au-delà, « Tout lire » demande confirmation : c'est un geste irréversible. */
const CONFIRM_READ_ABOVE = 25;

export function Inbox({
  clients,
  role,
  conversations,
  counters,
  networksShown,
  connections,
  selection,
  query,
  clientSlug,
  search: initialSearch,
  selectedId,
  threadOpen,
  thread,
}: {
  clients: ClientChip[];
  role: ModerationRole;
  conversations: Conversation[];
  counters: InboxCounters;
  networksShown: ModerationChannel[];
  connections: ChannelConnectionSummary[];
  selection: InboxSelection;
  /** Les paramètres bruts de l'URL — « Tout lire » les relit comme la page. */
  query: InboxQuery;
  clientSlug: string | null;
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
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [gesturePending, startGesture] = useTransition();
  const [readingAll, startReadingAll] = useTransition();

  /* La conversation ouverte, en avance sur le serveur.
     Le surlignage attendait la page rendue côté serveur : un clic restait
     sans effet visible le temps de l'aller-retour, et on cliquait deux fois.
     L'état local prend la main dès le clic et **s'efface tout seul** quand le
     serveur rattrape — `base` retient depuis quelle conversation on est
     parti : dès que `selectedId` en diffère, la réponse est arrivée. Dérivé
     au rendu, sans effet : un `setState` dans un effet ferait un rendu de
     plus à chaque clic, pour le même résultat. */
  const [optimistic, setOptimistic] = useState<{
    id: string;
    base: string | null;
  } | null>(null);
  const shownId =
    optimistic && optimistic.base === selectedId ? optimistic.id : selectedId;

  const clientById = useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients],
  );

  const selectedIndex = useMemo(
    () => conversations.findIndex((conversation) => conversation.id === shownId),
    [conversations, shownId],
  );

  const goTo = useCallback(
    (conversationId: string) => {
      setOptimistic({ id: conversationId, base: selectedId });
      const next = new URLSearchParams(searchParams.toString());
      next.set("conv", conversationId);
      router.push(`${pathname}?${next}`, { scroll: false });
    },
    [pathname, router, searchParams, selectedId],
  );

  const runGesture = useCallback(
    (ids: string[], gesture: InboxGesture) => {
      startGesture(async () => {
        const result = await applyInboxGesture({ conversationIds: ids, gesture });
        if (result.ok) {
          toast.success(result.message);
          // Une ligne archivée ou supprimée quitte la vue : la garder cochée
          // ferait promettre à la barre des lignes qui n'y sont plus.
          setChecked((current) => {
            const next = new Set(current);
            for (const id of ids) next.delete(id);
            return next;
          });
          router.refresh();
        } else {
          toast.error(result.error);
        }
      });
    },
    [router],
  );

  /* Ouvrir un fil le marque lu — le geste de toute boîte de réception — et
     silencieusement : un toast à chaque ouverture serait du bruit. Le serveur
     répercute vers Meta (`mark_seen`), et le miroir est complet. La référence
     évite de re-marquer le même fil à chaque rendu. */
  const autoReadId = useRef<string | null>(null);
  useEffect(() => {
    const open = thread.conversation;
    if (!open || !open.unread || autoReadId.current === open.id) return;
    autoReadId.current = open.id;
    void applyInboxGesture({ conversationIds: [open.id], gesture: "lu" }).then(
      (result) => {
        if (result.ok) router.refresh();
      },
    );
  }, [thread.conversation, router]);

  /* Combien de non-lus sont visibles : c'est ce qui décide d'offrir « Tout
     lire ». Un décompte exact de la boîte entière demanderait une requête de
     plus à chaque rendu, pour une information que le bouton donne lui-même
     dans son message de retour. */
  const unreadShown = conversations.filter((conversation) => conversation.unread).length;

  const markAllRead = useCallback(() => {
    /* La confirmation au-delà d'un écran de lignes : marquer quatre cents fils
       comme lus ne se défait pas d'un Ctrl-Z, et le bouton est à deux
       centimètres de « Tout sélectionner ». */
    if (
      unreadShown > CONFIRM_READ_ABOVE &&
      !window.confirm(
        `Marquer comme lues toutes les conversations non lues de ce filtre ? (${unreadShown} visibles, et celles qui suivent.)`,
      )
    ) {
      return;
    }

    startReadingAll(async () => {
      const result = await markFilterAsRead({
        clientSlug: clientSlug ?? undefined,
        query,
      });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }, [clientSlug, query, router, unreadShown]);

  const toggleChecked = useCallback((id: string, isChecked: boolean) => {
    setChecked((current) => {
      const next = new Set(current);
      if (isChecked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

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

  /* L'état du relevé. Un **avertissement** n'est pas une **erreur** : le
     passage qui aboutit écrit quand même dans `last_error` ce qui lui a
     manqué — un refus sur la messagerie, par exemple — alors que les
     commentaires sont bien remontés. L'écran lisait ce champ seul et
     remplaçait « Relevé il y a X » par « canal en erreur », ce qui donnait à
     une boîte parfaitement à jour l'air d'une panne. Le juge est donc
     `status`, et l'âge du relevé s'affiche **toujours**. */
  const lastPolledAt = connections.reduce<string | null>(
    (latest, connection) =>
      connection.last_polled_at && (!latest || connection.last_polled_at > latest)
        ? connection.last_polled_at
        : latest,
    null,
  );
  const failing = connections.filter((connection) => connection.status !== "connected");
  const warned = connections.filter(
    (connection) => connection.status === "connected" && connection.last_error,
  );

  const selectedClient = thread.conversation
    ? clientById.get(thread.conversation.client_id)
    : undefined;

  // Une conversation disparue de la liste (filtre changé, ligne archivée) ne
  // doit pas rester cochée en fantôme.
  const visibleIds = new Set(conversations.map((conversation) => conversation.id));
  const checkedVisible = [...checked].filter((id) => visibleIds.has(id));

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
          Rien n&apos;est encore relevé, et rien ne peut l&apos;être tant
          qu&apos;aucun compte n&apos;est branché. {COMPOSIO_TRANSITION_NOTE}
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
        networks={networksShown}
        selection={selection}
        clientSlug={clientSlug}
        trailing={
          <>
            <span className="type-caption hidden text-text-secondary lg:inline">
              {lastPolledAt ? `Relevé ${relativeTime(lastPolledAt)}` : "Jamais relevé"}
            </span>

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
            ) : warned.length > 0 ? (
              <span
                className="type-caption inline-flex items-center gap-1 font-medium text-warning-ink"
                title={detailDesAvertissements(warned)}
              >
                <AlertTriangle className="size-3.5" strokeWidth={1.75} aria-hidden />
                {warned.length > 1 ? `${warned.length} avertissements` : "avertissement"}
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
      <Panel className="relative flex min-h-0 flex-1 overflow-visible lg:h-[calc(100dvh-14.75rem)] lg:min-h-96 lg:flex-none">
        <SelectionBar
          count={checkedVisible.length}
          pending={gesturePending}
          onGesture={(gesture) => runGesture(checkedVisible, gesture)}
          onClear={() => setChecked(new Set())}
        />

        <div
          className={cn(
            "flex min-h-0 w-full flex-col rounded-l-lg border-border md:w-96 md:shrink-0 md:border-r",
            threadOpen ? "hidden md:flex" : "flex",
          )}
        >
          {conversations.length > 0 ? (
            <div className="type-caption flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5 text-text-secondary">
              {/* Tout sélectionner — la liste affichée entière, donc « tous les
                  messages d'un client » dès que le filtre client est posé : le
                  chemin direct vers le rangement ou la suppression en masse. */}
              <label className="hover:text-text-primary flex min-w-0 flex-1 cursor-pointer items-center gap-2 transition-colors duration-(--motion-duration) ease-standard">
                <input
                  type="checkbox"
                  checked={
                    checkedVisible.length === conversations.length &&
                    conversations.length > 0
                  }
                  onChange={(event) =>
                    setChecked(
                      event.target.checked
                        ? new Set(conversations.map((conversation) => conversation.id))
                        : new Set(),
                    )
                  }
                  className="accent-accent-ink size-3.5"
                  aria-label="Tout sélectionner"
                />
                {checkedVisible.length > 0
                  ? `${checkedVisible.length} sélectionnée(s)`
                  : "Tout sélectionner"}
              </label>

              {/* « Tout lire » ne passe pas par la sélection : la case ci-contre
                  ne coche que les lignes affichées, et le geste unitaire est
                  plafonné à deux cents identifiants. Ici le serveur relit le
                  filtre et marque **tout** ce qu'il désigne. */}
              {unreadShown > 0 ? (
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={readingAll}
                  className="focus-visible:ring-ring shrink-0 rounded-md px-1.5 py-0.5 font-medium text-accent-ink transition-colors duration-(--motion-duration) ease-standard hover:bg-accent-subtle focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Tout lire
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto">
          <ConversationList
            conversations={conversations}
            clients={clientById}
            showClient={clientSlug === null && clients.length > 1}
            selectedId={shownId}
            selectedIds={checked}
            pending={gesturePending}
            onToggle={toggleChecked}
            onGesture={runGesture}
            emptyMessage="Aucune conversation ne correspond à ces filtres."
            onSelect={goTo}
          />
          </div>
        </div>

        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-r-lg",
            threadOpen ? "flex" : "hidden md:flex",
          )}
        >
          <ConversationThread
            key={thread.conversation?.id ?? "empty"}
            clientSlug={selectedClient?.slug ?? null}
            clientName={selectedClient?.name ?? null}
            clientLogoUrl={selectedClient?.logoUrl ?? null}
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

/**
 * Le détail d'un avertissement de relevé, lisible.
 *
 * Le titre ne portait que le message du premier canal, brut — et Meta rend
 * volontiers « An unknown error occurred », qui n'apprend rien et ne dit même
 * pas de quel canal il s'agit. On nomme donc le canal et le compte, une ligne
 * par avertissement, et on traduit le refus générique de Meta en ce qu'il
 * signifie en pratique : réessayer au passage suivant.
 */
function detailDesAvertissements(warned: ChannelConnectionSummary[]): string {
  return warned
    .map((connection) => {
      const canal = CHANNEL_LABELS[connection.channel] ?? connection.channel;
      const compte = connection.display_name ? ` · ${connection.display_name}` : "";
      const message = connection.last_error?.trim() ?? "";
      const lisible =
        message === "" || /unknown error/i.test(message)
          ? "Meta n'a pas dit pourquoi. Le passage suivant réessaiera ; si l'avertissement revient, c'est une portée à rebrancher."
          : message;
      return `${canal}${compte} — ${lisible}`;
    })
    .join("\n");
}
