import { describe, expect, it } from "vitest";

import {
  BALL_COUNT,
  GUARD,
  LAVA_TOKENS,
  START_TIME,
  avoidBoxes,
  ballsAt,
  dropletCaught,
  fieldAt,
  fragmentShader,
  nearestBox,
  parseColor,
  pearlsOf,
  readLavaPalette,
  type DropletState,
  type LavaBox,
} from "./lava-shader";

const TOKENS: Record<string, string> = {
  "--profondeur": "#0b110c",
  "--signal": "#22e05b",
  "--menthe": "#e2f3da",
  "--rose": "#f7a8d8",
  "--lagon": "#2fd3c6",
  "--craie": "#f7f8f4",
  "--lilas": "#9c95ff",
  "--azur": "#4d7bff",
};
const read = (token: string) => TOKENS[token] ?? "";

/** Le hero à 1440 × 846 : preuve, trois lignes de titre, chapô, deux boutons, puis l'en-tête (unités, y depuis le bas). */
const DESKTOP: { w: number; h: number; boxes: LavaBox[] } = {
  w: 1440,
  h: 846,
  boxes: [
    [0.196, 0.716, 0.463, 0.745],
    [0.175, 0.586, 1.007, 0.7],
    [0.175, 0.497, 0.789, 0.61],
    [0.175, 0.395, 0.774, 0.524],
    [0.175, 0.344, 0.85, 0.376],
    [0.175, 0.307, 0.783, 0.339],
    [0.175, 0.27, 0.482, 0.302],
    [0.175, 0.16, 0.57, 0.22],
    [0.584, 0.16, 0.822, 0.22],
    [0.175, 0.946, 0.288, 0.979],
    [0.6, 0.952, 0.98, 0.973],
    [1.262, 0.942, 1.312, 0.982],
  ],
};
/** Le hero à 390 × 844. */
const MOBILE: { w: number; h: number; boxes: LavaBox[] } = {
  w: 390,
  h: 844,
  boxes: [
    [0.09, 1.71, 0.58, 1.77],
    [0.05, 1.46, 0.95, 1.66],
    [0.05, 1.38, 0.7, 1.47],
    [0.05, 1.05, 0.93, 1.3],
    [0.05, 0.69, 0.95, 0.82],
    [0.05, 0.56, 0.95, 0.68],
    [0.05, 2.03, 0.33, 2.1],
    [0.57, 2.01, 0.95, 2.11],
  ],
};

function worstFieldOnBoxes(balls: Float32Array, boxes: readonly LavaBox[]): number {
  let worst = 0;
  for (const [x0, y0, x1, y1] of boxes) {
    for (let k = 0; k <= 20; k += 1) {
      const x = x0 + ((x1 - x0) * k) / 20;
      const y = y0 + ((y1 - y0) * k) / 20;
      worst = Math.max(worst, fieldAt(balls, x, y0), fieldAt(balls, x, y1), fieldAt(balls, x0, y), fieldAt(balls, x1, y));
    }
  }
  return worst;
}

describe("parseColor", () => {
  it("lit les trois écritures d'une couleur de token", () => {
    expect(parseColor("#22e05b")).toEqual([34 / 255, 224 / 255, 91 / 255]);
    expect(parseColor(" #fff ")).toEqual([1, 1, 1]);
    expect(parseColor("rgb(11, 17, 12)")).toEqual([11 / 255, 17 / 255, 12 / 255]);
  });
  it("refuse ce qu'elle ne sait pas lire", () => {
    expect(parseColor("")).toBeNull();
    expect(parseColor("var(--signal)")).toBeNull();
  });
});

describe("readLavaPalette", () => {
  it("prend chaque couleur dans les tokens de la charte", () => {
    const palette = readLavaPalette(read, "dark");
    expect(palette?.signal).toEqual(parseColor(TOKENS["--signal"]));
    expect(palette?.fond).toEqual(parseColor(TOKENS["--profondeur"]));
    expect(Object.keys(palette ?? {})).toEqual(Object.keys(LAVA_TOKENS.dark));
  });
  it("renonce si un token manque, plutôt que d'inventer une couleur", () => {
    expect(readLavaPalette((t) => (t === "--rose" ? "" : read(t)), "dark")).toBeNull();
  });
});

describe("fragmentShader", () => {
  it("grave les couleurs en constantes nommées, sans aucune valeur hexadécimale", () => {
    const src = fragmentShader(readLavaPalette(read, "dark")!);
    for (const name of ["PROFONDEUR", "SIGNAL", "MENTHE", "ROSE", "LAGON"]) expect(src).toContain(`const vec3 ${name}=`);
    expect(src).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    expect(src).toContain(`uniform vec3 u_balls[${BALL_COUNT}]`);
  });
});

describe("ballsAt", () => {
  it("rend sept gouttes, la dernière (le pointeur) absente sans pointeur", () => {
    const balls = ballsAt(START_TIME, 1440, 846, null);
    expect(balls).toHaveLength(BALL_COUNT * 3);
    expect(balls[(BALL_COUNT - 1) * 3 + 2]).toBe(0);
  });
  it("est déterministe : la même image pour le repli et la première image WebGL", () => {
    expect(Array.from(ballsAt(START_TIME, 1440, 846, null, DESKTOP.boxes))).toEqual(Array.from(ballsAt(START_TIME, 1440, 846, null, DESKTOP.boxes)));
  });
  for (const [label, frame] of [
    ["sur écran large", DESKTOP],
    ["sur téléphone", MOBILE],
  ] as const) {
    it(`ne pose jamais de matière sur le texte, ${label}, sur tout un cycle`, () => {
      const state: DropletState = { caught: -1, wanted: 0 };
      for (let t = START_TIME; t < START_TIME + 44; t += 0.25) {
        const balls = ballsAt(t, frame.w, frame.h, null, frame.boxes, undefined, state, 0.25);
        expect(worstFieldOnBoxes(balls, frame.boxes)).toBeLessThanOrEqual(GUARD.fieldMax + 1e-6);
      }
    });
  }
  it("résorbe la goutte du pointeur au-dessus du titre et la laisse entière dans le vide", () => {
    const onTitle = ballsAt(START_TIME, 1440, 846, { x: 0.3, y: 0.6, presence: 1 }, DESKTOP.boxes);
    expect(onTitle[(BALL_COUNT - 1) * 3 + 2]).toBe(0);
    const away = ballsAt(START_TIME, 1440, 846, { x: 0.95, y: 0.5, presence: 1 }, DESKTOP.boxes);
    expect(away[(BALL_COUNT - 1) * 3 + 2]).toBeCloseTo(0.09, 2);
  });
});

describe("dropletCaught", () => {
  it("laisse la gouttelette détachée sur l'image de repli et la prend dans le verre quelques secondes par cycle", () => {
    expect(dropletCaught(START_TIME)).toBe(0);
    let caught = 0;
    for (let t = START_TIME; t < START_TIME + 22; t += 0.5) caught += dropletCaught(t);
    expect(caught * 0.5).toBeGreaterThan(3);
    expect(caught * 0.5).toBeLessThan(7);
  });
});

describe("la gouttelette", () => {
  it("n'est jamais un nez : détachée, un vide la sépare de la grande bulle", () => {
    const state: DropletState = { caught: -1, wanted: 0 };
    let detached = 0;
    for (let t = START_TIME; t < START_TIME + 44; t += 1 / 30) {
      const b = ballsAt(t, DESKTOP.w, DESKTOP.h, null, DESKTOP.boxes, undefined, state, 1 / 30);
      if (state.caught > 0.02) continue;
      detached += 1;
      // Sur le segment qui va d'elle au centre de la grande bulle, le champ repasse sous le bord.
      let low = Infinity;
      for (let k = 1; k < 40; k += 1) {
        const s = k / 40;
        low = Math.min(low, fieldAt(b, b[15] + (b[0] - b[15]) * s, b[16] + (b[1] - b[16]) * s));
      }
      expect(low).toBeLessThan(1);
    }
    // Et elle l'est la plus grande partie du temps.
    expect(detached / (44 * 30)).toBeGreaterThan(0.5);
  });
  it("prise dans le verre, garde son liseré : la perle se déclare plongée dans la masse", () => {
    const state: DropletState = { caught: 1, wanted: 1 };
    const balls = ballsAt(START_TIME + 10, DESKTOP.w, DESKTOP.h, null, [], undefined, state, 0);
    expect(pearlsOf(balls)[3]).toBeGreaterThan(0.9);
  });
});

describe("nearestBox", () => {
  it("donne la distance au bord et la sortie la plus courte, dedans comme dehors", () => {
    const box: LavaBox = [0, 0, 1, 1];
    expect(nearestBox([box], 2, 0.5)).toMatchObject({ d: 1, nx: 1, ny: 0 });
    const inside = nearestBox([box], 0.9, 0.5);
    expect(inside.d).toBeCloseTo(-0.1);
    expect(inside.nx).toBe(1);
  });
});

describe("avoidBoxes", () => {
  it("passe les pixels en unités, y depuis le bas, et suit l'en-tête collant au défilement", () => {
    const rects = { flow: [[100, 200, 300, 260] as const], fixed: [[100, 10, 200, 40] as const] };
    const atTop = avoidBoxes(rects, { left: 0, top: 0, width: 1000, height: 500 });
    expect(atTop[0]).toEqual([0.2, 0.48, 0.6, 0.6]);
    expect(atTop[1]).toEqual([0.2, 0.92, 0.4, 0.98]);
    // Section remontée de 100 px : l'en-tête, lui, n'a pas bougé dans la fenêtre.
    const scrolled = avoidBoxes(rects, { left: 0, top: -100, width: 1000, height: 500 });
    expect(scrolled[0]).toEqual(atTop[0]);
    expect(scrolled[1][1]).toBeCloseTo(0.72);
    // Section sortie de la fenêtre : l'en-tête n'est plus au-dessus d'elle.
    expect(avoidBoxes(rects, { left: 0, top: -600, width: 1000, height: 500 })).toHaveLength(1);
  });
});
