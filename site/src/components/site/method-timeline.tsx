"use client";

import { useEffect, useRef, type ReactNode } from "react";

/* Les styles vivent dans `src/styles/method.css`, importé par globals.css. */

type Step = { title: string; text: string };
type Mode = "pin" | "flow";

/* Écran assez large pour la flèche horizontale et assez haut pour qu'elle
   tienne, figée, avec son titre : la section se fige et le défilement la
   trace. En deçà, la flèche se trace au fil de la lecture, sans se figer. */
const PIN_QUERY = "(min-width: 1024px) and (min-height: 620px)";
/* Parts de la course figée : un temps d'arrêt avant que la flèche ne parte,
   un autre à l'arrivée, pour que l'état final se lise avant de repartir. */
const LEAD = 0.05;
const HOLD = 0.12;
/* La ligne de lecture d'un téléphone : là où l'œil se pose dans l'écran. */
const READING_LINE = 0.62;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/**
 * La méthode en flèche (retour du 10/10). Sur écran large, la section se
 * fige le temps d'environ 1,7 hauteur d'écran : la flèche se trace de gauche
 * à droite, les cinq étapes apparaissent une à une le long d'elle, et un
 * curseur Signal la parcourt jusqu'à la pointe, atteinte à la fin. Sur
 * téléphone, la même flèche descend le long des étapes — cinq colonnes
 * côte à côte n'y laisseraient que 70 px par étape, les titres ne tiendraient
 * pas — et le curseur suit la ligne de lecture, sans figer la page.
 *
 * Tout passe par une seule variable, `--p` (0 → 1), posée sur la racine à
 * chaque image par un seul écouteur de défilement passif : la feuille de
 * style en tire le trait, le curseur et la pointe. Les étapes atteintes
 * portent `data-reached`. Le rendu serveur ne porte ni l'un ni l'autre :
 * c'est l'état final, que garde un visiteur sans JavaScript ou qui a
 * demandé de réduire les animations.
 */
export function MethodTimeline({ steps, children }: { steps: Step[]; children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const line = root?.querySelector<HTMLElement>("[data-method-line]");
    if (!root || !line) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-method-step]"));
    const nodes = items.map((item) => item.querySelector<HTMLElement>("[data-method-node]"));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia(PIN_QUERY);
    let mode: Mode | null = null;
    let marks: number[] = [];
    let frame = 0;
    let painted = -1;

    /* Où tombe chaque étape sur la flèche, en part de sa longueur : mesuré
       et non supposé, la colonne d'une étape et la hauteur d'un texte
       changeant avec l'écran et la langue. */
    const measure = () => {
      painted = -1;
      const box = line.getBoundingClientRect();
      const across = box.width >= box.height;
      const length = across ? box.width : box.height;
      marks = nodes.map((node) => {
        if (!node || length <= 0) return 0;
        const at = node.getBoundingClientRect();
        const center = across ? at.left + at.width / 2 - box.left : at.top + at.height / 2 - box.top;
        return center / length;
      });
    };

    const progress = () => {
      const viewport = window.innerHeight;
      if (mode === "pin") {
        const box = root.getBoundingClientRect();
        const run = box.height - viewport;
        const raw = run > 0 ? -box.top / run : 1;
        return clamp((raw - LEAD) / (1 - LEAD - HOLD));
      }
      const box = line.getBoundingClientRect();
      if (box.width >= box.height) return clamp((viewport * 0.9 - box.top) / (viewport * 0.5));
      return clamp((viewport * READING_LINE - box.top) / box.height);
    };

    const paint = () => {
      frame = 0;
      if (!mode) return;
      const p = Math.round(progress() * 10000) / 10000;
      /* Loin de la section, `p` reste à 0 ou à 1 : rien à repeindre. */
      if (p === painted) return;
      painted = p;
      root.style.setProperty("--p", String(p));
      items.forEach((item, index) => item.toggleAttribute("data-reached", p > (marks[index] ?? 0) + 0.004));
      root.toggleAttribute("data-end", p >= 0.999);
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(paint);
    };

    const apply = () => {
      mode = reduce.matches ? null : wide.matches ? "pin" : "flow";
      if (!mode) {
        delete root.dataset.mode;
        root.style.removeProperty("--p");
        root.removeAttribute("data-end");
        items.forEach((item) => item.removeAttribute("data-reached"));
        return;
      }
      root.dataset.mode = mode;
      measure();
      paint();
    };

    const resized = new ResizeObserver(() => {
      if (!mode) return;
      measure();
      schedule();
    });

    apply();
    resized.observe(root);
    window.addEventListener("scroll", schedule, { passive: true });
    reduce.addEventListener("change", apply);
    wide.addEventListener("change", apply);
    return () => {
      window.removeEventListener("scroll", schedule);
      reduce.removeEventListener("change", apply);
      wide.removeEventListener("change", apply);
      resized.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={rootRef} className="method">
      <div className="method-stage">
        <div className="container-site">
          {children}
          <div className="method-timeline">
            <div data-method-line aria-hidden className="method-line">
              <span className="method-guide" />
              <span className="method-fill" />
              <span className="method-head" />
              <span className="method-cursor" />
            </div>
            <ol className="method-steps">
              {steps.map((step, index) => (
                <li key={step.title} data-method-step className="method-step">
                  <span data-method-node aria-hidden className="method-node" />
                  <div className="method-step-body">
                    <span className="method-num type-overline">{String(index + 1).padStart(2, "0")}</span>
                    <h3 className="method-title type-h3">{step.title}</h3>
                    <p className="method-text type-small">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
