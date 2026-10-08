"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Les pilules de fond : des capsules de verre vert qui dérivent lentement
 * derrière la page et défilent moins vite qu'elle quand on scrolle — la
 * référence « DAY 219 » du moodboard, passée au vert.
 *
 * Un seul canvas 2D fixe, rendu à demi-résolution et adouci par un flou CSS
 * (composé par le GPU, pas recalculé par le script). Les couleurs et la
 * densité viennent des tokens `--pill-1..4` et `--pill-alpha` : l'alpha
 * plafonne la luminance sous le texte, c'est lui qui garde le contraste.
 *
 * Le pointeur repousse doucement ce qu'il frôle ; hors écran ou onglet caché,
 * rien ne tourne ; en mouvement réduit, les capsules ne dérivent pas et ne
 * suivent que le défilement, qui est un geste de la personne.
 */

type Pill = {
  x: number;
  y: number;
  length: number;
  radius: number;
  angle: number;
  spin: number;
  vx: number;
  vy: number;
  /* 0,06 à 0,22 : la part du défilement que la capsule suit. Plus elle est loin, moins elle bouge. */
  depth: number;
  color: number;
  phase: number;
};

const TOKENS = ["--pill-1", "--pill-2", "--pill-3", "--pill-4"] as const;
const FALLBACK = ["#9ff0c9", "#2fbf7a", "#5fe0c8", "#e8fff4"] as const;
const RENDER_SCALE = 0.75;
const FRAME_MS = 1000 / 30;
const POINTER_RADIUS = 280;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const getReducedMotion = () => window.matchMedia(REDUCED_MOTION_QUERY).matches;
const getServerReducedMotion = () => false;

/* Un générateur déterministe : la même page donne les mêmes capsules à chaque
   visite, et la capture de vérification reste comparable. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makePills(width: number, height: number): Pill[] {
  const random = mulberry32(219);
  const count = Math.max(3, Math.min(8, Math.round((width * height) / 190000)));
  const pills: Pill[] = [];
  for (let i = 0; i < count; i++) {
    const length = 220 + random() * 260;
    pills.push({
      x: random() * width,
      y: random() * height,
      length,
      radius: length * (0.3 + random() * 0.1),
      angle: (random() < 0.5 ? -1 : 1) * (0.5 + random() * 0.6),
      spin: (random() - 0.5) * 0.06,
      vx: (random() - 0.5) * 14,
      vy: -(4 + random() * 8),
      depth: 0.06 + random() * 0.16,
      color: i % 3,
      phase: random() * Math.PI * 2,
    });
  }
  return pills;
}

function capsule(ctx: CanvasRenderingContext2D, length: number, radius: number) {
  const half = length / 2;
  ctx.beginPath();
  ctx.moveTo(-half + radius, -radius);
  ctx.lineTo(half - radius, -radius);
  ctx.arc(half - radius, 0, radius, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(-half + radius, radius);
  ctx.arc(-half + radius, 0, radius, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.closePath();
}

export function PillsCanvas({ className = "" }: { className?: string }) {
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getServerReducedMotion);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const style = getComputedStyle(canvas);
    const colors = TOKENS.map((token, i) => style.getPropertyValue(token).trim() || FALLBACK[i]);
    const alpha = Math.min(0.5, Math.max(0.05, parseFloat(style.getPropertyValue("--pill-alpha")) || 0.26));

    let width = 0;
    let height = 0;
    let pills: Pill[] = [];
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.max(1, Math.round(width * RENDER_SCALE));
      canvas.height = Math.max(1, Math.round(height * RENDER_SCALE));
      if (pills.length === 0) pills = makePills(width, height);
    };
    resize();

    const pointer = { x: -1e4, y: -1e4, active: false };
    const onPointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
    };
    const onPointerLeave = () => {
      pointer.active = false;
    };

    let frameId = 0;
    let running = false;
    let last = 0;
    let lastDraw = 0;
    let elapsed = 0;

    const draw = (scrollY: number) => {
      ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";
      for (const pill of pills) {
        /* La capsule garde sa place dans la page et ne suit le défilement
           que pour une part : elle paraît derrière, loin. Enveloppe verticale
           sur la hauteur de l'écran plus la plus longue capsule. */
        const span = height + 520;
        const y = (((pill.y - scrollY * pill.depth) % span) + span) % span - 260;
        const x = (((pill.x % (width + 520)) + width + 520) % (width + 520)) - 260;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(pill.angle);
        const gradient = ctx.createLinearGradient(-pill.length / 2, 0, pill.length / 2, 0);
        gradient.addColorStop(0, colors[pill.color]);
        gradient.addColorStop(0.5, colors[(pill.color + 1) % 3]);
        gradient.addColorStop(1, colors[(pill.color + 2) % 3]);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = gradient;
        capsule(ctx, pill.length, pill.radius);
        ctx.fill();
        /* Le volume : un bord plus sombre en bas (le verre s'épaissit), un reflet perle en haut. */
        const shade = ctx.createLinearGradient(0, -pill.radius, 0, pill.radius);
        shade.addColorStop(0, "rgba(255,255,255,0.0)");
        shade.addColorStop(0.55, "rgba(0,0,0,0.0)");
        shade.addColorStop(1, "rgba(0,0,0,0.55)");
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillStyle = shade;
        capsule(ctx, pill.length, pill.radius);
        ctx.fill();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = colors[3];
        ctx.translate(-pill.length * 0.04, -pill.radius * 0.5);
        capsule(ctx, pill.length * 0.78, pill.radius * 0.2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    const frame = (now: number) => {
      if (!running) return;
      frameId = requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (now - lastDraw < FRAME_MS) return;
      lastDraw = now;
      elapsed += dt;
      const scrollY = window.scrollY;
      for (const pill of pills) {
        pill.x += (pill.vx + Math.sin(elapsed * 0.3 + pill.phase) * 4) * dt;
        pill.y += pill.vy * dt;
        pill.angle += pill.spin * dt;
        if (pointer.active) {
          const span = height + 520;
          const sy = (((pill.y - scrollY * pill.depth) % span) + span) % span - 260;
          const sx = (((pill.x % (width + 520)) + width + 520) % (width + 520)) - 260;
          const dx = sx - pointer.x;
          const dy = sy - pointer.y;
          const dist = Math.hypot(dx, dy);
          if (dist < POINTER_RADIUS && dist > 1) {
            const push = (1 - dist / POINTER_RADIUS) * 60 * dt;
            pill.x += (dx / dist) * push;
            pill.y += (dy / dist) * push;
          }
        }
      }
      draw(scrollY);
    };

    const start = () => {
      if (running) return;
      running = true;
      last = performance.now();
      frameId = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(frameId);
    };

    const onResize = () => {
      resize();
      if (reducedMotion) draw(window.scrollY);
    };
    window.addEventListener("resize", onResize);

    const cleanups: Array<() => void> = [() => window.removeEventListener("resize", onResize)];

    if (reducedMotion) {
      /* Pas de dérive : une image, redessinée au défilement pour la parallaxe. */
      draw(window.scrollY);
      let pending = false;
      const onScroll = () => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
          pending = false;
          draw(window.scrollY);
        });
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      cleanups.push(() => window.removeEventListener("scroll", onScroll));
    } else {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerleave", onPointerLeave);
      document.addEventListener("pointercancel", onPointerLeave);
      const onVisibility = () => {
        if (document.hidden) stop();
        else start();
      };
      document.addEventListener("visibilitychange", onVisibility);
      cleanups.push(() => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerleave", onPointerLeave);
        document.removeEventListener("pointercancel", onPointerLeave);
        document.removeEventListener("visibilitychange", onVisibility);
        stop();
      });
      start();
    }

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        filter: "blur(7px) saturate(1.1)",
        zIndex: 0,
      }}
    />
  );
}
