import {
  ACTIONABLE_STATUSES,
  countsAsPending,
  isSpam,
  MODERATION_FLAGS,
  STATUS_GROUP_MEMBERS,
  type ConversationKind,
  type ConversationStatus,
  type ModerationChannel,
  type StatusGroup,
} from "./types";

/**
 * Les compteurs de l'Inbox, dérivés d'**un seul tableau** et d'une seule
 * fonction.
 *
 * C'est le cœur de la refonte du 11/09 : avant, chaque badge était calculé par
 * sa propre boucle, avec sa propre définition de « à traiter », et rien ne
 * garantissait qu'ils parlaient de la même chose. Un onglet pouvait promettre
 * douze conversations que le clic n'affichait pas.
 *
 * La règle est désormais unique et se lit en une phrase : **le compteur d'une
 * option dit ce que le clic sur cette option montrera.** Le badge d'un réseau
 * compte donc les conversations qui passent tous les filtres *sauf* celui des
 * réseaux ; le badge d'un client, tous sauf celui des clients ; et ainsi de
 * suite. C'est ce qui rend l'invariant vrai : sans filtre de réseau posé, la
 * somme des réseaux vaut le total, et de même pour les clients.
 *
 * Pure, sans Supabase : les lignes arrivent d'une lecture unique, et le test
 * encode l'invariant plutôt que la confiance.
 */

export type CounterRow = {
  client_id: string;
  channel: ModerationChannel;
  kind: ConversationKind;
  status: ConversationStatus;
  unread: boolean;
  flags: string[];
  last_message_at: string;
};

export type InboxSelection = {
  /** Réseaux cochés. Liste vide = aucun filtre, donc tous. */
  networks: ModerationChannel[];
  /** Client choisi, ou tous. */
  clientId?: string;
  /** Le segment de statut. Il y en a toujours un : « Toutes » n'existe plus. */
  statusGroup: StatusGroup;
  unreadOnly: boolean;
  flaggedOnly: boolean;
  /** Bascule « Messages privés » : les commentaires sortent de la liste. */
  dmOnly: boolean;
};

/* La recherche plein texte n'entre pas dans la sélection : elle porte sur des
   colonnes que ces lignes n'embarquent pas, et c'est la requête qui l'applique.
   Un compteur calculé sans elle serait faux dès qu'elle est posée — d'où la
   règle : recherche active, les badges se taisent plutôt que de mentir (voir
   `getInboxCounters`). */

export type InboxCounters = {
  /** Ce que la liste affiche, filtres compris. */
  total: number;
  /** Non lus dans ce même périmètre. */
  unread: number;
  /** Conversations portant au moins un drapeau, dans ce même périmètre. */
  flagged: number;
  /** Non lus **à traiter** : la définition de la pastille du rail. */
  pending: number;
  /** Ancienneté du plus vieux message à traiter du périmètre, en heures. */
  oldestActionableHours: number | null;
  /** Badge d'un réseau : tous les filtres sauf celui des réseaux. */
  byNetwork: Record<string, number>;
  /** Badge d'un client : tous les filtres sauf celui des clients. */
  byClient: Record<string, number>;
  /** Badge d'un segment : tous les filtres sauf celui des statuts. */
  byStatusGroup: Record<StatusGroup, number>;
};

/**
 * Les réseaux que le module relève vraiment.
 *
 * Ils s'affichent **même à zéro** : une rangée qui perd une icône dès que la
 * boîte se vide déplace les autres, et on clique alors sur le mauvais réseau.
 * Un réseau absent de cette liste mais présent dans les données s'ajoute
 * derrière — une reprise d'historique ne doit pas devenir invisible.
 */
export const INGESTED_CHANNELS: ModerationChannel[] = [
  "instagram",
  "facebook",
  "youtube",
];

export function networksToShow(rows: readonly CounterRow[]): ModerationChannel[] {
  const extras = new Set<ModerationChannel>();
  for (const row of rows) {
    if (!INGESTED_CHANNELS.includes(row.channel)) extras.add(row.channel);
  }
  return [...INGESTED_CHANNELS, ...[...extras].sort()];
}

/** Un drapeau reconnu — ce que « Signalées » montre. */
function hasFlag(row: CounterRow): boolean {
  return row.flags.some((flag) =>
    (MODERATION_FLAGS as readonly string[]).includes(flag),
  );
}

/** Le spam quitte « À traiter », partout et de la même façon. */
function inStatusGroup(row: CounterRow, group: StatusGroup): boolean {
  if (!STATUS_GROUP_MEMBERS[group].includes(row.status)) return false;
  return group !== "a-traiter" || !isSpam(row.flags);
}

/**
 * Un prédicat par dimension. Les compteurs se construisent en **retirant**
 * une dimension du lot — c'est ce qui fait qu'un badge ne ment pas.
 */
type Dimension = "network" | "client" | "status";

function matches(
  row: CounterRow,
  selection: InboxSelection,
  except?: Dimension,
): boolean {
  if (
    except !== "network" &&
    selection.networks.length > 0 &&
    !selection.networks.includes(row.channel)
  ) {
    return false;
  }
  if (except !== "client" && selection.clientId && row.client_id !== selection.clientId) {
    return false;
  }
  if (except !== "status" && !inStatusGroup(row, selection.statusGroup)) return false;
  if (selection.unreadOnly && !row.unread) return false;
  if (selection.flaggedOnly && !hasFlag(row)) return false;
  if (selection.dmOnly && row.kind !== "dm") return false;
  return true;
}

export function deriveCounters(
  rows: readonly CounterRow[],
  selection: InboxSelection,
  now = new Date(),
): InboxCounters {
  const counters: InboxCounters = {
    total: 0,
    unread: 0,
    flagged: 0,
    pending: 0,
    oldestActionableHours: null,
    byNetwork: Object.fromEntries(networksToShow(rows).map((channel) => [channel, 0])),
    byClient: {},
    byStatusGroup: { "a-traiter": 0, "en-attente": 0, traitees: 0 },
  };

  for (const row of rows) {
    // Un client ne disparaît pas de la rangée parce qu'on a filtré ailleurs :
    // sa case existe dès qu'il a une conversation, à zéro s'il le faut.
    counters.byClient[row.client_id] ??= 0;

    if (matches(row, selection)) {
      counters.total += 1;
      if (row.unread) counters.unread += 1;
      if (hasFlag(row)) counters.flagged += 1;
      if (countsAsPending(row)) counters.pending += 1;

      if (ACTIONABLE_STATUSES.includes(row.status) && !isSpam(row.flags)) {
        const hours =
          (now.getTime() - new Date(row.last_message_at).getTime()) / 3_600_000;
        if (counters.oldestActionableHours === null || hours > counters.oldestActionableHours) {
          counters.oldestActionableHours = hours;
        }
      }
    }

    if (matches(row, selection, "network") && row.channel in counters.byNetwork) {
      counters.byNetwork[row.channel] = (counters.byNetwork[row.channel] ?? 0) + 1;
    }
    if (matches(row, selection, "client")) {
      counters.byClient[row.client_id] = (counters.byClient[row.client_id] ?? 0) + 1;
    }
    if (matches(row, selection, "status")) {
      for (const group of ["a-traiter", "en-attente", "traitees"] as const) {
        if (inStatusGroup(row, group)) counters.byStatusGroup[group] += 1;
      }
    }
  }

  return counters;
}
