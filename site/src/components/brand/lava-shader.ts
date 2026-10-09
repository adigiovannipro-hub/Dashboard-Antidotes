/**
 * La lave du hero (charte r-04, r-05, r-19) : un champ de métaballes 2D.
 * Ce module ne dépend pas de React — il porte la composition (où vivent les
 * gouttes et comment elles tournent), les shaders et leur moteur WebGL1, et
 * le contour figé qui sert de première image. Une seule source pour les deux
 * rendus : la première image sans JavaScript et la première image WebGL
 * tombent au même endroit, le fondu de l'une à l'autre ne se voit pas.
 */

export type LavaVariant = "dark" | "light";

/* --- Le champ --------------------------------------------------------------
   Chaque goutte est un disque ; la lave est leur union lissée par un minimum
   doux exponentiel, d = −k·ln Σ exp(−dᵢ/k). C'est un champ de métaballes à
   noyau exponentiel, dont l'isoligne zéro est le bord : deux gouttes voisines
   fusionnent en une seule masse au contour lisse (les « baies » concaves de
   r-05). Et d reste une vraie distance au bord, dedans comme dehors : le
   liseré éclairé a la même largeur tout autour de la masse, comme sur r-05,
   sans les cibles qu'une distance au premier ordre creuse au milieu d'une
   goutte quand deux gradients s'annulent. */

/** Rayon de fusion k, en unités : la taille des congés entre deux gouttes. */
export const BLEND = 0.085;

/** Nombre de gouttes passées au shader : six de composition, la septième au pointeur. */
export const BALL_COUNT = 7;

type Blob = {
  /** Au repos sur un écran large : x depuis la gauche et y depuis le bas, en fraction de la section ; r en « unités » (le plus petit côté). */
  land: readonly [number, number, number];
  /** Même chose sur un écran en portrait. */
  port: readonly [number, number, number];
  /** Amplitude de l'orbite, en unités. */
  amp: readonly [number, number];
  /** Cycle en secondes — la charte demande 14 à 22 s, chaque goutte sur le sien. */
  period: number;
  phase: number;
};

/*
 * La composition. Sur écran large, la moitié gauche reste libre (le texte y
 * vit) : une grande masse entre par le bord droit, déborde en haut et en bas,
 * pousse un nez arrondi vers le centre comme sur r-05 ; une gouttelette s'en
 * détache et s'y recolle. En portrait, la lave tient le coin haut-droit et la
 * bande du bas, le milieu reste au texte. Les rayons sont grands exprès : la
 * lave est une matière coupée par les bords, pas des bulles posées dans le cadre.
 */
const BLOBS: readonly Blob[] = [
  // Le corps, adossé au bord droit et coupé par le bas.
  { land: [1.04, 0.42, 0.42], port: [1.08, 0.16, 0.44], amp: [0.03, 0.05], period: 19, phase: 0.4 },
  // La masse du haut, coupée par le bord supérieur.
  { land: [1.0, 1.04, 0.22], port: [1.02, 0.95, 0.42], amp: [0.04, 0.025], period: 16, phase: 2.1 },
  // Le balayage du bas, coupé par le bord inférieur.
  { land: [0.9, -0.04, 0.24], port: [0.55, -0.06, 0.42], amp: [0.045, 0.03], period: 21, phase: 4.0 },
  // Le nez qui avance vers le texte sans jamais l'atteindre.
  { land: [0.76, 0.56, 0.21], port: [0.6, 1.0, 0.26], amp: [0.035, 0.06], period: 14, phase: 1.2 },
  // Le flanc droit, sous la masse du haut (en portrait : l'autre moitié de la bande du bas).
  { land: [1.12, 0.75, 0.24], port: [0.05, -0.03, 0.3], amp: [0.025, 0.04], period: 22, phase: 5.3 },
  // La gouttelette : assez petite pour se détacher de la masse et s'y fondre à nouveau.
  { land: [0.71, 0.3, 0.05], port: [0.34, 0.15, 0.06], amp: [0.06, 0.045], period: 17, phase: 3.1 },
];

/** Rayon de la goutte du pointeur, en unités, sur écran large et en portrait. */
const POINTER_RADIUS: readonly [number, number] = [0.075, 0.09];

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** 0 en portrait, 1 sur écran large ; entre les deux (tablette, carré), la composition glisse de l'une à l'autre. */
export function landscapeFactor(width: number, height: number): number {
  return smoothstep(0.85, 1.25, width / Math.max(1, height));
}

/** Le pointeur vu par la lave : position en fraction de la section (y depuis le bas) et présence 0 → 1. */
export type LavaPointer = { x: number; y: number; presence: number };

/**
 * Les sept gouttes à l'instant `time`, prêtes pour `uniform3fv` : centre et
 * rayon en unités (une unité = le plus petit côté de la section, origine en
 * bas à gauche). Le calcul est ici et pas dans le shader : sept gouttes
 * coûtent quelques dizaines d'opérations par image, contre autant par pixel.
 */
export function ballsAt(time: number, width: number, height: number, pointer: LavaPointer | null, out = new Float32Array(BALL_COUNT * 3)): Float32Array {
  const unit = Math.max(1, Math.min(width, height));
  const sx = width / unit;
  const sy = height / unit;
  const l = landscapeFactor(width, height);
  const tau = Math.PI * 2;
  BLOBS.forEach((b, i) => {
    const w = tau / b.period;
    // Orbite de Lissajous : deux fréquences voisines, la trajectoire ne se referme jamais tout à fait.
    out[i * 3] = mix(b.port[0], b.land[0], l) * sx + b.amp[0] * Math.sin(w * time + b.phase);
    out[i * 3 + 1] = mix(b.port[1], b.land[1], l) * sy + b.amp[1] * Math.cos(w * 0.83 * time + b.phase * 1.7 + 1.3);
    // La goutte respire un peu : le contour change de forme, pas seulement de place.
    out[i * 3 + 2] = mix(b.port[2], b.land[2], l) * (1 + 0.05 * Math.sin(w * 1.37 * time + b.phase * 2.3));
  });
  const k = (BALL_COUNT - 1) * 3;
  // Au-dessus du texte (moitié gauche d'un écran large), la goutte du pointeur se résorbe : Craie sur Signal tombe à 1,7:1.
  const shrink = pointer ? mix(1, smoothstep(0.36, 0.58, pointer.x), l) : 0;
  const r = pointer ? mix(POINTER_RADIUS[1], POINTER_RADIUS[0], l) * pointer.presence * shrink : 0;
  // Goutte absente : rejetée loin du cadre, sa contribution au champ est nulle.
  out[k] = r > 0.002 && pointer ? pointer.x * sx : -100;
  out[k + 1] = r > 0.002 && pointer ? pointer.y * sy : -100;
  out[k + 2] = r;
  return out;
}

/** Le champ en un point, en unités : distance signée au bord (négative dans la matière). Miroir exact du shader. */
export function lavaDistance(balls: Float32Array, x: number, y: number): number {
  let sum = 0;
  for (let i = 0; i < BALL_COUNT; i += 1) {
    const dx = x - balls[i * 3];
    const dy = y - balls[i * 3 + 1];
    // Math.sqrt plutôt que Math.hypot : quatre fois plus rapide, et ce calcul tourne à l'hydratation.
    sum += Math.exp(-(Math.sqrt(dx * dx + dy * dy) - balls[i * 3 + 2]) / BLEND);
  }
  return -BLEND * Math.log(Math.max(sum, 1e-30));
}

/* --- Les couleurs -----------------------------------------------------------
   Relevées sur le rendu de référence (r-05 et r-17 au centre), pas
   inventées. Les teintes pures viennent de la palette (tokens.css) ; les
   teintes de matière en sont dérivées. Le shader et la première image les
   lisent toutes les deux ici. */
type Rgb = readonly [number, number, number];
const hex = (h: string): Rgb => {
  const v = parseInt(h.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
};

export const LAVA_COLORS = {
  dark: {
    /** Le cœur : Signal dans l'ombre de la matière (r-05 relève #15803D au centre de la masse). */
    core: "#148a3a",
    /** Le bord éclairé : Signal monté vers la Menthe (#6EF39F relevé sur r-05). */
    rim: "#6af09c",
    /** La frange basse : Rose (#F7A8D8), saturée d'un cran comme sur r-05. */
    fringe: "#f294da",
    /** L'éclat de bord, là où le rose et le vert se rencontrent : Menthe. */
    glint: "#e2f3da",
  },
  light: {
    /** Le corps : Signal éclairci (#5BEA90 relevé sur r-17). */
    core: "#5bea8e",
    /** Le vert plus dense au cœur des grandes masses. */
    deep: "#2fdc68",
    /** Les franges : Lagon et Lilas. */
    rim: "#2fd3c6",
    fringe: "#a19bff",
    glint: "#e9fbff",
  },
} as const;

/**
 * Le liseré éclairé est une lueur intérieure, comme celle d'un outil de
 * dessin : la forme est rendue en basse définition, floutée, et la part de
 * vide que le flou ramène sous chaque point de la matière dit à quel point
 * ce point est près du bord. Elle ne connaît que le vrai contour — aucun
 * bord fantôme là où deux gouttes se recouvrent — et sa pente donne une
 * normale lisse, qui oriente la frange. σ en unités : sur r-05 le bord clair
 * rejoint le cœur sombre en 150 px environ pour une page de 900 px de haut ;
 * sur r-17 la frange Lagon-Lilas est plus serrée.
 */
export const GLOW_SIGMA: Record<LavaVariant, number> = { dark: 0.1, light: 0.065 };

/** Définition du masque flouté : texels par unité. Fixe, pour que le noyau du flou ne dépende pas de l'écran. */
export const GLOW_TEXELS_PER_UNIT = 100;

const glslColor = (h: string) => {
  const [r, g, b] = hex(h);
  return `vec3(${r.toFixed(4)},${g.toFixed(4)},${b.toFixed(4)})`;
};

const PRECISION = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;

/** Le champ, en GLSL : profondeur dans la matière (positive dedans), −(−k·ln Σ exp(−dᵢ/k)). */
const DEPTH_GLSL = `uniform vec3 u_balls[${BALL_COUNT}];const float K=${BLEND.toFixed(4)};
float depthAt(vec2 p){float S=0.;for(int i=0;i<${BALL_COUNT};i++){vec3 b=u_balls[i];S+=exp(-(length(p-b.xy)-b.z)/K);}return K*log(max(S,1e-20));}
`;

export const VERTEX_SHADER = `attribute vec2 a_pos;void main(){gl_Position=vec4(a_pos,0.,1.);}`;

/** Passe 1 : le masque en basse définition, 1 dehors et 0 dedans. */
const MASK_SHADER = `${PRECISION}uniform vec2 u_low;uniform vec2 u_extent;${DEPTH_GLSL}
void main(){vec2 p=gl_FragCoord.xy/u_low*u_extent;float d=depthAt(p);float h=.5*u_extent.x/u_low.x;
gl_FragColor=vec4(vec3(1.-smoothstep(-h,h,d)),1.);}`;

/** Passes 2 et 3 : flou gaussien séparable, σ et rayon gravés dans la source. */
function blurShader(variant: LavaVariant): string {
  const sigma = GLOW_SIGMA[variant] * GLOW_TEXELS_PER_UNIT;
  const radius = Math.ceil(sigma * 3);
  let sum = 0;
  for (let i = -radius; i <= radius; i += 1) sum += Math.exp(-(i * i) / (2 * sigma * sigma));
  return `${PRECISION}uniform sampler2D u_tex;uniform vec2 u_low;uniform vec2 u_step;
void main(){vec2 uv=gl_FragCoord.xy/u_low;float acc=0.;
for(int i=-${radius};i<=${radius};i++){float x=float(i);acc+=exp(-x*x/${(2 * sigma * sigma).toFixed(3)})*texture2D(u_tex,uv+u_step*x).r;}
gl_FragColor=vec4(vec3(acc/${sum.toFixed(5)}),1.);}`;
}

/**
 * Passe 4, en pleine définition : le bord net vient du champ, la lumière du
 * masque flouté. Les couleurs sont gravées dans la source : une variante ne
 * change jamais en cours de route.
 */
function finalShader(variant: LavaVariant): string {
  const c = LAVA_COLORS[variant];
  const shade =
    variant === "dark"
      ? `
  // Frange rose sur les bords tournés vers le bas (r-05, r-04). Le passage du vert au rose est court et
  // passe par la Menthe : mélangés à parts égales, les deux donneraient un gris sale.
  // Elle tient aussi le flanc gauche dans le bas de la section, comme le dessous du nez sur r-05.
  float fa=dot(n,normalize(vec2(-.45,-1.)));
  float w=clamp(smoothstep(.4,.92,fa)+smoothstep(.05,.6,fa)*smoothstep(.42,.08,uv.y)*.55,0.,1.)*trust;
  vec3 edge=mix(RIM_C,FRINGE,w);edge=mix(edge,GLINT,.55*4.*w*(1.-w));
  // Le rose tient plus loin dans la matière que le vert, puis tourne au mauve avant le cœur (r-05).
  float band=mix(rim,smoothstep(0.,.62,g2),w);
  vec3 core=CORE*(1.+(vnoise(p*1.4+vec2(u_time*.02,-u_time*.013))-.5)*.16);
  vec3 col=mix(core,edge,band);
  col=mix(col,GLINT,pow(rim,8.)*.1);`
      : `
  // Lagon et Lilas se partagent le bord (r-17) : le Lilas sur les faces tournées vers le bas et dans le
  // bas de la section, le Lagon ailleurs ; un bruit lent fait glisser la frontière entre les deux.
  float s=clamp(smoothstep(-.3,.6,dot(n,normalize(vec2(.3,-1.))))+smoothstep(.62,.15,uv.y)*.85,0.,1.);
  s*=trust*mix(.7,1.,vnoise(p*.9+u_time*.015));
  vec3 edge=mix(RIM_C,FRINGE,s);
  vec3 core=mix(CORE,DEEP,(1.-smoothstep(0.,.1,g))*.22);
  vec3 col=mix(core,edge,rim);
  col=mix(col,GLINT,pow(rim,10.)*.18);`;
  return `${PRECISION}uniform vec2 u_res;uniform vec2 u_extent;uniform vec2 u_low;uniform sampler2D u_glow;uniform float u_seed;uniform float u_time;
${DEPTH_GLSL}const vec3 CORE=${glslColor(c.core)};const vec3 RIM_C=${glslColor(c.rim)};const vec3 FRINGE=${glslColor(c.fringe)};
const vec3 GLINT=${glslColor(c.glint)};${variant === "light" ? `const vec3 DEEP=${glslColor(LAVA_COLORS.light.deep)};` : ""}
// Hachage sans sinus : sin() à grand argument se répète en motifs sur une partie des GPU mobiles.
float hash(vec2 q){vec3 p3=fract(vec3(q.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float vnoise(vec2 q){vec2 i=floor(q);vec2 f=fract(q);f=f*f*(3.-2.*f);
return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float glow(vec2 uv){return texture2D(u_glow,uv).r;}
void main(){
  vec2 uv=gl_FragCoord.xy/u_res;vec2 p=uv*u_extent;
  float depth=depthAt(p);float px=u_extent.x/u_res.x;
  // Grain fin, renouvelé 24 fois par seconde : il vit dans la matière et mord aussi le bord, qui ne tombe jamais net.
  float grain=hash(gl_FragCoord.xy+vec2(u_seed,u_seed*1.618))-.5;
  float a=smoothstep(-1.1*px,1.1*px,depth+grain*.9*px);
  if(a<=0.){gl_FragColor=vec4(0.);return;}
  // La part de vide sous le flou : 0,5 sur un bord droit, plus dans un creux, rien au cœur.
  float g=glow(uv);float g2=clamp(g*2.,0.,1.);
  // Profil relevé sur r-05 : le bord reste clair un moment, puis plonge vers le cœur.
  float rim=smoothstep(.04,.9,g2);
  // Sa pente pointe vers le dehors : c'est la normale lissée du bord le plus proche. Différences prises à
  // trois texels : le masque est en 8 bits, une pente mesurée sur un seul texel se lit en escaliers.
  vec2 o=3./u_low;
  vec2 n=vec2(glow(uv+vec2(o.x,0.))-glow(uv-vec2(o.x,0.)),glow(uv+vec2(0.,o.y))-glow(uv-vec2(0.,o.y)));
  // Là où la pente s'aplatit (cœur, coin coupé par le cadre), la direction ne veut plus rien dire : la frange s'y retire.
  float trust=smoothstep(.01,.05,length(n));
  n/=length(n)+1e-5;${shade}
  col+=grain*${variant === "dark" ? "0.1" : "0.075"};
  gl_FragColor=vec4(clamp(col,0.,1.)*a,a);
}`;
}

/** Les sources des quatre passes d'une variante. */
export function lavaShaders(variant: LavaVariant) {
  return { vertex: VERTEX_SHADER, mask: MASK_SHADER, blur: blurShader(variant), final: finalShader(variant) };
}

type Pass = { program: WebGLProgram; loc: (name: string) => WebGLUniformLocation | null };

function compile(gl: WebGLRenderingContext, fragment: string): Pass | null {
  const program = gl.createProgram();
  if (!program) return null;
  for (const [type, src] of [
    [gl.VERTEX_SHADER, VERTEX_SHADER],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  // Le triangle plein cadre lit l'attribut 0 dans chaque programme : un seul tampon sert aux quatre passes.
  gl.bindAttribLocation(program, 0, "a_pos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  const cache = new Map<string, WebGLUniformLocation | null>();
  return {
    program,
    loc: (name) => {
      if (!cache.has(name)) cache.set(name, gl.getUniformLocation(program, name));
      return cache.get(name) ?? null;
    },
  };
}

export type LavaRenderer = {
  /** Peint une image : temps en secondes, pointeur ou null. La taille est celle du canvas. */
  draw: (time: number, pointer: LavaPointer | null, seed: number) => void;
  dispose: () => void;
};

/**
 * Le rendu complet sur un contexte WebGL1 : masque, deux flous, image finale.
 * `null` si le GPU refuse un programme ou une cible de rendu — le composant
 * garde alors son repli SVG.
 */
export function createLavaRenderer(gl: WebGLRenderingContext, variant: LavaVariant): LavaRenderer | null {
  const src = lavaShaders(variant);
  const mask = compile(gl, src.mask);
  const blur = compile(gl, src.blur);
  const final = compile(gl, src.final);
  if (!mask || !blur || !final) return null;
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  // Un seul triangle plus grand que l'écran : tout le dessin est dans les fragment shaders.
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.disable(gl.BLEND);

  // Deux cibles en basse définition, en ping-pong : masque → flou horizontal → flou vertical.
  const targets = [0, 1].map(() => ({ tex: gl.createTexture(), fb: gl.createFramebuffer() }));
  let low = [0, 0];
  const allocate = (w: number, h: number) => {
    low = [w, h];
    for (const t of targets) {
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      // Bord étiré : au-delà du cadre, la matière continue, le flou ne prend pas la coupe pour un bord.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
    }
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return ok;
  };
  const balls = new Float32Array(BALL_COUNT * 3);

  return {
    draw: (time, pointer, seed) => {
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      const unit = Math.max(1, Math.min(w, h));
      const extent = [w / unit, h / unit];
      const lw = Math.max(8, Math.round(extent[0] * GLOW_TEXELS_PER_UNIT));
      const lh = Math.max(8, Math.round(extent[1] * GLOW_TEXELS_PER_UNIT));
      if ((lw !== low[0] || lh !== low[1]) && !allocate(lw, lh)) return;
      ballsAt(time, w, h, pointer, balls);

      gl.viewport(0, 0, lw, lh);
      gl.useProgram(mask.program);
      gl.uniform2f(mask.loc("u_low"), lw, lh);
      gl.uniform2f(mask.loc("u_extent"), extent[0], extent[1]);
      gl.uniform3fv(mask.loc("u_balls"), balls);
      gl.bindFramebuffer(gl.FRAMEBUFFER, targets[0].fb);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.useProgram(blur.program);
      gl.uniform2f(blur.loc("u_low"), lw, lh);
      gl.uniform1i(blur.loc("u_tex"), 0);
      gl.activeTexture(gl.TEXTURE0);
      for (const [from, to, step] of [
        [0, 1, [1 / lw, 0]],
        [1, 0, [0, 1 / lh]],
      ] as const) {
        gl.bindTexture(gl.TEXTURE_2D, targets[from].tex);
        gl.bindFramebuffer(gl.FRAMEBUFFER, targets[to].fb);
        gl.uniform2f(blur.loc("u_step"), step[0], step[1]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.useProgram(final.program);
      gl.bindTexture(gl.TEXTURE_2D, targets[0].tex);
      gl.uniform1i(final.loc("u_glow"), 0);
      gl.uniform2f(final.loc("u_res"), w, h);
      gl.uniform2f(final.loc("u_extent"), extent[0], extent[1]);
      gl.uniform2f(final.loc("u_low"), lw, lh);
      gl.uniform3fv(final.loc("u_balls"), balls);
      gl.uniform1f(final.loc("u_time"), time);
      gl.uniform1f(final.loc("u_seed"), seed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose: () => {
      for (const t of targets) {
        gl.deleteTexture(t.tex);
        gl.deleteFramebuffer(t.fb);
      }
      gl.deleteBuffer(buffer);
      for (const pass of [mask, blur, final]) gl.deleteProgram(pass.program);
    },
  };
}

/* --- La première image ------------------------------------------------------
   Le contour de la lave à t = 0, tracé une fois par marching squares sur le
   même champ que le shader, puis simplifié. Il sert de repli sans JavaScript
   et sans WebGL, et de première image avant l'hydratation. */

/** Les deux cadres de référence : la section du hero sur un écran large et sur un téléphone. */
export const FALLBACK_FRAMES = {
  // Pas de grille assez large pour que le tracé coûte quelques millisecondes à l'hydratation, assez fin
  // pour qu'aucune facette ne se voie. Le champ est une distance, presque linéaire près du bord : une
  // interpolation entre deux nœuds y place le contour au dixième de pixel, même sur une grille lâche.
  land: { width: 1440, height: 940, margin: 180, step: 18 },
  port: { width: 390, height: 900, margin: 120, step: 10 },
} as const;

type Pt = [number, number];

/** Ramer–Douglas–Peucker : garde les sommets qui s'écartent de plus de `eps` de la corde. */
function simplify(points: Pt[], eps: number): Pt[] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [i0, i1] = stack.pop()!;
    const [ax, ay] = points[i0];
    const [bx, by] = points[i1];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let best = -1;
    let bestD = eps;
    for (let i = i0 + 1; i < i1; i += 1) {
      const d = Math.abs((points[i][0] - ax) * dy - (points[i][1] - ay) * dx) / len;
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([i0, best], [best, i1]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/**
 * Le contour de la lave à t = 0 dans un cadre de référence, en chemin SVG
 * (coordonnées du cadre, y vers le bas). Le champ est évalué jusque dans la
 * marge : la matière continue au-delà du bord, si bien que le liseré éclairé
 * du repli ne longe jamais une coupe.
 */
export function fallbackPath(frame: keyof typeof FALLBACK_FRAMES): string {
  const { width: W, height: H, margin: m, step } = FALLBACK_FRAMES[frame];
  const balls = ballsAt(0, W, H, null);
  const unit = Math.min(W, H);
  const cols = Math.ceil((W + 2 * m) / step);
  const rows = Math.ceil((H + 2 * m) / step);
  const nx = cols + 1;
  const val = new Float64Array(nx * (rows + 1));
  for (let j = 0; j <= rows; j += 1) {
    for (let i = 0; i <= cols; i += 1) {
      // L'anneau extérieur est forcé dehors : tout contour s'y referme.
      if (i === 0 || j === 0 || i === cols || j === rows) {
        val[j * nx + i] = -1;
        continue;
      }
      // Positif dans la matière : l'opposé de la distance signée, la même que celle du shader.
      val[j * nx + i] = -lavaDistance(balls, (i * step - m) / unit, (H - (j * step - m)) / unit);
    }
  }
  // Chaque croisement vit sur une arête de la grille : identifiant 2·k pour l'arête horizontale du nœud k, 2·k+1 pour la verticale.
  const points = new Map<number, Pt>();
  const links = new Map<number, number[]>();
  const at = (i: number, j: number) => val[j * nx + i];
  const cross = (id: number): Pt => {
    const cached = points.get(id);
    if (cached) return cached;
    const k = id >> 1;
    const i = k % nx;
    const j = (k - i) / nx;
    const [i2, j2] = id & 1 ? [i, j + 1] : [i + 1, j];
    const a = at(i, j);
    const b = at(i2, j2);
    const t = a / (a - b);
    const pt: Pt = [(i + (i2 - i) * t) * step - m, (j + (j2 - j) * t) * step - m];
    points.set(id, pt);
    return pt;
  };
  const link = (a: number, b: number) => {
    cross(a);
    cross(b);
    (links.get(a) ?? links.set(a, []).get(a)!).push(b);
    (links.get(b) ?? links.set(b, []).get(b)!).push(a);
  };
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const tl = at(i, j) > 0 ? 1 : 0;
      const tr = at(i + 1, j) > 0 ? 1 : 0;
      const br = at(i + 1, j + 1) > 0 ? 1 : 0;
      const bl = at(i, j + 1) > 0 ? 1 : 0;
      const code = tl * 8 + tr * 4 + br * 2 + bl;
      if (code === 0 || code === 15) continue;
      const top = 2 * (j * nx + i);
      const bottom = 2 * ((j + 1) * nx + i);
      const left = 2 * (j * nx + i) + 1;
      const right = 2 * (j * nx + i + 1) + 1;
      const centre = (at(i, j) + at(i + 1, j) + at(i + 1, j + 1) + at(i, j + 1)) / 4 > 0;
      switch (code) {
        case 1: case 14: link(left, bottom); break;
        case 2: case 13: link(bottom, right); break;
        case 3: case 12: link(left, right); break;
        case 4: case 11: link(top, right); break;
        case 6: case 9: link(top, bottom); break;
        case 7: case 8: link(left, top); break;
        // Cols : le centre de la cellule tranche entre « deux masses qui se touchent » et « deux masses séparées ».
        case 5: if (centre) { link(left, top); link(bottom, right); } else { link(left, bottom); link(top, right); } break;
        case 10: if (centre) { link(left, bottom); link(top, right); } else { link(left, top); link(bottom, right); } break;
      }
    }
  }
  const seen = new Set<number>();
  const parts: string[] = [];
  for (const start of links.keys()) {
    if (seen.has(start)) continue;
    const loop: Pt[] = [];
    let prev = -1;
    let cur = start;
    while (!seen.has(cur)) {
      seen.add(cur);
      loop.push(points.get(cur)!);
      const next = (links.get(cur) ?? []).find((id) => id !== prev && !seen.has(id));
      if (next === undefined) break;
      prev = cur;
      cur = next;
    }
    if (loop.length < 3) continue;
    // Une boucle fermée n'a pas de corde : on la coupe en deux au sommet le plus éloigné du départ.
    let far = 0;
    loop.forEach(([x, y], i) => {
      if (Math.hypot(x - loop[0][0], y - loop[0][1]) > Math.hypot(loop[far][0] - loop[0][0], loop[far][1] - loop[0][1])) far = i;
    });
    const pts = [...simplify(loop.slice(0, far + 1), 0.35), ...simplify([...loop.slice(far), loop[0]], 0.35).slice(1, -1)];
    parts.push(`M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`);
  }
  return parts.join("");
}
