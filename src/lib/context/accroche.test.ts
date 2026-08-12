import { describe, expect, it } from "vitest";

import { extractAccroche } from "./accroche";

describe("extractAccroche", () => {
  it("prend la première ligne pleine du wording", () => {
    const wording = "L'accroche qui claque.\n\nLe corps du post, plus long.\n#hashtag";
    expect(extractAccroche(wording)).toBe("L'accroche qui claque.");
  });

  it("saute les lignes vides et les puces d'ouverture", () => {
    expect(extractAccroche("\n\n- « Une accroche citée »")).toBe("Une accroche citée »");
  });

  it("rend une chaîne vide pour un wording vide", () => {
    expect(extractAccroche("")).toBe("");
    expect(extractAccroche("\n\n")).toBe("");
  });

  it("coupe un paragraphe démesuré à la première phrase", () => {
    const wording = `Une première phrase raisonnable qui ouvre le post. ${"La suite s'étire beaucoup trop pour une accroche. ".repeat(20)}`;
    expect(extractAccroche(wording)).toBe(
      "Une première phrase raisonnable qui ouvre le post.",
    );
  });

  it("coupe franchement quand aucune phrase ne se termine", () => {
    const wording = "mot ".repeat(200);
    expect(extractAccroche(wording).length).toBeLessThanOrEqual(300);
  });
});
