import { describe, expect, it } from "vitest";

import {
  dedupeKey,
  dueDateFor,
  matchWorkspace,
  planFathomTasks,
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

/** Le compte rendu tel que Fathom le rend, réduit à sa section utile. */
const synthese = (bloc: string) => `## Sujets\n\n  - [Un point.](x)\n\n## Prochaines étapes\n\n${bloc}`;

const SYNTHESE_BONDET = synthese(
  [
    "  - [**Alessandro :**](https://fathom.video/calls/759690039?timestamp=5094)",
    "      - [Envoyer la vidéo UGC de Théo à Malory pour validation.](https://fathom.video/calls/759690039?timestamp=1186)",
    "      - [Envoyer à Malory le récapitulatif et la proposition Google Ads.](https://fathom.video/calls/759690039?timestamp=5094)",
    "  - [**Malory :**](https://fathom.video/calls/759690039?timestamp=5094)",
    "      - [Examiner le plan de contenu d'août.](https://fathom.video/calls/759690039?timestamp=5094)",
  ].join("\n"),
);

const meeting = (over: Partial<FathomMeeting> = {}): FathomMeeting => ({
  id: "166904744",
  title: "ALESSANDRO x BONDET : point social media",
  url: "https://fathom.video/calls/759690039",
  startedAt: "2026-07-24T09:00:00Z",
  recordedBy: SANDRO,
  summary: SYNTHESE_BONDET,
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

  it("ne retient que les étapes du propriétaire, et rien d'autre", () => {
    const plan = planFathomTasks(contexte([meeting()]));

    expect(plan.tasks.map((t) => t.title)).toEqual([
      "Envoyer la vidéo UGC de Théo à Malory pour validation.",
      "Envoyer à Malory le récapitulatif et la proposition Google Ads.",
    ]);
  });

  it("rattache au bon client et pose la date du jour", () => {
    const plan = planFathomTasks(contexte([meeting()]));
    expect(plan.tasks[0]).toMatchObject({
      org_id: "org-1",
      workspace_id: "w-bondet",
      source: "fathom",
      due_date: "2026-08-10",
      source_label: "ALESSANDRO x BONDET : point social media",
    });
  });

  it("préfère le lien horodaté de l'étape à celui de la réunion", () => {
    const plan = planFathomTasks(contexte([meeting()]));
    expect(plan.tasks[0]!.source_url).toBe(
      "https://fathom.video/calls/759690039?timestamp=1186",
    );
  });

  it("compte les réunions sans compte rendu", () => {
    const plan = planFathomTasks(contexte([meeting({ summary: null })]));
    expect(plan.tasks).toHaveLength(0);
    expect(plan.skipped["sans-synthese"]).toBe(1);
  });

  it("compte les réunions dont aucune étape ne me revient", () => {
    const autrui = synthese("  - [**Malory :**](x)\n      - [Relire le plan.](x)");
    const plan = planFathomTasks(contexte([meeting({ summary: autrui })]));
    expect(plan.tasks).toHaveLength(0);
    expect(plan.skipped["rien-pour-moi"]).toBe(1);
  });

  it("compte les réunions sans enregistreur identifié", () => {
    const plan = planFathomTasks(contexte([meeting({ recordedBy: null })]));
    expect(plan.skipped["sans-proprietaire"]).toBe(1);
  });

  it("laisse sans client une réunion à deux clients, et le signale", () => {
    const plan = planFathomTasks(
      contexte([
        meeting({ title: "ALESSANDRO x I-WAY x CATHERINE OSTI : intentions d'août" }),
      ]),
    );
    expect(plan.tasks[0]!.workspace_id).toBeNull();
    expect(plan.withoutClient).toEqual([
      "ALESSANDRO x I-WAY x CATHERINE OSTI : intentions d'août",
    ]);
  });

  it("prend celui qui a enregistré comme propriétaire par défaut", () => {
    const lea = { name: "Léa Perret", email: "lea@nightsession.fr" };
    const pourLea = synthese("  - [**Léa :**](x)\n      - [Envoyer le devis.](x)");
    const plan = planFathomTasks(
      contexte([meeting({ recordedBy: lea, summary: pourLea })]),
    );
    expect(plan.tasks.map((t) => t.title)).toEqual(["Envoyer le devis."]);
  });

  it("respecte le propriétaire forcé par configuration", () => {
    const plan = planFathomTasks({
      ...contexte([meeting()]),
      owner: { name: "Malory BOUILLOD", email: "m@bondet.fr" },
    });
    expect(plan.tasks.map((t) => t.title)).toEqual(["Examiner le plan de contenu d'août."]);
  });

  it("dédoublonne deux passages sur la même réunion par la clé", () => {
    const premier = planFathomTasks(contexte([meeting()]));
    const second = planFathomTasks(contexte([meeting()]));
    expect(second.tasks.map((t) => t.dedupe_key)).toEqual(
      premier.tasks.map((t) => t.dedupe_key),
    );
  });
});
