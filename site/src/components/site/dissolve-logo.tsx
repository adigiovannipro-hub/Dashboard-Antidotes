"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";

/**
 * Le logotype en très grand, qui s'effervesce. Le haut du mot reste net ; le
 * bas se désagrège en filaments iridescents et en bulles qui s'échappent — le
 * visuel « SOUL » de la DA, appliqué à « antidotes ».
 *
 * Deux couches, pour rester léger :
 * - un filtre SVG (feTurbulence + feDisplacementMap) qui déchire le bas des
 *   lettres, sous un masque en dégradé vertical dont la ligne de fondu monte
 *   avec la dissolution ;
 * - un canvas 2D par-dessus, ≤ 400 particules recyclées, nées sur l'encre des
 *   lettres (échantillonnée une fois sur un canvas hors écran) et qui montent
 *   en s'évanouissant.
 *
 * La dissolution suit le défilement : 0 quand le mot entre dans l'écran, 1
 * quand il y est entier ou que la page est en bas, lissée image par image.
 * Rien ne passe par l'état React dans la boucle : les attributs SVG et le
 * canvas sont écrits à la main. Hors écran, tout s'arrête (rAF et SMIL). En
 * mouvement réduit : dissolution légère figée, sans particules. Sans canvas
 * 2D : le filtre seul.
 *
 * Intégration : `<DissolveLogo className="mx-auto" />` dans le pied de page,
 * avec de l'air au-dessus — les bulles débordent de la boîte du mot (44 unités
 * sur 36, soit ~120 % de sa hauteur) et passent par-dessus ce qui précède.
 */

type Direction = "up" | "down";

export type DissolveLogoProps = {
  className?: string;
  /** Le mot affiché. « antidotes » garde l'anneau iridescent du logotype ; un autre mot est rendu en texte seul. */
  label?: string;
  /** Sens de fuite de la matière. Le bas des lettres se dissout dans les deux cas : vers le haut, des bulles ; vers le bas, du sable. */
  direction?: Direction;
};

/* La boîte du logotype, celle de `Logo` : 188 × 36, ligne de base à 27. Les
   mêmes nombres, pour que le mot en grand soit le mot du rail, pas une copie. */
const BRAND_LABEL = "antidotes";
const BRAND_WIDTH = 188;
const BOX_HEIGHT = 36;
const BASELINE = 27;
const FONT_SIZE = 30;
const FONT_WEIGHT = 500;
const LETTER_SPACING = -1.1;
const FONT_FAMILY = "var(--font-geist), ui-sans-serif, system-ui";
const RING = { cx: 94, cy: 18, r: 9.5, strokeWidth: 4.5 };
const HIGHLIGHT = { cx: 91, cy: 14.5, r: 1.6 };

/* Hauteur, en unités de la boîte, que les particules parcourent hors du mot. */
const TRAVEL = 44;
const MAX_PARTICLES = 400;
const MAX_DPR = 1.5;
/* Pixels par unité pour l'échantillonnage de l'encre : 2 suffit, les points
   servent de lieux de naissance, pas de rendu. */
const SAMPLE_DENSITY = 2;
/* En mouvement réduit, une dissolution légère et figée. */
const STATIC_PROGRESS = 0.35;

const IRIS_TOKENS = ["--iris-cyan", "--iris-violet", "--iris-pink", "--iris-amber"] as const;
/* Repli si les tokens ne sont pas lisibles (composant monté hors du site). */
const IRIS_FALLBACK = ["#7fd9ff", "#8d7bff", "#ff6fae", "#ffb866"] as const;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const getReducedMotion = () => window.matchMedia(REDUCED_MOTION_QUERY).matches;
const getServerReducedMotion = () => false;

/* Ce que la dissolution vaut, à une progression donnée. Pure, pour que le
   rendu initial (JSX) et la boucle (attributs) écrivent les mêmes nombres. */
type DissolveValues = {
  fineScale: number;
  coarseScale: number;
  fadeTop: number;
  fadeBottom: number;
  loseOpacity: number;
};

function dissolveValues(progress: number): DissolveValues {
  return {
    fineScale: 1 + progress * 14,
    coarseScale: 2 + progress * 22,
    /* À 0, la ligne de fondu passe sous l'anneau, qui descend à 29,75 — plus
       bas que la ligne de base : rogné, vu à l'écran. À 1, elle part juste
       sous la hauteur d'x : le haut reste net. */
    fadeTop: BASELINE + 4 - progress * 19,
    fadeBottom: BASELINE + 5 - progress * 3,
    loseOpacity: Math.min(1, progress * 1.6),
  };
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/* Un mot hors marque n'a pas de métriques connues : on estime sa largeur et
   on force le texte dessus (`textLength`, espacement seul) pour que SVG et
   canvas parlent de la même boîte. */
function estimatedWidth(label: string): number {
  return Math.max(120, Math.round(Array.from(label).length * 17.5));
}

/* ---------------------------------------------------------------------------
   L'encre des lettres, échantillonnée.
   Les glyphes sont redessinés sur un canvas hors écran, un par un, à la
   position que le SVG leur a donnée (`getExtentOfChar`) : c'est ce qui aligne
   les particules sur les vraies lettres, quelle que soit la police chargée.
   --------------------------------------------------------------------------- */
type InkPoints = { xs: Float32Array; ys: Float32Array; count: number };

function sampleInk(group: SVGGElement, viewWidth: number, withRing: boolean): InkPoints | null {
  const nodes = Array.from(group.querySelectorAll("text"));
  if (nodes.length === 0) return null;
  const width = Math.ceil(viewWidth * SAMPLE_DENSITY);
  const height = Math.ceil(BOX_HEIGHT * SAMPLE_DENSITY);
  const offscreen = document.createElement("canvas");
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.scale(SAMPLE_DENSITY, SAMPLE_DENSITY);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.textBaseline = "alphabetic";
  try {
    for (const node of nodes) {
      ctx.font = `${FONT_WEIGHT} ${FONT_SIZE}px ${getComputedStyle(node).fontFamily}`;
      const chars = Array.from(node.textContent ?? "");
      const count = Math.min(chars.length, node.getNumberOfChars());
      for (let i = 0; i < count; i++) {
        ctx.fillText(chars[i], node.getExtentOfChar(i).x, BASELINE);
      }
    }
  } catch {
    /* Un texte non rendu (ancêtre masqué) refuse ses extents : pas de particules, le filtre seul. */
    return null;
  }
  if (withRing) {
    ctx.lineWidth = RING.strokeWidth;
    ctx.beginPath();
    ctx.arc(RING.cx, RING.cy, RING.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const { data } = ctx.getImageData(0, 0, width, height);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 96) continue;
    const pixel = (i - 3) / 4;
    xs.push(((pixel % width) + 0.5) / SAMPLE_DENSITY);
    ys.push((Math.floor(pixel / width) + 0.5) / SAMPLE_DENSITY);
  }
  if (xs.length === 0) return null;
  return { xs: Float32Array.from(xs), ys: Float32Array.from(ys), count: xs.length };
}

/* ---------------------------------------------------------------------------
   Les particules : des tableaux typés recyclés, jamais d'objet alloué dans la
   boucle. `alive` porte les indices vivants en tête ; une mort est un échange
   avec le dernier vivant.
   --------------------------------------------------------------------------- */
type ParticlePool = {
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  age: Float32Array;
  life: Float32Array;
  size: Float32Array;
  phase: Float32Array;
  color: Uint8Array;
  /* 0 = bulle, 1 = filament. */
  kind: Uint8Array;
  alive: Uint16Array;
  count: number;
};

function createParticlePool(): ParticlePool {
  const alive = new Uint16Array(MAX_PARTICLES);
  for (let i = 0; i < MAX_PARTICLES; i++) alive[i] = i;
  return {
    x: new Float32Array(MAX_PARTICLES),
    y: new Float32Array(MAX_PARTICLES),
    vx: new Float32Array(MAX_PARTICLES),
    vy: new Float32Array(MAX_PARTICLES),
    age: new Float32Array(MAX_PARTICLES),
    life: new Float32Array(MAX_PARTICLES),
    size: new Float32Array(MAX_PARTICLES),
    phase: new Float32Array(MAX_PARTICLES),
    color: new Uint8Array(MAX_PARTICLES),
    kind: new Uint8Array(MAX_PARTICLES),
    alive,
    count: 0,
  };
}

function spawnParticle(pool: ParticlePool, x: number, y: number, viewWidth: number, travelSign: number) {
  if (pool.count >= MAX_PARTICLES) return;
  const p = pool.alive[pool.count];
  pool.count += 1;
  const filament = Math.random() < 0.3;
  const r = Math.random();
  pool.x[p] = x;
  pool.y[p] = y;
  pool.vx[p] = (Math.random() - 0.5) * 2;
  /* Les filaments filent plus vite que les bulles : deux vitesses, deux matières. */
  pool.vy[p] = travelSign * (filament ? 10 + r * 14 : 5 + r * 11);
  pool.age[p] = 0;
  pool.life[p] = 1.6 + Math.random() * 2.2;
  pool.size[p] = filament ? 0.25 + Math.random() * 0.5 : 0.2 + r * r * 0.9;
  pool.phase[p] = Math.random() * Math.PI * 2;
  pool.kind[p] = filament ? 1 : 0;
  /* La teinte suit la position dans le mot, comme le dégradé : cyan à gauche,
     ambre à droite, avec un peu de jeu pour que ça scintille. */
  const hue = Math.floor((x / viewWidth) * 4 + (Math.random() - 0.5) * 1.2);
  pool.color[p] = Math.min(3, Math.max(0, hue));
}

function killParticle(pool: ParticlePool, slot: number) {
  const last = pool.count - 1;
  const p = pool.alive[slot];
  pool.alive[slot] = pool.alive[last];
  pool.alive[last] = p;
  pool.count = last;
}

/* ---------------------------------------------------------------------------
   Le mot lui-même, rendu trois fois (deux copies déchirées, une nette).
   --------------------------------------------------------------------------- */
type WordmarkProps = {
  label: string;
  isBrand: boolean;
  viewWidth: number;
  fill: string;
  ringStroke: string;
  highlight?: boolean;
};

function Wordmark({ label, isBrand, viewWidth, fill, ringStroke, highlight = false }: WordmarkProps) {
  const text = {
    y: BASELINE,
    fontFamily: FONT_FAMILY,
    fontSize: FONT_SIZE,
    fontWeight: FONT_WEIGHT,
    letterSpacing: LETTER_SPACING,
    fill,
  };
  if (!isBrand) {
    return (
      <text x="0" textLength={viewWidth} lengthAdjust="spacing" {...text}>
        {label}
      </text>
    );
  }
  return (
    <>
      <text x="0" {...text}>
        antid
      </text>
      <circle cx={RING.cx} cy={RING.cy} r={RING.r} stroke={ringStroke} strokeWidth={RING.strokeWidth} />
      {highlight && <circle cx={HIGHLIGHT.cx} cy={HIGHLIGHT.cy} r={HIGHLIGHT.r} fill="white" opacity="0.85" />}
      <text x="109" {...text}>
        tes
      </text>
    </>
  );
}

export function DissolveLogo({ className = "", label = BRAND_LABEL, direction = "up" }: DissolveLogoProps) {
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getServerReducedMotion);
  /* `useId` rend des caractères que `url(#…)` n'aime pas toujours : on les retire. */
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ids = {
    iris: `${id}-iris`,
    fine: `${id}-fine`,
    coarse: `${id}-coarse`,
    keep: `${id}-keep`,
    lose: `${id}-lose`,
    keepGradient: `${id}-keep-gradient`,
    loseGradient: `${id}-lose-gradient`,
  };
  const isBrand = label === BRAND_LABEL;
  const viewWidth = isBrand ? BRAND_WIDTH : estimatedWidth(label);
  const iris = `url(#${ids.iris})`;
  const initial = dissolveValues(reducedMotion ? STATIC_PROGRESS : 0);

  /* Le bruit est étiré verticalement (fréquence x haute, y basse) : les
     bandes de déplacement deviennent des filaments et non des vagues. La
     matrice tasse le canal rouge (déplacement horizontal) et décale le vert
     dans le sens de fuite : la matière déchirée penche vers où elle s'en va. */
  const verticalBias = direction === "up" ? 0.3 : -0.1;
  const flowMatrix = `0.3 0 0 0 0.35  0 0.8 0 0 ${verticalBias}  0 0 1 0 0  0 0 0 1 0`;

  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sharpRef = useRef<SVGGElement>(null);
  const loseRef = useRef<SVGGElement>(null);
  const fineRef = useRef<SVGFEDisplacementMapElement>(null);
  const coarseRef = useRef<SVGFEDisplacementMapElement>(null);
  const keepGradientRef = useRef<SVGLinearGradientElement>(null);
  const loseGradientRef = useRef<SVGLinearGradientElement>(null);

  useEffect(() => {
    if (reducedMotion) return;
    const root = rootRef.current;
    const svg = svgRef.current;
    const sharp = sharpRef.current;
    const lose = loseRef.current;
    const fine = fineRef.current;
    const coarse = coarseRef.current;
    const gradients = [keepGradientRef.current, loseGradientRef.current];
    if (!root || !svg || !sharp || !lose || !fine || !coarse) return;

    const cleanups: Array<() => void> = [];
    const travelSign = direction === "up" ? -1 : 1;

    /* Les couleurs viennent des tokens, lues une fois : le canvas ne sait pas
       résoudre `var()`. */
    const rootStyle = getComputedStyle(root);
    const colors = IRIS_TOKENS.map((token, index) => rootStyle.getPropertyValue(token).trim() || IRIS_FALLBACK[index]);

    /* --- Le canvas. Sans contexte 2D, la dissolution se joue au filtre seul. --- */
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d") ?? null;
    const pool = ctx ? createParticlePool() : null;
    let ink: InkPoints | null = null;
    /* Pixels de canvas par unité de la boîte, et décalage de l'origine : le
       canvas déborde au-dessus du mot quand la matière monte. */
    let unitScale = 1;
    const originY = direction === "up" ? TRAVEL : 0;

    const resize = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      unitScale = (rect.width / viewWidth) * dpr;
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);
    cleanups.push(() => resizeObserver.disconnect());

    /* L'encre s'échantillonne une fois la police arrivée : avant, les
       glyphes mesurés seraient ceux du repli système. */
    let disposed = false;
    const sample = () => {
      if (disposed || !ctx) return;
      ink = sampleInk(sharp, viewWidth, isBrand);
    };
    document.fonts.ready.then(sample);
    cleanups.push(() => {
      disposed = true;
    });

    /* --- La dissolution, écrite sur le SVG seulement quand elle bouge :
       une fois à 1, seul le SMIL du bruit continue de respirer. --- */
    let written = -1;
    const applyProgress = (progress: number) => {
      if (Math.abs(progress - written) < 0.002) return;
      written = progress;
      const values = dissolveValues(progress);
      fine.setAttribute("scale", values.fineScale.toFixed(2));
      coarse.setAttribute("scale", values.coarseScale.toFixed(2));
      for (const gradient of gradients) {
        gradient?.setAttribute("y1", values.fadeTop.toFixed(2));
        gradient?.setAttribute("y2", values.fadeBottom.toFixed(2));
      }
      lose.setAttribute("opacity", values.loseOpacity.toFixed(3));
    };

    /* --- La boucle. --- */
    let frameId = 0;
    let running = false;
    let last = 0;
    let elapsed = 0;
    let progress = 0;
    let spawnDebt = 0;

    const frame = (now: number) => {
      /* Un onglet revenu d'une longue pause rend un dt énorme : plafonné. */
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      elapsed += dt;

      /* Lecture avant écriture, pour ne pas forcer deux mises en page. 0 quand
         le haut du mot touche le bas de l'écran, 1 quand il est entier — ou
         quand la page est en bas, un pied de page ne descendant jamais plus. */
      const rect = root.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      let target = clamp01((viewportHeight - rect.top) / Math.max(rect.height, 1));
      if (window.scrollY + viewportHeight >= document.documentElement.scrollHeight - 2) target = 1;
      progress += (target - progress) * (1 - Math.exp(-dt * 2.4));
      applyProgress(progress);

      if (ctx && canvas && pool) {
        const { fadeTop } = dissolveValues(progress);

        /* Naissances : le débit suit la dissolution et respire lentement une
           fois à 1 — la « boucle douce ». Les points sont tirés dans la bande
           qui se dissout, plus souvent près de la base. */
        if (ink) {
          const rate = progress * (110 + 50 * Math.sin(elapsed * 0.7));
          spawnDebt = Math.min(spawnDebt + rate * dt, 40);
          const bandTop = fadeTop - 1.5;
          const bandHeight = Math.max(BASELINE - bandTop, 0.5);
          while (spawnDebt >= 1 && pool.count < MAX_PARTICLES) {
            spawnDebt -= 1;
            for (let tries = 0; tries < 6; tries++) {
              const k = Math.floor(Math.random() * ink.count);
              const y = ink.ys[k];
              if (y < bandTop) continue;
              if (Math.random() < (y - bandTop) / bandHeight) {
                spawnParticle(pool, ink.xs[k], y, viewWidth, travelSign);
                break;
              }
            }
          }
        }

        /* Vie : une montée régulière, un balancement latéral de bulle. */
        for (let slot = pool.count - 1; slot >= 0; slot--) {
          const p = pool.alive[slot];
          pool.age[p] += dt;
          if (pool.age[p] >= pool.life[p]) {
            killParticle(pool, slot);
            continue;
          }
          pool.x[p] += (pool.vx[p] + Math.sin(elapsed * 2.2 + pool.phase[p]) * 2.2) * dt;
          pool.y[p] += pool.vy[p] * dt;
        }

        /* Rendu : en additif sur le canevas sombre, groupé par couleur pour
           ne poser que quatre styles par image. */
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(unitScale, 0, 0, unitScale, 0, originY * unitScale);
        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";
        for (let c = 0; c < colors.length; c++) {
          ctx.fillStyle = colors[c];
          ctx.strokeStyle = colors[c];
          for (let slot = 0; slot < pool.count; slot++) {
            const p = pool.alive[slot];
            if (pool.color[p] !== c) continue;
            const t = pool.age[p] / pool.life[p];
            const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
            const x = pool.x[p];
            const y = pool.y[p];
            const size = pool.size[p];
            if (pool.kind[p] === 0) {
              ctx.globalAlpha = alpha * 0.18;
              ctx.beginPath();
              ctx.arc(x, y, size * 2.6, 0, Math.PI * 2);
              ctx.fill();
              ctx.globalAlpha = alpha * 0.9;
              ctx.beginPath();
              ctx.arc(x, y, size, 0, Math.PI * 2);
              ctx.fill();
            } else {
              /* La traîne reste derrière le mouvement. */
              ctx.globalAlpha = alpha * 0.7;
              ctx.lineWidth = size * 0.6;
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x, y - travelSign * (2 + size * 5));
              ctx.stroke();
            }
          }
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }

      if (running) frameId = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running) return;
      running = true;
      last = performance.now();
      frameId = requestAnimationFrame(frame);
      svg.unpauseAnimations();
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(frameId);
      svg.pauseAnimations();
    };

    /* Hors écran, rien ne tourne — ni la boucle, ni le bruit SMIL. La marge
       couvre le vol des particules au-dessus du mot. */
    svg.pauseAnimations();
    const intersection = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) start();
          else stop();
        }
      },
      { rootMargin: "30% 0px 30% 0px" },
    );
    intersection.observe(root);
    cleanups.push(() => {
      intersection.disconnect();
      stop();
    });

    /* rAF est suspendu par le navigateur dans un onglet caché ; au retour, on
       remet l'horloge à zéro pour ne pas rejouer d'un coup le temps perdu. */
    const onVisibility = () => {
      last = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibility);
    cleanups.push(() => document.removeEventListener("visibilitychange", onVisibility));

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [reducedMotion, direction, viewWidth, isBrand]);

  const maskBox = { x: -20, y: -20, width: viewWidth + 40, height: BOX_HEIGHT + 40 };
  /* Le filtre ne couvre que le mot et sa marge de déchirure : le vol vers le
     haut est l'affaire du canvas, pas du bruit — qui coûte par pixel couvert. */
  const filterBox = { x: -16, y: -16, width: viewWidth + 32, height: BOX_HEIGHT + 32 };

  return (
    <div
      ref={rootRef}
      className={className}
      style={{ position: "relative", width: "clamp(240px, 100%, 1100px)", aspectRatio: `${viewWidth} / ${BOX_HEIGHT}` }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${viewWidth} ${BOX_HEIGHT}`}
        role="img"
        aria-label={label}
        fill="none"
        overflow="visible"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
      >
        <defs>
          <linearGradient id={ids.iris} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={viewWidth} y2={BOX_HEIGHT}>
            <stop offset="0" stopColor="var(--iris-cyan)" />
            <stop offset="0.38" stopColor="var(--iris-violet)" />
            <stop offset="0.7" stopColor="var(--iris-pink)" />
            <stop offset="1" stopColor="var(--iris-amber)" />
          </linearGradient>
          {/* Deux dégradés inverses, même ligne de fondu : ce que l'un garde, l'autre le perd. */}
          <linearGradient
            ref={keepGradientRef}
            id={ids.keepGradient}
            gradientUnits="userSpaceOnUse"
            x1="0"
            x2="0"
            y1={initial.fadeTop}
            y2={initial.fadeBottom}
          >
            <stop offset="0" stopColor="#fff" />
            <stop offset="1" stopColor="#000" />
          </linearGradient>
          <linearGradient
            ref={loseGradientRef}
            id={ids.loseGradient}
            gradientUnits="userSpaceOnUse"
            x1="0"
            x2="0"
            y1={initial.fadeTop}
            y2={initial.fadeBottom}
          >
            <stop offset="0" stopColor="#000" />
            <stop offset="1" stopColor="#fff" />
          </linearGradient>
          <mask id={ids.keep} maskUnits="userSpaceOnUse" {...maskBox}>
            <rect {...maskBox} fill={`url(#${ids.keepGradient})`} />
          </mask>
          <mask id={ids.lose} maskUnits="userSpaceOnUse" {...maskBox}>
            <rect {...maskBox} fill={`url(#${ids.loseGradient})`} />
          </mask>
          {/* Filaments fins : bruit serré, déplacement court. */}
          <filter id={ids.fine} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB" {...filterBox}>
            <feTurbulence type="fractalNoise" baseFrequency="0.09 0.015" numOctaves="2" seed="7" result="noise">
              {!reducedMotion && (
                <animate attributeName="baseFrequency" values="0.09 0.015;0.11 0.021;0.09 0.015" dur="7s" repeatCount="indefinite" />
              )}
            </feTurbulence>
            <feColorMatrix in="noise" type="matrix" values={flowMatrix} result="flow" />
            <feDisplacementMap
              ref={fineRef}
              in="SourceGraphic"
              in2="flow"
              scale={initial.fineScale}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
          {/* Traînées larges : bruit lâche, déplacement long, posées en dessous et plus pâles. */}
          <filter id={ids.coarse} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB" {...filterBox}>
            <feTurbulence type="fractalNoise" baseFrequency="0.035 0.008" numOctaves="2" seed="3" result="noise">
              {!reducedMotion && (
                <animate attributeName="baseFrequency" values="0.035 0.008;0.045 0.011;0.035 0.008" dur="11s" repeatCount="indefinite" />
              )}
            </feTurbulence>
            <feColorMatrix in="noise" type="matrix" values={flowMatrix} result="flow" />
            <feDisplacementMap
              ref={coarseRef}
              in="SourceGraphic"
              in2="flow"
              scale={initial.coarseScale}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>

        {/* La matière qui part : deux copies iridescentes déchirées, visibles sous la ligne de fondu. */}
        <g ref={loseRef} opacity={initial.loseOpacity} mask={`url(#${ids.lose})`}>
          <g filter={`url(#${ids.coarse})`} opacity="0.55">
            <Wordmark label={label} isBrand={isBrand} viewWidth={viewWidth} fill={iris} ringStroke={iris} />
          </g>
          <g filter={`url(#${ids.fine})`}>
            <Wordmark label={label} isBrand={isBrand} viewWidth={viewWidth} fill={iris} ringStroke={iris} />
          </g>
        </g>
        {/* Le mot net, visible au-dessus de la ligne de fondu. */}
        <g ref={sharpRef} mask={`url(#${ids.keep})`}>
          <Wordmark label={label} isBrand={isBrand} viewWidth={viewWidth} fill="currentColor" ringStroke={iris} highlight />
        </g>
      </svg>

      {!reducedMotion && (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            width: "100%",
            top: direction === "up" ? `${(-TRAVEL / BOX_HEIGHT) * 100}%` : 0,
            height: `${((BOX_HEIGHT + TRAVEL) / BOX_HEIGHT) * 100}%`,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
