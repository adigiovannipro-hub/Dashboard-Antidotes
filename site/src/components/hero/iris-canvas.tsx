"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Fond du hero : bulles de verre iridescentes sur l'encre, un seul fragment
 * shader (métaballes + reflet « thin film » dont la teinte suit la normale).
 * Le pointeur attire la bulle principale, le défilement secoue le champ. Sans
 * WebGL, le dégradé CSS rendu côté serveur reste — c'est aussi la première
 * image avant l'hydratation, d'où le fondu du canvas.
 */
type Inputs = {
  pointerX: number;
  pointerY: number;
  hasPointer: boolean;
  /** Pixels défilés cumulés : la boucle en prend la différence, sans rien écrire ici. */
  scrollTotal: number;
  rect: { left: number; top: number; width: number; height: number };
};

/** Tokens lus au démarrage ; repli sur les valeurs de tokens.css s'ils manquent. */
const TOKENS: Array<[string, string]> = [["--iris-cyan", "#7fd9ff"], ["--iris-violet", "#8d7bff"], ["--iris-pink", "#ff6fae"], ["--iris-amber", "#ffb866"], ["--ink-0", "#0a0b0f"]];

const VERT = `attribute vec2 a_pos;void main(){gl_Position=vec4(a_pos,0.,1.);}`;

// Un seul triangle couvre l'écran ; tout le dessin est dans ce shader.
const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_res;uniform float u_time;uniform vec2 u_mouse;uniform float u_mouseOn;
uniform float u_turb;uniform float u_push;uniform float u_intensity;uniform vec3 u_pal[4];uniform vec3 u_ink;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
// Palette cyclique cyan → violet → rose → ambre → cyan.
vec3 iris(float h){float x=fract(h)*4.;vec3 c=mix(u_pal[0],u_pal[1],clamp(x,0.,1.));
c=mix(c,u_pal[2],clamp(x-1.,0.,1.));c=mix(c,u_pal[3],clamp(x-2.,0.,1.));return mix(c,u_pal[0],clamp(x-3.,0.,1.));}
// Métaballe : champ r²/d², gradient cumulé vers l'extérieur pour la normale.
void ball(vec2 p,vec2 c,float r,inout float f,inout vec2 g){vec2 d=p-c;float d2=dot(d,d)+1e-4;float r2=r*r;f+=r2/d2;g+=2.*r2*d/(d2*d2);}
// Brume irisée très faible : c'est elle que les bulles réfractent.
vec3 haze(vec2 q){return iris(q.x*.3+q.y*.15+u_time*.01)*.045;}
void main(){
vec2 uv=gl_FragCoord.xy/u_res;float aspect=u_res.x/u_res.y;vec2 ext=vec2(aspect,1.)*.5;
vec2 p=(uv-.5)*vec2(aspect,1.);float t=u_time;
// Turbulence du défilement : un cisaillement sinusoïdal tord le champ.
p+=vec2(sin(p.y*5.+t*2.3),cos(p.x*4.-t*1.9))*u_turb*.05;
vec2 m=(u_mouse-.5)*vec2(aspect,1.);float rs=clamp(aspect*1.25,.5,1.);
// Bulle principale : sa dérive est attirée par le pointeur, déjà lissé côté JS.
// Sur un écran large, la bulle principale vit à droite de la colonne de texte ; au doigt, le pointeur l'y ramène.
vec2 c0=mix(vec2(.3*smoothstep(.9,1.4,aspect)+sin(t*.23)*.4,cos(t*.19)*.4)*ext,m,u_mouseOn*.6);vec2 push=vec2(0.,u_push);
float f=0.;vec2 g=vec2(0.);
ball(p,c0+push*.6,.30*rs,f,g);
ball(p,vec2(-.75+sin(t*.13)*.2,.45+cos(t*.11)*.3)*ext+push,.20*rs,f,g);
ball(p,vec2(.8+cos(t*.17)*.18,-.4+sin(t*.14)*.25)*ext+push*1.3,.17*rs,f,g);
ball(p,vec2(-.3+sin(t*.09)*.4,-.6+cos(t*.12)*.2)*ext+push*.8,.14*rs,f,g);
ball(p,vec2(.4+cos(t*.15)*.3,.65+sin(t*.1)*.25)*ext+push*1.1,.11*rs,f,g);
// Le pointeur gonfle le champ autour de lui sans former sa propre bulle.
vec2 dm=p-m;float q=1.+40.*dot(dm,dm);f+=.4*u_mouseOn/q;g+=32.*u_mouseOn*dm/(q*q);
float mask=smoothstep(.94,1.06,f);
// Dôme (normale couchée au bord, dressée au cœur) ; thin film : la teinte suit la normale et l'épaisseur.
float k=clamp(1.-1./max(f,1e-3),0.,1.);vec2 dir=normalize(g+1e-5);
vec3 n=normalize(vec3(dir*sqrt(1.-k),sqrt(k)));float fres=pow(1.-n.z,2.5);
float hue=fres*.7+n.x*.22+n.y*.14+p.x*.12+t*.012;vec3 film=iris(hue);
float spec=pow(max(dot(n,normalize(vec3(-.45,.65,.62))),0.),60.)*.7+pow(max(dot(n,normalize(vec3(.5,-.4,.75))),0.),24.)*.25;
vec3 bg=u_ink+haze(uv)+iris(hue+.3)*smoothstep(.3,1.,f)*.1;
vec3 body=u_ink+haze(uv+n.xy*.1)*1.8+film*(.08+.9*fres)+vec3(spec);
vec3 col=u_ink+(mix(bg,body,mask)-u_ink)*u_intensity;
// Grain, puis vignette vers le bas : le texte du hero repose sur de l'encre.
col+=(hash(gl_FragCoord.xy+fract(t)*61.)-.5)*.022;
float vig=smoothstep(.1,.7,uv.y)*(1.-.35*smoothstep(.6,1.3,length(p/ext)));
gl_FragColor=vec4(mix(u_ink,col,.2+.8*vig),1.);}`;

function readColor(style: CSSStyleDeclaration, name: string, fallback: string): number[] {
  const raw = style.getPropertyValue(name).trim() || fallback;
  const v = parseInt(/^#([0-9a-f]{6})$/i.exec(raw)?.[1] ?? fallback.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => c / 255);
}

/** Compile, lie, pose le triangle plein cadre. `null` si le GPU refuse. */
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
 * Écouteurs d'entrée (pointeur — souris et toucher —, défilement, géométrie du
 * canvas). Tout s'écrit dans une ref que ce hook possède, jamais dans un état
 * React : la boucle lit, rien ne re-rend.
 */
function useInputListeners(canvasRef: RefObject<HTMLCanvasElement | null>): RefObject<Inputs> {
  const inputsRef = useRef<Inputs>({ pointerX: 0, pointerY: 0, hasPointer: false, scrollTotal: 0, rect: { left: 0, top: 0, width: 0, height: 0 } });
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = inputsRef.current;
    const measure = () => {
      const r = canvas.getBoundingClientRect();
      s.rect = { left: r.left, top: r.top, width: r.width, height: r.height };
    };
    const onMove = (e: Event) => {
      const p = e as PointerEvent;
      s.pointerX = p.clientX;
      s.pointerY = p.clientY;
      s.hasPointer = true;
    };
    // Un doigt levé n'est plus un pointeur, une souris sortie de la fenêtre non plus ; une souris relâchée, si.
    const onLeave = (e: Event) => {
      const p = e as PointerEvent;
      if (e.type === "pointerout" ? !p.relatedTarget : p.pointerType !== "mouse") s.hasPointer = false;
    };
    let lastY = window.scrollY;
    const onScroll = () => {
      s.scrollTotal += window.scrollY - lastY;
      lastY = window.scrollY;
      measure();
    };
    measure();
    const subs: Array<[EventTarget, string, (e: Event) => void]> = [
      [window, "pointermove", onMove],
      [window, "pointerdown", onMove],
      [window, "pointerup", onLeave],
      [window, "pointercancel", onLeave],
      [document, "pointerout", onLeave],
      [window, "blur", onLeave],
      [window, "scroll", onScroll],
      [window, "resize", measure],
    ];
    subs.forEach(([t, type, fn]) => t.addEventListener(type, fn, { passive: true }));
    return () => subs.forEach(([t, type, fn]) => t.removeEventListener(type, fn));
  }, [canvasRef]);
  return inputsRef;
}

// Repli CSS (et première image avant l'hydratation) : trois halos aux teintes des tokens, même vignette d'encre.
const FALLBACK = [["violet", "32% 38%", 36], ["pink", "70% 56%", 28], ["cyan", "58% 16%", 22]]
  .map(([c, at, a]) => `radial-gradient(40% 48% at ${at}, color-mix(in srgb, var(--iris-${c}) ${a}%, transparent), transparent 70%)`)
  .concat("linear-gradient(transparent 45%, var(--ink-0))", "var(--ink-0)")
  .join(", ");

export function IrisCanvas({ className = "", intensity = 1 }: { className?: string; intensity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fallbackRef = useRef<HTMLDivElement | null>(null);
  const intensityRef = useRef(1);
  const inputsRef = useInputListeners(canvasRef);

  // Par une ref : changer l'intensité ne reconstruit pas le contexte GL.
  useEffect(() => {
    intensityRef.current = Math.min(1, Math.max(0, intensity));
  }, [intensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const fallback = fallbackRef.current;
    if (!canvas || !fallback) return;
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
    const program = gl && buildProgram(gl);
    if (!gl || !program) return;
    const u = (name: string) => gl.getUniformLocation(program, name);
    const [uRes, uTime, uMouse, uMouseOn, uTurb, uPush, uIntensity] = ["u_res", "u_time", "u_mouse", "u_mouseOn", "u_turb", "u_push", "u_intensity"].map(u);
    // Les couleurs viennent des tokens : le shader ne porte aucune valeur à lui.
    const style = getComputedStyle(document.documentElement);
    const colors = TOKENS.map(([name, hex]) => readColor(style, name, hex));
    gl.uniform3fv(u("u_pal"), new Float32Array(colors.slice(0, 4).flat()));
    gl.uniform3fv(u("u_ink"), new Float32Array(colors[4]));

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = motionQuery.matches;
    const onMotion = () => {
      reduced = motionQuery.matches;
      /* En mouvement réduit, une image puis l'arrêt : comme les pilules, le bandeau et les vidéos. */
      if (reduced) run(false);
      else run(true);
    };
    // DPR plafonné à 1,25 puis 0,8× (0,6× au doigt) — le shader coûte par pixel, et un fond
    // de bulles floues ne montre pas la différence ; c'est ce qui le rend abordable sur un portable.
    const scale = Math.min(window.devicePixelRatio || 1, coarse ? 1 : 1.25) * (coarse ? 0.6 : 0.8);
    const fps = reduced ? 30 : coarse ? 40 : 60;
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

    // État simulé, lissé image par image : le pointeur a de l'inertie, le défilement
    // devient une vitesse qui s'amortit. Rien ne saute.
    const sim = { x: 0.5, y: 0.5, on: 0, vel: 0, time: 0, scroll: 0 };
    let raf = 0;
    let last = 0;
    let running = false;
    let visible = false;
    let painted = false;
    // Garde-fou : sans GPU (rendu logiciel, appareil faible), la boucle tombe sous 20 images
    // par seconde et mange le fil principal. On garde alors la dernière image, immobile —
    // un fond figé vaut mieux qu'une page qui rame. Mesuré sur les quarante premières images.
    let frozen = false;
    let samples = 0;
    let slowMs = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // Cadence plafonnée : un 120 Hz ne double pas le coût ; en mouvement réduit, 30 suffisent.
      if (now - last < 1000 / fps - 2) return;
      const dt = Math.min((now - last) / 1000, 0.1);
      if (painted && samples < 40) {
        samples += 1;
        slowMs += now - last;
        if (samples === 40 && slowMs / samples > 50) {
          frozen = true;
          run(false);
          return;
        }
      }
      last = now;
      const s = inputsRef.current;
      const r = s.rect;
      if (s.hasPointer && r.width > 0 && r.height > 0) {
        const follow = 1 - Math.exp(-dt * (reduced ? 1.5 : 3.5));
        sim.x += ((s.pointerX - r.left) / r.width - sim.x) * follow;
        sim.y += (1 - (s.pointerY - r.top) / r.height - sim.y) * follow;
      }
      sim.on += ((s.hasPointer ? 1 : 0) - sim.on) * (1 - Math.exp(-dt * 2.5));
      if (!reduced) sim.vel += s.scrollTotal - sim.scroll;
      sim.scroll = s.scrollTotal;
      sim.vel *= Math.exp(-dt * 4);
      sim.time += dt * (reduced ? 0.12 : 1);

      gl.uniform1f(uTime, sim.time);
      gl.uniform2f(uMouse, sim.x, sim.y);
      gl.uniform1f(uMouseOn, sim.on * (reduced ? 0 : 1));
      gl.uniform1f(uTurb, Math.min(Math.abs(sim.vel) / 600, 1));
      gl.uniform1f(uPush, Math.max(-1, Math.min(1, sim.vel / 900)) * 0.12);
      gl.uniform1f(uIntensity, intensityRef.current);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!painted) {
        // Première image rendue : le canvas se révèle, le dégradé CSS peut partir.
        painted = true;
        canvas.style.opacity = "1";
        fallback.style.display = "none";
        if (reduced) run(false);
      }
    };
    // Une seule boucle, qui ne tourne que visible et onglet au premier plan.
    const run = (on: boolean) => {
      if (on === running) return;
      running = on && visible && !document.hidden && !frozen;
      if (running) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      } else cancelAnimationFrame(raf);
    };
    const onVisibility = () => run(!document.hidden);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      run(visible);
    });
    const ro = new ResizeObserver(resize);
    // Contexte perdu (GPU réinitialisé) : retour au dégradé CSS, pas un rectangle noir.
    const onLost = (e: Event) => {
      e.preventDefault();
      run(false);
      canvas.style.opacity = "0";
      fallback.style.display = "";
    };
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("webglcontextlost", onLost);
    motionQuery.addEventListener("change", onMotion);
    io.observe(canvas);
    ro.observe(canvas);

    return () => {
      run(false);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      motionQuery.removeEventListener("change", onMotion);
      gl.deleteProgram(program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [inputsRef]);

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <div ref={fallbackRef} className="absolute inset-0" style={{ background: FALLBACK }} />
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full opacity-0 transition-opacity duration-(--motion-slow)" />
    </div>
  );
}
