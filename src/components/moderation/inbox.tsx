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
import { Inbox as InboxIcon, Search, Smile } from "lucide-react";
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
import { SelectionBar } from "@/components/moderation/selection-bar";
import { ShortcutsHint } from "@/components/moderation/shortcuts-hint";
import { ModerationSyncButton } from "@/components/moderation/sync-button";
import { SyncPanel } from "@/components/moderation/sync-panel";
import { Input } from "@/components/ui/input";
import type { InboxCounters, InboxSelection } from "@/lib/moderation/counters";
import type { InboxQuery } from "@/lib/moderation/filters";
import type { ChannelConnectionSummary } from "@/lib/moderation/queries";
import { isReactionOnly } from "@/lib/moderation/reactions";
import { describeEmptyState, type EmptyState } from "@/lib/moderation/empty-state";
import { statusGroupOf } from "@/lib/moderation/types";
import type {
  Conversation,
  Draft,
  ModerationChannel,
  ModerationMessage,
  ModerationRole,
  SavedReply,
} from "@/lib/moderation/types";
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
  savedReplies,
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
  savedReplies: SavedReply[];
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

  /* Le geste s'applique à l'écran avant le serveur.
     Une action de masse sur trente lignes mettait deux secondes à se voir :
     on recliquait, et le doute valait bien plus cher que le gain. La table
     `overlay` porte le changement attendu, la liste le rend tout de suite, et
     un échec **retire** l'entrée — la ligne redevient ce qu'elle était, avec
     l'erreur en toast. Elle se vide dès que le serveur rend sa version. */
  const [pendingOverlay, setPendingOverlay] = useState<{
    base: Conversation[];
    patch: Record<string, Partial<Conversation>>;
  } | null>(null);
  /* Dérivé au rendu, sans effet : l'overlay ne vaut que pour la liste sur
     laquelle il a été posé. Dès que le serveur en rend une autre, l'identité
     du tableau change et l'attendu s'efface tout seul — le même mécanisme que
     le surlignage optimiste ci-dessous, et pour la même raison : un
     `setState` dans un effet ferait un rendu de plus à chaque clic. */
  const overlay = useMemo(
    () =>
      pendingOverlay && pendingOverlay.base === conversations
        ? pendingOverlay.patch
        : {},
    [pendingOverlay, conversations],
  );
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
  const clientNames = useMemo(
    () => new Map(clients.map((client) => [client.id, client.name])),
    [clients],
  );

  /* La liste telle qu'elle doit se voir : l'attendu par-dessus le rendu, et
     les lignes que le geste fait sortir du segment courant retirées. Sans ce
     retrait, « Marquer traitées » laissait trente lignes en place avec un
     nouveau libellé, ce qui ne ressemble pas à un rangement. */
  const shown = useMemo(() => {
    const rows = conversations.map((conversation) =>
      overlay[conversation.id]
        ? ({ ...conversation, ...overlay[conversation.id] } as Conversation)
        : conversation,
    );
    return rows.filter(
      (conversation) =>
        !overlay[conversation.id] ||
        (!overlay[conversation.id]?.deleted_at &&
          statusGroupOf(conversation.status) === selection.statusGroup),
    );
  }, [conversations, overlay, selection.statusGroup]);

  /* Les réactions se rangent à part.
     « ❤️ », « 🔥 », « @sophie » : sur un compte qui marche, c'est la moitié du
     volume, et ça n'appelle aucune réponse. Mêlées au reste, elles noient les
     vraies questions ; regroupées en bas, elles se closent d'un geste. Seule
     la charge de travail les sépare — dans « Traitées », elles ont déjà leur
     place au fil de l'eau. */
  const [reactions, questions] = useMemo(() => {
    if (selection.statusGroup !== "a-traiter") {
      return [[] as Conversation[], shown] as const;
    }
    const left: Conversation[] = [];
    const right: Conversation[] = [];
    for (const conversation of shown) {
      (conversation.kind === "comment" && isReactionOnly(conversation.excerpt)
        ? left
        : right
      ).push(conversation);
    }
    return [left, right] as const;
  }, [shown, selection.statusGroup]);

  const selectedIndex = useMemo(
    () => shown.findIndex((conversation) => conversation.id === shownId),
    [shown, shownId],
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
      const expected = expectedPatch(gesture);
      setPendingOverlay((current) => {
        const patch = current?.base === conversations ? { ...current.patch } : {};
        for (const id of ids) patch[id] = { ...patch[id], ...expected };
        return { base: conversations, patch };
      });

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
          // Retour en arrière : la ligne reprend l'état que le serveur porte.
          setPendingOverlay((current) => {
            if (!current) return current;
            const patch = { ...current.patch };
            for (const id of ids) delete patch[id];
            return { base: current.base, patch };
          });
          toast.error(result.error);
        }
      });
    },
    [conversations, router],
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
  const unreadShown = shown.filter((conversation) => conversation.unread).length;

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

  /* Pourquoi la liste est vide. Quatre raisons, quatre gestes — une seule
     phrase pour les quatre ne disait jamais quoi faire. */
  const filtered =
    selection.networks.length > 0 ||
    Boolean(selection.clientId) ||
    selection.unreadOnly ||
    selection.flaggedOnly ||
    selection.dmOnly ||
    Boolean(initialSearch);
  const emptyState = describeEmptyState({
    connections: connections.length,
    everPolled: connections.some((connection) => connection.last_polled_at),
    filtered,
    segment: selection.statusGroup,
  });

  const resetFilters = useCallback(() => {
    // Le segment reste : c'est le cadre de travail, pas un filtre qu'on a
    // posé par mégarde.
    const next = new URLSearchParams();
    if (selection.statusGroup !== "a-traiter") next.set("statut", selection.statusGroup);
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, selection.statusGroup]);

  const closeThread = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("conv");
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const move = useCallback(
    (delta: number) => {
      if (shown.length === 0) return;
      const base = selectedIndex === -1 ? 0 : selectedIndex;
      const next = Math.min(Math.max(base + delta, 0), shown.length - 1);
      goTo(shown[next]!.id);
    },
    [shown, goTo, selectedIndex],
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

  const selectedClient = thread.conversation
    ? clientById.get(thread.conversation.client_id)
    : undefined;

  // Une conversation disparue de la liste (filtre changé, ligne archivée) ne
  // doit pas rester cochée en fantôme.
  const visibleIds = new Set(shown.map((conversation) => conversation.id));
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
      {/* Sans bouton : « ? » l'ouvre, et « ? » est dans la liste. */}
      <ShortcutsHint />

      <InboxFilterBar
        clients={clients}
        counters={counters}
        networks={networksShown}
        selection={selection}
        clientSlug={clientSlug}
        trailing={
          <>
            {/* Un seul repère pour tout l'état du relevé : l'âge, les erreurs,
                le détail par client et par réseau, l'échéance des jetons et le
                bouton pour relever. Il en vivait trois dans cette barre, dont
                deux ne disaient pas ce qui clochait. */}
            <SyncPanel
              connections={connections}
              clientNames={clientNames}
              isOwner={role === "owner"}
            />

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
          {shown.length > 0 ? (
            <div className="type-caption flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5 text-text-secondary">
              {/* Tout sélectionner — la liste affichée entière, donc « tous les
                  messages d'un client » dès que le filtre client est posé : le
                  chemin direct vers le rangement ou la suppression en masse. */}
              <label className="hover:text-text-primary flex min-w-0 flex-1 cursor-pointer items-center gap-2 transition-colors duration-(--motion-duration) ease-standard">
                <input
                  type="checkbox"
                  checked={
                    checkedVisible.length === shown.length && shown.length > 0
                  }
                  onChange={(event) =>
                    setChecked(
                      event.target.checked
                        ? new Set(shown.map((conversation) => conversation.id))
                        : new Set(),
                    )
                  }
                  className="accent-accent-ink size-3.5"
                  aria-label="Tout sélectionner"
                />
                {checkedVisible.length > 0
                  ? `${checkedVisible.length} sélectionnée(s)`
                  : unreadShown > 0
                    ? // Ce qu'on vient chercher en ouvrant l'Inbox se dit en
                      // tête de liste, en clair. « Tout sélectionner » est un
                      // geste, pas une information.
                      `${unreadShown} non ${unreadShown > 1 ? "lues" : "lue"}`
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
            conversations={questions}
            clients={clientById}
            showClient={clientSlug === null && clients.length > 1}
            selectedId={shownId}
            selectedIds={checked}
            pending={gesturePending}
            onToggle={toggleChecked}
            onGesture={runGesture}
            empty={<EmptyList state={emptyState} isOwner={role === "owner"} onReset={resetFilters} />}
            onSelect={goTo}
          />
          </div>

          {reactions.length > 0 ? (
            <details className="border-border shrink-0 border-t">
              <summary className="type-caption hover:bg-surface-sunken flex cursor-pointer items-center gap-2 px-3 py-2 text-text-secondary transition-colors duration-(--motion-duration) ease-standard">
                <Smile className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                <span className="min-w-0 flex-1">
                  Réactions seules · {reactions.length}
                </span>
              </summary>
              <div className="px-3 pb-2">
                <p className="type-caption text-text-secondary">
                  Emojis et mentions, sans question. Aucune réponse ne leur a été
                  demandée au modèle.
                </p>
                <button
                  type="button"
                  disabled={gesturePending}
                  onClick={() =>
                    runGesture(
                      reactions.map((conversation) => conversation.id),
                      "traitee",
                    )
                  }
                  className="focus-visible:ring-ring mt-2 rounded-md px-1.5 py-0.5 type-caption font-medium text-accent-ink transition-colors duration-(--motion-duration) ease-standard hover:bg-accent-subtle focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clore les {reactions.length} sans réponse
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto border-t border-border">
                <ConversationList
                  conversations={reactions}
                  clients={clientById}
                  showClient={clientSlug === null && clients.length > 1}
                  selectedId={shownId}
                  selectedIds={checked}
                  pending={gesturePending}
                  onToggle={toggleChecked}
                  onGesture={runGesture}
                  empty={null}
                  onSelect={goTo}
                />
              </div>
            </details>
          ) : null}
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
            savedReplies={savedReplies}
            onAdvance={() => move(1)}
            onBack={closeThread}
          />
        </div>
      </Panel>
    </div>
  );
}

/**
 * L'état vide, rendu.
 *
 * Une phrase, et **une sortie quand il y en a une**. Quand il n'y en a pas —
 * une boîte à jour — l'absence de bouton est le message : ce n'est pas une
 * panne, c'est fini.
 */
function EmptyList({
  state,
  isOwner,
  onReset,
}: {
  state: EmptyState;
  isOwner: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <p className="type-label text-text-primary">{state.title}</p>
      {state.hint ? (
        <p className="type-caption max-w-xs text-text-secondary">{state.hint}</p>
      ) : null}

      {state.action === "reinitialiser" ? (
        <button
          type="button"
          onClick={onReset}
          className="focus-visible:ring-ring type-caption mt-1 rounded-md px-2 py-1 font-medium text-accent-ink transition-colors duration-(--motion-duration) ease-standard hover:bg-accent-subtle focus-visible:ring-2 focus-visible:outline-none"
        >
          Retirer les filtres
        </button>
      ) : null}

      {state.action === "relever" && isOwner ? (
        <div className="mt-1">
          <ModerationSyncButton />
        </div>
      ) : null}

      {state.action === "brancher" ? (
        <p className="type-caption text-text-secondary">
          {COMPOSIO_TRANSITION_NOTE}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Ce qu'un geste change, vu de l'écran.
 *
 * Le miroir de `patchOfGesture` côté serveur, réduit à ce que la liste
 * affiche. Les deux doivent rester d'accord : une ligne qui se range
 * autrement à l'écran que dans la base clignote au rafraîchissement suivant.
 * `signaler` ne figure pas ici — le drapeau dépend de la ligne, et il se voit
 * de toute façon au rendu suivant.
 */
function expectedPatch(gesture: InboxGesture): Partial<Conversation> {
  switch (gesture) {
    case "lu":
      return { unread: false };
    case "non-lu":
      return { unread: true };
    case "traitee":
      return { status: "answered_elsewhere", unread: false };
    case "archiver":
      return { status: "ignored", unread: false };
    case "restaurer":
      return { status: "to_process" };
    case "supprimer":
      return { deleted_at: new Date().toISOString() };
    default:
      return {};
  }
}
