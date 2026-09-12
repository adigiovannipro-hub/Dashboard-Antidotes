/**
 * Le relevé du radar — orchestration **pure** : la persistance et les
 * connecteurs sont injectés. Pour chaque compte actif : le connecteur de son
 * réseau rend ses derniers posts, on les range par URL (une publication
 * relevée deux fois ne rentre qu'une fois, ses chiffres se rafraîchissent),
 * on note les abonnés relevés et la date, ou l'erreur. Un compte qui échoue
 * n'arrête pas les autres.
 */

import type { InboundThreshold, PostPlatform, RadarAccount } from "../types";
import type { RadarPost, RadarProviders } from "./radar/types";

export type RadarStore = {
  listActiveAccounts(): Promise<RadarAccount[]>;
  upsertPosts(account: RadarAccount, posts: RadarPost[]): Promise<number>;
  saveAccount(id: string, patch: Partial<RadarAccount>): Promise<void>;
};

export type CollectReport = {
  accounts: number;
  collected: number;
  /** Écartés par un seuil : comptés, jamais rangés — le tableau reste lisible. */
  belowThreshold: number;
  skipped: { account: string; reason: string }[];
  errors: { account: string; message: string }[];
  /** Comptes mis en pause faute d'exister encore chez leur réseau. */
  paused: { account: string; message: string }[];
};

/**
 * « Ce compte n'existe pas » — le seul refus qu'il soit inutile de rejouer
 * demain.
 *
 * Un pseudo qui a changé, un compte supprimé, une faute au collage : le
 * réseau répondra la même chose chaque nuit, et le relevé enverrait un
 * échec par jour jusqu'à ce qu'on cesse de les lire — ce qui est pire que
 * le silence, parce que le jour où c'est vraiment cassé personne ne
 * regarde. Ces comptes-là se mettent en pause tout seuls, avec leur raison
 * lisible à l'écran, et se rouvrent d'un clic une fois le pseudo corrigé.
 *
 * Ce qui n'entre **pas** ici, volontairement : jeton expiré, plafond
 * d'appels, panne du réseau. Ils se réparent ailleurs et touchent souvent
 * tous les comptes d'un coup — les mettre en pause éteindrait le radar
 * entier pour une cause qui se règle en rebranchant.
 */
export function isUnknownAccount(message: string): boolean {
  const texte = message.toLowerCase();
  return (
    /"code"\s*:\s*110\b/.test(texte) || // Meta : « Invalid user id »
    texte.includes("2207013") || // Meta : profil introuvable
    texte.includes("invalid user id") ||
    texte.includes("introuvable") ||
    texte.includes("not found") ||
    texte.includes("does not exist") ||
    texte.includes("doesn't exist")
  );
}

/**
 * Un seuil ne juge que ce que le réseau rend : un post sans compteur de vues
 * n'est pas écarté par « ≥ 10 000 vues ». Rejeter sur une grandeur absente
 * viderait le tableau des réseaux qui ne la donnent pas — LinkedIn n'a pas
 * de vues. Même règle qu'à l'écran (`filters.ts`), et c'est voulu : ce qu'on
 * garde et ce qu'on montre se disent de la même façon.
 */
export function passesThreshold(post: RadarPost, threshold: InboundThreshold | undefined): boolean {
  if (!threshold) return true;
  const ok = (value: number | undefined, minimum: number | undefined) =>
    minimum === undefined || value === undefined || value >= minimum;
  return (
    ok(post.metrics.views, threshold.min_views) &&
    ok(post.metrics.likes, threshold.min_likes) &&
    ok(post.metrics.comments, threshold.min_comments)
  );
}

/** Ce que la ligne du compte affiche une fois la veille suspendue. */
export function pausedReason(handle: string): string {
  return `Le réseau ne connaît plus « ${handle} » : veille suspendue. Corrigez le pseudo, ou remettez-le dans la veille pour réessayer.`;
}

export async function collectRadar(options: {
  store: RadarStore;
  providers: RadarProviders;
  now: () => Date;
  /** Les seuils par réseau, tels que les Consignes les portent. */
  thresholds?: Partial<Record<PostPlatform, InboundThreshold>>;
}): Promise<CollectReport> {
  const report: CollectReport = { accounts: 0, collected: 0, belowThreshold: 0, skipped: [], errors: [], paused: [] };
  const accounts = await options.store.listActiveAccounts();
  /* La mise en pause attend la fin de la boucle : quand **plusieurs**
     comptes répondent tous « introuvable » la même nuit, ce ne sont pas
     plusieurs comptes supprimés d'un coup, c'est notre appel qui est faux —
     et éteindre le radar entier sur un défaut de code serait la pire
     réponse possible. Le garde-fou compare une population : avec un seul
     compte relevable, « tous » ne veut rien dire, et un compte renommé est
     le cas normal. */
  const candidates: { account: RadarAccount; label: string; message: string }[] = [];

  for (const account of accounts) {
    const label = `${account.platform}:${account.handle}`;
    const collector = options.providers.collectors[account.platform as PostPlatform];
    if (!collector) {
      report.skipped.push({ account: label, reason: options.providers.missing[account.platform] ?? "connecteur absent" });
      continue;
    }
    report.accounts += 1;
    try {
      const collection = await collector({ handle: account.handle, url: account.url });
      const threshold = options.thresholds?.[account.platform as PostPlatform];
      const kept = collection.posts.filter((post) => passesThreshold(post, threshold));
      report.belowThreshold += collection.posts.length - kept.length;
      const stored = await options.store.upsertPosts(account, kept);
      report.collected += stored;
      await options.store.saveAccount(account.id, {
        followers: collection.followers ?? account.followers,
        last_collected_at: options.now().toISOString(),
        last_error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report.errors.push({ account: label, message });
      await options.store.saveAccount(account.id, { last_error: message }).catch(() => undefined);
      if (isUnknownAccount(message)) candidates.push({ account, label, message });
    }
  }

  if (candidates.length > 0 && (report.accounts === 1 || candidates.length < report.accounts)) {
    for (const { account, label, message } of candidates) {
      /* La ligne porte la phrase, pas la charge utile du réseau : un
         `{"error":{"message":"Invalid user id","code":110}}` posé dans une
         cellule n'apprend rien et ne dit pas quoi faire. Le message brut
         reste dans le rapport, donc dans le journal du passage. */
      await options.store
        .saveAccount(account.id, { is_active: false, last_error: pausedReason(account.handle) })
        .catch(() => undefined);
      report.paused.push({ account: label, message });
    }
  }

  return report;
}
