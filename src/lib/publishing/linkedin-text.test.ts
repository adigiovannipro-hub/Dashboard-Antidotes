import { describe, expect, it } from "vitest";

import { escapeLittleText, toLittleText } from "./linkedin-text";

describe("escapeLittleText", () => {
  it("échappe chaque caractère réservé", () => {
    expect(escapeLittleText("(a) [b] <c> {d} @e *f* _g_ ~h~ |i \\j")).toBe(
      "\\(a\\) \\[b\\] \\<c\\> \\{d\\} \\@e \\*f\\* \\_g\\_ \\~h\\~ \\|i \\\\j",
    );
  });

  it("laisse le reste intact, accents et emojis compris", () => {
    expect(escapeLittleText("Été 2026 — 50 % 🌾 !")).toBe("Été 2026 — 50 % 🌾 !");
  });
});

describe("toLittleText", () => {
  it("une parenthèse ne coupe plus la légende", () => {
    expect(toLittleText("Nos métiers (et les vôtres)")).toBe(
      "Nos métiers \\(et les vôtres\\)",
    );
  });

  it("convertit les hashtags en modèle, accents compris", () => {
    expect(toLittleText("Rejoignez-nous #Métiers #meunerie_FR")).toBe(
      "Rejoignez-nous {hashtag|\\#|Métiers} {hashtag|\\#|meunerie\\_FR}",
    );
  });

  it("reconnaît un hashtag en début de texte, de ligne ou après une parenthèse", () => {
    expect(toLittleText("#Un\n#Deux (#Trois)")).toBe(
      "{hashtag|\\#|Un}\n{hashtag|\\#|Deux} \\({hashtag|\\#|Trois}\\)",
    );
  });

  it("un # collé à un mot ou isolé n'est pas un hashtag", () => {
    expect(toLittleText("C# et n°1 # seul")).toBe("C\\# et n°1 \\# seul");
  });
});
