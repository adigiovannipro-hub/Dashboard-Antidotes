import { describe, expect, it } from "vitest";

import {
  dedupeKey,
  dueDateFor,
  isOwnItem,
  matchWorkspace,
  planFathomTasks,
  type FathomActionItem,
  type FathomMeeting,
  type FathomWorkspace,
} from "./fathom";

/**
 * Les cas sont pris de vraies réunions — titres, libellés et destinataires
 * relevés sur le compte Fathom au moment du branchement. Une règle de
 * reconnaissance ne se juge pas sur des exemples commodes.
 */

const SANDRO = { name: "Alessandro DI GIOVANNI", email: "a.digiovanni.pro@gmail.com" };

const ESPACES: FathomWorkspace[] = [
  { id: "w-bondet", slug: "bondet", name: "Bondet" },
  { id: "w-anmf", slug: "anmf", name: "ANMF" },
  { id: "w-originel", slug: "l-originel", name: "L'Originel" },
  { id: "w-iway", slug: "i-way", name: "I-WAY" },
  { id: "w-osti", slug: "catherine-osti", name: "Catherine Osti" },
];

const item = (over: Partial<FathomActionItem> = {}): FathomActionItem => ({
  description: "Email Théo re: HD UGC video",
  completed: false,
  assignee: SANDRO,
  playbackUrl: "https://fathom.video/calls/759690039?timestamp=1178",
  ...over,
});

const meeting = (over: Partial<FathomMeeting> = {}): FathomMeeting => ({
  id: "166904744",
  title: "ALESSANDRO x BONDET : point social media",
  url: "https://fathom.video/calls/759690039",
  startedAt: "2026-07-24T09:00:00Z",
  recordedBy: SANDRO,
  actionItems: [item()],
  ...over,
});

describe("matchWorkspace", () => {
  it("reconnaît le client nommé dans le titre", () => {
    expect(matchWorkspace("ALESSANDRO x BONDET : point social media", ESPACES)?.id).toBe(
      "w-bondet",
    );
  });

  it("reconnaît ANMF sous ses autres noms", () => {
    for (const titre of [
      "Point d'étape Chasseurs de Graines / Organisation des tournages",
      "Campagne Chasseurs de Graines 2026 / Présentation",
      "Echange Mediapilote x Alessandro",
    ]) {
      expect(matchWorkspace(titre, ESPACES)?.id, titre).toBe("w-anmf");
    }
  });

  it("ne rattache rien quand deux clients sont nommés", () => {
    // Le cas qui justifie la règle : la tâche irait chez l'un des deux, et
    // resterait invisible derrière le filtre de l'autre.
    expect(
      matchWorkspace("ALESSANDRO x I-WAY x CATHERINE OSTI : intentions d'août", ESPACES),
    ).toBeNull();
  });

  it("ne rattache rien quand aucun client n'est nommé", () => {
    expect(matchWorkspace("ALESSANDRO x GMS : expatriation Bali", ESPACES)).toBeNull();
  });

  it("ignore la casse, les accents et la ponctuation", () => {
    expect(matchWorkspace("point l'originel — septembre", ESPACES)?.id).toBe(
      "w-originel",
    );
    expect(matchWorkspace("RÉUNION I-Way / bilan", ESPACES)?.id).toBe("w-iway");
  });
});

describe("isOwnItem", () => {
  it("retient l'item quand l'adresse correspond", () => {
    expect(isOwnItem(item(), SANDRO)).toBe(true);
  });

  it("compare les adresses sans tenir compte de la casse", () => {
    const majuscules = { name: null, email: "A.DIGIOVANNI.PRO@GMAIL.COM" };
    expect(isOwnItem(item({ assignee: majuscules }), SANDRO)).toBe(true);
  });

  it("se rabat sur le nom quand l'adresse manque", () => {
    const sansAdresse = { name: "alessandro di giovanni", email: null };
    expect(isOwnItem(item({ assignee: sansAdresse }), SANDRO)).toBe(true);
  });

  it("écarte l'item d'un tiers", () => {
    const malory = { name: "Malory BOUILLOD", email: "malory@bondet.fr" };
    expect(isOwnItem(item({ assignee: malory }), SANDRO)).toBe(false);
  });

  it("écarte un item sans destinataire", () => {
    expect(isOwnItem(item({ assignee: null }), SANDRO)).toBe(false);
  });
});

describe("dedupeKey", () => {
  it("rend la même clé pour le même libellé", () => {
    expect(dedupeKey("42", "Relancer Théo")).toBe(dedupeKey("42", "Relancer Théo"));
  });

  it("ignore les espaces de bord", () => {
    expect(dedupeKey("42", "  Relancer Théo  ")).toBe(dedupeKey("42", "Relancer Théo"));
  });

  it("distingue deux libellés et deux réunions", () => {
    expect(dedupeKey("42", "A")).not.toBe(dedupeKey("42", "B"));
    expect(dedupeKey("42", "A")).not.toBe(dedupeKey("43", "A"));
  });

  it("ne dépend pas du rang de l'item — c'est tout l'intérêt", () => {
    const avant = ["Un", "Deux", "Trois"].map((t) => dedupeKey("42", t));
    const apres = ["Trois", "Un", "Deux"].map((t) => dedupeKey("42", t));
    expect([...apres].sort()).toEqual([...avant].sort());
  });
});

describe("dueDateFor", () => {
  it("pose la tâche au jour de la réunion", () => {
    expect(dueDateFor("2026-08-12T14:30:00Z", "2026-08-10")).toBe("2026-08-12");
  });

  it("ramène à aujourd'hui une réunion passée", () => {
    // Sans ce plancher, une reprise d'historique s'affiche entièrement en
    // retard le jour du branchement.
    expect(dueDateFor("2026-02-25T09:00:00Z", "2026-08-10")).toBe("2026-08-10");
  });

  it("laisse le jour même au jour même", () => {
    expect(dueDateFor("2026-08-10T09:00:00Z", "2026-08-10")).toBe("2026-08-10");
  });
});

describe("planFathomTasks", () => {
  const contexte = (meetings: FathomMeeting[]) => ({
    orgId: "org-1",
    today: "2026-08-10",
    meetings,
    workspaces: ESPACES,
  });

  it("crée une tâche par item retenu, rattachée au bon client", () => {
    const plan = planFathomTasks(contexte([meeting()]));

    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0]).toMatchObject({
      org_id: "org-1",
      workspace_id: "w-bondet",
      title: "Email Théo re: HD UGC video",
      source: "fathom",
      due_date: "2026-08-10",
      source_label: "ALESSANDRO x BONDET : point social media",
    });
  });

  it("préfère le lien horodaté à celui de la réunion", () => {
    const plan = planFathomTasks(contexte([meeting()]));
    expect(plan.tasks[0]!.source_url).toBe(
      "https://fathom.video/calls/759690039?timestamp=1178",
    );
  });

  it("se rabat sur le lien de la réunion quand l'item n'en a pas", () => {
    const plan = planFathomTasks(contexte([meeting({ actionItems: [item({ playbackUrl: null })] })]));
    expect(plan.tasks[0]!.source_url).toBe("https://fathom.video/calls/759690039");
  });

  it("écarte les items des autres, les items faits et les items vides", () => {
    const plan = planFathomTasks(
      contexte([
        meeting({
          actionItems: [
            item(),
            item({ description: "Envoyer le kit média", assignee: { name: "Malory BOUILLOD", email: "m@bondet.fr" } }),
            item({ description: "Déjà traité", completed: true }),
            item({ description: "Flottant", assignee: null }),
            item({ description: "   " }),
          ],
        }),
      ]),
    );

    expect(plan.tasks).toHaveLength(1);
    expect(plan.skipped).toEqual({
      fait: 1,
      "non-assigne": 1,
      "assigne-ailleurs": 1,
      vide: 1,
    });
  });

  it("laisse sans client une réunion à deux clients, et le signale", () => {
    const plan = planFathomTasks(
      contexte([
        meeting({
          id: "169349379",
          title: "ALESSANDRO x I-WAY x CATHERINE OSTI : intentions d'août",
          actionItems: [item({ description: "Monter le reel Gisèle" })],
        }),
      ]),
    );

    expect(plan.tasks[0]!.workspace_id).toBeNull();
    expect(plan.withoutClient).toEqual([
      "ALESSANDRO x I-WAY x CATHERINE OSTI : intentions d'août",
    ]);
  });

  it("ne signale pas une réunion sans client dont aucun item ne me revient", () => {
    const plan = planFathomTasks(
      contexte([
        meeting({
          title: "HAMZA SDT x NETFLIX",
          actionItems: [item({ assignee: { name: "Emilie Martin", email: "e@netflix.com" } })],
        }),
      ]),
    );

    expect(plan.tasks).toHaveLength(0);
    expect(plan.withoutClient).toEqual([]);
  });

  it("prend celui qui a enregistré comme propriétaire par défaut", () => {
    const autre = { name: "Léa Perret", email: "lea@nightsession.fr" };
    const plan = planFathomTasks(
      contexte([
        meeting({ recordedBy: autre, actionItems: [item({ assignee: autre })] }),
      ]),
    );
    expect(plan.tasks).toHaveLength(1);
  });

  it("respecte le propriétaire forcé par configuration", () => {
    const autre = { name: "Léa Perret", email: "lea@nightsession.fr" };
    const plan = planFathomTasks({
      ...contexte([meeting({ recordedBy: autre, actionItems: [item({ assignee: autre })] })]),
      owner: SANDRO,
    });
    expect(plan.tasks).toHaveLength(0);
    expect(plan.skipped["assigne-ailleurs"]).toBe(1);
  });

  it("dédoublonne deux passages sur la même réunion par la clé", () => {
    const premier = planFathomTasks(contexte([meeting()]));
    const second = planFathomTasks(contexte([meeting()]));
    expect(second.tasks[0]!.dedupe_key).toBe(premier.tasks[0]!.dedupe_key);
  });
});
