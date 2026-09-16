import { describe, expect, it } from "vitest";

import {
  DM_DEFERRED_WARNING,
  DM_HEADERS_ONLY_PREFIX,
  DM_UNAVAILABLE_PREFIX,
  dmHeadersOnlyNote,
  dmServedByHeaders,
  dmUnavailableWarning,
  dmWasRefused,
  shouldPullDirectMessages,
  startsAtHeaders,
} from "./dm-availability";

describe("dmUnavailableWarning", () => {
  it("commence par le préfixe exact, sur les deux réseaux", () => {
    // C'est ce préfixe que le passage suivant relit dans `last_error`.
    expect(dmUnavailableWarning("instagram").startsWith(DM_UNAVAILABLE_PREFIX)).toBe(
      true,
    );
    expect(dmUnavailableWarning("facebook").startsWith(DM_UNAVAILABLE_PREFIX)).toBe(
      true,
    );
  });

  it("nomme le réglage Instagram à vérifier, sans l'affirmer comme cause", () => {
    const warning = dmUnavailableWarning("instagram");
    expect(warning).toContain("Autoriser l'accès aux messages");
    expect(warning).toContain("relancer un relevé complet");
    expect(warning).toContain("vérifier");
  });

  it("garde le texte d'origine pour Messenger", () => {
    const warning = dmUnavailableWarning("facebook");
    expect(warning).toBe(
      "Messages privés indisponibles : Meta refuse de servir la boîte de cette Page, même réduite au minimum. Les commentaires, eux, remontent normalement.",
    );
  });
});

describe("dmWasRefused", () => {
  it("reconnaît l'avertissement écrit en base", () => {
    expect(dmWasRefused(dmUnavailableWarning("instagram"))).toBe(true);
    expect(dmWasRefused(dmUnavailableWarning("facebook"))).toBe(true);
  });

  it("le reconnaît aussi derrière l'avertissement de volume des publications", () => {
    // Sur Instagram, `last_error` concatène les deux avertissements.
    expect(
      dmWasRefused(
        `2 publication(s) trop commentée(s) pour Meta : leurs commentaires n'ont pas pu être relevés ce passage. ${dmUnavailableWarning("instagram")}`,
      ),
    ).toBe(true);
  });

  it("ne confond pas un autre avertissement avec un refus de la boîte", () => {
    expect(dmWasRefused("Photos de profil refusées par Meta : (#3)")).toBe(false);
    expect(
      dmWasRefused(
        "Meta n'a pas répondu à temps sur cette boîte. Le passage suivant redemande par tranches plus petites.",
      ),
    ).toBe(false);
    expect(dmWasRefused(null)).toBe(false);
    expect(dmWasRefused("")).toBe(false);
  });

  it("ne prend ni la note d'en-têtes ni le report pour un refus", () => {
    // Une boîte servie fil par fil marche ; une boîte reportée n'a pas été
    // demandée. Ni l'une ni l'autre ne doit être sautée le lendemain.
    expect(dmWasRefused(dmHeadersOnlyNote())).toBe(false);
    expect(dmWasRefused(DM_DEFERRED_WARNING)).toBe(false);
  });
});

describe("dmHeadersOnlyNote", () => {
  it("commence par le préfixe exact que le passage suivant relit", () => {
    expect(dmHeadersOnlyNote().startsWith(DM_HEADERS_ONLY_PREFIX)).toBe(true);
  });
});

describe("dmServedByHeaders", () => {
  it("reconnaît la note, même derrière un autre avertissement", () => {
    expect(dmServedByHeaders(dmHeadersOnlyNote())).toBe(true);
    expect(
      dmServedByHeaders(`Photos de profil refusées par Meta : (#3) ${dmHeadersOnlyNote()}`),
    ).toBe(true);
  });

  it("ne confond pas un refus ou un report avec les en-têtes", () => {
    expect(dmServedByHeaders(dmUnavailableWarning("facebook"))).toBe(false);
    expect(dmServedByHeaders(DM_DEFERRED_WARNING)).toBe(false);
    expect(dmServedByHeaders(null)).toBe(false);
  });
});

describe("startsAtHeaders", () => {
  it("démarre le relevé du jour aux en-têtes quand seuls les en-têtes ont passé", () => {
    // Le jour n'a qu'un palier : repartir du listing développé, c'est
    // échouer, se déclarer refusée, et ne plus relire la boîte qu'à la nuit.
    expect(startsAtHeaders({ scope: "jour", lastError: dmHeadersOnlyNote() })).toBe(true);
  });

  it("repart du haut la nuit — c'est la passe de réparation", () => {
    expect(startsAtHeaders({ scope: "complet", lastError: dmHeadersOnlyNote() })).toBe(false);
  });

  it("repart du haut sans mémoire d'en-têtes", () => {
    expect(startsAtHeaders({ scope: "jour", lastError: null })).toBe(false);
    expect(startsAtHeaders({ scope: "jour", lastError: DM_DEFERRED_WARNING })).toBe(false);
  });
});

describe("shouldPullDirectMessages", () => {
  it("relève toujours la boîte au passage complet, même refusée la veille", () => {
    // C'est le passage de réparation : lui seul retente.
    expect(
      shouldPullDirectMessages({
        scope: "complet",
        lastError: dmUnavailableWarning("instagram"),
      }),
    ).toBe(true);
  });

  it("relève la boîte au relevé du jour quand rien n'a été refusé", () => {
    expect(shouldPullDirectMessages({ scope: "jour", lastError: null })).toBe(true);
    expect(
      shouldPullDirectMessages({ scope: "jour", lastError: DM_DEFERRED_WARNING }),
    ).toBe(true);
    expect(
      shouldPullDirectMessages({ scope: "jour", lastError: dmHeadersOnlyNote() }),
    ).toBe(true);
    expect(
      shouldPullDirectMessages({
        scope: "jour",
        lastError: "Photos de profil refusées par Meta : (#3)",
      }),
    ).toBe(true);
  });

  it("ne retente pas une boîte refusée au relevé du jour", () => {
    // 45 s pour le même refus, dans une route qui n'en a que soixante.
    expect(
      shouldPullDirectMessages({
        scope: "jour",
        lastError: dmUnavailableWarning("facebook"),
      }),
    ).toBe(false);
  });
});
