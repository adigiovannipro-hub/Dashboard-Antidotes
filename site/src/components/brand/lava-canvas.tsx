"use client";

import { useEffect, useRef } from "react";
import {
  START_TIME,
  avoidBoxes,
  createLavaRenderer,
  isSoftwareRenderer,
  measureAvoid,
  readLavaPalette,
  type AvoidRects,
  type LavaBox,
  type LavaPointer,
  type LavaRenderer,
  type LavaVariant,
} from "./lava-shader";

/**
 * La lave du hero : les bulles de verre de la V1, aux couleurs et aux règles
 * de la charte V2 (r-05, r-19). Le canvas peint tout, fond compris ; avant le
 * JavaScript, sans WebGL ou si le GPU lâche, l'image de repli — le même
 * shader, rendu une fois à t = 7 s — tient la place.
 */
type LavaCanvasProps = {
  className?: string;
  /** « dark » sur Profondeur (cœur Signal, franges Menthe et Rose), « light » sur Craie (franges Lagon et Lilas). */
  variant?: LavaVariant;
  /** La lave s'efface sur les premiers 60 vh de défilement : les capsules prennent le relais. */
  fadeOnScroll?: boolean;
};

/**
 * Les images de repli, rendues par le shader lui-même à t = 7 s, sans
 * pointeur, sur la mise en page du hero (1440 × 900 et 390 × 844). Seule la
 * variante sombre en a : c'est la seule que le site pose.
 */
export const LAVA_FALLBACK = { land: "/brand/lave-hero-large.webp", port: "/brand/lave-hero-portrait.webp" } as const;

/** Amorti du pointeur, par image à 60 Hz (charte r-05). */
const POINTER_EASE = 0.06;
/** Défilement, en fraction de la hauteur de fenêtre, au bout duquel la lave a disparu. */
const FADE_DISTANCE = 0.6;
/** Le fondu de l'image de repli vers la première image WebGL. */
const REVEAL_MS = 800;
/** Sous 20 images par seconde en moyenne sur quarante, la machine ne suit pas. */
const SLOW_FRAME_MS = 50;
/** Morsure du grain sur le bord, en pixels du canvas : sur écran large, le verre reste net. */
const EDGE_GRAIN = { fine: 0.8, coarse: 1.1 } as const;

export function LavaCanvas({ className = "", variant = "dark", fadeOnScroll = true }: LavaCanvasProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fallbackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const fallback = fallbackRef.current;
    if (!root || !canvas || !fallback) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    let reduced = motionQuery.matches;

    /* --- Ce qui ne dépend pas du GPU : le fondu au défilement, le pointeur et
       les boîtes du texte. Tout s'écrit dans des variables lues par la boucle,
       jamais dans un état React : rien ne re-rend. */
    let fade = 1;
    const applyFade = () => {
      // En mouvement réduit, rien ne bouge, l'opacité non plus.
      const next = fadeOnScroll && !reduced ? 1 - Math.min(1, Math.max(0, window.scrollY / (FADE_DISTANCE * window.innerHeight))) : 1;
      if (next === fade) return;
      fade = next;
      root.style.opacity = fade >= 1 ? "" : fade.toFixed(3);
    };
    let rect = root.getBoundingClientRect();
    // Le texte que la lave évite : relevé au montage, aux polices chargées, au redimensionnement ; remis
    // en unités à chaque défilement (l'en-tête collant glisse sur la section).
    let rects: AvoidRects = { flow: [], fixed: [] };
    let boxes: LavaBox[] = [];
    // Image figée (mouvement réduit, machine lente) : elle se repeint quand le texte bouge.
    let redraw: (() => void) | null = null;
    const remeasure = () => {
      rect = root.getBoundingClientRect();
      rects = measureAvoid(root);
      boxes = avoidBoxes(rects, rect);
      redraw?.();
    };
    let pending = 0;
    const onScrollOrResize = () => {
      if (pending) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        rect = root.getBoundingClientRect();
        boxes = avoidBoxes(rects, rect);
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
    remeasure();
    let fontsLive = true;
    document.fonts?.ready.then(() => {
      if (fontsLive) remeasure();
    });
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
      fontsLive = false;
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

    /* --- Le GPU. Sans WebGL, sans les couleurs de la charte ou en rendu logiciel, l'image de repli
       reste : c'est la même image, immobile. */
    const palette = readLavaPalette((token) => getComputedStyle(root).getPropertyValue(token), variant);
    const gl = palette ? canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" }) : null;
    if (!gl || !palette || isSoftwareRenderer(gl)) return removeInputs;
    // Prêt quand le programme est compilé — hors du fil principal quand le pilote le permet.
    let renderer: LavaRenderer | null = null;
    let disposed = false;

    const lavaPointer: LavaPointer = { x: 0.5, y: 0.5, presence: 0 };
    // L'horloge part de l'instant de l'image de repli : la première image WebGL tombe dessus.
    let time = START_TIME;
    const draw = () => {
      renderer?.draw({
        time,
        pointer: reduced || lavaPointer.presence < 0.001 ? null : lavaPointer,
        boxes,
        // Le grain change 24 fois par seconde, la cadence d'une pellicule : à 60 il fourmille comme un écran neigeux.
        seed: reduced ? 3.7 : (Math.floor(time * 24) % 61) * 7.31,
        edge: coarse ? EDGE_GRAIN.coarse : EDGE_GRAIN.fine,
      });
    };

    let raf = 0;
    let last = 0;
    let running = false;
    let visible = false;
    let painted = false;
    let revealTimer = 0;
    // Garde-fou : sous 20 images par seconde en moyenne sur quarante, la définition baisse d'abord ; si la
    // machine ne suit toujours pas, la dernière image reste, immobile — un fond figé vaut mieux qu'une page qui rame.
    let lowered = false;
    let frozen = false;
    let samples = 0;
    let slowMs = 0;
    const fps = coarse ? 30 : 60;

    // Le shader coûte par pixel : échelle plafonnée à 1,5 (1,6 au doigt, où un canvas agrandi épaissit le
    // grain) et quatre millions de pixels au plus ; en définition réduite, jamais sous 0,75.
    const resize = () => {
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      let scale = Math.min(window.devicePixelRatio || 1, coarse ? 1.6 : 1.5);
      if (cw * ch * scale * scale > 4e6) scale = Math.sqrt(4e6 / Math.max(1, cw * ch));
      if (lowered) scale = Math.max(0.75, scale * 0.6);
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
      // Le repli ne part qu'une fois le fondu fini : le retirer avant laisserait un trou le temps de la transition.
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
        if (samples === 40 && slowMs / samples > SLOW_FRAME_MS) {
          if (!lowered) {
            lowered = true;
            samples = 0;
            slowMs = 0;
            resize();
          } else {
            frozen = true;
            run();
            return;
          }
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
      const next = visible && !document.hidden && !reduced && !frozen && renderer !== null;
      if (next === running) return;
      running = next;
      if (running) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      } else cancelAnimationFrame(raf);
    };
    // Mouvement réduit : une image, la même que le repli (t = 7 s), et plus rien ne bouge.
    const paintStill = () => {
      if (!renderer) return;
      time = START_TIME;
      draw();
      if (!painted) reveal();
    };
    const build = () => {
      void createLavaRenderer(gl, palette).then((ready) => {
        if (disposed) {
          ready?.dispose();
          return;
        }
        renderer = ready;
        if (reduced) paintStill();
        else run();
      });
    };

    redraw = () => {
      if (!running && painted) draw();
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
      remeasure();
      onScrollOrResize();
    });
    // Contexte perdu (GPU réinitialisé) : retour à l'image de repli, pas un rectangle noir ; s'il revient,
    // la lave repart d'elle-même.
    const onLost = (e: Event) => {
      e.preventDefault();
      renderer = null;
      run();
      window.clearTimeout(revealTimer);
      painted = false;
      samples = 0;
      slowMs = 0;
      canvas.style.opacity = "0";
      fallback.style.display = "";
    };
    const onRestored = () => build();

    if (reduced) canvas.style.transition = "none";
    resize();
    build();
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    motionQuery.addEventListener("change", onMotion);
    io.observe(root);
    ro.observe(canvas);

    return () => {
      disposed = true;
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(revealTimer);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      motionQuery.removeEventListener("change", onMotion);
      removeInputs();
      // Les ressources GPU sont rendues, pas le contexte : le perdre exprès le laisserait perdu pour le
      // montage suivant sur le même canvas (double montage du mode strict de React, changement de variante).
      renderer?.dispose();
    };
  }, [variant, fadeOnScroll]);

  return (
    <div ref={rootRef} aria-hidden="true" className={`pointer-events-none overflow-hidden ${className}`}>
      <div ref={fallbackRef} className="absolute inset-0">
        {variant === "dark" && (
          <picture>
            <source media="(max-aspect-ratio: 1/1)" srcSet={LAVA_FALLBACK.port} />
            {/* Rendu du shader déjà encodé en WebP : next/image le réencoderait sans rien gagner. */}
            <img
              src={LAVA_FALLBACK.land}
              alt=""
              decoding="async"
              fetchPriority="high"
              className="absolute inset-0 h-full w-full select-none object-cover object-right portrait:object-bottom"
            />
          </picture>
        )}
      </div>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full opacity-0"
        style={{ transition: `opacity ${REVEAL_MS}ms cubic-bezier(.2,.8,.2,1)` }}
      />
    </div>
  );
}
