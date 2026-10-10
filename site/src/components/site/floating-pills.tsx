"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { FLOATING_PILLS, type FloatingPill } from "@/components/brand/capsule";

/* Les styles vivent dans `src/styles/pills.css`, importé par globals.css. */

/**
 * Les pilules qui flottent derrière le bas de page (retour du 11/10) : très
 * peu, différentes, grosses et moyennes, vertes, sans texte, posées dans les
 * marges des sections 3 (méthode), 4 (questionnaire) et 5 (FAQ). Elles
 * défilent moins vite que la page : par rapport au contenu, elles descendent.
 *
 * Une ancre de hauteur nulle par section, juste avant elle dans `home.tsx`.
 * Le rendu serveur est la position de repos — celle que garde un visiteur
 * sans JavaScript ou qui a demandé de réduire les animations. Le script ne
 * fait que translater chaque pilule : `y = profondeur × (milieu de l'écran −
 * centre de la pilule)`, nul quand la pilule est au milieu de l'écran, si
 * bien que la place de repos est celle qu'on voit en la croisant.
 */

type Zone = "methode" | "note" | "faq";

type Placement = {
  pill: FloatingPill;
  /** Taille d'affichage (carré), en px. */
  size: number;
  side: "left" | "right";
  /** Décalage vertical depuis le haut de la section, en px. */
  top: number;
  /** Part du défilement qu'elle perd : plus elle est grosse, plus elle traîne. */
  depth: number;
  /** Rotation ajoutée à celle du rendu, en degrés. */
  rotate: number;
  /** Décalage quand la méthode se fige (écran large) : la pilule traverse alors la course figée. */
  pinTop?: string;
} & (
  | { screen: "large"; /** Écart entre la matière et la colonne de texte, en px. */ edge: number }
  | { screen: "small"; /** Matière qui dépasse du bord de l'écran, en px. */ show: number }
);

/* Écran large : cinq pilules, toutes différentes — trois grosses, deux
   moyennes —, dans les gouttières. Sur téléphone et tablette : deux petites,
   dans la bande vide qui sépare deux sections. Jamais deux de même taille. */
const PLACEMENTS: Record<Zone, Placement[]> = {
  methode: [
    { pill: "softgel", screen: "large", size: 340, side: "right", top: 40, edge: 28, depth: 0.34, rotate: -6 },
    /* Quand la méthode se fige, l'écran reste immobile 1,7 hauteur d'écran : la
       pilule moyenne descend alors au milieu de cette course pour la traverser. */
    { pill: "comprime", screen: "large", size: 148, side: "left", top: 380, pinTop: "calc(100vh + 160px)", edge: 24, depth: 0.18, rotate: 10 },
  ],
  note: [
    { pill: "bicolore", screen: "large", size: 166, side: "left", top: 60, edge: 32, depth: 0.2, rotate: -12 },
    /* La grosse gélule passe derrière le bord de la carte de verre : c'est
       l'effet du verre, sur les 48 px de rembourrage de la carte, loin de son
       texte. Assez bas pour que sa course ne remonte jamais jusqu'au chapeau
       de la section, qui court, lui, jusqu'au bord de la colonne. */
    { pill: "gelule", screen: "large", size: 300, side: "right", top: 560, edge: -28, depth: 0.24, rotate: 8 },
    { pill: "bicolore", screen: "small", size: 128, side: "right", top: -64, show: 84, depth: 0.06, rotate: -8 },
  ],
  faq: [
    { pill: "oblong", screen: "large", size: 236, side: "left", top: 250, edge: 36, depth: 0.26, rotate: -10 },
    { pill: "comprime", screen: "small", size: 112, side: "left", top: -56, show: 68, depth: 0.05, rotate: 12 },
  ],
};

/* ---------------------------------------------------------------------------
   Un seul moteur pour toutes les ancres : un écouteur de défilement passif,
   une image d'animation à la fois, rien tant qu'aucune pilule n'est à l'écran.
   --------------------------------------------------------------------------- */

type Item = {
  el: HTMLElement;
  anchor: HTMLElement;
  depth: number;
  /** Centre de repos dans la page, en px ; `null` si la pilule est masquée. */
  center: number | null;
  visible: boolean;
  y: number;
};

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";
const items = new Map<Element, Item>();
let frame = 0;
let visibleCount = 0;
let running = false;
let observer: IntersectionObserver | null = null;
let resizer: ResizeObserver | null = null;
let reduceQuery: MediaQueryList | null = null;

function measure() {
  const scroll = window.scrollY;
  for (const item of items.values()) {
    const height = item.el.offsetHeight;
    item.center = height ? item.anchor.getBoundingClientRect().top + scroll + item.el.offsetTop + height / 2 : null;
  }
}

function paint() {
  frame = 0;
  const middle = window.scrollY + window.innerHeight / 2;
  for (const item of items.values()) {
    if (!item.visible || item.center === null) continue;
    const y = Math.round(item.depth * (middle - item.center) * 10) / 10;
    if (y === item.y) continue;
    item.y = y;
    item.el.style.transform = `translate3d(0, ${y}px, 0)`;
  }
}

function schedule() {
  if (!frame && visibleCount > 0) frame = window.requestAnimationFrame(paint);
}

function onResize() {
  measure();
  schedule();
}

function start() {
  if (running) return;
  running = true;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const item = items.get(entry.target);
        if (!item || item.visible === entry.isIntersecting) continue;
        item.visible = entry.isIntersecting;
        visibleCount += item.visible ? 1 : -1;
      }
      schedule();
    },
    { rootMargin: "35% 0px" },
  );
  resizer = new ResizeObserver(onResize);
  resizer.observe(document.body);
  for (const item of items.values()) observer.observe(item.el);
  measure();
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
}

function stop() {
  if (!running) return;
  running = false;
  window.removeEventListener("scroll", schedule);
  window.removeEventListener("resize", onResize);
  observer?.disconnect();
  resizer?.disconnect();
  observer = null;
  resizer = null;
  if (frame) window.cancelAnimationFrame(frame);
  frame = 0;
  visibleCount = 0;
  for (const item of items.values()) {
    item.visible = false;
    item.y = 0;
    item.el.style.removeProperty("transform");
  }
}

function applyMotion() {
  if (reduceQuery?.matches || items.size === 0) stop();
  else start();
}

function register(next: Item[]) {
  for (const item of next) items.set(item.el, item);
  if (!reduceQuery) {
    reduceQuery = window.matchMedia(REDUCE_QUERY);
    reduceQuery.addEventListener("change", applyMotion);
  }
  if (running) {
    for (const item of next) observer?.observe(item.el);
    measure();
  } else {
    applyMotion();
  }
  return () => {
    for (const item of next) {
      items.delete(item.el);
      observer?.unobserve(item.el);
      if (item.visible) visibleCount -= 1;
    }
    if (items.size === 0) {
      stop();
      reduceQuery?.removeEventListener("change", applyMotion);
      reduceQuery = null;
    }
  };
}

export function FloatingPills({ zone }: { zone: Zone }) {
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const pills = Array.from(anchor.querySelectorAll<HTMLElement>("[data-fp]"));
    return register(pills.map((el) => ({ el, anchor, depth: Number(el.dataset.depth) || 0, center: null, visible: false, y: 0 })));
  }, []);

  return (
    <div ref={anchorRef} aria-hidden className="fpills" data-zone={zone}>
      {PLACEMENTS[zone].map((placement, index) => {
        const asset = FLOATING_PILLS[placement.pill];
        const style: Record<`--fp-${string}`, string | number> = {
          "--fp-size": `${placement.size}px`,
          "--fp-top": `${placement.top}px`,
          "--fp-rotate": `${placement.rotate}deg`,
          "--fp-core-l": asset.core.left,
          "--fp-core-r": asset.core.right,
          ...(placement.pinTop ? { "--fp-top-pin": placement.pinTop } : {}),
          ...(placement.screen === "large" ? { "--fp-edge": `${placement.edge}px` } : { "--fp-show": `${placement.show}px` }),
        };
        return (
          <div
            key={`${placement.pill}-${index}`}
            data-fp
            data-depth={placement.depth}
            data-side={placement.side}
            data-screen={placement.screen}
            data-fit={placement.screen === "large" ? "column" : "edge"}
            data-pin={placement.pinTop ? "" : undefined}
            className="fpill"
            style={style as CSSProperties}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- rendu 3D déjà encodé en WebP à 2× : next/image le réencoderait sans rien gagner */}
            <img className="fpill-img" src={asset.src} alt="" width={placement.size} height={placement.size} loading="lazy" decoding="async" draggable={false} />
          </div>
        );
      })}
    </div>
  );
}
