/**
 * La portée d'un relevé d'Inbox : court à l'ouverture, complet la nuit.
 *
 * Le relevé ne connaissait qu'une forme — soixante jours de conversations,
 * cinquante fils par page, les photos de profil et les auteurs masqués
 * redemandés à chaque passage. Ouvrir l'inbox déclenchait donc, chaque fois,
 * le rattrapage entier du compte. C'est ce qui le rendait interminable, et
 * c'est ce qui faisait tomber les boîtes Instagram : une réponse que Meta
 * n'assemble pas dans son délai revient en « long polling terminated ».
 *
 * Deux portées, donc, et une seule différence de nature : ce qu'on **redemande**.
 *
 *   • `jour` — ce que l'ouverture de l'écran déclenche. Deux jours de
 *     conversations, aucun rattrapage de profil, et les commentaires des
 *     seules publications dont le compteur a bougé (`moderation_post_cursors`).
 *   • `complet` — le passage nocturne. Soixante jours, rattrapages compris,
 *     et les curseurs remis à jour sans être consultés : c'est la passe de
 *     réparation, elle doit voir ce que les passes courtes ont pu manquer.
 *
 * Module **pur** : aucune horloge implicite, aucun accès réseau. La date du
 * moment se passe en paramètre, ce qui le rend testable et permet aux trois
 * appelants — écran, route, script — de partager la même arithmétique.
 */

export type SyncScope = "jour" | "complet";

export const SYNC_SCOPES: readonly SyncScope[] = ["jour", "complet"];

/** Ce qu'un humain lit du relevé qu'il vient de lancer. */
export const SYNC_SCOPE_LABELS: Record<SyncScope, string> = {
  jour: "Relevé du jour",
  complet: "Relevé complet",
};

/**
 * La fenêtre des **conversations privées**, en jours.
 *
 * Deux jours et non un : le relevé du jour part à l'ouverture de l'écran,
 * donc à des heures irrégulières, et la passe nocturne est un cron GitHub qui
 * saute parfois sa fenêtre ; le relevé tourne en UTC quand la boîte vit à
 * Paris ; et Meta antidate parfois `updated_time` d'un fil réveillé par un
 * accusé de lecture. Un seul jour laisserait un trou que rien ne viendrait
 * combler avant la nuit.
 *
 * Les **publications**, elles, gardent leur fenêtre de soixante jours dans les
 * deux portées : un commentaire arrive aujourd'hui sous un reel d'il y a six
 * semaines, et raccourcir cette liste-là reviendrait à ne jamais le voir. Ce
 * n'est pas la fenêtre qui rend le passage court, ce sont les curseurs.
 */
const CONVERSATION_WINDOW_DAYS: Record<SyncScope, number> = {
  jour: 2,
  complet: 60,
};

export function conversationWindowDays(scope: SyncScope): number {
  return CONVERSATION_WINDOW_DAYS[scope];
}

/** La borne basse `YYYY-MM-DD` des conversations, calculée en UTC. */
export function conversationSince(scope: SyncScope, now: Date): string {
  const since = new Date(now.getTime());
  since.setUTCDate(since.getUTCDate() - conversationWindowDays(scope));
  return since.toISOString().slice(0, 10);
}

/**
 * Vrai quand le passage saute les publications dont le compteur de
 * commentaires n'a pas bougé. Le passage nocturne, lui, redescend tout :
 * c'est lui qui répare ce qu'un compteur menteur aurait fait manquer.
 */
export function usesPostCursors(scope: SyncScope): boolean {
  return scope === "jour";
}

/**
 * Vrai quand le passage rattrape photos de profil et auteurs masqués — des
 * appels un par un, plafonnés, qui n'apportent rien à qui ouvre son écran et
 * veut voir les fils du jour.
 */
export function backfillsProfiles(scope: SyncScope): boolean {
  return scope === "complet";
}

/**
 * Combien de paliers l'escalier des **messages privés** a le droit de
 * descendre avant de déclarer la boîte indisponible.
 *
 * Chaque palier coûte au plus un appel de 45 s — le timeout maison ne se
 * rejoue plus (`graph.ts`). Cinq paliers rejoués trois fois faisaient 700 s
 * par Page refusée, et le relevé horaire y passait 750 s sur 872. Un seul
 * palier à l'ouverture de l'écran : la route Vercel a soixante secondes, et
 * c'est le palier réduit, celui qui passe quand la boîte passe. Trois la
 * nuit : le passage de réparation a le temps d'essayer les en-têtes, pas
 * celui de s'enliser.
 */
const DIRECT_MESSAGE_STEP_BUDGET: Record<SyncScope, number> = {
  jour: 1,
  complet: 3,
};

export function directMessageStepBudget(scope: SyncScope): number {
  return DIRECT_MESSAGE_STEP_BUDGET[scope];
}

/**
 * La portée reçue d'une requête ou d'un workflow. `null` sur une valeur
 * inconnue ou absente : c'est l'appelant qui choisit son défaut — l'écran
 * relève le jour, le script relève tout.
 */
export function parseSyncScope(value: unknown): SyncScope | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return SYNC_SCOPES.find((scope) => scope === normalized) ?? null;
}
