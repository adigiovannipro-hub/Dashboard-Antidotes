import { createHash } from "node:crypto";

/**
 * Fathom → « Mon travail » : la décision, sans réseau ni base.
 *
 * Tout ce qui suit est pur. Ce qui vient du dehors — les réunions — arrive en
 * argument, ce qui doit être écrit repart en valeur de retour. C'est ce qui
 * permet de tester les règles sur des cas réels sans compte Fathom, et c'est
 * là que vivent les trois seules décisions du chantier : quels items retenir,
 * à quel client les rattacher, à quelle date les poser.
 *
 * Fathom produit déjà les tâches de fin de réunion en clair, avec la personne
 * à qui chacune revient et un lien horodaté vers le moment exact où elle a été
 * dite. Il n'y a donc rien à faire lire par un modèle : le compte rendu est
 * déjà structuré, et un extracteur n'aurait fait qu'ajouter du coût et une
 * source d'erreur devant une donnée qui est déjà propre.
 */

// --- Ce que l'API rend, réduit à ce qu'on lit --------------------------------

export type FathomAssignee = {
  name: string | null;
  email: string | null;
};

export type FathomActionItem = {
  description: string;
  completed: boolean;
  assignee: FathomAssignee | null;
  /** Lien horodaté vers le moment de la réunion où l'item a été dit. */
  playbackUrl: string | null;
};

export type FathomMeeting = {
  /** Identifiant stable de l'enregistrement, tel que rendu par l'API. */
  id: string;
  title: string;
  url: string | null;
  /** Début de la réunion, ISO 8601. */
  startedAt: string;
  /** Qui a enregistré — par défaut, le propriétaire des tâches. */
  recordedBy: FathomAssignee | null;
  actionItems: FathomActionItem[];
};

// --- Ce qu'on en tire --------------------------------------------------------

/** Un espace client, réduit à ce que la reconnaissance a besoin de lire. */
export type FathomWorkspace = {
  id: string;
  slug: string;
  name: string;
};

export type FathomTask = {
  org_id: string;
  workspace_id: string | null;
  title: string;
  source: "fathom";
  due_date: string;
  dedupe_key: string;
  source_url: string | null;
  source_label: string;
};

/**
 * Pourquoi un item n'est pas devenu une tâche.
 *
 * Compté et rendu dans le rapport du cron plutôt que passé sous silence : un
 * import qui annonce « 5 tâches créées » sans dire qu'il en a écarté douze
 * ment par omission, et c'est ce genre de silence qui fait découvrir six mois
 * plus tard que la moitié des réunions ne remontait pas.
 */
export type FathomSkipReason = "fait" | "non-assigne" | "assigne-ailleurs" | "vide";

export const FATHOM_SKIP_LABELS: Record<FathomSkipReason, string> = {
  fait: "déjà coché dans Fathom",
  "non-assigne": "sans destinataire",
  "assigne-ailleurs": "assigné à quelqu'un d'autre",
  vide: "libellé vide",
};

export type FathomPlan = {
  tasks: FathomTask[];
  skipped: Record<FathomSkipReason, number>;
  /** Réunions dont aucun client n'a pu être déduit, pour le rapport. */
  withoutClient: string[];
};

// --- Reconnaissance du client ------------------------------------------------

/**
 * Les autres noms sous lesquels un client apparaît dans un titre de réunion.
 *
 * La clé est le nom canonique du client ; elle est rapprochée du nom **ou** du
 * slug de l'espace, normalisés. Ce détour évite de coder en dur des slugs que
 * seule la base connaît : ANMF garde ses alias quel que soit le nom que porte
 * son espace.
 */
export const CLIENT_ALIASES: Record<string, string[]> = {
  anmf: ["anmf", "chasseurs de graines", "chasseurs de graine", "mediapilote"],
};

/** Minuscules, sans accents, ponctuation réduite à des espaces. */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Tous les repères qui désignent un espace : son nom, son slug, ses alias. */
function hintsOf(workspace: FathomWorkspace): string[] {
  const name = normalize(workspace.name);
  const slug = normalize(workspace.slug);
  const aliases = new Set([name, slug]);

  for (const [canonical, extra] of Object.entries(CLIENT_ALIASES)) {
    if (name === canonical || slug === canonical) {
      for (const hint of extra) aliases.add(normalize(hint));
    }
  }

  return [...aliases].filter((hint) => hint.length >= 3);
}

/**
 * Le client d'une réunion, déduit de son titre.
 *
 * **Au moindre doute, aucun client.** Un titre qui nomme deux clients —
 * « ALESSANDRO x I-WAY x CATHERINE OSTI » — n'en désigne aucun : la tâche part
 * sans rattachement plutôt qu'attribuée au premier trouvé. Se tromper de
 * client coûte plus cher que ne pas en mettre : la tâche resterait invisible
 * derrière le filtre du mauvais client, et le bon ne la verrait jamais.
 */
export function matchWorkspace(
  title: string,
  workspaces: FathomWorkspace[],
): FathomWorkspace | null {
  const haystack = normalize(title);
  const matches = workspaces.filter((workspace) =>
    hintsOf(workspace).some((hint) => haystack.includes(hint)),
  );

  return matches.length === 1 ? matches[0]! : null;
}

// --- Sélection des items -----------------------------------------------------

/**
 * L'item revient-il au propriétaire ?
 *
 * L'e-mail fait foi quand il est là ; sinon on compare les noms normalisés,
 * parce que Fathom rend parfois un participant sans adresse — un invité entré
 * par le lien, par exemple.
 *
 * Un item **sans destinataire** n'est pas retenu. Il est tentant de se le
 * donner par défaut dans un tête-à-tête client, mais la règle demandée est
 * « uniquement mes tâches », et un item flottant n'en est pas une. Il est
 * compté dans le rapport, donc rien ne disparaît sans le dire.
 */
export function isOwnItem(item: FathomActionItem, owner: FathomAssignee): boolean {
  const assignee = item.assignee;
  if (!assignee) return false;

  if (assignee.email && owner.email) {
    return assignee.email.toLowerCase() === owner.email.toLowerCase();
  }

  if (assignee.name && owner.name) {
    return normalize(assignee.name) === normalize(owner.name);
  }

  return false;
}

/**
 * La clé d'idempotence d'un item.
 *
 * Le schéma annonçait `fathom:<recording_id>:<n>`, un rang. On préfère
 * l'empreinte du libellé : Fathom réordonne ses items d'un rendu à l'autre, et
 * un rang qui glisse recrée toute la liste à chaque passage. L'empreinte est
 * stable au réordonnancement — et un item réécrit devient légitimement une
 * autre tâche, ce qui est le comportement voulu.
 */
export function dedupeKey(meetingId: string, description: string): string {
  const digest = createHash("sha256").update(description.trim()).digest("hex");
  return `fathom:${meetingId}:${digest.slice(0, 12)}`;
}

/**
 * L'échéance d'une tâche issue d'une réunion.
 *
 * Fathom ne produit aucune date, et on n'en invente pas : la tâche est posée
 * au jour de la réunion, ramené à aujourd'hui s'il est passé. Sans ce plancher,
 * une reprise d'historique déverserait des dizaines de tâches déjà en retard,
 * en rouge, le jour du branchement — un écran qui hurle pour un travail qui
 * vient d'arriver.
 */
export function dueDateFor(meetingStartedAt: string, today: string): string {
  const day = meetingStartedAt.slice(0, 10);
  return day > today ? day : today;
}

// --- Le plan -----------------------------------------------------------------

export type FathomContext = {
  orgId: string;
  today: string;
  meetings: FathomMeeting[];
  workspaces: FathomWorkspace[];
  /** Forcé par configuration ; sinon, celui qui a enregistré la réunion. */
  owner?: FathomAssignee;
};

export function planFathomTasks(context: FathomContext): FathomPlan {
  const tasks: FathomTask[] = [];
  const skipped: Record<FathomSkipReason, number> = {
    fait: 0,
    "non-assigne": 0,
    "assigne-ailleurs": 0,
    vide: 0,
  };
  const withoutClient = new Set<string>();

  for (const meeting of context.meetings) {
    const owner = context.owner ?? meeting.recordedBy;
    const workspace = matchWorkspace(meeting.title, context.workspaces);
    const dueDate = dueDateFor(meeting.startedAt, context.today);

    let retained = 0;
    for (const item of meeting.actionItems) {
      const title = item.description.trim();
      if (title.length === 0) {
        skipped.vide += 1;
        continue;
      }
      if (item.completed) {
        skipped.fait += 1;
        continue;
      }
      if (!item.assignee) {
        skipped["non-assigne"] += 1;
        continue;
      }
      if (!owner || !isOwnItem(item, owner)) {
        skipped["assigne-ailleurs"] += 1;
        continue;
      }

      retained += 1;
      tasks.push({
        org_id: context.orgId,
        workspace_id: workspace?.id ?? null,
        title,
        source: "fathom",
        due_date: dueDate,
        dedupe_key: dedupeKey(meeting.id, title),
        // Le lien horodaté plutôt que celui de la réunion : il ouvre la vidéo
        // à la seconde où la tâche a été dite, ce qui est la seule chose qu'on
        // vient y chercher trois jours plus tard.
        source_url: item.playbackUrl ?? meeting.url,
        source_label: meeting.title,
      });
    }

    if (retained > 0 && !workspace) withoutClient.add(meeting.title);
  }

  return { tasks, skipped, withoutClient: [...withoutClient] };
}
