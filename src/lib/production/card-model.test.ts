import { describe, expect, it } from "vitest";

import { buildCardModel, type ProductionSnapshot } from "./card-model";
import type { PhaseSlice } from "./phases";
import type { GenerationJob } from "./types";

const slice = (overrides: Partial<PhaseSlice> = {}): PhaseSlice => ({
  phase: "intentions",
  target_month: "2026-09-01",
  status: "pending",
  completed_at: null,
  due_start: null,
  due_end: null,
  ...overrides,
});

const job = (overrides: Partial<GenerationJob> = {}): GenerationJob => ({
  id: "job-1",
  org_id: "org",
  workspace_id: "ws",
  phase: "wording",
  target_month: "2026-09-01",
  status: "running",
  progress_current: 4,
  progress_total: 12,
  result: null,
  error_message: null,
  started_at: null,
  finished_at: null,
  created_at: "2026-08-11T08:00:00Z",
  updated_at: "2026-08-11T08:00:00Z",
  ...overrides,
});

const snapshot = (overrides: Partial<ProductionSnapshot> = {}): ProductionSnapshot => ({
  workspace_id: "ws",
  moduleReady: true,
  phases: [],
  target: { total: 0, withWording: 0, validated: 0, scheduled: 0, firstPublication: null },
  previous: { published: 0, total: 0, hasRealData: false },
  ahead: {},
  jobs: [],
  ...overrides,
});

/** Un cycle avancé jusqu'au wording : reporting et intentions réglés. */
const upToWording: PhaseSlice[] = [
  slice({
    phase: "reporting",
    target_month: "2026-07-01",
    status: "done",
    completed_at: "2026-08-03T09:00:00Z",
  }),
  slice({ phase: "intentions", status: "done", completed_at: "2026-08-16T10:00:00Z" }),
];

const build = (
  snap: Partial<ProductionSnapshot> = {},
  options: {
    today?: string;
    upcoming?: number;
    moderation?: number | null;
    monthProgress?: { done: number; total: number } | null;
  } = {},
) =>
  buildCardModel({
    today: options.today ?? "2026-08-18",
    snapshot: snapshot(snap),
    upcoming: options.upcoming ?? 5,
    moderation: options.moderation === undefined ? 2 : options.moderation,
    monthProgress:
      options.monthProgress === undefined ? { done: 4, total: 9 } : options.monthProgress,
  });

describe("buildCardModel", () => {
  it("compose le sous-titre mois + phase courante", () => {
    const model = build({}, { today: "2026-08-03" });
    expect(model.subtitle).toBe("Août · Reporting");
  });

  it("propose de générer les intentions du mois suivant, avec le mois en toutes lettres", () => {
    const model = build(
      {
        phases: [
          slice({
            phase: "reporting",
            target_month: "2026-07-01",
            status: "done",
            completed_at: "2026-08-03T09:00:00Z",
          }),
        ],
      },
      { today: "2026-08-12" },
    );
    expect(model.currentPhase).toBe("intentions");
    expect(model.action?.label).toBe("Générer les intentions de septembre");
    expect(model.action?.targetMonth).toBe("2026-09-01");
    expect(model.metrics.map((metric) => metric.label)).toEqual([
      "À publier sous 7 jours",
      "Messages en attente",
      "Mois précédent clôturé",
    ]);
  });

  it("compte les wordings restants et suit leur avancement", () => {
    const model = build({
      phases: upToWording,
      target: { total: 12, withWording: 4, validated: 0, scheduled: 0, firstPublication: null },
    });
    expect(model.action?.label).toBe("Rédiger les 8 contenus restants");
    expect(model.metrics).toContainEqual({
      label: "Contenus rédigés",
      value: "4 sur 12",
    });
    // La barre, elle, montre le mois en cours tous réseaux confondus — pas
    // l'avancement de la phase, qui se lit déjà à la ligne ci-dessus.
    expect(model.progress).toEqual({ done: 4, total: 9, label: "Publié ce mois-ci" });
  });

  it("montre l'avancement des publications du mois, tous réseaux confondus", () => {
    const model = build({}, { monthProgress: { done: 7, total: 18 } });
    expect(model.progress).toEqual({ done: 7, total: 18, label: "Publié ce mois-ci" });
  });

  it("n'affiche aucune barre quand le mois n'a rien de planifié", () => {
    expect(build({}, { monthProgress: { done: 0, total: 0 } }).progress).toBeNull();
    expect(build({}, { monthProgress: null }).progress).toBeNull();
  });

  it("désactive le wording quand tout est rédigé, avec la raison", () => {
    const model = build({
      phases: upToWording,
      target: { total: 12, withWording: 12, validated: 0, scheduled: 0, firstPublication: null },
    });
    expect(model.action?.disabled).toBe(true);
    expect(model.action?.reason).toBe("Tous les contenus sont rédigés");
  });

  it("alerte quand la phase attend des intentions qui n'existent pas", () => {
    const model = build({ phases: upToWording });
    expect(model.info).toContain("Aucune intention pour septembre");
    expect(model.action?.disabled).toBe(true);
  });

  it("envoie le planning en validation et donne la première date", () => {
    const model = build({
      phases: [...upToWording, slice({ phase: "wording", status: "done", completed_at: "2026-08-19T10:00:00Z" })],
      target: { total: 12, withWording: 12, validated: 7, scheduled: 2, firstPublication: "2026-09-02" },
    }, { today: "2026-08-24" });
    expect(model.currentPhase).toBe("programmation");
    // Plus de « programmer » : la publication est automatique à 16h, le
    // moment du cycle est l'envoi du planning au client.
    expect(model.action?.label).toBe("Envoyer en validation");
    expect(model.action?.kind).toBe("validation");
    expect(model.metrics).toContainEqual({
      label: "Première publication le",
      value: "2 sept.",
    });
  });

  it("bloque le reporting d'un mois sans rien du tout", () => {
    const model = build({}, { today: "2026-08-03" });
    expect(model.currentPhase).toBe("reporting");
    expect(model.action?.label).toBe("Générer le reporting de juillet");
    expect(model.action?.disabled).toBe(true);
    expect(model.action?.reason).toBe(
      "Aucune donnée ni publication en juillet à analyser",
    );
  });

  it("ouvre le reporting sur les seules données de régie, sans planning", () => {
    // Le cas d'un client arrivé en cours de route : ses chiffres Meta de
    // juillet existent, son planning de juillet non. Lui refuser son bilan
    // pour une ligne de tableau absente n'avait aucun sens.
    const model = build(
      { previous: { published: 0, total: 0, hasRealData: true } },
      { today: "2026-08-03" },
    );
    expect(model.action?.disabled).toBe(false);
    expect(model.action?.reason).toBeNull();
    expect(
      model.views[0]!.menu.find((entry) => entry.phase === "reporting")!.disabled,
    ).toBe(false);
  });

  it("fait du bouton le témoin d'un job actif et de sa progression", () => {
    const model = build({
      phases: upToWording,
      target: { total: 12, withWording: 4, validated: 0, scheduled: 0, firstPublication: null },
      jobs: [job()],
    });
    expect(model.activeJob).toMatchObject({ id: "job-1", current: 4, total: 12 });
    // Un job en cours prend la barre : c'est lui qu'on regarde à cet instant.
    expect(model.progress).toEqual({
      done: 4,
      total: 12,
      label: "Rédaction en cours",
    });
  });

  it("propose la reprise après un job partiel, avec le compte des échecs", () => {
    const model = build({
      phases: upToWording,
      target: { total: 12, withWording: 8, validated: 0, scheduled: 0, firstPublication: null },
      jobs: [
        job({
          status: "partial",
          progress_current: 8,
          result: { failed_subject_ids: ["a", "b", "c", "d"] },
        }),
      ],
    });
    expect(model.activeJob).toBeNull();
    expect(model.action?.kind).toBe("resume");
    expect(model.action?.label).toBe("Reprendre · 4/12 échoués");
  });

  it("repropose l'action normale après un arrêt, pas une reprise", () => {
    const model = build({
      phases: upToWording,
      // Deux wordings ont été écrits avant l'arrêt : le compteur en tient
      // compte, mais le bouton ne se met pas en ton danger — un arrêt
      // demandé n'est pas un échec à rattraper.
      target: { total: 12, withWording: 6, validated: 0, scheduled: 0, firstPublication: null },
      jobs: [
        job({
          status: "cancelled",
          progress_current: 2,
          progress_total: 8,
          result: { summary: "Arrêté après 2 wordings sur 8." },
        }),
      ],
    });
    expect(model.activeJob).toBeNull();
    expect(model.action?.kind).toBe("generate");
    expect(model.action?.label).toBe("Rédiger les 6 contenus restants");
    // La barre revient au mois, le job arrêté ne la tient plus.
    expect(model.progress?.label).toBe("Publié ce mois-ci");
  });

  it("ouvre sur le mois par défaut et propose deux mois d'avance", () => {
    const model = build({}, { today: "2026-08-18" });
    expect(model.views).toHaveLength(3);
    expect(model.views.map((vue) => vue.monthLabel)).toEqual([
      "Septembre",
      "Octobre",
      "Novembre",
    ]);
    // La première vue est celle que la carte ouvre : elle porte le cycle réel.
    expect(model.views[0]!.badge).toBeNull();
    expect(model.views[0]!.subtitle).toBe(model.subtitle);
  });

  it("ne met jamais un mois d'avance en retard", () => {
    const model = build(
      {
        // Octobre est vide : sans garde-fou, ses quatre segments gris se
        // liraient comme quatre phases en retard.
        phases: upToWording,
      },
      { today: "2026-08-24" },
    );
    const octobre = model.views[1]!;
    expect(octobre.badge).toBe("En avance");
    expect(octobre.lateBadge).toBeNull();
    expect(octobre.segments.every((segment) => !segment.late)).toBe(true);
    expect(octobre.info).toContain("Rien n'est en retard");
    expect(octobre.action?.label).toBe("Générer les intentions d'octobre");
    expect(octobre.action?.targetMonth).toBe("2026-10-01");
  });

  it("reprend l'avancement déjà posé sur un mois d'avance", () => {
    const model = build(
      {
        phases: [
          slice({ phase: "intentions", target_month: "2026-10-01", status: "done" }),
        ],
        ahead: { "2026-10-01": { total: 9, withWording: 3, validated: 0 } },
      },
      { today: "2026-08-18" },
    );
    const octobre = model.views[1]!;
    expect(octobre.currentPhase).toBe("wording");
    expect(octobre.action?.label).toBe("Rédiger les 6 contenus restants");
    expect(octobre.metrics).toContainEqual({
      label: "Publications au planning",
      value: "9",
    });
  });

  it("marque la vue du reporting comme un bilan, pas comme un mois à produire", () => {
    const model = build({}, { today: "2026-08-03" });
    expect(model.views[0]!.badge).toBe("Bilan");
  });

  it("se tait sur le cycle quand les tables du module ne sont pas en base", () => {
    const model = build({ moduleReady: false }, { today: "2026-08-12", upcoming: 3 });
    // Ni phase courante, ni bouton : une action qui répondrait 500 ne
    // s'affiche pas, et aucun retard n'est affirmé.
    expect(model.currentPhase).toBeNull();
    expect(model.action).toBeNull();
    expect(model.lateBadge).toBeNull();
    expect(model.subtitle).toBe("Août · Cycle indisponible");
    expect(model.segments.every((segment) => segment.tone === "idle")).toBe(true);
    expect(model.info).toContain("0032");
    // Sans les tables, un clic sur un segment répondrait 500 : la carte le dit
    // au composant, qui rend les segments inertes.
    expect(model.moduleReady).toBe(false);
    expect(model.views[0]!.menu).toEqual([]);
    // Les mesures venues du planning restent : elles, sont vraies.
    expect(model.metrics).toContainEqual({
      label: "À publier sous 7 jours",
      value: "3",
    });
  });

  it("désactive dans le menu ce qui est impossible, avec la raison", () => {
    // Le cas I-WAY : un espace sans planning le mois d'avant. Le menu lançait
    // le job quand même, il échouait à la première ligne, et l'écran donnait
    // l'impression que le clic n'avait rien fait.
    const model = build({}, { today: "2026-08-03" });
    const reporting = model.views[0]!.menu.find((entry) => entry.phase === "reporting")!;
    expect(reporting.disabled).toBe(true);
    expect(reporting.reason).toBe(
      "Aucune donnée ni publication en juillet à analyser",
    );

    const intentions = model.views[0]!.menu.find(
      (entry) => entry.phase === "intentions",
    )!;
    expect(intentions.disabled).toBe(false);
    expect(intentions.targetMonth).toBe("2026-09-01");
  });

  it("ouvre le menu dès qu'il y a de la matière", () => {
    const model = build({
      phases: upToWording,
      target: { total: 12, withWording: 4, validated: 0, scheduled: 0, firstPublication: null },
      previous: { published: 8, total: 9, hasRealData: false },
    });
    expect(model.views[0]!.menu.every((entry) => !entry.disabled)).toBe(true);
    // La validation n'est pas un job : le menu doit le dire au composant,
    // sinon le clic part vers `/api/generate/programmation`.
    expect(
      model.views[0]!.menu.find((entry) => entry.phase === "programmation")!.kind,
    ).toBe("validation");
  });

  it("refuse le reporting d'un mois d'avance, qui n'est pas écoulé", () => {
    const model = build({ phases: upToWording }, { today: "2026-08-24" });
    const octobre = model.views[1]!;
    const reporting = octobre.menu.find((entry) => entry.phase === "reporting")!;
    expect(reporting.disabled).toBe(true);
    expect(reporting.reason).toBe("Le reporting analyse un mois écoulé");
    // Et l'envoi en validation vise bien octobre, pas le mois par défaut.
    expect(
      octobre.menu.find((entry) => entry.phase === "programmation")!.targetMonth,
    ).toBe("2026-10-01");
  });

  it("masque la ligne modération quand l'espace n'en a pas", () => {
    const model = build({}, { today: "2026-08-03", moderation: null });
    expect(model.metrics.some((metric) => metric.label === "Messages en attente")).toBe(
      false,
    );
  });
});
