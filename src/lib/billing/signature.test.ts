import { describe, expect, it } from "vitest";

import { SIGNATURE_HTML, SIGNATURE_INTRO, SIGNATURE_TEXT, splitAroundAttachment } from "./signature";
import { SIGNATURE_IMAGES } from "./signature-assets";

describe("splitAroundAttachment", () => {
  const parts = splitAroundAttachment("Hello,\n\nMerci beaucoup et à très vite,");

  it("ferme le message sur « À dispo, » et garde la carte pour après la pièce jointe", () => {
    expect(parts.before.text.endsWith(SIGNATURE_INTRO)).toBe(true);
    expect(parts.before.html).not.toContain("<table");
    expect(parts.after.text).toBe(SIGNATURE_TEXT.replace(SIGNATURE_INTRO, "").trimStart());
  });

  it("rend la carte entière — nom, titre, téléphone, adresse et ses trois images", () => {
    // Vécu en production le 8/09/2026 : le découpage de l'ancienne carte
    // retirait la première rangée du tableau, et sur celle-ci c'est la carte
    // entière. Quatre clients ont reçu la seule ligne de l'adresse e-mail.
    expect(parts.after.html).toBe(SIGNATURE_HTML);
    for (const needle of [
      "Alessandro DI GIOVANNI",
      "Social Media Consultant",
      "+33679779235",
      "a.digiovanni.pro@gmail.com",
    ]) {
      expect(parts.after.html).toContain(needle);
    }
    for (const image of SIGNATURE_IMAGES) {
      expect(parts.after.html).toContain(`cid:${image.cid}`);
    }
  });
});
