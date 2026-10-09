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
 * - derrière, une coulure figée en SVG (tracés étirés, ondulés par un filtre)
 *   — c'est la première image avant le JavaScript et le repli sans WebGL ;
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
   pied des lettres, juste au-dessus de la ligne de base — c'est le bas des
   panses et des fûts qui se dissout, pas la moitié du mot, qui doit se lire. */
const CUT_Y = -0.1 * X_HEIGHT;
/* La plus longue coulure, depuis la coupe, et le fondu au bas de la scène. */
const DRIP_MAX = (SCENE_BOTTOM - CUT_Y) * 0.98;

/* Le cadre du canvas : sous la coupe seulement, débordant un peu des lettres
   pour que l'ondulation ait de la place — le pixel coûte, pas la scène. */
const CANVAS_X0 = WORD_X - 34;
const CANVAS_X1 = LETTERS_RIGHT + 34;
const CANVAS_Y0 = CUT_Y - 2;
const CANVAS_Y1 = SCENE_BOTTOM;

/* La texture des lettres : rouge net, vert flou moyen, bleu flou large. Ses
   marges sont vides, si bien qu'une relecture hors des lettres rend du noir. */
const TEX_X0 = WORD_X - 44;
const TEX_X1 = LETTERS_RIGHT + 44;
const TEX_Y0 = ASCENDER_Y - 2;
const TEX_Y1 = 6;
const TEX_W = 2048;
const TEX_H = 320;

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

const vec3 = (hex: string) => {
  const v = parseInt(hex.slice(1), 16);
  return `vec3(${[(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => (c / 255).toFixed(4)).join(",")})`;
};

const VERT = `attribute vec2 a_pos;varying vec2 v_uv;void main(){v_uv=a_pos*.5+.5;gl_Position=vec4(a_pos,0.,1.);}`;

/*
 * Le shader de la coulure. Pour un pixel à la profondeur d sous la coupe :
 * 1. l'abscisse lue est déplacée par deux bruits lents qui descendent avec
 *    le temps — un large qui balance, un plus serré qui ondule — d'amplitude
 *    croissante avec la profondeur : la peinture est droite à la source et
 *    serpente en bas ;
 * 2. l'ordonnée lue remonte dans la lettre à mesure qu'on descend (étirement
 *    ×28 environ) : une panse s'ouvre, un fût reste plein, d'où des colonnes
 *    qui se divisent et se rejoignent comme sur r-09 a ;
 * 3. la texture passe du net au flou large avec la profondeur, et trois
 *    relectures horizontales élargissent le flou vers le bas ;
 * 4. chaque colonne a sa longueur, tirée d'un bruit sur l'abscisse lue, qui
 *    respire très lentement ;
 * 5. la couleur suit une palette irisée cyclique qui défile vers le bas — le
 *    rose et la Craie y pèsent plus que le vert, comme sur r-09 a —
 *    décalée par un bruit pour que les colonnes voisines ne soient pas en
 *    phase ; près de la coupe la peinture est encore Craie, la couleur des
 *    lettres ;
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
const vec3 SIGNAL=${vec3(SIGNAL)};
const vec3 LAGON=${vec3(LAGON)};
const vec3 AZUR=${vec3(AZUR)};
const vec3 LILAS=${vec3(LILAS)};
const vec3 ROSE=${vec3(ROSE)};
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
vec3 iris(float h){
h=fract(h)*7.;float i=floor(h);float f=smoothstep(0.,1.,fract(h));
vec3 a=LILAS;vec3 b=AZUR;
if(i<1.){a=AZUR;b=LAGON;}else if(i<2.){a=LAGON;b=SIGNAL;}else if(i<3.){a=SIGNAL;b=ROSE;}
else if(i<4.){a=ROSE;b=CRAIE;}else if(i<5.){a=CRAIE;b=ROSE;}else if(i<6.){a=ROSE;b=LILAS;}
return mix(a,b,f);}
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
// 3. Longueur de chaque ruban : la sienne, qui respire lentement.
float ln=rb.g*.8+noise(vec2(id*17.,t*.035))*.2;
float L=LEN*(.62+.38*ln);
float end=smoothstep(L*.55,L,d);
// 4. Du net au flou : un ruban défini, qui s'évase à mesure qu'il s'éteint.
float spread=.5+2.*depth+5.*end;
vec3 cm=(c*2.+src(sx-spread,sy)+src(sx+spread,sy))*.25;
float body=max(smoothstep(.04,.62,cm.g),smoothstep(.12,.62,cm.b)*.8);
float k=mix(c.r,body,smoothstep(0.,.25,dn));
k=mix(k,min(1.,cm.b*1.5),smoothstep(2.,6.,dn)*.6+end*.4);
float tail=1.-end;
tail*=smoothstep(BOTTOM,BOTTOM-.8*XH,ly);
// 5. Couleur : la palette défile vers le bas, chaque ruban a sa phase ;
// des nappes plus sombres descendent avec la peinture, et le cœur du ruban
// est plus clair que ses bords — le satiné de r-09.
float hn=noise(vec2(sx*.012,dn*.3-t*.033));
float h=dn*.34-t*.03+id*.55+hn*.5;
vec3 col=iris(h);
float dens=.72+.28*noise(vec2(id*23.,dn*.85-t*.09));
col*=dens*(.62+.38*smoothstep(.2,.85,cm.b));
// Les plis : de fines lignes sombres et des reflets qui suivent l'ondulation,
// la peinture se lit comme une soie tombante et non comme des bandes pleines.
float fr=noise(vec2(sx*.1,dn*.12+id*9.));
float fold=1.-smoothstep(0.,.24,abs(fr-.5));
col*=1.-.42*fold*smoothstep(0.,.35,dn);
col+=CRAIE*.14*smoothstep(.7,.95,fr)*smoothstep(0.,.5,dn);
col=mix(col,CRAIE,(1.-smoothstep(0.,.2,dn))*.8);
// 6. Grain.
float g=hash(floor(gl_FragCoord.xy)+u_seed)-.5;
float a=clamp(k*tail,0.,1.);
a=clamp(a+g*a*(1.-a)*.7,0.,1.);
col=clamp(col+g*.12,0.,1.);
gl_FragColor=vec4(col*a,a);}`;

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
 * Les rubans : chaque trait que la coupe traverse — un fût, le bas d'une
 * panse — devient un ruban, avec sa phase de couleur (R) et sa longueur (V),
 * rangées dans une texture d'une ligne. Sans elles, la couleur changeait au
 * milieu d'un même ruban ; avec elles, deux rubans voisins se distinguent
 * comme sur r-09 a. Les suites du nombre d'or et du nombre plastique écartent
 * les valeurs voisines. Entre deux traits, la phase glisse de l'une à l'autre
 * et la longueur prend la plus courte, raccourcie : les bords d'un ruban
 * s'éteignent avant son cœur, et sa fin s'arrondit.
 */
function ribbonData(sharp: Float32Array): Uint8Array {
  const row = Math.round((CUT_Y - 0.04 * X_HEIGHT - TEX_Y0) * (TEX_H / (TEX_Y1 - TEX_Y0)));
  const phase = new Float32Array(TEX_W).fill(-1);
  const length = new Float32Array(TEX_W).fill(-1);
  let run = 0;
  let inside = false;
  for (let x = 0; x < TEX_W; x++) {
    const on = sharp[row * TEX_W + x] > 0.5;
    if (on && !inside) run += 1;
    inside = on;
    if (!on) continue;
    phase[x] = (run * 0.6180339 + 0.21) % 1;
    length[x] = (run * 0.7548776 + 0.37) % 1;
  }
  let prev = -1;
  for (let x = 0; x <= TEX_W; x++) {
    if (x < TEX_W && phase[x] < 0) continue;
    const l = prev >= 0 ? prev : x;
    const r = x < TEX_W ? x : prev;
    for (let i = prev + 1; i < x; i++) {
      const f = (i - prev) / (x - prev);
      phase[i] = l >= 0 && r >= 0 ? phase[l] + (phase[r] - phase[l]) * f : 0;
      length[i] = l >= 0 && r >= 0 ? Math.min(length[l], length[r]) * 0.8 : 0;
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
      p += phase[j];
      q += length[j];
    }
    out[x * 4] = Math.round((p / (2 * radius + 1)) * 255);
    out[x * 4 + 1] = Math.round((q / (2 * radius + 1)) * 255);
    out[x * 4 + 3] = 255;
  }
  return out;
}

/** Les lettres peintes depuis leurs tracés, puis floutées deux fois : net, moyen, large dans R, V, B. Et leurs rubans. */
function paintSource(): { letters: ImageData; ribbons: Uint8Array } | null {
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
  return { letters: image, ribbons: ribbonData(sharp) };
}

function createRenderer(gl: WebGLRenderingContext, source: { letters: ImageData; ribbons: Uint8Array }): Renderer | null {
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
  gl.clearColor(0, 0, 0, 0);

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
const pct = (v: number, origin: number, span: number) => `${(((v - origin) / span) * 100).toFixed(4)}%`;
const SCENE_VIEWBOX = `${SCENE_X.toFixed(3)} ${SCENE_Y.toFixed(3)} ${SCENE_W.toFixed(3)} ${SCENE_H.toFixed(3)}`;
const CANVAS_BOX = {
  left: pct(CANVAS_X0, SCENE_X, SCENE_W),
  top: pct(CANVAS_Y0, SCENE_Y, SCENE_H),
  width: pct(CANVAS_X1 - CANVAS_X0, 0, SCENE_W),
  height: pct(CANVAS_Y1 - CANVAS_Y0, 0, SCENE_H),
};

/* La coulure figée : la tranche des lettres sous la coupe, étirée jusqu'au bas. */
const SLIVER_BOTTOM = 1.2;
const STATIC_STRETCH = (DRIP_MAX * 0.86) / (SLIVER_BOTTOM - CUT_Y);

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

    // DPR plafonné à 1,5 (1,25 au doigt) et deux millions et demi de pixels au plus.
    const resize = () => {
      if (!renderer) return;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (cw <= 0 || ch <= 0) return;
      let scale = Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.5);
      if (cw * ch * scale * scale > 2.5e6) scale = Math.sqrt(2.5e6 / (cw * ch));
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
  const sliverH = SLIVER_BOTTOM - CUT_Y;
  const dripTop = CUT_Y;
  const dripH = DRIP_MAX;
  const dripX = CANVAS_X0;
  const dripW = CANVAS_X1 - CANVAS_X0;
  const layer = { position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", overflow: "visible" } as const;

  return (
    <div ref={rootRef} role="img" aria-label="antidotes" className={`coulure ${className}`} style={{ position: "relative", width: "100%" }}>
      <style href="coulure-wordmark" precedence="default">
        {CSS}
      </style>
      <div className="coulure-stage" style={{ position: "relative", width: "100%", aspectRatio: `${SCENE_W.toFixed(3)} / ${SCENE_H.toFixed(3)}` }}>
        {/* La coulure figée : première image, repli sans WebGL ou si le GPU lâche. */}
        <svg ref={fallbackRef} aria-hidden="true" viewBox={SCENE_VIEWBOX} preserveAspectRatio="xMidYMid meet" style={layer}>
          <defs>
            <clipPath id={id("sliver")} clipPathUnits="userSpaceOnUse">
              <rect x={TEX_X0} y={CUT_Y} width={TEX_X1 - TEX_X0} height={sliverH} />
            </clipPath>
            <filter id={id("wave")} filterUnits="userSpaceOnUse" x={dripX} y={dripTop - 2} width={dripW} height={dripH + 4} colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="0.012 0.0045" numOctaves={2} seed={11} result="noise" />
              {/* Seul le rouge déplace : le vert est figé à 0,5, la peinture ne remonte pas. */}
              <feColorMatrix in="noise" type="matrix" values="1 0 0 0 0  0 0 0 0 0.5  0 0 0 0 0  0 0 0 0 1" result="flow" />
              <feDisplacementMap in="SourceGraphic" in2="flow" scale={26} xChannelSelector="R" yChannelSelector="G" result="waved" />
              <feGaussianBlur in="waved" stdDeviation="2.6 0.8" />
            </filter>
            <mask id={id("paint")} maskUnits="userSpaceOnUse" x={dripX} y={dripTop} width={dripW} height={dripH}>
              <g filter={ref("wave")}>
                <g transform={`translate(0 ${CUT_Y}) scale(1 ${STATIC_STRETCH.toFixed(3)}) translate(0 ${-CUT_Y})`}>
                  <path d={LOGOTYPE.letters} fill="#fff" clipPath={ref("sliver")} />
                </g>
              </g>
            </mask>
            <linearGradient id={id("fade")} gradientUnits="userSpaceOnUse" x1={0} y1={dripTop} x2={0} y2={dripTop + dripH}>
              <stop offset="0" stopColor="#fff" />
              <stop offset="0.45" stopColor="#fff" stopOpacity="0.85" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <mask id={id("fadeMask")} maskUnits="userSpaceOnUse" x={dripX} y={dripTop} width={dripW} height={dripH}>
              <rect x={dripX} y={dripTop} width={dripW} height={dripH} fill={ref("fade")} />
            </mask>
            {/* La palette irisée en bandes obliques, Craie à la source comme les lettres. */}
            <linearGradient id={id("iris")} gradientUnits="userSpaceOnUse" x1={0} y1={dripTop} x2={70} y2={dripTop + dripH}>
              <stop offset="0" stopColor={CRAIE} />
              <stop offset="0.08" stopColor={CRAIE} />
              <stop offset="0.17" stopColor={AZUR} />
              <stop offset="0.27" stopColor={LAGON} />
              <stop offset="0.37" stopColor={SIGNAL} />
              <stop offset="0.48" stopColor={ROSE} />
              <stop offset="0.57" stopColor={CRAIE} />
              <stop offset="0.66" stopColor={LILAS} />
              <stop offset="0.76" stopColor={AZUR} />
              <stop offset="0.86" stopColor={LAGON} />
              <stop offset="1" stopColor={SIGNAL} />
            </linearGradient>
            <linearGradient id={id("irisX")} gradientUnits="userSpaceOnUse" x1={WORD_X} y1={0} x2={LETTERS_RIGHT} y2={0}>
              <stop offset="0" stopColor={LAGON} />
              <stop offset="0.3" stopColor={ROSE} />
              <stop offset="0.55" stopColor={AZUR} />
              <stop offset="0.8" stopColor={SIGNAL} />
              <stop offset="1" stopColor={LILAS} />
            </linearGradient>
          </defs>
          <g className="coulure-drip" mask={ref("fadeMask")}>
            <g mask={ref("paint")}>
              <rect x={dripX} y={dripTop} width={dripW} height={dripH} fill={ref("iris")} />
              <rect x={dripX} y={dripTop + dripH * 0.12} width={dripW} height={dripH * 0.88} fill={ref("irisX")} opacity={0.4} />
            </g>
          </g>
        </svg>
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          style={{ position: "absolute", display: "block", ...CANVAS_BOX, opacity: 0, transition: `opacity ${REVEAL_MS}ms cubic-bezier(.2,.8,.2,1)` }}
        />
        {/* Le haut du logo, vectoriel : les lettres coupées à la ligne de coupe, le point et son halo. */}
        <svg aria-hidden="true" viewBox={SCENE_VIEWBOX} preserveAspectRatio="xMidYMid meet" style={layer}>
          <defs>
            <clipPath id={id("cut")} clipPathUnits="userSpaceOnUse">
              <rect x={SCENE_X} y={SCENE_Y} width={SCENE_W} height={CUT_Y - SCENE_Y} />
            </clipPath>
            <radialGradient id={id("halo")}>
              <stop offset="0" stopColor={SIGNAL} stopOpacity="0.42" />
              <stop offset="0.45" stopColor={SIGNAL} stopOpacity="0.14" />
              <stop offset="1" stopColor={SIGNAL} stopOpacity="0" />
            </radialGradient>
          </defs>
          <path d={LOGOTYPE.letters} fill={CRAIE} clipPath={ref("cut")} />
          <circle cx={LOGOTYPE.dot.cx} cy={LOGOTYPE.dot.cy} r={LOGOTYPE.dot.r * 3} fill={ref("halo")} />
          <circle cx={LOGOTYPE.dot.cx} cy={LOGOTYPE.dot.cy} r={LOGOTYPE.dot.r} fill={SIGNAL} />
        </svg>
      </div>
      {/* Sous 120 px : l'aplat statique de référence, sans effet. */}
      <svg className="coulure-small" aria-hidden="true" viewBox={LOGOTYPE.viewBox} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        <path d={LOGOTYPE.letters} fill={CRAIE} />
        <circle cx={LOGOTYPE.dot.cx} cy={LOGOTYPE.dot.cy} r={LOGOTYPE.dot.r} fill={SIGNAL} />
      </svg>
    </div>
  );
}
