import { describe, expect, it } from "vitest";

import type { ContextDeliverables } from "@/lib/context/types";
import {
  computeQuotas,
  formatForCategory,
  platformForNetwork,
  renderExisting,
  renderQuotas,
  type ExistingPublication,
} from "./quotas";

const publication = (
  overrides: Partial<ExistingPublication> = {},
): ExistingPublication => ({
  platform: "meta",
  format: "post",
  name: "SUJET",
  scheduledOn: null,
  status: "idea",
  ...overrides,
});

const deliverables = (
  overrides: Partial<ContextDeliverables> = {},
): ContextDeliverables => ({
  intentions: "",
  reseaux: [],
  publications: [],
  ...overrides,
});

describe("formatForCategory", () => {
  it("rapproche les mots du contrat des formats du planning", () => {
    expect(formatForCategory("Post fixe")).toBe("post");
    expect(formatForCategory("Stories")).toBe("story");
    expect(formatForCategory("Reels")).toBe("reel");
    expect(formatForCategory("Carrousel")).toBe("carousel");
    expect(formatForCategory("Vidéo")).toBe("video");
  });

  it("rend null plutôt que de deviner", () => {
    expect(formatForCategory("Article")).toBeNull();
    expect(formatForCategory("Newsletter")).toBeNull();
    expect(formatForCategory("")).toBeNull();
  });
});

describe("platformForNetwork", () => {
  it("reconnaît les réseaux, accents et casse compris", () => {
    expect(platformForNetwork("LinkedIn")).toBe("linkedin");
    expect(platformForNetwork("tiktok")).toBe("tiktok");
    expect(platformForNetwork("Instagram")).toBe("instagram");
  });

  it("rend null sur un réseau inconnu", () => {
    expect(platformForNetwork("Mastodon")).toBeNull();
  });
});

describe("computeQuotas", () => {
  it("déduit les lignes déjà posées du volume dû", () => {
    // Le cas du cahier des charges : 9 dus, 3 déjà là, 6 à créer.
    const report = computeQuotas(
      deliverables({
        reseaux: [
          {
            nom: "Instagram",
            publications: [
              { categorie: "Post fixe", quantite: 4 },
              { categorie: "Stories", quantite: 5 },
            ],
          },
        ],
      }),
      [
        publication({ format: "post" }),
        publication({ format: "post" }),
        publication({ format: "story" }),
      ],
    );

    expect(report.duTotal).toBe(9);
    expect(report.dejaTotal).toBe(3);
    expect(report.resteTotal).toBe(6);

    const instagram = report.reseaux[0]!;
    expect(instagram.lignes).toEqual([
      { categorie: "Post fixe", format: "post", du: 4, deja: 2, reste: 2 },
      { categorie: "Stories", format: "story", du: 5, deja: 1, reste: 4 },
    ]);
  });

  it("ne compte pas deux fois une publication au-delà du volume dû", () => {
    const report = computeQuotas(
      deliverables({
        reseaux: [{ nom: "Instagram", publications: [{ categorie: "Post fixe", quantite: 2 }] }],
      }),
      [publication(), publication(), publication(), publication()],
    );
    expect(report.reseaux[0]!.lignes[0]).toEqual({
      categorie: "Post fixe",
      format: "post",
      du: 2,
      deja: 2,
      reste: 0,
    });
    // Les deux en trop ne disparaissent pas : elles sont signalées à part.
    expect(report.reseaux[0]!.horsQuota).toBe(2);
    expect(report.resteTotal).toBe(0);
  });

  it("n'impute rien à une catégorie qu'il ne sait pas rapprocher", () => {
    const report = computeQuotas(
      deliverables({
        reseaux: [{ nom: "LinkedIn", publications: [{ categorie: "Article", quantite: 3 }] }],
      }),
      [publication({ platform: "linkedin", format: "post" })],
    );
    const ligne = report.reseaux[0]!.lignes[0]!;
    expect(ligne.format).toBeNull();
    expect(ligne.deja).toBe(0);
    expect(ligne.reste).toBe(3);
    // La publication existante n'est pas perdue pour autant.
    expect(report.reseaux[0]!.horsQuota).toBe(1);
  });

  it("sépare les réseaux du contrat de ceux qu'on trouve au planning", () => {
    const report = computeQuotas(
      deliverables({
        reseaux: [{ nom: "Instagram", publications: [{ categorie: "Reels", quantite: 2 }] }],
      }),
      [publication({ platform: "tiktok", format: "reel" })],
    );
    expect(report.reseaux[0]!.resteTotal).toBe(2);
    expect(report.reseauxNonContractuels).toEqual([{ platform: "tiktok", deja: 1 }]);
  });

  it("laisse entièrement à produire ce qui n'est rattaché à aucun réseau", () => {
    const report = computeQuotas(
      deliverables({ publications: [{ categorie: "Newsletter", quantite: 1 }] }),
      [publication()],
    );
    expect(report.horsReseau).toEqual([
      { categorie: "Newsletter", format: null, du: 1, deja: 0, reste: 1 },
    ]);
    expect(report.resteTotal).toBe(1);
  });

  it("laisse le nom exact servir avant le parapluie META", () => {
    // Le board d'origine range Instagram et Facebook sous un seul réseau META.
    // Un contrat qui déclare les deux ne doit pas voir le premier rafler tout.
    const report = computeQuotas(
      deliverables({
        reseaux: [
          { nom: "Instagram", publications: [{ categorie: "Post fixe", quantite: 2 }] },
          { nom: "Facebook", publications: [{ categorie: "Post fixe", quantite: 2 }] },
        ],
      }),
      [
        publication({ platform: "meta" }),
        publication({ platform: "facebook" }),
      ],
    );
    // Facebook prend la sienne au nom exact, Instagram ramasse la ligne META.
    expect(report.reseaux[0]!.lignes[0]!.deja).toBe(1);
    expect(report.reseaux[1]!.lignes[0]!.deja).toBe(1);
    expect(report.resteTotal).toBe(2);
  });

  it("rend un rapport vide quand le contrat ne déclare aucun volume", () => {
    const report = computeQuotas(deliverables(), [publication()]);
    expect(report.duTotal).toBe(0);
    expect(report.resteTotal).toBe(0);
  });
});

describe("renderQuotas", () => {
  it("se tait plutôt que d'annoncer un total inventé", () => {
    expect(renderQuotas(computeQuotas(deliverables(), []))).toBe("");
  });

  it("chiffre le reste par réseau et par catégorie", () => {
    const rendu = renderQuotas(
      computeQuotas(
        deliverables({
          reseaux: [
            {
              nom: "Instagram",
              publications: [
                { categorie: "Post fixe", quantite: 4 },
                { categorie: "Stories", quantite: 5 },
              ],
            },
          ],
        }),
        [publication({ format: "post" }), publication({ format: "post" }), publication({ format: "story" })],
      ),
    );
    expect(rendu).toContain("Instagram : 6 à créer sur 9 dus");
    expect(rendu).toContain("Post fixe : 4 dus, 2 déjà au planning, 2 à créer");
    expect(rendu).toContain("TOTAL À CRÉER : 6 publications (9 dues au contrat, 3 déjà au planning)");
  });

  it("dit qu'une catégorie n'a pas été rapprochée", () => {
    const rendu = renderQuotas(
      computeQuotas(
        deliverables({
          reseaux: [{ nom: "LinkedIn", publications: [{ categorie: "Article", quantite: 2 }] }],
        }),
        [],
      ),
    );
    expect(rendu).toContain("catégorie non rapprochée");
  });
});

describe("renderExisting", () => {
  it("liste les lignes déjà posées, les datées d'abord", () => {
    const rendu = renderExisting([
      publication({ name: "SANS DATE" }),
      publication({ name: "LE 3", scheduledOn: "2026-09-03", format: "reel" }),
      publication({ name: "LE 1", scheduledOn: "2026-09-01" }),
    ]);
    expect(rendu.split("\n")).toEqual([
      "- 2026-09-01 · META · POST · « LE 1 »",
      "- 2026-09-03 · META · REELS · « LE 3 »",
      "- sans date · META · POST · « SANS DATE »",
    ]);
  });

  it("rend une chaîne vide quand le mois est vierge", () => {
    expect(renderExisting([])).toBe("");
  });
});
