"use client";

import { useEffect, useId, useRef } from "react";

import { LOGOTYPE } from "./logotype-paths";

/**
 * Le logotype animé « Coulure » (charte r-09, proposition a) : « antidotes. »
 * en Craie, net, et sous la ligne de coupe le bas des lettres se dissout en
 * traînées de peinture irisée qui coulent lentement vers le bas, ondulent et
 * s'éteignent dans le noir, avec du grain. Le point Signal ne coule pas.
 *
 * Trois couches superposées dans une scène à l'échelle du logotype :
 * - derrière, une coulure figée en SVG — un ruban par trait que la coupe
 *   traverse, ondulé, aux couleurs de la palette irisée, flouté et grainé :
 *   c'est la première image avant le JavaScript et le repli sans WebGL ;
 * - au milieu, le canvas WebGL : un fragment shader relit une texture des
 *   lettres en remontant depuis la coupe, l'étire vers le bas, la déplace par
 *   un bruit lent et la colore d'une palette irisée qui défile ;
 * - devant, les lettres en SVG coupées à la ligne de coupe, et le point avec
 *   son halo : le haut du logo reste vectoriel, donc net à toute densité,
 *   quel que soit le plafond de résolution du canvas.
 *
 * Hors écran, onglet caché ou machine trop lente : la boucle s'arrête sur la
 * dernière image. Mouvement réduit : une seule image, et rien ne bouge. Sous
 * 120 px de large (r-09) : le logo statique, sans effet.
 */

/* --- Géométrie, en unités du logotype (hauteur d'x = 50, ligne de base à 0). */
const [WORD_X, ASCENDER_Y, WORD_W] = LOGOTYPE.viewBox.split(" ").map(Number);
const X_HEIGHT = LOGOTYPE.xHeight;
/* Le bord droit du « s » : le point est posé à 0,12 hauteur d'x de lui. */
const LETTERS_RIGHT = LOGOTYPE.dot.cx - LOGOTYPE.dot.r - 0.12 * X_HEIGHT;

/* Le mot occupe les deux tiers de la largeur : assez grand pour signer le pied
   de page, assez de marge pour que les coulures qui ondulent ne touchent pas
   les bords. La hauteur (0,62 × la largeur) laisse la peinture couler. */
const WORD_SHARE = 0.66;
const SCENE_RATIO = 0.62;
const SCENE_W = WORD_W / WORD_SHARE;
const SCENE_H = SCENE_W * SCENE_RATIO;
const SCENE_X = WORD_X - (SCENE_W - WORD_W) / 2;
const SCENE_Y = ASCENDER_Y - SCENE_H * 0.06;
const SCENE_BOTTOM = SCENE_Y + SCENE_H;

/* La ligne de coupe. Sur r-09 a le mot reste entier : la peinture part du
   pied des lettres, un dixième de hauteur d'x au-dessus de la ligne de base —
   c'est le bas des panses et des fûts qui se dissout, pas la moitié du mot,
   qui doit se lire. */
const CUT_Y = -0.1 * X_HEIGHT;
/* La plus longue coulure, depuis la coupe. */
const DRIP_MAX = (SCENE_BOTTOM - CUT_Y) * 0.98;
/* La palette fait un tour complet tous les 1 / 0,34 hauteurs d'x de coulure. */
const IRIS_PER_XH = 0.34;
const IRIS_PERIOD = X_HEIGHT / IRIS_PER_XH;

/* Le cadre du canvas : sous la coupe seulement, débordant un peu des lettres
   pour que l'ondulation ait de la place — le pixel coûte, pas la scène. */
const CANVAS_X0 = WORD_X - 34;
const CANVAS_X1 = LETTERS_RIGHT + 34;
const CANVAS_Y0 = CUT_Y - 2;
const CANVAS_Y1 = SCENE_BOTTOM;

/* La texture des lettres : rouge net, vert flou moyen, bleu flou large. Le
   shader ne relit que la bande juste au-dessus de la coupe (un cinquième de
   hauteur d'x) : elle seule est peinte et floutée, ce qui divise le calcul
   par cinq. Ses marges latérales sont vides, si bien qu'une relecture hors
   des lettres rend du noir. */
const TEX_X0 = WORD_X - 44;
const TEX_X1 = LETTERS_RIGHT + 44;
const TEX_Y0 = CUT_Y - 0.3 * X_HEIGHT;
const TEX_Y1 = CUT_Y + 4;
const TEX_W = 2048;
const TEX_H = 96;

/** Aucun effet sous cette largeur, en pixels CSS (r-09). */
const MIN_WIDTH = 120;
/** Le fondu de la coulure figée vers la première image WebGL. */
const REVEAL_MS = 900;
/** L'instant servi en mouvement réduit et à la première image : une coulure déjà formée. */
const START_TIME = 41;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/* La charte, en dur : le logo ne change pas de couleurs avec un thème. */
const CRAIE = "#F7F8F4";
const SIGNAL = "#22E05B";
const LAGON = "#2FD3C6";
const AZUR = "#4D7BFF";
const LILAS = "#9C95FF";
const ROSE = "#F7A8D8";
/* Le cycle irisé, le même pour le shader et la coulure figée. Le rose et la
   Craie y pèsent plus que le vert, comme sur r-09 a. */
const IRIS = [AZUR, LAGON, SIGNAL, ROSE, CRAIE, ROSE, LILAS];

/**
 * Les traits que traverse une horizontale du logotype : des intervalles
 * [x0, x1], calculés sur les tracés eux-mêmes (droites et quadratiques), sans
 * rien peindre — le serveur en a besoin pour la coulure figée. Les contours
 * des lettres sont simples : la règle pair-impair suffit à apparier les bords.
 */
function strokesAt(y: number): Array<[number, number]> {
  const xs: number[] = [];
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  const line = (x0: number, y0: number, x1: number, y1: number) => {
    if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
  };
  for (const [, cmd, args] of LOGOTYPE.letters.matchAll(/([MLQZ])([^MLQZ]*)/g)) {
    const n = (args.match(/-?\d*\.?\d+/g) ?? []).map(Number);
    if (cmd === "M") [cx, cy, sx, sy] = [n[0], n[1], n[0], n[1]];
    else if (cmd === "L") {
      line(cx, cy, n[0], n[1]);
      [cx, cy] = [n[0], n[1]];
    } else if (cmd === "Q") {
      const [qx, qy, x1, y1] = n;
      const a = cy - 2 * qy + y1;
      const b = 2 * (qy - cy);
      const c = cy - y;
      const roots: number[] = [];
      if (Math.abs(a) < 1e-9) {
        if (Math.abs(b) > 1e-9) roots.push(-c / b);
      } else {
        const disc = b * b - 4 * a * c;
        if (disc >= 0) roots.push((-b - Math.sqrt(disc)) / (2 * a), (-b + Math.sqrt(disc)) / (2 * a));
      }
      for (const t of roots) if (t >= 0 && t < 1) xs.push((1 - t) * (1 - t) * cx + 2 * (1 - t) * t * qx + t * t * x1);
      [cx, cy] = [x1, y1];
    } else if (cmd === "Z") {
      line(cx, cy, sx, sy);
      [cx, cy] = [sx, sy];
    }
  }
  xs.sort((p, q) => p - q);
  const runs: Array<[number, number]> = [];
  for (let i = 0; i + 1 < xs.length; i += 2) runs.push([xs[i], xs[i + 1]]);
  return runs;
}

/* Chaque trait que la coupe traverse devient un ruban, avec sa phase de
   couleur et sa longueur. Les suites du nombre d'or et du nombre plastique
   écartent les valeurs de deux rubans voisins. Le léger décalage de la ligne
   lue évite de tomber pile sur un sommet de tracé. */
const ribbonPhase = (k: number) => (k * 0.6180339 + 0.21) % 1;
const ribbonLength = (k: number) => (k * 0.7548776 + 0.37) % 1;
const SOURCE_STROKES = strokesAt(CUT_Y - 0.04 * X_HEIGHT - 0.013);

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/*
 * La coulure figée : un ruban par trait que la coupe traverse — les plus
 * larges (le bas d'une panse) en deux, comme la panse s'ouvre plus haut —,
 * qui ondule de plus en plus en descendant, s'affine au bout et porte la
 * palette décalée de sa phase. Une décimale suffit : c'est flouté.
 */
const STATIC_RIBBONS = SOURCE_STROKES.flatMap(([x0, x1]): Array<[number, number]> =>
  x1 - x0 > 30 ? [[x0, (x0 + x1) / 2 - 1.5], [(x0 + x1) / 2 + 1.5, x1]] : [[x0, x1]],
).map(([x0, x1], i) => {
  const k = i + 1;
  const length = DRIP_MAX * (0.66 + 0.3 * ribbonLength(k));
  const steps = 26;
  const left: string[] = [];
  const right: string[] = [];
  for (let s = 0; s <= steps; s++) {
    const d = (length * s) / steps;
    const depth = d / DRIP_MAX;
    const amp = 0.4 + 5 * depth + 4 * depth * depth;
    const wave = amp * (0.6 * Math.sin(d * 0.031 + k * 1.7) + 0.4 * Math.sin(d * 0.083 + k * 2.9));
    const half = ((x1 - x0) / 2) * (1 + 0.25 * depth - 0.4 * smoothstep(0.6, 1, s / steps));
    const mid = (x0 + x1) / 2 + wave;
    const y = (s === 0 ? CUT_Y - 0.6 : CUT_Y + d).toFixed(1);
    left.push(`${(mid - half).toFixed(1)} ${y}`);
    right.unshift(`${(mid + half).toFixed(1)} ${y}`);
  }
  return { d: `M${left.join("L")}L${right.join("L")}Z`, shift: -ribbonPhase(k) * 0.55 * IRIS_PERIOD };
});

const vec3 = (hex: string) => {
  const v = parseInt(hex.slice(1), 16);
  return `vec3(${[(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => (c / 255).toFixed(4)).join(",")})`;
};

const VERT = `attribute vec2 a_pos;varying vec2 v_uv;void main(){v_uv=a_pos*.5+.5;gl_Position=vec4(a_pos,0.,1.);}`;

/* La palette irisée en GLSL : un tour de cycle par unité de h, transitions adoucies. */
const IRIS_GLSL = `vec3 iris(float h){h=fract(h)*${IRIS.length}.;float f=smoothstep(0.,1.,fract(h));${IRIS.map(
  (c, i) => `if(h<${i + 1}.)return mix(${vec3(c)},${vec3(IRIS[(i + 1) % IRIS.length])},f);`,
).join("")}return ${vec3(IRIS[0])};}`;

/*
 * Le shader de la coulure. Pour un pixel à la profondeur d sous la coupe :
 * 1. l'abscisse lue est déplacée par deux bruits lents qui descendent avec
 *    le temps — un large qui balance, un plus serré qui ondule — d'amplitude
 *    croissante avec la profondeur : la peinture est droite à la source et
 *    serpente en bas ;
 * 2. l'ordonnée lue remonte dans la lettre à mesure qu'on descend (étirement
 *    ×33) : une panse s'ouvre, un fût reste plein, d'où des rubans qui se
 *    divisent comme sur r-09 a ;
 * 3. chaque ruban a sa longueur, lue dans la texture des rubans, qui respire
 *    très lentement ;
 * 4. la texture passe du net au flou large avec la profondeur, et deux
 *    relectures latérales élargissent le ruban à mesure qu'il s'éteint ;
 * 5. la couleur suit la palette irisée, qui défile vers le bas, décalée de la
 *    phase du ruban ; des nappes plus sombres descendent avec la peinture, le
 *    cœur du ruban est plus clair que ses bords, et des plis sombres suivent
 *    l'ondulation — une soie qui tombe, pas des bandes pleines ; près de la
 *    coupe, la peinture est encore Craie, la couleur des lettres ;
 * 6. le grain, renouvelé 24 fois par seconde, éclaircit et assombrit la
 *    peinture et effrite les fins de coulure.
 */
const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D u_src;
uniform sampler2D u_rib;
uniform vec4 u_rect;
uniform vec4 u_tex;
uniform float u_time;
uniform float u_seed;
varying vec2 v_uv;
const float CUT=${CUT_Y.toFixed(3)};
const float LEN=${DRIP_MAX.toFixed(3)};
const float BOTTOM=${SCENE_BOTTOM.toFixed(3)};
const float XH=${X_HEIGHT.toFixed(3)};
const vec3 CRAIE=${vec3(CRAIE)};
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
${IRIS_GLSL}
vec3 src(float x,float y){return texture2D(u_src,vec2((x-u_tex.x)/u_tex.z,(y-u_tex.y)/u_tex.w)).rgb;}
vec2 rib(float x){return texture2D(u_rib,vec2((x-u_tex.x)/u_tex.z,.5)).rg;}
void main(){
float lx=mix(u_rect.x,u_rect.z,v_uv.x);
float ly=mix(u_rect.w,u_rect.y,v_uv.y);
float d=ly-CUT;
// Au-dessus de la coupe, les lettres elles-mêmes, sous leur copie vectorielle :
// le recouvrement bouche la ligne que l'anticrénelage des deux bords laisserait.
if(d<0.){float o=src(lx,ly).r;gl_FragColor=vec4(CRAIE*o,o);return;}
float t=u_time;
float dn=d/XH;
float depth=clamp(d/LEN,0.,1.);
// 1. Ondulation.
float amp=.5+8.*depth+6.*depth*depth;
float n1=noise(vec2(lx*.02,dn*.45-t*.06));
float n2=noise(vec2(lx*.045+11.,dn*1.3-t*.12));
float sx=lx+(n1-.5)*1.6*amp+(n2-.5)*2.*amp;
// 2. Lecture : on remonte dans la lettre.
float sy=CUT-min(d*.03,.2*XH);
vec3 c=src(sx,sy);
vec2 rb=rib(sx);
float id=rb.r;
// 3. Longueur du ruban.
float ln=rb.g*.8+noise(vec2(id*17.,t*.035))*.2;
float L=LEN*(.62+.38*ln);
float end=smoothstep(L*.55,L,d);
// 4. Du net au flou.
float spread=.5+2.*depth+5.*end;
vec3 cm=(c*2.+src(sx-spread,sy)+src(sx+spread,sy))*.25;
float body=max(smoothstep(.04,.62,cm.g),smoothstep(.12,.62,cm.b)*.8);
float k=mix(c.r,body,smoothstep(0.,.25,dn));
k=mix(k,min(1.,cm.b*1.5),smoothstep(2.,6.,dn)*.6+end*.4);
float tail=(1.-end)*smoothstep(BOTTOM,BOTTOM-.8*XH,ly);
// 5. Couleur.
float hn=noise(vec2(sx*.012,dn*.3-t*.033));
vec3 col=iris(dn*${IRIS_PER_XH}-t*.03+id*.55+hn*.5);
float dens=.72+.28*noise(vec2(id*23.,dn*.85-t*.09));
col*=dens*(.62+.38*smoothstep(.2,.85,cm.b));
float fr=noise(vec2(sx*.1,dn*.12+id*9.));
float fold=1.-smoothstep(0.,.24,abs(fr-.5));
col*=1.-.42*fold*smoothstep(0.,.35,dn);
col+=CRAIE*.14*smoothstep(.7,.95,fr)*smoothstep(0.,.5,dn);
col=mix(col,CRAIE,(1.-smoothstep(0.,.22,dn))*.92);
// 6. Grain.
float g=hash(floor(gl_FragCoord.xy)+u_seed)-.5;
float a=clamp(k*tail,0.,1.);
a=clamp(a+g*a*(1.-a)*.7,0.,1.);
col=clamp(col+g*.12,0.,1.);
gl_FragColor=vec4(col*a,a);}`;

type Source = { letters: ImageData; ribbons: Uint8Array };
type Renderer = { draw: (time: number, seed: number) => void; viewport: (w: number, h: number) => void; dispose: () => void };

/**
 * Flou en boîte, trois passes horizontales puis une verticale : une gaussienne
 * à peu de frais, calculée une fois. Le hors-cadre vaut zéro.
 */
function boxBlur(input: Float32Array, w: number, h: number, rx: number, ry: number): Float32Array {
  let a = input.slice();
  let b = new Float32Array(a.length);
  const nx = 1 / (2 * rx + 1);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let sum = 0;
      for (let x = 0; x <= rx && x < w; x++) sum += a[row + x];
      for (let x = 0; x < w; x++) {
        b[row + x] = sum * nx;
        if (x + rx + 1 < w) sum += a[row + x + rx + 1];
        if (x - rx >= 0) sum -= a[row + x - rx];
      }
    }
    [a, b] = [b, a];
  }
  const ny = 1 / (2 * ry + 1);
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y <= ry && y < h; y++) sum += a[y * w + x];
    for (let y = 0; y < h; y++) {
      b[y * w + x] = sum * ny;
      if (y + ry + 1 < h) sum += a[(y + ry + 1) * w + x];
      if (y - ry >= 0) sum -= a[(y - ry) * w + x];
    }
  }
  return b;
}

/**
 * La texture des rubans, une seule ligne : la phase de couleur (R) et la
 * longueur (V) du trait qui passe à chaque abscisse. Sans elle, la couleur
 * changeait au milieu d'un même ruban ; avec elle, deux rubans voisins se
 * distinguent comme sur r-09 a. Entre deux traits, la phase glisse de l'une à
 * l'autre et la longueur prend la plus courte, raccourcie : les bords d'un
 * ruban s'éteignent avant son cœur, et sa fin s'arrondit.
 */
function ribbonData(): Uint8Array {
  const phase = new Float32Array(TEX_W).fill(-1);
  const length = new Float32Array(TEX_W).fill(-1);
  const px = (x: number) => ((x - TEX_X0) / (TEX_X1 - TEX_X0)) * TEX_W;
  SOURCE_STROKES.forEach(([x0, x1], i) => {
    for (let x = Math.max(0, Math.ceil(px(x0))); x <= Math.min(TEX_W - 1, Math.floor(px(x1))); x++) {
      phase[x] = ribbonPhase(i + 1);
      length[x] = ribbonLength(i + 1);
    }
  });
  // Les trous : entre deux traits, ou au-delà du premier et du dernier.
  let prev = -1;
  for (let x = 0; x <= TEX_W; x++) {
    if (x < TEX_W && phase[x] < 0) continue;
    const l = prev >= 0 ? prev : x;
    const r = x < TEX_W ? x : prev;
    if (l >= 0 && l < TEX_W && r >= 0) {
      for (let i = prev + 1; i < x; i++) {
        const f = (i - prev) / (x - prev);
        phase[i] = prev >= 0 && x < TEX_W ? phase[l] + (phase[r] - phase[l]) * f : phase[l];
        length[i] = Math.min(length[l], length[r]) * 0.8;
      }
    }
    prev = x;
  }
  // Adouci sur deux unités : le flou des rubans déborde le trait net, rien ne doit y changer d'un coup.
  const out = new Uint8Array(TEX_W * 4);
  const radius = 9;
  for (let x = 0; x < TEX_W; x++) {
    let p = 0;
    let q = 0;
    for (let i = -radius; i <= radius; i++) {
      const j = Math.min(TEX_W - 1, Math.max(0, x + i));
      p += Math.max(0, phase[j]);
      q += Math.max(0, length[j]);
    }
    out[x * 4] = Math.round((p / (2 * radius + 1)) * 255);
    out[x * 4 + 1] = Math.round((q / (2 * radius + 1)) * 255);
    out[x * 4 + 3] = 255;
  }
  return out;
}

/** Les lettres peintes depuis leurs tracés, puis floutées deux fois : net, moyen, large dans R, V, B. Et leurs rubans. */
function paintSource(): Source | null {
  const canvas = document.createElement("canvas");
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || typeof Path2D === "undefined") return null;
  const sx = TEX_W / (TEX_X1 - TEX_X0);
  const sy = TEX_H / (TEX_Y1 - TEX_Y0);
  ctx.setTransform(sx, 0, 0, sy, -TEX_X0 * sx, -TEX_Y0 * sy);
  ctx.fillStyle = "#fff";
  ctx.fill(new Path2D(LOGOTYPE.letters));
  const image = ctx.getImageData(0, 0, TEX_W, TEX_H);
  const n = TEX_W * TEX_H;
  const sharp = new Float32Array(n);
  for (let i = 0; i < n; i++) sharp[i] = image.data[i * 4 + 3] / 255;
  const mid = boxBlur(sharp, TEX_W, TEX_H, 7, 1);
  const wide = boxBlur(sharp, TEX_W, TEX_H, 20, 3);
  for (let i = 0; i < n; i++) {
    image.data[i * 4] = sharp[i] * 255;
    image.data[i * 4 + 1] = Math.min(255, mid[i] * 255);
    image.data[i * 4 + 2] = Math.min(255, wide[i] * 255);
    image.data[i * 4 + 3] = 255;
  }
  return { letters: image, ribbons: ribbonData() };
}

function createRenderer(gl: WebGLRenderingContext, source: Source): Renderer | null {
  const program = gl.createProgram();
  if (!program) return null;
  for (const [type, code] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]] as const) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, code);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const upload = (unit: number) => {
    const texture = gl.createTexture();
    gl.activeTexture(unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  };
  // Des données, pas une image : ni retournement, ni prémultiplication.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  const letters = upload(gl.TEXTURE0);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source.letters);
  const ribbons = upload(gl.TEXTURE1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, TEX_W, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, source.ribbons);

  const u = (name: string) => gl.getUniformLocation(program, name);
  gl.uniform1i(u("u_src"), 0);
  gl.uniform1i(u("u_rib"), 1);
  gl.uniform4f(u("u_rect"), CANVAS_X0, CANVAS_Y0, CANVAS_X1, CANVAS_Y1);
  gl.uniform4f(u("u_tex"), TEX_X0, TEX_Y0, TEX_X1 - TEX_X0, TEX_Y1 - TEX_Y0);
  const uTime = u("u_time");
  const uSeed = u("u_seed");
  gl.disable(gl.BLEND);

  return {
    draw(time, seed) {
      gl.uniform1f(uTime, time);
      gl.uniform1f(uSeed, seed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    viewport(w, h) {
      gl.viewport(0, 0, w, h);
    },
    dispose() {
      gl.deleteTexture(letters);
      gl.deleteTexture(ribbons);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}

/* Positions en pourcentage de la scène : les trois couches se superposent au pixel près. */
const pct = (v: number, span: number) => `${((v / span) * 100).toFixed(4)}%`;
const SCENE_VIEWBOX = `${SCENE_X.toFixed(3)} ${SCENE_Y.toFixed(3)} ${SCENE_W.toFixed(3)} ${SCENE_H.toFixed(3)}`;
const CANVAS_BOX = {
  left: pct(CANVAS_X0 - SCENE_X, SCENE_W),
  top: pct(CANVAS_Y0 - SCENE_Y, SCENE_H),
  width: pct(CANVAS_X1 - CANVAS_X0, SCENE_W),
  height: pct(CANVAS_Y1 - CANVAS_Y0, SCENE_H),
};
const LAYER = { position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", overflow: "visible" } as const;

/*
 * Sous 120 px de large, la scène cède la place au logo statique entier. Une
 * requête de conteneur plutôt qu'un calcul : c'est juste dès la première
 * image, sans JavaScript.
 */
const CSS = `.coulure{container-type:inline-size}.coulure-small{display:none}@container (max-width:${MIN_WIDTH - 0.02}px){.coulure-stage{display:none}.coulure-small{display:block}}`;

export function CoulureWordmark({ className = "" }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fallbackRef = useRef<SVGSVGElement | null>(null);
  // Des identifiants propres à l'instance, sans les caractères que `url(#…)` digère mal.
  const uid = `coulure-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const fallback = fallbackRef.current;
    if (!root || !canvas || !fallback) return;

    const motionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    let reduced = motionQuery.matches;
    let wide = root.clientWidth >= MIN_WIDTH;

    let gl: WebGLRenderingContext | null = null;
    let renderer: Renderer | null = null;
    let started = false;
    let raf = 0;
    let last = 0;
    let time = START_TIME;
    let running = false;
    let visible = false;
    let painted = false;
    let revealTimer = 0;
    // Garde-fou : sous 20 images par seconde en moyenne sur les quarante premières, on garde la dernière image.
    let frozen = false;
    let samples = 0;
    let slowMs = 0;
    // La coulure est lente : 30 images suffisent au doigt, où chaque pixel coûte plus.
    const fps = coarse ? 30 : 60;

    // Le grain change 24 fois par seconde, la cadence d'une pellicule ; en mouvement réduit, il ne bouge plus.
    const draw = () => renderer?.draw(time, reduced ? 0 : (Math.floor(time * 24) % 61) * 7.31);

    // DPR plafonné à 1,5 sur ordinateur, avec deux millions et demi de pixels au plus. Au doigt le
    // canvas est petit (un pied de page de téléphone) : 2 et six cent mille pixels, sinon la peinture
    // se lit en gros pixels sur un écran 3×.
    const resize = () => {
      if (!renderer) return;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (cw <= 0 || ch <= 0) return;
      const budget = coarse ? 6e5 : 2.5e6;
      let scale = Math.min(window.devicePixelRatio || 1, coarse ? 2 : 1.5);
      if (cw * ch * scale * scale > budget) scale = Math.sqrt(budget / (cw * ch));
      const w = Math.max(1, Math.round(cw * scale));
      const h = Math.max(1, Math.round(ch * scale));
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
      renderer.viewport(w, h);
      // Boucle arrêtée (mouvement réduit, machine trop lente) : l'image fixe suit quand même la taille.
      if (!running && painted) draw();
    };

    const reveal = () => {
      painted = true;
      canvas.style.opacity = "1";
      // La coulure figée ne part qu'une fois le fondu fini : la retirer avant laisserait un trou.
      revealTimer = window.setTimeout(() => {
        fallback.style.display = "none";
      }, reduced ? 0 : REVEAL_MS);
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 1000 / fps - 2) return;
      const dt = Math.min((now - last) / 1000, 0.1);
      if (painted && samples < 40) {
        samples += 1;
        slowMs += now - last;
        if (samples === 40 && slowMs / samples > 50) {
          frozen = true;
          run();
          return;
        }
      }
      last = now;
      time += dt;
      draw();
      if (!painted) reveal();
    };

    // Une seule boucle, qui ne tourne que visible, assez large, onglet au premier plan, mouvement autorisé et machine à la hauteur.
    function run() {
      const next = !!renderer && visible && wide && !document.hidden && !reduced && !frozen;
      if (next === running) return;
      running = next;
      if (running) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      } else cancelAnimationFrame(raf);
    }

    const paintStill = () => {
      if (!renderer || !wide) return;
      resize();
      draw();
      if (!painted) reveal();
    };

    // Contexte perdu (GPU réinitialisé) : retour à la coulure figée, pas un rectangle vide.
    const onLost = (event: Event) => {
      event.preventDefault();
      frozen = true;
      run();
      window.clearTimeout(revealTimer);
      canvas.style.opacity = "0";
      fallback.style.display = "";
    };

    /* Le GPU et la texture ne se préparent qu'à l'approche du pied de page :
       rien ne pèse sur le chargement de la page. Sans WebGL, la coulure figée reste. */
    const start = () => {
      if (started) return;
      started = true;
      gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
      const source = gl ? paintSource() : null;
      renderer = gl && source ? createRenderer(gl, source) : null;
      if (!renderer) return;
      canvas.addEventListener("webglcontextlost", onLost);
      resize();
      if (reduced) paintStill();
    };

    const onMotion = () => {
      reduced = motionQuery.matches;
      canvas.style.transition = reduced ? "none" : "";
      run();
      if (reduced) paintStill();
    };
    const onVisibility = () => run();
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? false;
        if (visible && wide) start();
        run();
      },
      { rootMargin: "240px 0px" },
    );
    const ro = new ResizeObserver(() => {
      wide = root.clientWidth >= MIN_WIDTH;
      if (visible && wide) start();
      resize();
      run();
    });

    if (reduced) canvas.style.transition = "none";
    document.addEventListener("visibilitychange", onVisibility);
    motionQuery.addEventListener("change", onMotion);
    io.observe(root);
    ro.observe(root);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(revealTimer);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      motionQuery.removeEventListener("change", onMotion);
      canvas.removeEventListener("webglcontextlost", onLost);
      renderer?.dispose();
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  const id = (name: string) => `${uid}-${name}`;
  const ref = (name: string) => `url(#${id(name)})`;

  return (
    <div ref={rootRef} role="img" aria-label="antidotes" className={`coulure ${className}`} style={{ position: "relative", width: "100%" }}>
      <style href="coulure-wordmark" precedence="default">
        {CSS}
      </style>
      <div className="coulure-stage" style={{ position: "relative", width: "100%", aspectRatio: `${SCENE_W.toFixed(3)} / ${SCENE_H.toFixed(3)}` }}>
        {/* La coulure figée : première image, repli sans WebGL ou si le GPU lâche. */}
        <svg ref={fallbackRef} aria-hidden="true" viewBox={SCENE_VIEWBOX} style={LAYER}>
          <defs>
            {STATIC_RIBBONS.map((ribbon, i) => (
              <path key={i} id={id(`ribbon-${i}`)} d={ribbon.d} />
            ))}
            <linearGradient id={id("iris")} gradientUnits="userSpaceOnUse" x1={0} y1={CUT_Y} x2={0} y2={CUT_Y + IRIS_PERIOD} spreadMethod="repeat">
              {[...IRIS, IRIS[0]].map((color, i) => (
                <stop key={i} offset={i / IRIS.length} stopColor={color} />
              ))}
            </linearGradient>
            {STATIC_RIBBONS.map((ribbon, i) => (
              <linearGradient
                key={i}
                id={id(`iris-${i}`)}
                href={`#${id("iris")}`}
                gradientUnits="userSpaceOnUse"
                x1={0}
                y1={CUT_Y}
                x2={0}
                y2={CUT_Y + IRIS_PERIOD}
                spreadMethod="repeat"
                gradientTransform={`translate(0 ${ribbon.shift.toFixed(2)})`}
              />
            ))}
            {/* Le bout de chaque ruban s'éteint, à sa propre longueur : un masque à l'échelle du ruban. */}
            <linearGradient id={id("end")} x1={0} y1={0} x2={0} y2={1}>
              <stop offset="0" stopColor="#fff" />
              <stop offset="0.5" stopColor="#fff" />
              <stop offset="0.96" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <mask id={id("end-mask")} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox" x={-0.5} y={-0.05} width={2} height={1.1}>
              <rect x={-0.5} y={0} width={2} height={1} fill={ref("end")} />
            </mask>
            {/* À la source, la peinture est encore Craie, la couleur des lettres. */}
            <linearGradient id={id("source")} gradientUnits="userSpaceOnUse" x1={0} y1={CUT_Y} x2={0} y2={CUT_Y + 0.22 * X_HEIGHT}>
              <stop offset="0" stopColor={CRAIE} stopOpacity="0.85" />
              <stop offset="1" stopColor={CRAIE} stopOpacity="0" />
            </linearGradient>
            {/* Le flou de la peinture, puis le grain par-dessus, comme partout dans la charte. */}
            <filter
              id={id("paint")}
              filterUnits="userSpaceOnUse"
              x={CANVAS_X0}
              y={CANVAS_Y0}
              width={CANVAS_X1 - CANVAS_X0}
              height={CANVAS_Y1 - CANVAS_Y0}
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.2 0.8" result="soft" />
              <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves={1} seed={5} result="noise" />
              <feColorMatrix in="noise" type="saturate" values="0" result="mono" />
              <feComposite in="soft" in2="mono" operator="arithmetic" k2={1} k3={0.22} k4={-0.11} result="grain" />
              <feComposite in="grain" in2="soft" operator="in" />
            </filter>
          </defs>
          <g filter={ref("paint")}>
            {STATIC_RIBBONS.map((_, i) => (
              <use key={i} href={`#${id(`ribbon-${i}`)}`} fill={ref(`iris-${i}`)} mask={ref("end-mask")} />
            ))}
            <g fill={ref("source")}>
              {STATIC_RIBBONS.map((_, i) => (
                <use key={i} href={`#${id(`ribbon-${i}`)}`} />
              ))}
            </g>
          </g>
        </svg>
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          style={{ position: "absolute", display: "block", ...CANVAS_BOX, opacity: 0, transition: `opacity ${REVEAL_MS}ms cubic-bezier(.2,.8,.2,1)` }}
        />
        {/* Le haut du logo, vectoriel : les lettres coupées à la ligne de coupe, le point et son halo. */}
        <svg aria-hidden="true" viewBox={SCENE_VIEWBOX} style={LAYER}>
          <defs>
            {/* Les tracés, une seule fois dans la page : le logo de moins de 120 px les reprend. */}
            <path id={id("letters")} d={LOGOTYPE.letters} />
            <clipPath id={id("cut")} clipPathUnits="userSpaceOnUse">
              <rect x={SCENE_X} y={SCENE_Y} width={SCENE_W} height={CUT_Y - SCENE_Y} />
            </clipPath>
            <radialGradient id={id("halo")}>
              <stop offset="0" stopColor={SIGNAL} stopOpacity="0.42" />
              <stop offset="0.45" stopColor={SIGNAL} stopOpacity="0.14" />
              <stop offset="1" stopColor={SIGNAL} stopOpacity="0" />
            </radialGradient>
          </defs>
          <use href={`#${id("letters")}`} fill={CRAIE} clipPath={ref("cut")} />
          <circle cx={LOGOTYPE.dot.cx} cy={LOGOTYPE.dot.cy} r={LOGOTYPE.dot.r * 3} fill={ref("halo")} />
          <circle cx={LOGOTYPE.dot.cx} cy={LOGOTYPE.dot.cy} r={LOGOTYPE.dot.r} fill={SIGNAL} />
        </svg>
      </div>
      {/* Sous 120 px : l'aplat statique de référence, sans effet. */}
      <svg className="coulure-small" aria-hidden="true" viewBox={LOGOTYPE.viewBox} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        <use href={`#${id("letters")}`} fill={CRAIE} />
        <circle cx={LOGOTYPE.dot.cx} cy={LOGOTYPE.dot.cy} r={LOGOTYPE.dot.r} fill={SIGNAL} />
      </svg>
    </div>
  );
}
