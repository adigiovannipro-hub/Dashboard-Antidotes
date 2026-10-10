import type { CSSProperties } from "react";
import { CAPSULE_ASSETS, Capsule, SERVICE_PILLS, type ServicePill } from "@/components/brand/capsule";
import { Rich } from "@/components/brand/rich";
import type { Dictionary, Service } from "@/i18n/types";
import { CASE_VISUALS, type CaseVisual } from "@/lib/cases";
import { CLIENT_LOGOS } from "@/lib/logos";
import { LogoMarquee } from "./logo-marquee";
import { MethodTimeline } from "./method-timeline";
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

/* --- Services : une rangée par expertise, signée par sa pilule (r-06). ------ */
/* Retour du 10/10 : chaque service se lit par sa promesse (`title`), en
   rangées. Retour du 11/10 : les pilules redeviennent vertes et portent le
   nom du service, gravé ton sur ton (r-06) — c'est la pilule qui nomme le
   service, le libellé en texte ne reste que pour les lecteurs d'écran (et
   revient à l'écran pour une pilule lisse, `engraved: false`). Assez grande
   pour que le mot se lise, elle déborde sur le rembourrage de la rangée
   plutôt que de l'épaissir.
   Jamais deux pilules de même taille ni de même orientation (r-06) : chacune
   occupe une part différente de sa colonne et ne s'écarte que de quelques
   degrés de l'inclinaison déjà rendue dans l'image — au-delà, la lumière
   partirait dans tous les sens et le mot pencherait. */
const PILLS: Record<Service["icon"], { pill: ServicePill; scale: number; rotate: number }> = {
  compass: { pill: "strategie", scale: 0.9, rotate: -3 },
  calendar: { pill: "accompagnement", scale: 1, rotate: 2 },
  clapperboard: { pill: "production", scale: 0.97, rotate: -2 },
  target: { pill: "publicite", scale: 0.84, rotate: 4 },
  layout: { pill: "plateforme", scale: 0.87, rotate: -4 },
  sparkles: { pill: "ia", scale: 0.72, rotate: 3 },
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
        <ul className="mt-12 md:mt-16 lg:grid lg:grid-cols-2 lg:gap-x-12 xl:gap-x-16">
          {dict.services.items.map((item) => {
            const placement = PILLS[item.icon];
            const pill = SERVICE_PILLS[placement.pill];
            /* Sur téléphone, la pilule est seule sur sa ligne : on retire le vide de son
               cadre (le halo) pour que la matière s'aligne sur la marge et s'arrête à
               un demi-cran du titre, quelle que soit sa forme. */
            const side = 200 * placement.scale;
            const trim = {
              "--trim-t": `${Math.round(pill.core.top * side)}px`,
              "--trim-b": `${Math.round((1 - pill.core.bottom) * side) - 12}px`,
              "--trim-l": `${Math.round(pill.core.left * side)}px`,
            } as CSSProperties;
            return (
              <li
                key={item.label}
                className="capsule-host grid grid-cols-1 border-b border-line py-7 first:border-t sm:grid-cols-[176px_minmax(0,1fr)] sm:items-center sm:gap-x-6 md:py-8 lg:grid-cols-[160px_minmax(0,1fr)] lg:nth-2:border-t xl:grid-cols-[196px_minmax(0,1fr)] xl:gap-x-8"
              >
                {/* La boîte de la pilule est bien plus haute que la pilule (son halo est peint
                    dans l'image) : elle mord sur le rembourrage au lieu d'épaissir la rangée.
                    Sur téléphone, elle passe au-dessus du titre, calée sur sa marge gauche. */}
                <div
                  aria-hidden
                  style={trim}
                  className="mt-[calc(-1*var(--trim-t))] mb-[calc(-1*var(--trim-b))] ml-[calc(-1*var(--trim-l))] flex w-[200px] items-center sm:-my-10 sm:ml-0 sm:w-auto sm:justify-center"
                >
                  <div style={{ width: `${placement.scale * 100}%` }} className="flex justify-center">
                    <Capsule src={pill.src[dict.locale]} size={200} rotate={placement.rotate} halo={pill.halo} />
                  </div>
                </div>
                <div className="reveal">
                  <p className={pill.engraved ? "sr-only" : "type-overline mb-2 text-text-3"}>{item.label}</p>
                  <h3 className="font-sans text-[length:clamp(1.25rem,1.75vw,1.5rem)] leading-[1.22] font-semibold tracking-[-0.016em] text-balance text-text">
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

/* --- Méthode : une flèche que le défilement trace, cinq étapes le long. -------- */
/* Retour du 10/10 : la flèche se dessine de gauche à droite au fil du
   défilement, les cinq étapes apparaissent une à une, et un curseur Signal la
   parcourt jusqu'à la pointe. Le rendu serveur est l'état final — flèche
   pleine, curseur au bout, tout lisible — : c'est ce que voient un visiteur
   sans JavaScript et celui qui a demandé de réduire les animations. */
export function Method({ dict }: { dict: Dictionary }) {
  return (
    <section id="methode" aria-labelledby="methode-titre" className="scroll-mt-16">
      <MethodTimeline steps={dict.method.steps}>
        <SectionHeading eyebrow={dict.method.eyebrow} index={3} title={dict.method.title} id="methode-titre" />
      </MethodTimeline>
    </section>
  );
}

/* --- FAQ : accordéons natifs, à filets. -------------------------------------- */
/* Un seul dévoilement à la fois (retour du 10/10) : les `<details>` d'un même
   `name` forment un accordéon exclusif, tenu par le navigateur — ouvrir une
   question referme l'autre, sans script, clavier et lecteur d'écran compris.
   Un navigateur qui ne le connaît pas laisse simplement plusieurs réponses
   ouvertes. */
export function Faq({ dict }: { dict: Dictionary }) {
  return (
    <section id="faq" aria-labelledby="faq-titre" className="scroll-mt-16">
      <div className="container-site section-pad grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <SectionHeading eyebrow={dict.faq.eyebrow} index={5} title={dict.faq.title} id="faq-titre" />
        </div>
        <div className="reveal lg:col-span-7">
          {dict.faq.items.map((item) => (
            <details key={item.q} name="faq" className="group border-t border-line-strong last:border-b">
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
