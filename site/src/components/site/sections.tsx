import { CAPSULE_ASSETS, Capsule, type CapsuleAsset } from "@/components/brand/capsule";
import { Rich } from "@/components/brand/rich";
import type { Dictionary, Service } from "@/i18n/types";
import { CASE_VISUALS, type CaseVisual } from "@/lib/cases";
import { CLIENT_LOGOS } from "@/lib/logos";
import { LogoMarquee } from "./logo-marquee";
import { PhoneCase } from "./phone-case";

/**
 * Les sections du corps de page, dans les deux univers de la charte : les
 * capsules sur la Profondeur juste après la lave (« lave en hero, capsules
 * ensuite »), puis le Verre clair pour les preuves, la méthode et la FAQ.
 * Chaque titre porte un mot-clé vert et une touche manuscrite.
 */

/* Le surtitre des pages de la charte : « 02 · CONCEPT DE MARQUE », en Geist Mono. */
export function SectionHeading({ eyebrow, index, title, id, className = "" }: { eyebrow: string; index?: number; title: string; id?: string; className?: string }) {
  return (
    <div className={`reveal max-w-3xl ${className}`}>
      <p className="type-overline text-text-3">
        {index ? `${String(index).padStart(2, "0")} · ` : ""}
        {eyebrow}
      </p>
      <h2 id={id} className="type-h2 mt-4 text-text">
        <Rich text={title} />
      </h2>
    </div>
  );
}

/* --- Services : une rangée par expertise, la capsule en repère (r-06). ------- */
/* Retour du 10/10 : les gélules de 200 px écrasaient la grille et le libellé
   d'un mot ne disait rien. Chaque service se lit désormais par sa promesse
   (`title`), le libellé passe en surtitre, et la gélule devient un repère à
   gauche de la rangée, à l'échelle d'une icône.
   Jamais deux gélules de même taille ni de même orientation (r-06) : chacune
   occupe une part différente de sa colonne — l'écart tient donc à toutes les
   largeurs d'écran — et ne s'écarte que de quelques degrés de l'inclinaison
   déjà rendue dans l'image (au-delà, la lumière partirait dans tous les sens). */
const CAPSULES: Record<Service["icon"], { asset: CapsuleAsset; scale: number; rotate: number }> = {
  compass: { asset: "strategie", scale: 0.94, rotate: -4 },
  calendar: { asset: "accompagnement", scale: 0.86, rotate: 6 },
  clapperboard: { asset: "production", scale: 1, rotate: -3 },
  target: { asset: "publicite", scale: 0.78, rotate: 0 },
  layout: { asset: "plateforme", scale: 0.9, rotate: 4 },
  sparkles: { asset: "ia", scale: 0.82, rotate: -6 },
};

export function Services({ dict }: { dict: Dictionary }) {
  return (
    <section
      id="services"
      aria-labelledby="services-titre"
      data-univers="sombre"
      className="theme-dark relative isolate z-10 scroll-mt-16 overflow-hidden rounded-b-[clamp(28px,4vw,56px)] bg-profondeur text-text"
    >
      {/* Les marques ouvrent la bande des capsules, sur le noir — jamais sur la lave. */}
      <div className="pt-6 md:pt-10">
        <p className="container-site type-overline mb-5 text-text-3">{dict.hero.trustLabel}</p>
        <LogoMarquee logos={CLIENT_LOGOS} label={dict.hero.trustLabel} />
      </div>
      <div className="container-site section-pad">
        <SectionHeading eyebrow={dict.services.eyebrow} index={1} title={dict.services.title} id="services-titre" />
        {/* Deux colonnes de rangées à filets : chaque colonne porte ses propres filets, du
            premier au dernier, pour que la gouttière les coupe tous de la même façon. */}
        <ul className="mt-12 md:mt-16 lg:grid lg:grid-cols-2 lg:gap-x-16">
          {dict.services.items.map((item) => {
            const capsule = CAPSULES[item.icon];
            const asset = CAPSULE_ASSETS[capsule.asset];
            return (
              <li
                key={item.label}
                className="capsule-host grid grid-cols-[72px_minmax(0,1fr)] items-center gap-x-4 border-b border-line py-6 first:border-t sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-x-6 md:py-8 lg:grid-cols-[108px_minmax(0,1fr)] lg:nth-2:border-t"
              >
                {/* La boîte de la gélule est plus haute que la rangée (son halo est peint dans
                    l'image) : elle déborde sur le rembourrage plutôt que d'épaissir la ligne. */}
                <div aria-hidden className="-my-4 flex items-center justify-center">
                  <div style={{ width: `${capsule.scale * 100}%` }}>
                    <Capsule src={asset.src} size={120} rotate={capsule.rotate} halo={asset.halo} />
                  </div>
                </div>
                <div className="reveal">
                  <p className="type-overline text-text-3">{item.label}</p>
                  <h3 className="mt-2 font-sans text-[length:clamp(1.25rem,1.75vw,1.5rem)] leading-[1.22] font-semibold tracking-[-0.016em] text-balance text-text">
                    {item.title}
                  </h3>
                  <p className="type-small mt-2 max-w-[46ch] text-text-2">{item.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* --- Cas clients : un rail de publications, trois colonnes, puis les chiffres sur verre. --- */
/* Les visuels des trois clients entremêlés, un de chacun à tour de rôle : le
   rail montre la matière, pas un client après l'autre. */
function interleaveVisuals(ids: string[]): CaseVisual[] {
  const lists = ids.map((id) => CASE_VISUALS[id] ?? []);
  const longest = Math.max(0, ...lists.map((list) => list.length));
  const rail: CaseVisual[] = [];
  for (let i = 0; i < longest; i++) for (const list of lists) if (list[i]) rail.push(list[i]);
  return rail;
}

/* Les filets entre les quatre chiffres : une colonne, puis deux, puis quatre. */
const NUMBER_BORDERS = ["", "border-t sm:border-t-0 sm:border-l", "border-t lg:border-t-0 lg:border-l", "border-t sm:border-l lg:border-t-0"];

export function Cases({ dict }: { dict: Dictionary }) {
  const rail = interleaveVisuals(dict.cases.items.map((item) => item.id));
  return (
    <section id="cas" aria-labelledby="cas-titre" className="relative isolate scroll-mt-16 overflow-hidden">
      {/* L'anneau de lumière du Verre clair, coupé par le bord droit. */}
      <span aria-hidden className="ring-light -right-[18vw] -top-[22vw] -z-10 w-[62vw] opacity-90" />
      <div className="container-site section-pad relative">
        {/* La gélule irisée du Verre clair (r-18) et une plus petite, floutée, pour la profondeur. */}
        <div aria-hidden className="pointer-events-none absolute right-[2%] top-[calc(var(--section)-24px)] hidden w-[300px] lg:block xl:w-[340px]">
          <Capsule src={CAPSULE_ASSETS.hero.src} size={340} halo={CAPSULE_ASSETS.hero.halo} />
        </div>
        <div aria-hidden className="pointer-events-none absolute right-[26%] top-[calc(var(--section)+150px)] hidden w-[120px] lg:block">
          <Capsule src={CAPSULE_ASSETS.heroBlur.src} size={120} halo={CAPSULE_ASSETS.heroBlur.halo} />
        </div>
        <SectionHeading eyebrow={dict.cases.eyebrow} index={2} title={dict.cases.title} id="cas-titre" />
        {/* Le rail déborde du conteneur jusqu'aux bords de l'écran ; `body` est en `overflow-x: clip`. */}
        <ul tabIndex={0} aria-labelledby="cas-titre" className="reveal bleed-x mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-10">
          {rail.map((visual) => (
            <li key={visual.poster} className="w-[200px] shrink-0 snap-start md:w-[220px]">
              <PhoneCase poster={visual.poster} video={visual.video} alt={visual.alt} handle={visual.handle} />
            </li>
          ))}
        </ul>
        <ul className="reveal mt-6 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {dict.cases.items.map((item) => (
            <li key={item.id} className="border-t border-line-strong pt-5">
              <h3 className="type-h3 text-text">{item.client}</h3>
              <p className="type-data mt-1.5 text-text-3 sm:min-h-[2.9em]">{item.sector}</p>
              <span className="type-stat mt-5 block text-text">{item.stat.value}</span>
              <span className="type-small mt-2 block text-text-2">{item.stat.label}</span>
              {item.stat.source && <span className="type-caption mt-1 block text-text-3">{item.stat.source}</span>}
              <p className="type-small mt-3 text-text-2">{item.headline}</p>
            </li>
          ))}
        </ul>
        <dl className="reveal glass mt-14 grid grid-cols-1 rounded-xl sm:grid-cols-2 lg:grid-cols-4">
          {dict.cases.numbers.map((stat, index) => (
            <div key={stat.label} className={`border-line p-6 md:p-7 ${NUMBER_BORDERS[index] ?? ""}`}>
              <dt className="sr-only">{dict.cases.numbersLabel}</dt>
              <dd>
                <span className="type-h2 block text-text">{stat.value}</span>
                <span className="type-small mt-2 block text-text-2">{stat.label}</span>
                {stat.source && <span className="type-caption mt-1.5 block text-text-3">{stat.source}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* --- Méthode : cinq étapes numérotées en Geist Mono. ------------------------- */
export function Method({ dict }: { dict: Dictionary }) {
  return (
    <section id="methode" aria-labelledby="methode-titre" className="scroll-mt-16">
      <div className="container-site section-pad pt-0">
        <SectionHeading eyebrow={dict.method.eyebrow} index={3} title={dict.method.title} id="methode-titre" />
        <ol className="mt-12 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-5">
          {dict.method.steps.map((step, index) => (
            <li key={step.title} className="reveal border-t border-line-strong pt-5">
              <span className="type-overline flex items-center gap-2 text-text-3">
                <span aria-hidden className={`size-1.5 rounded-pill ${index === 0 ? "bg-signal" : "bg-text-3"}`} />
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="type-h3 mt-4 text-text lg:min-h-15">{step.title}</h3>
              <p className="type-small mt-2 hidden text-text-2 lg:block">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* --- FAQ : accordéons natifs, à filets. -------------------------------------- */
export function Faq({ dict }: { dict: Dictionary }) {
  return (
    <section id="faq" aria-labelledby="faq-titre" className="scroll-mt-16">
      <div className="container-site section-pad grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <SectionHeading eyebrow={dict.faq.eyebrow} index={5} title={dict.faq.title} id="faq-titre" />
        </div>
        <div className="reveal lg:col-span-7">
          {dict.faq.items.map((item) => (
            <details key={item.q} className="group border-t border-line-strong last:border-b">
              <summary className="type-lead flex cursor-pointer list-none items-center justify-between gap-6 py-5 font-medium text-text [&::-webkit-details-marker]:hidden">
                {item.q}
                <span aria-hidden className="relative size-5 shrink-0 text-text-3">
                  <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-current" />
                  <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-current transition-transform duration-(--motion) group-open:rotate-90" />
                </span>
              </summary>
              <p className="type-body max-w-2xl pb-6 text-text-2">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
