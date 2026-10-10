/**
 * La lave du hero : les formes de la V1 livrée — des bulles de verre en
 * métaballes, un dôme, des reflets nets, une bulle qui suit la souris —
 * peintes aux couleurs et aux règles de la charte V2 (r-05, r-19) : fond
 * Profondeur, cœur Signal, franges Menthe et Rose, grain, cycles de 14 à
 * 22 s, une goutte au pointeur amortie à 0,06.
 *
 * Ce module ne dépend pas de React : il porte la composition (où vivent les
 * gouttes et comment elles bougent), la garde qui les tient à l'écart du
 * texte, le shader et son moteur WebGL1. Le composant (`lava-canvas.tsx`)
 * ne fait que mesurer la page et faire tourner l'horloge.
 */

export type LavaVariant = "dark" | "light";

/** Six gouttes de composition, la septième au pointeur. */
export const BALL_COUNT = 7;
const DROPLET = BALL_COUNT - 2;
const POINTER = BALL_COUNT - 1;

/**
 * L'horloge démarre à 7 s : c'est l'instant de l'image de repli
 * (`public/brand/lave-hero-*.webp`) et de l'image figée en mouvement réduit.
 * La première image WebGL tombe donc sur le repli, le fondu de l'une à
 * l'autre ne se voit pas.
 */
export const START_TIME = 7;

type Vec2 = readonly [number, number];
type Vec3 = readonly [number, number, number];

/* --- La composition ---------------------------------------------------------
   Une unité = le plus petit côté de la section ; x depuis la gauche et y
   depuis le bas, en fraction de la section ; r en unités. « land » sur écran
   large, « port » en portrait ; entre les deux (tablette, carré), la
   composition glisse de l'une à l'autre. Chaque goutte a ses deux cycles
   (x, y) et sa respiration, tous entre 14 et 22 s (r-19). Les grandes formes
   sont coupées par les bords : la lave est une matière qui déborde du cadre,
   pas des bulles posées dedans. */
type Blob = {
  land: Vec3;
  port: Vec3;
  /** Amplitude de l'orbite, en unités. */
  amp: Vec2;
  /** Cycles de x, de y et de la respiration, en secondes. */
  period: Vec3;
  phase: number;
};

const BLOBS: readonly Blob[] = [
  // La grande bulle, à droite de la colonne de texte, coupée par le bord droit (en portrait : en bas à droite).
  { land: [0.855, 0.52, 0.32], port: [0.86, 0.04, 0.42], amp: [0.045, 0.05], period: [19, 16, 21], phase: 0.4 },
  // Sa compagne du haut, coupée par le bord supérieur (en portrait : la perle en haut à droite, sous le menu).
  { land: [0.99, 1.03, 0.21], port: [0.87, 0.87, 0.1], amp: [0.035, 0.03], period: [16, 21, 14], phase: 2.1 },
  // Le bas droit, coupé par le bord inférieur (en portrait : la perle du bord gauche).
  { land: [0.95, 0.0, 0.2], port: [-0.02, 0.2, 0.16], amp: [0.04, 0.03], period: [21, 17, 18], phase: 4.0 },
  // Le coin haut gauche, coupé par deux bords (en portrait : une bulle qui affleure au bas).
  { land: [0.0, 1.02, 0.17], port: [0.42, -0.13, 0.12], amp: [0.03, 0.03], period: [22, 15, 19], phase: 5.3 },
  // Une bulle qui affleure au bas, sous les boutons (en portrait : la petite perle du haut).
  { land: [0.33, -0.12, 0.17], port: [0.6, 0.885, 0.035], amp: [0.05, 0.02], period: [14, 20, 16], phase: 1.2 },
];

/*
 * La gouttelette ne vit pas sur une orbite libre : collée au flanc de la
 * grande bulle, elle s'y soudait par un col et lui faisait un nez. Elle se
 * place donc par rapport à elle, à une distance qui ne connaît que deux
 * états : franchement détachée (un écart de surface à surface où le champ
 * r²/d² retombe sous le seuil entre les deux), ou prise dans le verre, à
 * l'intérieur. Le passage de l'un à l'autre est court ; le col n'existe que
 * pendant ce passage.
 */
const DROPLET_SHAPE = {
  /** Rayon, en portrait et sur écran large. */
  radius: [0.05, 0.05] as Vec2,
  /**
   * Direction depuis le centre de la grande bulle, en radians : à sa gauche en portrait, en bas à gauche
   * sur écran large. Trouvées par balayage (angle × écart × 60 s, de 360 à 1920 px) : ailleurs, le champ
   * des grandes masses voisines ou le texte ne laissent jamais la place d'une perle détachée.
   */
  angle: [3.28, 3.84] as Vec2,
  /**
   * Balayage du flanc, en radians, en portrait et sur écran large : à contre-temps de la grande bulle,
   * elle descend quand celle-ci avance vers le texte. En portrait, la place est entre le texte et la
   * perle de gauche : elle n'y balaie pas.
   */
  sweep: [0, 0.12] as Vec2,
  /**
   * Écart de surface à surface quand elle est détachée. Le champ r²/d² porte loin : sous 0,2 unité,
   * les deux bulles restaient soudées et la gouttelette faisait un nez sur le flanc. Si le col tient
   * encore, l'écart grandit jusqu'à 0,12 de plus ; au-delà, elle n'a pas la place et rentre dans le verre.
   */
  gap: 0.24,
  stretch: 0.12,
  /** Prise : distance de son bord au bord de la grande bulle, vers l'intérieur. */
  depth: 0.07,
  /** Son cycle : détachée dix-sept secondes, prise cinq. */
  cycle: 22,
  caught: [0.36, 0.6] as Vec2,
  /** Constante de temps du passage d'un état à l'autre, en secondes : le col ne dure qu'un instant. */
  ease: 0.55,
} as const;

/** Rayon de la goutte du pointeur, en portrait et sur écran large. */
const POINTER_RADIUS: Vec2 = [0.085, 0.09];

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const TAU = Math.PI * 2;

/** 0 en portrait, 1 sur écran large ; entre les deux, la composition glisse. */
export function landscapeFactor(width: number, height: number): number {
  return smoothstep(0.85, 1.25, width / Math.max(1, height));
}

/** Le pointeur vu par la lave : position en fraction de la section (y depuis le bas) et présence 0 → 1. */
export type LavaPointer = { x: number; y: number; presence: number };

/** Ce que veut le cycle à l'instant `time` : 0 détachée, 1 prise dans le verre. */
export function dropletCaught(time: number): number {
  const { cycle, caught } = DROPLET_SHAPE;
  const u = ((((time - START_TIME) / cycle) % 1) + 1) % 1;
  return u >= caught[0] && u < caught[1] ? 1 : 0;
}

/**
 * L'état de la gouttelette d'une image à l'autre : où elle en est (0 détachée, 1 prise) et où elle
 * va. Tenu par le moteur ; sans lui (image figée, repli), elle est directement là où elle va.
 */
export type DropletState = { caught: number; wanted: number };

/* --- La garde du texte ------------------------------------------------------
   Craie sur Signal tombe à 1,7:1 (r-13) : aucune matière ne passe sous une
   lettre. Le composant relève les boîtes des glyphes de chaque ligne de texte
   du hero et du menu, et des boutons, en unités (y depuis le bas). Chaque
   goutte de composition en est repoussée à son rayon plus une marge ; puis le
   champ est mesuré sur le pourtour de chaque boîte, et la goutte qui y pèse
   le plus recule tant qu'il dépasse le seuil — les gouttes r²/d² s'additionnent
   de loin, deux voisines peuvent atteindre une lettre qu'aucune n'atteint
   seule. La goutte du pointeur, elle, se résorbe à l'approche. */

/** Une boîte à éviter : x0, y0, x1, y1 en unités, y depuis le bas. */
export type LavaBox = readonly [number, number, number, number];

export const GUARD = {
  /** Distance minimale du centre d'une goutte à une boîte : rayon × 1,06 + 0,035 unité. */
  inflate: 1.06,
  margin: 0.035,
  /** Champ maximal sur une boîte : le bord de la matière est à 1, son halo s'éteint en dessous. */
  fieldMax: 0.9,
  /** La goutte du pointeur est entière à 2,4 rayons du texte, nulle à 1 rayon. */
  pointerFull: 2.4,
  pointerGone: 1,
} as const;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Distance d'un point à la boîte la plus proche (négative dedans) et direction pour s'en éloigner. */
export function nearestBox(boxes: readonly LavaBox[], x: number, y: number): { d: number; nx: number; ny: number } {
  let best = { d: Infinity, nx: 0, ny: 0 };
  for (const [x0, y0, x1, y1] of boxes) {
    const cx = clamp(x, x0, x1);
    const cy = clamp(y, y0, y1);
    let dx = x - cx;
    let dy = y - cy;
    let d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1e-6) {
      // Centre dans la boîte : sortie par le côté le plus proche, distance comptée en négatif.
      const sides: Array<[number, number, number]> = [
        [x - x0, -1, 0],
        [x1 - x, 1, 0],
        [y - y0, 0, -1],
        [y1 - y, 0, 1],
      ];
      sides.sort((a, b) => a[0] - b[0]);
      [d, dx, dy] = [-sides[0][0], sides[0][1], sides[0][2]];
    } else {
      dx /= d;
      dy /= d;
    }
    if (d < best.d) best = { d, nx: dx, ny: dy };
  }
  return best;
}

/** Le champ r²/d² en un point, sans la goutte `skip`. Miroir exact du shader. */
export function fieldAt(balls: Float32Array, x: number, y: number, skip = -1): number {
  let f = 0;
  for (let i = 0; i < BALL_COUNT; i += 1) {
    if (i === skip) continue;
    const r = balls[i * 3 + 2];
    if (r <= 0) continue;
    const dx = x - balls[i * 3];
    const dy = y - balls[i * 3 + 1];
    f += (r * r) / (dx * dx + dy * dy + 1e-5);
  }
  return f;
}

function pushOut(balls: Float32Array, i: number, boxes: readonly LavaBox[]) {
  for (let it = 0; it < 6; it += 1) {
    const n = nearestBox(boxes, balls[i * 3], balls[i * 3 + 1]);
    const need = balls[i * 3 + 2] * GUARD.inflate + GUARD.margin - n.d;
    if (!(need > 0)) return;
    balls[i * 3] += n.nx * need;
    balls[i * 3 + 1] += n.ny * need;
  }
}

/** Points du pourtour d'une boîte, tous les 0,03 unité au plus (le champ r²/d² est sous-harmonique : son maximum sur une boîte est sur son bord). */
function perimeter(box: LavaBox, visit: (x: number, y: number) => void) {
  const [x0, y0, x1, y1] = box;
  const nx = Math.min(24, Math.max(1, Math.ceil((x1 - x0) / 0.03)));
  const ny = Math.min(12, Math.max(1, Math.ceil((y1 - y0) / 0.03)));
  for (let i = 0; i <= nx; i += 1) {
    const x = x0 + ((x1 - x0) * i) / nx;
    visit(x, y0);
    visit(x, y1);
  }
  for (let j = 1; j < ny; j += 1) {
    const y = y0 + ((y1 - y0) * j) / ny;
    visit(x0, y);
    visit(x1, y);
  }
}

function relieveField(balls: Float32Array, boxes: readonly LavaBox[], caught: number) {
  for (let it = 0; it < 8; it += 1) {
    let worst: number = GUARD.fieldMax;
    let wx = 0;
    let wy = 0;
    for (const box of boxes) {
      perimeter(box, (x, y) => {
        const f = fieldAt(balls, x, y);
        if (f > worst) {
          worst = f;
          wx = x;
          wy = y;
        }
      });
    }
    if (worst <= GUARD.fieldMax) return;
    // La goutte qui pèse le plus sur le pire point recule juste assez pour le ramener sous le seuil.
    let heavy = -1;
    let weight = 0;
    for (let i = 0; i < BALL_COUNT; i += 1) {
      const r = balls[i * 3 + 2];
      if (r <= 0) continue;
      const dx = wx - balls[i * 3];
      const dy = wy - balls[i * 3 + 1];
      const c = (r * r) / (dx * dx + dy * dy + 1e-5);
      if (c > weight) {
        weight = c;
        heavy = i;
      }
    }
    if (heavy < 0) return;
    const target = Math.max(0.02, weight - (worst - GUARD.fieldMax) - 0.01);
    const r = balls[heavy * 3 + 2];
    if (heavy === POINTER) {
      // Celle du pointeur ne recule pas sous la souris : elle rétrécit.
      balls[heavy * 3 + 2] = r * Math.sqrt(target / weight);
      continue;
    }
    const x = balls[heavy * 3];
    const y = balls[heavy * 3 + 1];
    let dx = x - wx;
    let dy = y - wy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < r * 0.5) {
      // Centre presque sur la lettre : la direction du point ne veut rien dire, on sort par le bord de boîte le plus proche.
      const n = nearestBox(boxes, x, y);
      dx = n.nx;
      dy = n.ny;
    } else {
      dx /= len;
      dy /= len;
    }
    const dist = r / Math.sqrt(target);
    balls[heavy * 3] = wx + dx * dist;
    balls[heavy * 3 + 1] = wy + dy * dist;
    pushOut(balls, heavy, boxes);
    // La gouttelette prise dans la grande bulle la suit.
    if (heavy === 0 && caught > 0) {
      balls[DROPLET * 3] += (balls[0] - x) * caught;
      balls[DROPLET * 3 + 1] += (balls[1] - y) * caught;
    }
  }
}

/** Le col entre la gouttelette et la masse qui pèse le plus sur elle : le minimum du champ sur le segment qui les relie. */
function bridgeOf(balls: Float32Array): number {
  const x = balls[DROPLET * 3];
  const y = balls[DROPLET * 3 + 1];
  let heavy = 0;
  let weight = 0;
  for (let i = 0; i < DROPLET; i += 1) {
    const r = balls[i * 3 + 2];
    const c = (r * r) / ((x - balls[i * 3]) ** 2 + (y - balls[i * 3 + 1]) ** 2 + 1e-5);
    if (c > weight) {
      weight = c;
      heavy = i;
    }
  }
  const hx = balls[heavy * 3];
  const hy = balls[heavy * 3 + 1];
  let low = Infinity;
  for (let k = 1; k < 24; k += 1) {
    const t = k / 24;
    low = Math.min(low, fieldAt(balls, x + (hx - x) * t, y + (hy - y) * t, POINTER));
  }
  return low;
}

/** Sous ce col, la gouttelette se lit détachée : une perle, pas un nez. */
const NECK_MAX = 0.9;

/**
 * Les sept gouttes à l'instant `time`, prêtes pour `uniform3fv` : centre et
 * rayon en unités. Le calcul est ici et pas dans le shader : sept gouttes et
 * quelques dizaines de boîtes coûtent moins par image que par pixel.
 */
export function ballsAt(
  time: number,
  width: number,
  height: number,
  pointer: LavaPointer | null,
  boxes: readonly LavaBox[] = [],
  out = new Float32Array(BALL_COUNT * 3),
  droplet?: DropletState,
  dt = 0,
): Float32Array {
  const unit = Math.max(1, Math.min(width, height));
  const sx = width / unit;
  const sy = height / unit;
  const l = landscapeFactor(width, height);
  BLOBS.forEach((b, i) => {
    const [px, py, pr] = b.period;
    out[i * 3] = mix(b.port[0], b.land[0], l) * sx + b.amp[0] * Math.sin((TAU / px) * time + b.phase);
    out[i * 3 + 1] = mix(b.port[1], b.land[1], l) * sy + b.amp[1] * Math.cos((TAU / py) * time + b.phase * 1.7 + 1.3);
    // La goutte respire : le contour change de forme, pas seulement de place.
    out[i * 3 + 2] = mix(b.port[2], b.land[2], l) * (1 + 0.045 * Math.sin((TAU / pr) * time + b.phase * 2.3));
  });

  // Les grandes formes d'abord tenues à distance du texte.
  if (boxes.length) for (let i = 0; i < DROPLET; i += 1) pushOut(out, i, boxes);

  // La gouttelette, par rapport à la grande bulle (déjà gardée).
  const s = DROPLET_SHAPE;
  const big = out[2];
  const r = mix(s.radius[0], s.radius[1], l) * (1 + 0.06 * Math.sin((TAU / 17) * time + 3.1));
  const angle = mix(s.angle[0], s.angle[1], l) - mix(s.sweep[0], s.sweep[1], l) * Math.sin((TAU / BLOBS[0].period[0]) * time + BLOBS[0].phase);
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const d = DROPLET * 3;
  const place = (dist: number) => {
    out[d] = out[0] + ca * dist;
    out[d + 1] = out[1] + sa * dist;
  };
  out[d + 2] = r;
  out[POINTER * 3 + 2] = 0;
  // Détachée, elle s'éloigne juste assez pour que le col se rompe : le plus petit écart qui y parvient,
  // cherché par dichotomie — continu dans le temps, elle glisse au lieu de sauter.
  let gap: number = s.gap;
  place(big + r + gap);
  let bridge = bridgeOf(out);
  if (bridge > NECK_MAX) {
    let lo = gap;
    let hi = gap + s.stretch;
    place(big + r + hi);
    bridge = bridgeOf(out);
    if (bridge <= NECK_MAX) {
      for (let it = 0; it < 10; it += 1) {
        const mid = (lo + hi) / 2;
        place(big + r + mid);
        if (bridgeOf(out) > NECK_MAX) lo = mid;
        else hi = mid;
      }
    }
    gap = hi;
    place(big + r + gap);
  }
  // Pas de place (le col tient même loin, ou le texte est là) : elle rentre dans le verre plutôt que
  // de s'y coller. Avec une marge entre l'entrée et la sortie, pour ne pas hésiter sur le seuil.
  const clear = boxes.length ? nearestBox(boxes, out[d], out[d + 1]).d - (r * GUARD.inflate + GUARD.margin) : 1;
  const held = droplet ? droplet.wanted > 0.5 : false;
  const crowded = held ? bridge > NECK_MAX + 0.005 || clear < 0.035 : bridge > NECK_MAX + 0.02 || clear < 0.02;
  const wanted = dropletCaught(time) > 0.5 || crowded ? 1 : 0;
  let caught = wanted;
  if (droplet) {
    // Elle passe d'un état à l'autre en une seconde environ ; jamais à mi-chemin plus longtemps.
    if (!(droplet.caught >= 0)) droplet.caught = wanted;
    droplet.caught += (wanted - droplet.caught) * (1 - Math.exp(-Math.max(0, dt) / s.ease));
    droplet.wanted = wanted;
    caught = droplet.caught;
  }
  place(mix(big + r + gap, big - r - s.depth, caught));
  if (boxes.length) pushOut(out, DROPLET, boxes);

  const k = POINTER * 3;
  let pr = 0;
  if (pointer && pointer.presence > 0.001) {
    const R = mix(POINTER_RADIUS[0], POINTER_RADIUS[1], l);
    const px = pointer.x * sx;
    const py = pointer.y * sy;
    // Près du texte, la goutte du pointeur se résorbe : entière à 2,4 rayons, plus rien à un rayon.
    const shrink = boxes.length ? smoothstep(R * GUARD.pointerGone, R * GUARD.pointerFull, nearestBox(boxes, px, py).d) : 1;
    pr = R * pointer.presence * shrink;
    out[k] = px;
    out[k + 1] = py;
  }
  // Goutte absente : rejetée loin du cadre, sa contribution au champ est nulle.
  if (pr <= 0.002) {
    out[k] = -100;
    out[k + 1] = -100;
    pr = 0;
  }
  out[k + 2] = pr;

  if (boxes.length) relieveField(out, boxes, caught);
  return out;
}

/**
 * Les deux perles — la gouttelette et la goutte du pointeur — prêtes pour
 * `uniform4fv` : centre, rayon, et combien elles sont prises dans une autre
 * masse. Seule, une perle est déjà une bulle ; plongée dans la grande, son
 * champ ne fait que gonfler la masse et elle disparaît. Le shader lui rend
 * alors son liseré et son reflet net, à proportion de ce dernier chiffre.
 */
export function pearlsOf(balls: Float32Array, out = new Float32Array(8)): Float32Array {
  [DROPLET, POINTER].forEach((i, j) => {
    const r = balls[i * 3 + 2];
    out[j * 4] = balls[i * 3];
    out[j * 4 + 1] = balls[i * 3 + 1];
    out[j * 4 + 2] = r;
    out[j * 4 + 3] = r > 0.002 ? smoothstep(1.1, 2, fieldAt(balls, balls[i * 3], balls[i * 3 + 1], i)) : 0;
  });
  return out;
}

/* --- Ce que la lave évite, relevé dans la page -------------------------------
   Les vraies boîtes, pas une moitié d'écran supposée libre : une ligne de
   titre, le chapô, un bouton se placent différemment à 390, 768, 1024 ou
   1920 px, et une composition calée sur un écran large finissait sous une
   lettre en tablette. Sont relevés : chaque nœud de texte de la section
   (une boîte par ligne, par Range), ses liens et ses boutons, la même chose
   dans l'en-tête collant — le menu passe au-dessus de la lave — et tout
   élément marqué `data-lava-evite`. */

type Rect = readonly [number, number, number, number];
/** En pixels CSS : `flow` depuis le coin haut gauche de la section, `fixed` dans la fenêtre (l'en-tête ne défile pas). */
export type AvoidRects = { flow: Rect[]; fixed: Rect[] };

const SKIP = ".sr-only, script, style, noscript, template";
const CONTROL = "a, button, summary, [role='button']";

function pinned(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) {
    const position = getComputedStyle(e).position;
    if (position === "fixed" || position === "sticky") return true;
  }
  return false;
}

function boxesOf(scope: Element, lava: Element, push: (r: DOMRect) => void, skipOpaque: boolean) {
  const range = document.createRange();
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const el = node.parentElement;
    if (!el || !node.textContent?.trim() || lava.contains(el) || el.closest(SKIP) || el.closest(CONTROL)) continue;
    if (getComputedStyle(el).visibility === "hidden") continue;
    range.selectNodeContents(node);
    for (const r of range.getClientRects()) push(r);
  }
  // Un lien ou un bouton s'évite en entier : son fond en verre laisserait voir la matière sous le libellé.
  // Dans l'en-tête, un bouton plein porte son propre contraste : la lave peut passer sous lui.
  for (const el of scope.querySelectorAll(`${CONTROL}, svg`)) {
    if (lava.contains(el) || el.closest(SKIP) || (el.tagName.toLowerCase() === "svg" && el.closest(CONTROL))) continue;
    if (skipOpaque && opaque(el)) continue;
    push(el.getBoundingClientRect());
  }
}

function opaque(el: Element): boolean {
  const c = /rgba?\(([^)]+)\)/.exec(getComputedStyle(el).backgroundColor);
  if (!c) return false;
  const parts = c[1].split(/[\s,/]+/).filter(Boolean);
  return parts.length < 4 || Number(parts[3]) >= 0.95;
}

/** Relève les boîtes à éviter autour de la lave `lava` (l'élément racine du canvas). */
export function measureAvoid(lava: HTMLElement): AvoidRects {
  const section = lava.parentElement ?? lava;
  const host = section.getBoundingClientRect();
  const out: AvoidRects = { flow: [], fixed: [] };
  const add = (fixed: boolean) => (r: DOMRect) => {
    if (r.width < 1 || r.height < 1) return;
    if (fixed) out.fixed.push([r.left, r.top, r.right, r.bottom]);
    else out.flow.push([r.left - host.left, r.top - host.top, r.right - host.left, r.bottom - host.top]);
  };
  const sectionFixed = pinned(section);
  boxesOf(section, lava, add(sectionFixed), false);
  for (const header of document.querySelectorAll("header")) {
    if (section.contains(header) || header.contains(section)) continue;
    boxesOf(header, lava, add(pinned(header)), true);
  }
  const range = document.createRange();
  for (const el of document.querySelectorAll("[data-lava-evite]")) {
    if (section.contains(el)) continue;
    const push = add(pinned(el));
    if (el.matches("a, button")) push(el.getBoundingClientRect());
    else {
      range.selectNodeContents(el);
      for (const r of range.getClientRects()) push(r);
    }
  }
  return out;
}

/** Les boîtes en unités de la lave pour la section telle qu'elle est maintenant à l'écran (`host` : son rectangle dans la fenêtre). */
export function avoidBoxes(rects: AvoidRects, host: { left: number; top: number; width: number; height: number }): LavaBox[] {
  const unit = Math.max(1, Math.min(host.width, host.height));
  const boxes: LavaBox[] = [];
  const add = (x0: number, y0: number, x1: number, y1: number) => {
    // Hors de la section (en-tête parti avec le défilement), la boîte ne compte plus.
    if (y0 > host.height || y1 < 0 || x0 > host.width || x1 < 0) return;
    boxes.push([x0 / unit, (host.height - y1) / unit, x1 / unit, (host.height - y0) / unit]);
  };
  for (const [x0, y0, x1, y1] of rects.flow) add(x0, y0, x1, y1);
  for (const [x0, y0, x1, y1] of rects.fixed) add(x0 - host.left, y0 - host.top, x1 - host.left, y1 - host.top);
  return boxes;
}

/* --- Les couleurs -----------------------------------------------------------
   Lues dans les tokens de la charte (tokens.css) au montage : le shader ne
   porte aucune valeur à lui. Sur Profondeur (le hero), cœur Signal, franges
   Menthe et Rose, une touche de Lagon ; la variante claire, sur Craie, prend
   les franges Lagon et Lilas de r-17. */
export const LAVA_TOKENS = {
  dark: { fond: "--profondeur", signal: "--signal", menthe: "--menthe", rose: "--rose", lagon: "--lagon" },
  light: { fond: "--craie", signal: "--signal", menthe: "--lagon", rose: "--lilas", lagon: "--azur" },
} as const satisfies Record<LavaVariant, Record<string, string>>;

export type LavaPalette = Record<keyof (typeof LAVA_TOKENS)["dark"], readonly [number, number, number]>;

/** Une couleur CSS (#rgb, #rrggbb ou rgb()) en composantes 0–1 ; null si illisible. */
export function parseColor(value: string): readonly [number, number, number] | null {
  const v = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1];
    const n = parseInt(h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(v);
  if (rgb) return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255];
  return null;
}

/** La palette d'une variante, lue dans les propriétés calculées de `el`. */
export function readLavaPalette(read: (token: string) => string, variant: LavaVariant): LavaPalette | null {
  const out: Partial<Record<keyof LavaPalette, readonly [number, number, number]>> = {};
  for (const [role, token] of Object.entries(LAVA_TOKENS[variant]) as Array<[keyof LavaPalette, string]>) {
    const c = parseColor(read(token));
    if (!c) return null;
    out[role] = c;
  }
  return out as LavaPalette;
}

const glsl = ([r, g, b]: readonly [number, number, number]) => `vec3(${r.toFixed(4)},${g.toFixed(4)},${b.toFixed(4)})`;

const PRECISION = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;

export const VERTEX_SHADER = `attribute vec2 a_pos;void main(){gl_Position=vec4(a_pos,0.,1.);}`;

/**
 * Un seul passage, comme la V1 : le champ r²/d² et son gradient, la distance
 * au bord, le dôme, le Fresnel, deux reflets, le grain. Les couleurs sont
 * gravées dans la source en constantes nommées.
 */
export function fragmentShader(c: LavaPalette): string {
  return `${PRECISION}uniform vec2 u_res;uniform vec2 u_ext;uniform float u_time;uniform float u_seed;uniform float u_edge;
uniform vec3 u_balls[${BALL_COUNT}];uniform vec4 u_pearls[2];
const vec3 PROFONDEUR=${glsl(c.fond)};const vec3 SIGNAL=${glsl(c.signal)};
const vec3 MENTHE=${glsl(c.menthe)};const vec3 ROSE=${glsl(c.rose)};const vec3 LAGON=${glsl(c.lagon)};
// Hachage sans sinus : sin() à grand argument se répète en motifs sur une partie des GPU mobiles.
float hash(vec2 q){vec3 p3=fract(vec3(q.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float vnoise(vec2 q){vec2 i=floor(q);vec2 f=fract(q);f=f*f*(3.-2.*f);
return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
void main(){
  vec2 uv=gl_FragCoord.xy/u_res;vec2 p=uv*u_ext;float px=u_ext.x/u_res.x;
  // Les métaballes de la V1 : champ r²/d², et son gradient tourné vers l'extérieur.
  float f=0.;vec2 g=vec2(0.);
  for(int i=0;i<${BALL_COUNT};i++){vec3 b=u_balls[i];vec2 d=p-b.xy;float d2=dot(d,d)+1e-5;float r2=b.z*b.z;f+=r2/d2;g+=2.*r2*d/(d2*d2);}
  // Le grain change 24 fois par seconde ; il vit dans la matière, à peine dans le fond.
  float grain=hash(gl_FragCoord.xy+vec2(u_seed,u_seed*1.618))-.5;
  float gm=length(g);
  // Distance au bord, exacte pour une bulle seule (d = 2f(√f − 1)/|∇f|), juste au premier ordre près
  // d'une fusion. Le bord est net au pixel, le grain le mord à peine : sur écran large, le verre reste net.
  float sd=2.*f*(sqrt(f)-1.)/max(gm,1e-4);
  float a=smoothstep(-px,px,sd+grain*u_edge*px);
  // Le fond : la Profondeur, et la lumière verte que la matière jette autour d'elle.
  vec3 bg=PROFONDEUR+SIGNAL*.06*smoothstep(.3,1.,f);
  if(a<=0.){gl_FragColor=vec4(bg+grain*.025,1.);return;}
  vec2 dir=g/(gm+1e-6);
  // Le dôme : pour une bulle seule, exactement la hauteur d'une demi-sphère.
  float k=clamp(1.-1./max(f,1e-3),0.,1.);float dome=sqrt(k);
  // Au col entre deux bulles, le gradient s'annule et sa direction tourne d'un coup : |∇f|/(2f^1,5) vaut
  // 1/r pour une bulle seule et tombe à 0 au col, la normale s'y redresse en douceur — sinon le reflet y
  // dessine une étoile et le liseré une aiguille. Sa part couchée s'atténue aussi avec |∇f|.
  float trust=smoothstep(.4,2.,gm/(2.*pow(max(f,1e-3),1.5)));
  vec3 n=normalize(vec3(dir*sqrt(1.-k)*(gm/(gm+2.))*trust,dome+(1.-trust)*.6));
  vec3 L=normalize(vec3(-.45,.65,.62));
  float diff=max(dot(n,L),0.);
  // Le Fresnel se lit sur le dôme, pas sur la normale redressée : un col reste un pont éclairé entre
  // deux bulles au lieu d'une couture sombre.
  float fres=1.-dome;
  // Le verre : on voit le fond au travers, à peine teinté de vert.
  vec3 glass=bg*.7+SIGNAL*.06;
  // Le cœur Signal, localisé : il ne tient que là où la matière est épaisse, et se concentre à l'opposé
  // de la lumière, comme une caustique — la lumière qui traverse la bulle se rassemble de l'autre côté.
  float dens=smoothstep(.7,.99,dome);
  float cau=pow(max(dot(n,normalize(vec3(.4,-.48,.78))),0.),5.)*smoothstep(.15,.85,dome);
  vec3 core=SIGNAL*(.5+.25*n.z+.35*diff)*(1.+(vnoise(p*1.6+vec2(u_time*.02,-u_time*.015))-.5)*.14);
  // Un voile Signal dans l'épaisseur moyenne, le cœur plein au centre et dans la caustique : la matière
  // reste du verre au bord, le vert reste vif au cœur.
  vec3 body=mix(glass,core,clamp(.28*smoothstep(.05,.6,dome)+.5*dens+.65*cau,0.,1.));
  // La frange fait le tour comme un film : Menthe côté lumière, une touche de Lagon sur les bords tournés
  // vers le haut à droite, Rose sur ceux tournés vers le bas (r-05) — et, comme sur r-05, sur les flancs
  // dans le bas de la section.
  float rel=smoothstep(.55,1.,trust);
  float fa=dot(dir,normalize(vec2(-.45,-1.)));
  float roseW=clamp(smoothstep(.1,.8,fa)+smoothstep(-.2,.5,fa)*smoothstep(.45,.08,uv.y)*.6,0.,1.)*mix(.5,1.,rel);
  float lagW=.35*smoothstep(.45,.95,dot(dir,normalize(vec2(.75,.65))))*(1.-roseW)*rel;
  vec3 rimC=mix(mix(MENTHE,LAGON,lagW),ROSE,roseW);
  // Film large et doux, puis liseré fin, en lumière ajoutée : sur le verre sombre, la teinte reste pure.
  // Le liseré se mesure en distance au contour : même finesse sur une grande bulle et sur une perle. Au
  // col, il se retient — un col n'est pas une arête.
  float lit=.55+.6*max(dot(dir,normalize(vec2(-.45,.65))),0.)+.35*roseW;
  float ds=max(sd,0.);
  vec3 glowC=mix(SIGNAL,rimC,.55+.35*roseW);
  body+=(glowC*(pow(fres,3.)*.12+exp(-ds/.03)*.3)+rimC*exp(-ds/.0045)*.85*mix(.45,1.,rel))*lit;
  // Le rose tient plus loin dans la matière que le vert (r-05) : mélangé et non ajouté, il reste rose.
  body=mix(body,ROSE*.9,roseW*smoothstep(.18,.75,fres)*.55);
  // Le reflet du ciel sur le haut du dôme : c'est lui qui dit « verre » plutôt que « gelée ».
  float sky=smoothstep(.05,.9,n.y)*smoothstep(.04,.45,fres)*(1.-smoothstep(.55,.95,fres));
  body+=MENTHE*sky*.16*(1.-roseW);
  // Les reflets de la V1 : un net et blanc en haut à gauche, un second en contre-jour. Ils ne vivent que
  // sur une normale franche : au col, une normale à demi redressée passe face à la lumière sur une
  // large zone et dessinait une étoile.
  float sharp=smoothstep(.85,1.,trust);
  float spec=(pow(diff,120.)*1.3+pow(max(dot(n,normalize(vec3(.5,-.4,.75))),0.),28.)*.18)*sharp;
  body+=MENTHE*spec+mix(SIGNAL,MENTHE,.5)*pow(diff,10.)*.08;
  // Les perles prises dans le verre — la gouttelette, la goutte du pointeur — gardent leur liseré et
  // leur reflet : une bulle dans la bulle, lisible même au milieu de la grande masse.
  for(int j=0;j<2;j++){vec4 q=u_pearls[j];
    if(q.z>.002&&q.w>.001){vec2 dq=(p-q.xy)/q.z;float l=length(dq);
      if(l<1.){vec3 np=vec3(dq,sqrt(1.-l*l));vec2 dn=dq/(l+1e-4);
        // Une bulle d'air dans le vert : plus claire au travers, un liseré qui suit la lumière, une
        // caustique au bas droit, et le reflet net de la V1.
        float rimP=smoothstep(.68,.97,l)*(1.-smoothstep(.97,1.,l));
        float litP=.3+.7*max(dot(dn,normalize(vec2(-.45,.65))),0.);
        float cauP=pow(max(dot(np,normalize(vec3(.4,-.48,.78))),0.),6.)*(1.-l*l);
        float ps=pow(max(dot(np,L),0.),60.);
        body=mix(body,body*.55+glass*.45,q.w*.6*(1.-smoothstep(.75,1.,l)));
        body+=q.w*(MENTHE*rimP*litP*.55+mix(SIGNAL,MENTHE,.3)*pow(l,3.)*.12+SIGNAL*cauP*.35+MENTHE*ps*1.2);}}}
  body+=grain*.1;
  gl_FragColor=vec4(clamp(mix(bg+grain*.025,body,a),0.,1.),1.);
}`;
}

type Program = { program: WebGLProgram; loc: (name: string) => WebGLUniformLocation | null };

/**
 * Compile et lie le programme. Avec KHR_parallel_shader_compile, le pilote compile hors du fil
 * principal et l'on vient voir où il en est toutes les 32 ms : une compilation bloquante figeait la
 * page plusieurs centaines de millisecondes juste après l'affichage, sur un pilote lent.
 */
function compile(gl: WebGLRenderingContext, fragment: string): Promise<Program | null> {
  const program = gl.createProgram();
  if (!program) return Promise.resolve(null);
  const shaders: WebGLShader[] = [];
  for (const [type, src] of [
    [gl.VERTEX_SHADER, VERTEX_SHADER],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) return Promise.resolve(null);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
    shaders.push(shader);
  }
  gl.bindAttribLocation(program, 0, "a_pos");
  gl.linkProgram(program);
  const finish = (): Program | null => {
    const ok = gl.getProgramParameter(program, gl.LINK_STATUS) && shaders.every((sh) => gl.getShaderParameter(sh, gl.COMPILE_STATUS));
    for (const sh of shaders) gl.deleteShader(sh);
    if (!ok) {
      gl.deleteProgram(program);
      return null;
    }
    const cache = new Map<string, WebGLUniformLocation | null>();
    return {
      program,
      loc: (name) => {
        if (!cache.has(name)) cache.set(name, gl.getUniformLocation(program, name));
        return cache.get(name) ?? null;
      },
    };
  };
  const parallel = gl.getExtension("KHR_parallel_shader_compile") as { COMPLETION_STATUS_KHR: number } | null;
  if (!parallel) return Promise.resolve(finish());
  return new Promise((resolve) => {
    const poll = () => {
      if (gl.isContextLost()) resolve(null);
      else if (gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) resolve(finish());
      else window.setTimeout(poll, 32);
    };
    poll();
  });
}

/**
 * Rendu logiciel (SwiftShader, llvmpipe : pas de carte graphique, ou une carte écartée par le
 * navigateur) : chaque image coûte au processeur ce qu'elle coûterait au GPU, et la page en paie le
 * prix. La lave reste alors sur son image de repli, qui est la même image, immobile.
 */
export function isSoftwareRenderer(gl: WebGLRenderingContext): boolean {
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "");
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
}

export type LavaFrame = {
  time: number;
  pointer: LavaPointer | null;
  boxes: readonly LavaBox[];
  /** Graine du grain : changée 24 fois par seconde, figée en mouvement réduit. */
  seed: number;
  /** Morsure du grain sur le bord, en pixels du canvas : moins sur écran large, où le verre doit rester net. */
  edge: number;
};

export type LavaRenderer = {
  draw: (frame: LavaFrame) => void;
  dispose: () => void;
};

/** Le rendu sur un contexte WebGL1, prêt une fois le programme compilé ; `null` si le GPU le refuse — le composant garde alors son repli. */
export async function createLavaRenderer(gl: WebGLRenderingContext, palette: LavaPalette): Promise<LavaRenderer | null> {
  const pass = await compile(gl, fragmentShader(palette));
  if (!pass || gl.isContextLost()) return null;
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  // Un seul triangle plus grand que l'écran : tout le dessin est dans le fragment shader.
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.disable(gl.BLEND);
  gl.useProgram(pass.program);
  const balls = new Float32Array(BALL_COUNT * 3);
  const pearls = new Float32Array(8);
  const droplet: DropletState = { caught: -1, wanted: 0 };
  let last = Number.NaN;
  return {
    draw: ({ time, pointer, boxes, seed, edge }) => {
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      const unit = Math.max(1, Math.min(w, h));
      const dt = Number.isFinite(last) ? Math.min(0.1, Math.max(0, time - last)) : 0;
      last = time;
      ballsAt(time, w, h, pointer, boxes, balls, droplet, dt);
      pearlsOf(balls, pearls);
      gl.viewport(0, 0, w, h);
      gl.useProgram(pass.program);
      gl.uniform2f(pass.loc("u_res"), w, h);
      gl.uniform2f(pass.loc("u_ext"), w / unit, h / unit);
      gl.uniform1f(pass.loc("u_time"), time);
      gl.uniform1f(pass.loc("u_seed"), seed);
      gl.uniform1f(pass.loc("u_edge"), edge);
      gl.uniform3fv(pass.loc("u_balls"), balls);
      gl.uniform4fv(pass.loc("u_pearls"), pearls);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose: () => {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(pass.program);
    },
  };
}
