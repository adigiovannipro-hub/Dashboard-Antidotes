"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Le logotype « antidotes » en grand, fusionné et effervescent — l'affiche
 * SOUL du moodboard : le mot reste net en bas, bord néon menthe, et sa
 * matière monte en volutes vertes qui se déchirent en fumée. Le pointeur,
 * ou le doigt, attise la zone qu'il touche.
 *
 * Le mot est peint une fois sur un canvas 2D hors écran (police de marque,
 * graisse lourde, interlettrage négatif pour que les lettres se touchent) ;
 * un fragment shader relit cette texture : telle quelle sous la ligne de
 * base, étirée vers le haut et déplacée par un bruit fractal au-dessus. Rien
 * ne passe par l'état React dans la boucle. Hors écran, onglet caché ou GPU
 * trop lent : la boucle s'arrête sur la dernière image. Sans WebGL ou en
 * mouvement réduit : le mot en HTML, avec son halo CSS.
 */

const TOKENS: Array<[string, string]> = [["--text", "#f6f5f1"], ["--mint", "#9ff0c9"], ["--green", "#2fbf7a"], ["--turquoise", "#5fe0c8"]];
/* Hauteur des volutes, en hauteurs de mot. La boîte du composant = mot × (1 + FLAME). */
const FLAME = 1.6;
/* Le rapport largeur/hauteur du mot peint, figé pour que la boîte ait sa taille avant la police. */
const WORD_ASPECT = 4.1;
const TEX_WIDTH = 2560;
const TEX_HEIGHT = Math.round(TEX_WIDTH / WORD_ASPECT);
const LETTER_SPACING_EM = -0.085;
const LABEL = "antidotes";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const VERT = `attribute vec2 a_pos;varying vec2 v_uv;void main(){v_uv=a_pos*.5+.5;gl_Position=vec4(a_pos,0.,1.);}`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D u_text;uniform vec2 u_res;uniform float u_time;uniform float u_pointer;uniform float u_hover;uniform float u_word;
uniform vec3 u_ink;uniform vec3 u_mint;uniform vec3 u_green;uniform vec3 u_turq;
varying vec2 v_uv;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.));return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<3;i++){v+=a*noise(p);p=p*2.03+vec2(17.,9.);a*=.5;}return v;}
void main(){
vec2 uv=v_uv;
// Le mot net, en bas : canal vert = plein, canal rouge = contour.
float inWord=step(uv.y,u_word);
vec2 tuv=vec2(uv.x,clamp(uv.y/u_word,0.,1.));
vec4 t=texture2D(u_text,tuv)*inWord;
// La matière qui monte : une bande étroite des glyphes (de la mi-hauteur
// d'x aux sommets des hampes) est étirée sur toute la hauteur libre — chaque
// lettre devient une langue, courte pour un o, haute pour un t — puis tordue
// par deux bruits, un large qui courbe, un serré qui effiloche. Le bruit
// fractal vit dans [.25,.75] : amplifié ×3,6 pour que la torsion se voie.
float v0=.5;float v1=.74;float y0=u_word*v0;
float s=(uv.y-y0)/(1.-y0);
float near=smoothstep(.3,0.,abs(uv.x-u_pointer))*u_hover;
float agit=.7+.5*u_hover+1.3*near;
float n1=fbm(vec2(uv.x*4.5+u_time*.06,uv.y*1.3-u_time*.2));
float n2=fbm(vec2(uv.x*9.+u_time*.04,uv.y*2.6-u_time*.42));
float stretch=1.+.15*u_hover+.3*near+(n1-.5)*.6;
float dx=(n1-.5)*3.6*(.012+.09*s)*agit+(n2-.5)*3.6*.02*s*(1.+2.*near);
float sy=s/stretch;
float vv=v0+(v1-v0)*sy;
// Cinq lignes moyennées : la bande est agrandie cinq fois, une seule ligne ferait des marches.
vec2 fuv=vec2(uv.x+dx,vv);float dv=.0022;
vec4 f=(s>0.&&sy<=1.)?(texture2D(u_text,fuv-vec2(0.,2.*dv))+texture2D(u_text,fuv-vec2(0.,dv))+texture2D(u_text,fuv)+texture2D(u_text,fuv+vec2(0.,dv))+texture2D(u_text,fuv+vec2(0.,2.*dv)))*.2:vec4(0.);
float wisp=smoothstep(.0,.55,n2+.4*(1.-sy));
float fade=pow(smoothstep(.97,.15,sy),.85);
float birth=smoothstep(0.,.06,s);
float tear=mix(1.,wisp,smoothstep(.3,1.,sy));
float body=f.g*tear*fade*birth;
float rim=f.r*tear*fade*birth;
vec3 flameColor=mix(u_green,u_turq,clamp(sy*1.5,0.,1.));flameColor=mix(flameColor,u_mint,n1*.5);
// Halo du contour : quatre relectures du canal rouge.
vec2 px=2.5/u_res;
float halo=(texture2D(u_text,tuv+vec2(px.x,0.)).r+texture2D(u_text,tuv-vec2(px.x,0.)).r+texture2D(u_text,tuv+vec2(0.,px.y)).r+texture2D(u_text,tuv-vec2(0.,px.y)).r)*.25*inWord;
// Composition prémultipliée : halo, plein, contour, puis la fumée — corps
// vert translucide, bord menthe lumineux : des langues cernées de néon.
float aC=halo*.45;vec3 pc=u_mint*aC;float pa=aC;
float aA=t.g;pc=u_ink*aA+pc*(1.-aA);pa=aA+pa*(1.-aA);
float aB=t.r;pc=u_mint*aB+pc*(1.-aB);pa=aB+pa*(1.-aB);
float aD=min(1.,body*.4+rim*1.);
pc+=(flameColor*body*.36+mix(u_mint,vec3(1.),.35)*rim*.95)*(1.-pa*.7);pa=pa+aD*(1.-pa);
pc=min(pc,vec3(pa));
gl_FragColor=vec4(pc,pa);}`;

function readColor(style: CSSStyleDeclaration, name: string, fallback: string): number[] {
  const raw = style.getPropertyValue(name).trim() || fallback;
  const v = parseInt(/^#([0-9a-f]{6})$/i.exec(raw)?.[1] ?? fallback.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => c / 255);
}

function buildProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;
  for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]] as const) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  return program;
}

/**
 * Le mot peint : plein dans le canal vert, contour dans le rouge. Les lettres
 * sont posées une à une avec un interlettrage négatif — c'est ce qui les fait
 * se toucher, et `letterSpacing` du canvas n'est pas partout.
 */
function paintWord(fontFamily: string, weight: number): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = TEX_WIDTH;
  canvas.height = TEX_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const chars = Array.from(LABEL);
  const measure = (size: number) => {
    ctx.font = `${weight} ${size}px ${fontFamily}`;
    const widths = chars.map((c) => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + LETTER_SPACING_EM * size * (chars.length - 1);
    return { widths, total };
  };
  /* Taille ajustée à la boîte : 95 % de la largeur, et le corps sous 80 % de la hauteur. */
  const probe = measure(100);
  const size = Math.min((TEX_WIDTH * 0.95 * 100) / probe.total, TEX_HEIGHT * 0.8);
  const { widths, total } = measure(size);
  const baseline = TEX_HEIGHT * 0.86;
  const advance = (i: number) => widths[i] + LETTER_SPACING_EM * size;
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  /* Contour d'abord, rouge, puis plein par-dessus, vert : le filet ne survit
     que sur le pourtour de l'union des lettres — c'est ce qui les fond
     l'une dans l'autre au lieu de montrer leurs recouvrements. */
  ctx.strokeStyle = "#ff0000";
  ctx.lineWidth = Math.max(2, size * 0.034);
  let x = (TEX_WIDTH - total) / 2;
  chars.forEach((c, i) => {
    ctx.strokeText(c, x, baseline);
    x += advance(i);
  });
  ctx.fillStyle = "#00ff00";
  x = (TEX_WIDTH - total) / 2;
  chars.forEach((c, i) => {
    ctx.fillText(c, x, baseline);
    x += advance(i);
  });
  return canvas;
}

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const getReducedMotion = () => window.matchMedia(REDUCED_MOTION_QUERY).matches;
const getServerReducedMotion = () => false;

export function FuseWordmark({ className = "" }: { className?: string }) {
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getServerReducedMotion);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const staticRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reducedMotion) return;
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const stat = staticRef.current;
    if (!root || !canvas || !stat) return;
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
    const program = gl && buildProgram(gl);
    if (!gl || !program) return;

    const u = (name: string) => gl.getUniformLocation(program, name);
    const [uRes, uTime, uPointer, uHover, uWord] = ["u_res", "u_time", "u_pointer", "u_hover", "u_word"].map(u);
    const style = getComputedStyle(root);
    const [ink, mint, green, turq] = TOKENS.map(([name, hex]) => readColor(style, name, hex));
    gl.uniform3fv(u("u_ink"), new Float32Array(ink));
    gl.uniform3fv(u("u_mint"), new Float32Array(mint));
    gl.uniform3fv(u("u_green"), new Float32Array(green));
    gl.uniform3fv(u("u_turq"), new Float32Array(turq));
    gl.uniform1f(uWord, 1 / (1 + FLAME));
    gl.uniform1i(u("u_text"), 0);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const scale = Math.min(window.devicePixelRatio || 1, coarse ? 1 : 1.25);
    const fps = coarse ? 40 : 60;
    const resize = () => {
      const w = Math.max(1, Math.round(canvas.clientWidth * scale));
      const h = Math.max(1, Math.round(canvas.clientHeight * scale));
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    };
    resize();

    /* La police de marque : lue sur le mot HTML, une fois chargée. */
    let ready = false;
    let disposed = false;
    const fontStyle = getComputedStyle(stat);
    const weight = parseInt(fontStyle.fontWeight, 10) || 800;
    const family = fontStyle.fontFamily;
    document.fonts
      .load(`${weight} 64px ${family}`)
      .catch(() => undefined)
      .then(() => document.fonts.ready)
      .then(() => {
        if (disposed) return;
        const painted = paintWord(family, weight);
        if (!painted) return;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, painted);
        ready = true;
      });

    const sim = { pointer: 0.5, hover: 0, time: 0 };
    const input = { pointer: 0.5, hover: false };
    let raf = 0;
    let last = 0;
    let running = false;
    let visible = false;
    let painted = false;
    let frozen = false;
    let samples = 0;
    let slowMs = 0;
    let touchTimer = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 1000 / fps - 2) return;
      const dt = Math.min((now - last) / 1000, 0.1);
      if (painted && samples < 40) {
        samples += 1;
        slowMs += now - last;
        if (samples === 40 && slowMs / samples > 50 && !("__antidotesNoFreeze" in window)) {
          frozen = true;
          run(false);
          return;
        }
      }
      last = now;
      if (!ready) return;
      sim.pointer += (input.pointer - sim.pointer) * (1 - Math.exp(-dt * 6));
      sim.hover += ((input.hover ? 1 : 0) - sim.hover) * (1 - Math.exp(-dt * (input.hover ? 4 : 1.6)));
      sim.time += dt;
      gl.uniform1f(uTime, sim.time);
      gl.uniform1f(uPointer, sim.pointer);
      gl.uniform1f(uHover, sim.hover);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!painted) {
        painted = true;
        canvas.style.opacity = "1";
        stat.style.opacity = "0";
      }
    };
    const run = (on: boolean) => {
      if (on === running) return;
      running = on && visible && !document.hidden && !frozen;
      if (running) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      } else cancelAnimationFrame(raf);
    };

    const onMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0) return;
      input.pointer = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      input.hover = true;
      if (event.pointerType !== "mouse") {
        /* Un doigt ne « sort » pas : l'agitation retombe seule après un moment. */
        window.clearTimeout(touchTimer);
        touchTimer = window.setTimeout(() => {
          input.hover = false;
        }, 1400);
      }
    };
    const onLeave = () => {
      input.hover = false;
    };
    root.addEventListener("pointermove", onMove, { passive: true });
    root.addEventListener("pointerdown", onMove, { passive: true });
    root.addEventListener("pointerleave", onLeave);
    root.addEventListener("pointercancel", onLeave);

    const onVisibility = () => run(!document.hidden);
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? false;
        run(visible);
      },
      { rootMargin: "10% 0px" },
    );
    const ro = new ResizeObserver(resize);
    const onLost = (event: Event) => {
      event.preventDefault();
      run(false);
      canvas.style.opacity = "0";
      stat.style.opacity = "";
    };
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("webglcontextlost", onLost);
    io.observe(canvas);
    ro.observe(canvas);

    return () => {
      disposed = true;
      run(false);
      window.clearTimeout(touchTimer);
      io.disconnect();
      ro.disconnect();
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerdown", onMove);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("pointercancel", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [reducedMotion]);

  return (
    <div
      ref={rootRef}
      className={`fuse ${className}`}
      role="img"
      aria-label={LABEL}
      style={{ position: "relative", width: "100%", aspectRatio: `${WORD_ASPECT} / ${1 + FLAME}`, touchAction: "pan-y" }}
    >
      {/* Le mot en HTML : première image, repli sans WebGL, et la police que le canvas relit. */}
      <span ref={staticRef} aria-hidden="true" className="fuse-static">
        {LABEL}
      </span>
      {!reducedMotion && <canvas ref={canvasRef} aria-hidden="true" className="fuse-canvas" />}
    </div>
  );
}
