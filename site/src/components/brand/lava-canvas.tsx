"use client";

import { useEffect, useId, useRef } from "react";
import { FALLBACK_FRAMES, GLOW_SIGMA, LAVA_COLORS, createLavaRenderer, fallbackPath, type LavaPointer, type LavaVariant } from "./lava-shader";

/**
 * La lave (charte r-04, r-05, r-19) : de grandes masses de matière verte qui
 * entrent par les bords du hero, bougent sur des cycles lents et laissent une
 * goutte suivre le pointeur. Le canvas est transparent hors de la matière, le
 * fond reste au parent. Avant le JavaScript, sans WebGL ou si le GPU lâche,
 * le même contour figé est servi en SVG — le rendu n'est jamais vide.
 */
type LavaCanvasProps = {
  className?: string;
  /** « dark » sur Profondeur (cœur Signal, franges Menthe et Rose), « light » sur Craie ou Aura (franges Lagon et Lilas). */
  variant?: LavaVariant;
  /** La lave s'efface sur les premiers 60 vh de défilement : les capsules prennent le relais. */
  fadeOnScroll?: boolean;
};

/** Amorti du pointeur, par image à 60 Hz (charte r-05). */
const POINTER_EASE = 0.06;
/** Défilement, en fraction de la hauteur de fenêtre, au bout duquel la lave a disparu. */
const FADE_DISTANCE = 0.6;
/** Le fondu de la première image SVG vers la première image WebGL. */
const REVEAL_MS = 800;

// Les deux contours de repli, calculés une fois au chargement du module (quelques millisecondes), identiques côté serveur et client.
const FALLBACK_PATHS = { land: fallbackPath("land"), port: fallbackPath("port") } as const;

/*
 * Les courbes de la lueur intérieure, en tables pour feComponentTransfer : les
 * mêmes que le shader, smoothstep(0,04 ; 0,9) pour le liseré et
 * smoothstep(0 ; 0,62) pour la frange, échantillonnées sur [0, 1].
 */
const RIM_TABLE = "0 0.057 0.27 0.53 0.82 0.98 1";
const FRINGE_TABLE = "0 0.18 0.54 0.9 1 1 1";
/** Côté du carreau de grain du repli, en unités du cadre SVG. */
const GRAIN_TILE = 160;

/**
 * Le contour de la lave à t = 0, en SVG. Même recette que le shader : la
 * part de vide que ramène un flou de la forme éclaire le bord, et la frange
 * apparaît sur les faces tournées dans sa direction (la forme moins sa copie
 * décalée).
 */
function FallbackFrame({ frame, variant, id }: { frame: keyof typeof FALLBACK_FRAMES; variant: LavaVariant; id: string }) {
  const { width: w, height: h, margin: m } = FALLBACK_FRAMES[frame];
  const unit = Math.min(w, h);
  const c = LAVA_COLORS[variant];
  const sigma = GLOW_SIGMA[variant] * unit;
  const offset = unit * 0.075;
  // Direction vers l'extérieur des faces qui portent la frange, en coordonnées SVG (y vers le bas).
  const [ox, oy] = variant === "dark" ? [-0.29, 0.96] : [0.54, 0.84];
  const fid = `${id}-${frame}`;
  // Le shader étend la frange au bas de la section quelle que soit l'orientation du bord (le rose sur le
  // flanc gauche d'un écran large, le Lilas partout en clair) : un second passage du contour, tout en
  // frange, masqué par un dégradé vertical aux mêmes bornes, fait la même chose.
  const lowFringe = variant === "light" || frame === "land";
  const [fadeFrom, fadeTo] = variant === "dark" ? [0.58, 0.9] : [0.38, 0.85];
  const region = { filterUnits: "userSpaceOnUse", x: -m, y: -m, width: w + 2 * m, height: h + 2 * m, colorInterpolationFilters: "sRGB" } as const;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      // Sur écran large la lave est adossée au bord droit : c'est lui qui sert d'ancre quand le cadre change de proportions.
      preserveAspectRatio={frame === "land" ? "xMaxYMid slice" : "xMidYMid slice"}
      className={`absolute inset-0 h-full w-full ${frame === "land" ? "hidden landscape:block" : "block landscape:hidden"}`}
    >
      <defs>
        <filter id={fid} {...region}>
          <feGaussianBlur in="SourceAlpha" stdDeviation={sigma} result="soft" />
          <feComposite in="SourceAlpha" in2="soft" operator="arithmetic" k2={2} k3={-2} result="glow" />
          <feComponentTransfer in="glow" result="rim">
            <feFuncA type="table" tableValues={RIM_TABLE} />
          </feComponentTransfer>
          <feComponentTransfer in="glow" result="band">
            <feFuncA type="table" tableValues={variant === "dark" ? FRINGE_TABLE : RIM_TABLE} />
          </feComponentTransfer>
          <feOffset in="SourceAlpha" dx={-ox * offset} dy={-oy * offset} result="shift" />
          <feComposite in="SourceAlpha" in2="shift" operator="out" result="face" />
          <feGaussianBlur in="face" stdDeviation={offset * 0.8} result="faceBlur" />
          {/* Seules les faces franchement tournées dans la direction gardent la frange, comme le seuil du shader. */}
          <feComponentTransfer in="faceBlur" result="faceSoft">
            <feFuncA type="table" tableValues="0 0.12 0.7 1 1 1" />
          </feComponentTransfer>
          <feComposite in="band" in2="faceSoft" operator="arithmetic" k1={1} result="fringe" />
          {/* Là où la frange prend, le liseré vert lui cède la place au lieu de la délaver. */}
          <feComposite in="rim" in2="fringe" operator="arithmetic" k2={1} k3={-1} result="rimOnly" />
          <feFlood floodColor={c.core} result="core" />
          <feFlood floodColor={c.rim} />
          <feComposite in2="rimOnly" operator="in" result="rimLayer" />
          <feFlood floodColor={c.fringe} />
          <feComposite in2="fringe" operator="in" result="fringeLayer" />
          <feMerge result="paint">
            <feMergeNode in="core" />
            <feMergeNode in="rimLayer" />
            <feMergeNode in="fringeLayer" />
          </feMerge>
          {/* Le grain, figé : un carreau de bruit fin, répété, ramené en niveaux de gris puis ajouté à la
              peinture. Calculer la turbulence sur toute la zone coûterait plus que tout le reste du filtre. */}
          <feTurbulence type="fractalNoise" baseFrequency={1.6} numOctaves={1} seed={7} stitchTiles="stitch" x={0} y={0} width={GRAIN_TILE} height={GRAIN_TILE} />
          <feTile />
          <feColorMatrix type="matrix" values="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 1" result="grain" />
          <feComposite in="paint" in2="grain" operator="arithmetic" k2={1} k3={0.34} k4={-0.17} />
          <feComposite in2="SourceAlpha" operator="in" />
        </filter>
        {lowFringe && (
          <>
            <filter id={`${fid}-low`} {...region}>
              <feGaussianBlur in="SourceAlpha" stdDeviation={sigma} result="soft" />
              <feComposite in="SourceAlpha" in2="soft" operator="arithmetic" k2={2} k3={-2} result="glow" />
              <feComponentTransfer in="glow" result="band">
                <feFuncA type="table" tableValues={variant === "dark" ? FRINGE_TABLE : RIM_TABLE} />
              </feComponentTransfer>
              <feFlood floodColor={c.fringe} />
              <feComposite in2="band" operator="in" result="pink" />
              <feTurbulence type="fractalNoise" baseFrequency={1.6} numOctaves={1} seed={11} stitchTiles="stitch" x={0} y={0} width={GRAIN_TILE} height={GRAIN_TILE} />
              <feTile />
              <feColorMatrix type="matrix" values="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 1" result="grain" />
              <feComposite in="pink" in2="grain" operator="arithmetic" k2={1} k3={0.34} k4={-0.17} />
              <feComposite in2="band" operator="in" />
            </filter>
            <linearGradient id={`${fid}-fade`} gradientUnits="userSpaceOnUse" x1="0" y1={h * fadeFrom} x2="0" y2={h * fadeTo}>
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="1" stopColor="#fff" stopOpacity="0.85" />
            </linearGradient>
            <mask id={`${fid}-mask`} maskUnits="userSpaceOnUse" x={-m} y={-m} width={w + 2 * m} height={h + 2 * m}>
              <rect x={-m} y={0} width={w + 2 * m} height={h + m} fill={`url(#${fid}-fade)`} />
            </mask>
          </>
        )}
      </defs>
      <path d={FALLBACK_PATHS[frame]} fill="#000" filter={`url(#${fid})`} />
      {lowFringe && (
        <g mask={`url(#${fid}-mask)`}>
          <path d={FALLBACK_PATHS[frame]} fill="#000" filter={`url(#${fid}-low)`} />
        </g>
      )}
    </svg>
  );
}

export function LavaCanvas({ className = "", variant = "dark", fadeOnScroll = true }: LavaCanvasProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fallbackRef = useRef<HTMLDivElement | null>(null);
  // Un identifiant de filtre propre à l'instance, sans les caractères que `url(#…)` digère mal.
  const filterId = `lava-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const fallback = fallbackRef.current;
    if (!root || !canvas || !fallback) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    let reduced = motionQuery.matches;

    /* --- Ce qui ne dépend pas du GPU : le fondu au défilement et le pointeur.
       Tout s'écrit dans des variables lues par la boucle, jamais dans un état
       React : rien ne re-rend. */
    let fade = 1;
    const applyFade = () => {
      // En mouvement réduit, rien ne bouge, l'opacité non plus.
      const next = fadeOnScroll && !reduced ? 1 - Math.min(1, Math.max(0, window.scrollY / (FADE_DISTANCE * window.innerHeight))) : 1;
      if (next === fade) return;
      fade = next;
      root.style.opacity = fade >= 1 ? "" : fade.toFixed(3);
    };
    let rect = root.getBoundingClientRect();
    let pending = 0;
    const onScrollOrResize = () => {
      if (pending) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        rect = root.getBoundingClientRect();
        applyFade();
      });
    };
    const pointer = { x: 0, y: 0, active: false };
    const onPointer = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    };
    // Un doigt levé n'est plus un pointeur, une souris sortie de la fenêtre non plus ; une souris relâchée, si.
    const onPointerEnd = (e: PointerEvent) => {
      if (e.type === "pointerout" ? !e.relatedTarget : e.pointerType !== "mouse") pointer.active = false;
    };
    const onBlur = () => {
      pointer.active = false;
    };
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });
    window.addEventListener("pointerup", onPointerEnd, { passive: true });
    window.addEventListener("pointercancel", onPointerEnd, { passive: true });
    document.addEventListener("pointerout", onPointerEnd, { passive: true });
    window.addEventListener("blur", onBlur);
    applyFade();
    const removeInputs = () => {
      cancelAnimationFrame(pending);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      document.removeEventListener("pointerout", onPointerEnd);
      window.removeEventListener("blur", onBlur);
      root.style.opacity = "";
    };

    /* --- Le GPU. Sans WebGL, le contour SVG reste : c'est le repli prévu. */
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
    const renderer = gl ? createLavaRenderer(gl, variant) : null;
    if (!gl || !renderer) return removeInputs;

    const lavaPointer: LavaPointer = { x: 0.5, y: 0.5, presence: 0 };
    let time = 0;
    const draw = () => {
      // Le grain change 24 fois par seconde, la cadence d'une pellicule : à 60 il fourmille comme un écran neigeux.
      renderer.draw(time, reduced || lavaPointer.presence < 0.001 ? null : lavaPointer, reduced ? 0 : (Math.floor(time * 24) % 61) * 7.31);
    };

    let raf = 0;
    let last = 0;
    let running = false;
    let visible = false;
    let painted = false;
    let revealTimer = 0;
    // Garde-fou : sous 20 images par seconde en moyenne sur les quarante premières (rendu logiciel,
    // appareil faible), on garde la dernière image, immobile — un fond figé vaut mieux qu'une page qui rame.
    let frozen = false;
    let samples = 0;
    let slowMs = 0;
    const fps = coarse ? 30 : 60;

    // Le shader coûte par pixel : DPR plafonné à 1,5 et quatre millions de pixels au plus. Au doigt, 1,6 :
    // en dessous, le canvas agrandi épaissit le grain du bord jusqu'à le faire pelucher.
    const resize = () => {
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      let scale = Math.min(window.devicePixelRatio || 1, coarse ? 1.6 : 1.5);
      if (cw * ch * scale * scale > 4e6) scale = Math.sqrt(4e6 / Math.max(1, cw * ch));
      const w = Math.max(1, Math.round(cw * scale));
      const h = Math.max(1, Math.round(ch * scale));
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
      // Boucle arrêtée (mouvement réduit, machine trop lente) : l'image fixe suit quand même la taille.
      if (!running && painted) draw();
    };

    const reveal = () => {
      painted = true;
      canvas.style.opacity = "1";
      // Le SVG ne part qu'une fois le fondu fini : le retirer avant laisserait un trou le temps de la transition.
      revealTimer = window.setTimeout(() => {
        fallback.style.display = "none";
      }, reduced ? 0 : REVEAL_MS);
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // Cadence plafonnée : un écran à 120 Hz ne double pas le coût, et la lave est lente — 30 images suffisent au doigt.
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
      // La goutte du pointeur : amortie à 0,06 par image, indépendamment de la cadence réelle.
      const ease = 1 - Math.pow(1 - POINTER_EASE, dt * 60);
      const inside = pointer.active && rect.width > 0 && pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= rect.top && pointer.y <= rect.bottom;
      if (inside) {
        const tx = (pointer.x - rect.left) / rect.width;
        const ty = 1 - (pointer.y - rect.top) / rect.height;
        // Elle naît sous le pointeur au lieu de traverser l'écran depuis sa dernière position.
        if (lavaPointer.presence < 0.01) {
          lavaPointer.x = tx;
          lavaPointer.y = ty;
        }
        lavaPointer.x += (tx - lavaPointer.x) * ease;
        lavaPointer.y += (ty - lavaPointer.y) * ease;
      }
      lavaPointer.presence += ((inside ? 1 : 0) - lavaPointer.presence) * ease;
      // Effacée par le défilement : rien à peindre, la boucle attend.
      if (fade <= 0.002) return;
      draw();
      if (!painted) reveal();
    };

    // Une seule boucle, qui ne tourne que visible, onglet au premier plan, mouvement autorisé et machine à la hauteur.
    const run = () => {
      const next = visible && !document.hidden && !reduced && !frozen;
      if (next === running) return;
      running = next;
      if (running) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      } else cancelAnimationFrame(raf);
    };
    // Mouvement réduit : une image, la même que le repli (t = 0), et plus rien ne bouge.
    const paintStill = () => {
      draw();
      if (!painted) reveal();
    };

    const onMotion = () => {
      reduced = motionQuery.matches;
      canvas.style.transition = reduced ? "none" : "";
      applyFade();
      run();
      if (reduced) paintStill();
    };
    const onVisibility = () => run();
    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      run();
    });
    const ro = new ResizeObserver(() => {
      resize();
      onScrollOrResize();
    });
    // Contexte perdu (GPU réinitialisé) : retour au contour SVG, pas un rectangle vide.
    const onLost = (e: Event) => {
      e.preventDefault();
      frozen = true;
      run();
      window.clearTimeout(revealTimer);
      canvas.style.opacity = "0";
      fallback.style.display = "";
    };

    if (reduced) canvas.style.transition = "none";
    resize();
    if (reduced) paintStill();
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("webglcontextlost", onLost);
    motionQuery.addEventListener("change", onMotion);
    io.observe(root);
    ro.observe(canvas);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(revealTimer);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      motionQuery.removeEventListener("change", onMotion);
      removeInputs();
      // Les ressources GPU sont rendues, pas le contexte : le perdre exprès le laisserait perdu pour le
      // montage suivant sur le même canvas (double montage du mode strict de React, changement de variante).
      renderer.dispose();
    };
  }, [variant, fadeOnScroll]);

  return (
    <div ref={rootRef} aria-hidden="true" className={`pointer-events-none overflow-hidden ${className}`}>
      <div ref={fallbackRef} className="absolute inset-0">
        <FallbackFrame frame="land" variant={variant} id={filterId} />
        <FallbackFrame frame="port" variant={variant} id={filterId} />
      </div>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full opacity-0"
        style={{ transition: `opacity ${REVEAL_MS}ms cubic-bezier(.2,.8,.2,1)` }}
      />
    </div>
  );
}
