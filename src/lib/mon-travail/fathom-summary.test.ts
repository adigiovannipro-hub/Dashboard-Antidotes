import { describe, expect, it } from "vitest";

import { extractNextSteps } from "./fathom-summary";

/**
 * Les deux cas sont **de vrais comptes rendus**, recopiés à l'identique du
 * compte — liens horodatés, gras, sous-puces, accents. Ce sont les deux
 * réunions demandées en exemple, Bondet et I-WAY/Catherine Osti, et les
 * attentes ci-dessous sont ce que le parseur en tire réellement.
 */

const BONDET = `
## Points clés

  - [**Les publicités Meta sont un investissement à long terme,** avec un ROAS de 0,38.](https://fathom.video/calls/759690039?tab=summary&timestamp=2732.0)

## Sujets

### Analyse des performances publicitaires Meta

  - [**ROAS global :** 0,38 (1 000 € de ventes pour 2 619 € de dépenses).](https://fathom.video/calls/759690039?tab=summary&timestamp=2732.0)
  - [**Campagne « Broad » :**](https://fathom.video/calls/759690039?tab=summary&timestamp=1989.0)
      - [**Problème :** Coût par achat très élevé de 457 €.](https://fathom.video/calls/759690039?tab=summary&timestamp=2033.0)
      - [**Action :** Budget plafonné à 35 % du total.](https://fathom.video/calls/759690039?tab=summary&timestamp=2068.0)

## Prochaines étapes

  - [**Alessandro :**](https://fathom.video/calls/759690039?tab=summary&timestamp=5094.0)
      - [Envoyer la vidéo UGC de Théo à Malory pour validation.](https://fathom.video/calls/759690039?tab=summary&timestamp=1186.0)
      - [Envoyer à Malory un e-mail récapitulatif, la proposition Google Ads et un devis pour le budget consolidé.](https://fathom.video/calls/759690039?tab=summary&timestamp=5094.0)
  - [**Malory :**](https://fathom.video/calls/759690039?tab=summary&timestamp=5094.0)
      - [Examiner le plan de contenu d'août et la proposition Google Ads.](https://fathom.video/calls/759690039?tab=summary&timestamp=5094.0)
      - [Envoyer à Alessandro les informations sur le stand Silmo, le kit média et les visuels HD de l'an dernier.](https://fathom.video/calls/759690039?tab=summary&timestamp=797.0)
      - [Demander à Justine de corriger les problèmes d'UI/UX sur Shopify (CTA, code de réduction, libellé de livraison).](https://fathom.video/calls/759690039?tab=summary&timestamp=1658.0)
`;

/** Celui de la capture : Pierre d'abord, avec des sous-puces, Alessandro après. */
const IWAY = `
## Prochaines étapes

  - [**Pierre :**](https://fathom.video/calls/769219559?tab=summary&timestamp=2328.0)
      - [Valider toutes les intentions d'août sur Monday.](https://fathom.video/calls/769219559?tab=summary&timestamp=146.0)
      - [Envoyer à Alessandro les assets Catherine Osti via WeTransfer/Drive :](https://fathom.video/calls/769219559?tab=summary&timestamp=2328.0)
          - [Photos \`porté + nature morte\` de la collection FW26.](https://fathom.video/calls/769219559?tab=summary&timestamp=2328.0)
          - [Dossier \`Atelier et Métiers d'Art\`.](https://fathom.video/calls/769219559?tab=summary&timestamp=2328.0)
          - [Lookbook FW26 au format PDF.](https://fathom.video/calls/769219559?tab=summary&timestamp=2328.0)
      - [Confirmer les revendeurs actifs pour la story \`Store Feature\`.](https://fathom.video/calls/769219559?tab=summary&timestamp=221.0)
      - [Créer les vidéos \`Atelier 3\` et \`Atelier 4\`.](https://fathom.video/calls/769219559?tab=summary&timestamp=1112.0)
      - [Fournir le contenu pour la story \`Catherine Inspo\`.](https://fathom.video/calls/769219559?tab=summary&timestamp=520.0)
      - [Fournir le contenu pour le \`Grid Talk\` d'I-WAY.](https://fathom.video/calls/769219559?tab=summary&timestamp=2179.0)
  - [**Alessandro :**](https://fathom.video/calls/769219559?tab=summary&timestamp=2107.0)
      - [Créer et envoyer le post \`Grid Talk\` à Pierre pour validation.](https://fathom.video/calls/769219559?tab=summary&timestamp=2107.0)
      - [Proposer des vidéos pour le \`Multi-Produit Fixe\` de Catherine Osti.](https://fathom.video/calls/769219559?tab=summary&timestamp=1414.0)
`;

describe("extractNextSteps", () => {
  it("ne rend que le bloc du propriétaire", () => {
    const steps = extractNextSteps(BONDET, "Alessandro DI GIOVANNI");

    expect(steps.map((s) => s.text)).toEqual([
      "Envoyer la vidéo UGC de Théo à Malory pour validation.",
      "Envoyer à Malory un e-mail récapitulatif, la proposition Google Ads et un devis pour le budget consolidé.",
    ]);
  });

  it("ignore les puces des autres sections, fussent-elles en « X : »", () => {
    // « Campagne « Broad » : », « Problème : », « Action : » vivent dans
    // « Sujets » et ressemblent à des intitulés de personne. Le bornage par
    // section est la seule chose qui les tienne dehors.
    const steps = extractNextSteps(BONDET, "Alessandro");
    expect(steps).toHaveLength(2);
    expect(steps.some((s) => s.text.includes("Coût par achat"))).toBe(false);
  });

  it("garde le lien horodaté de chaque tâche", () => {
    const steps = extractNextSteps(BONDET, "Alessandro DI GIOVANNI");
    expect(steps[0]!.url).toBe(
      "https://fathom.video/calls/759690039?tab=summary&timestamp=1186.0",
    );
  });

  it("reconnaît le prénom seul, là où le compte porte le nom complet", () => {
    // Le compte rendu écrit « Alessandro », Fathom dit « Alessandro DI GIOVANNI ».
    expect(extractNextSteps(IWAY, "Alessandro DI GIOVANNI")).toHaveLength(2);
  });

  it("ignore les sous-puces qui détaillent une tâche", () => {
    // Les trois lignes sous « Envoyer les assets » appartiennent à Pierre et
    // décrivent une seule tâche : elles ne doivent jamais devenir des tâches.
    const pierre = extractNextSteps(IWAY, "Pierre");
    expect(pierre.map((s) => s.text)).toEqual([
      "Valider toutes les intentions d'août sur Monday.",
      "Envoyer à Alessandro les assets Catherine Osti via WeTransfer/Drive :",
      "Confirmer les revendeurs actifs pour la story Store Feature.",
      "Créer les vidéos Atelier 3 et Atelier 4.",
      "Fournir le contenu pour la story Catherine Inspo.",
      "Fournir le contenu pour le Grid Talk d'I-WAY.",
    ]);
  });

  it("prend le bloc même quand il n'est pas le premier", () => {
    const steps = extractNextSteps(IWAY, "Alessandro");
    expect(steps.map((s) => s.text)).toEqual([
      "Créer et envoyer le post Grid Talk à Pierre pour validation.",
      "Proposer des vidéos pour le Multi-Produit Fixe de Catherine Osti.",
    ]);
  });

  it("s'arrête au titre suivant", () => {
    const avecSuite = `${BONDET}\n## Autre section\n\n  - [**Alessandro :**](x)\n      - [Ne doit pas être pris.](x)\n`;
    expect(extractNextSteps(avecSuite, "Alessandro")).toHaveLength(2);
  });

  it("ne rend rien quand la section est absente", () => {
    expect(extractNextSteps("## Sujets\n\n  - [Un point.](x)", "Alessandro")).toEqual([]);
  });

  it("ne rend rien quand le propriétaire n'y figure pas", () => {
    expect(extractNextSteps(BONDET, "Caroline")).toEqual([]);
  });

  it("accepte l'intitulé anglais", () => {
    const anglais = "## Next steps\n\n  - **Alessandro:**\n      - Send the deck.\n";
    expect(extractNextSteps(anglais, "Alessandro").map((s) => s.text)).toEqual([
      "Send the deck.",
    ]);
  });

  it("tolère l'absence de lien", () => {
    const nu = "## Prochaines étapes\n\n  - **Alessandro :**\n      - Relancer Théo.\n";
    expect(extractNextSteps(nu, "Alessandro")).toEqual([
      { text: "Relancer Théo.", url: null },
    ]);
  });

  it("ne confond pas deux personnes dont le bloc s'enchaîne", () => {
    const steps = extractNextSteps(BONDET, "Malory");
    expect(steps).toHaveLength(3);
    expect(steps[0]!.text).toBe(
      "Examiner le plan de contenu d'août et la proposition Google Ads.",
    );
  });
});
