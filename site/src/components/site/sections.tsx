import type { Dictionary, Stat } from "@/i18n/types";

/**
 * Les sections du corps, toutes rendues côté serveur : du texte, des
 * grilles, des `<details>` natifs pour ce qui se déplie. Aucun état client.
 */
export function SectionHeading({ eyebrow, title, lead, align = "left" }: { eyebrow: string; title: string; lead?: string; align?: "left" | "center" }) {
  return (
    <div className={`reveal max-w-3xl ${align === "center" ? "mx-auto text-center" : ""}`}>
      <p className="type-overline text-accent-ink">{eyebrow}</p>
      <h2 className="type-h2 mt-4 text-text">{title}</h2>
      {lead ? <p className="type-lead mt-5 text-text-2">{lead}</p> : null}
    </div>
  );
}

export function StatBlock({ stat, size = "lg" }: { stat: Stat; size?: "lg" | "md" }) {
  return (
    <div>
      <div className={size === "lg" ? "type-stat text-iris" : "type-h2 text-text"}>{stat.value}</div>
      <p className="type-small mt-2 text-text">{stat.label}</p>
      {stat.source ? <p className="type-caption mt-1 text-text-3">{stat.source}</p> : null}
    </div>
  );
}

export function Proof({ dict }: { dict: Dictionary }) {
  return (
    <section aria-labelledby="preuves" className="border-y border-line bg-ink-1">
      <div className="container-site py-14 md:py-20">
        <p id="preuves" className="type-overline reveal text-text-3">{dict.proof.eyebrow}</p>
        <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {dict.proof.items.map((stat) => (
            <div key={stat.label} className="reveal">
              <StatBlock stat={stat} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Mirror({ dict }: { dict: Dictionary }) {
  return (
    <section aria-labelledby="miroir" className="container-site section-pad">
      <SectionHeading eyebrow={dict.mirror.eyebrow} title={dict.mirror.title} />
      <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
        {dict.mirror.items.map((item, index) => (
          <div key={index} className="glass reveal rounded-lg p-6 md:p-7">
            <p className="type-body text-text">{item.situation}</p>
            <p className="type-small mt-5 border-t border-line pt-5 text-text-2">{item.result}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Cases({ dict }: { dict: Dictionary }) {
  return (
    <section id="cas" aria-labelledby="cas-titre" className="scroll-mt-20 border-t border-line bg-ink-1">
      <div className="container-site section-pad">
        <SectionHeading eyebrow={dict.cases.eyebrow} title={dict.cases.title} lead={dict.cases.lead} />
        <div className="mt-12 space-y-4">
          {dict.cases.items.map((item, index) => (
            <details key={item.id} className="group glass reveal rounded-lg open:bg-glass-strong" open={index === 0}>
              <summary className="flex cursor-pointer list-none flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                  <p className="type-overline text-text-3">{item.sector}</p>
                  <h3 className="type-h3 mt-2 text-text">
                    {item.client} <span className="text-text-2">— {item.headline}</span>
                  </h3>
                </div>
                <div className="flex shrink-0 items-center gap-6">
                  <div className="text-left md:text-right">
                    <div className="type-h2 text-iris">{item.results[0]?.value}</div>
                    <p className="type-caption max-w-[18rem] text-text-2">{item.results[0]?.label}</p>
                  </div>
                  <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-pill border border-line text-text-2 transition-transform duration-(--motion) group-open:rotate-45">
                    +
                  </span>
                </div>
              </summary>
              <div className="grid grid-cols-1 gap-8 border-t border-line p-6 md:grid-cols-5 md:p-8">
                <div className="md:col-span-3">
                  <p className="type-overline text-accent-ink">{dict.cases.needLabel}</p>
                  <p className="type-body mt-2 text-text-2">{item.need}</p>
                  <p className="type-overline mt-6 text-accent-ink">{dict.cases.answerLabel}</p>
                  <p className="type-body mt-2 text-text-2">{item.answer}</p>
                  <p className="type-caption mt-6 text-text-3">{item.period}</p>
                  {item.note ? <p className="type-caption mt-1 text-text-3">{item.note}</p> : null}
                </div>
                <div className="md:col-span-2">
                  <p className="type-overline text-accent-ink">{dict.cases.resultsLabel}</p>
                  <dl className="mt-3 divide-y divide-line">
                    {item.results.map((stat) => (
                      <div key={stat.label} className="py-4">
                        <dt className="type-h3 text-text">{stat.value}</dt>
                        <dd className="type-small mt-1 text-text-2">{stat.label}</dd>
                        {stat.source ? (
                          <dd className="type-caption mt-1 text-text-3">
                            {dict.cases.sourceLabel} : {stat.source}
                          </dd>
                        ) : null}
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </details>
          ))}
        </div>

        <div className="mt-20 grid grid-cols-1 gap-10 lg:grid-cols-5">
          <div className="reveal lg:col-span-2">
            <p className="type-overline text-accent-ink">{dict.cases.more.eyebrow}</p>
            <h3 className="type-h3 mt-3 text-text">{dict.cases.more.title}</h3>
            <p className="type-body mt-4 text-text-2">{dict.cases.more.text}</p>
          </div>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-3">
            {dict.cases.more.items.map((item) => (
              <li key={item.title} className="reveal rounded-md border border-line p-5">
                <p className="type-small font-medium text-text">{item.title}</p>
                <p className="type-small mt-2 text-text-2">{item.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function Services({ dict }: { dict: Dictionary }) {
  return (
    <section id="services" aria-labelledby="services-titre" className="container-site section-pad scroll-mt-20">
      <SectionHeading eyebrow={dict.services.eyebrow} title={dict.services.title} lead={dict.services.lead} />
      <ol className="mt-12 grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
        {dict.services.items.map((item, index) => (
          <li key={item.name} className="reveal border-t border-line pt-5">
            <p className="type-caption font-mono text-text-3">{String(index + 1).padStart(2, "0")}</p>
            <h3 className="type-h3 mt-2 text-text">{item.name}</h3>
            <p className="type-small mt-2 text-text-2">{item.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Method({ dict }: { dict: Dictionary }) {
  return (
    <section id="methode" aria-labelledby="methode-titre" className="scroll-mt-20 border-t border-line bg-ink-1">
      <div className="container-site section-pad">
        <SectionHeading eyebrow={dict.method.eyebrow} title={dict.method.title} lead={dict.method.lead} />
        <ol className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {dict.method.steps.map((step, index) => (
            <li key={step.title} className="glass reveal relative rounded-lg p-6">
              <span className="type-stat absolute right-5 top-4 text-iris opacity-70" aria-hidden>
                {index + 1}
              </span>
              <h3 className="type-h3 max-w-[70%] text-text">{step.title}</h3>
              <p className="type-small mt-3 text-text-2">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Tools({ dict }: { dict: Dictionary }) {
  return (
    <section id="outils" aria-labelledby="outils-titre" className="container-site section-pad scroll-mt-20">
      <SectionHeading eyebrow={dict.tools.eyebrow} title={dict.tools.title} lead={dict.tools.lead} />
      <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-6">
        {dict.tools.items.map((item, index) => (
          <div key={item.name} className={`glass reveal rounded-lg p-6 ${index < 2 ? "md:col-span-3" : "md:col-span-2"}`}>
            <h3 className="type-h3 text-text">{item.name}</h3>
            <p className="type-small mt-3 text-text-2">{item.text}</p>
          </div>
        ))}
      </div>
      <div className="reveal mt-10 rounded-lg border border-line p-6 md:p-8">
        <p className="type-overline text-accent-ink">{dict.tools.proofsTitle}</p>
        <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {dict.tools.proofs.map((proof) => (
            <li key={proof} className="type-small flex gap-3 text-text-2">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-pill bg-iris-violet" />
              {proof}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function About({ dict }: { dict: Dictionary }) {
  return (
    <section aria-labelledby="apropos" className="border-t border-line bg-ink-1">
      <div className="container-site section-pad grid grid-cols-1 gap-10 lg:grid-cols-5">
        <div className="reveal lg:col-span-3">
          <p className="type-overline text-accent-ink">{dict.about.eyebrow}</p>
          <h2 id="apropos" className="type-h2 mt-4 text-text">{dict.about.title}</h2>
          <p className="type-lead mt-6 text-text-2">{dict.about.bio}</p>
          <p className="type-caption mt-6 text-text-3">{dict.about.location}</p>
        </div>
        <ul className="reveal space-y-3 lg:col-span-2">
          {dict.about.points.map((point) => (
            <li key={point} className="type-small flex gap-3 rounded-md border border-line p-4 text-text">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-pill bg-iris-cyan" />
              {point}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Offer({ dict }: { dict: Dictionary }) {
  return (
    <section aria-labelledby="cadre" className="container-site section-pad">
      <div className="glass reveal grid grid-cols-1 gap-8 rounded-xl p-8 md:grid-cols-2 md:p-12">
        <div>
          <p className="type-overline text-accent-ink">{dict.offer.eyebrow}</p>
          <h2 id="cadre" className="type-h2 mt-4 text-text">{dict.offer.title}</h2>
          <p className="type-body mt-5 text-text-2">{dict.offer.text}</p>
          <a href="#note" className="type-small mt-8 inline-flex rounded-pill bg-text px-5 py-3 font-medium text-text-on-light transition-transform duration-(--motion) hover:-translate-y-px">
            {dict.offer.cta}
          </a>
        </div>
        <ul className="space-y-3 self-center">
          {dict.offer.items.map((item) => (
            <li key={item} className="type-body flex gap-3 text-text">
              <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-pill bg-iris-pink" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Faq({ dict }: { dict: Dictionary }) {
  return (
    <section id="faq" aria-labelledby="faq-titre" className="scroll-mt-20 border-t border-line bg-ink-1">
      <div className="container-site section-pad grid grid-cols-1 gap-10 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <SectionHeading eyebrow={dict.faq.eyebrow} title={dict.faq.title} />
        </div>
        <div className="divide-y divide-line lg:col-span-3">
          {dict.faq.items.map((item) => (
            <details key={item.q} className="group reveal py-5">
              <summary className="type-h3 flex cursor-pointer list-none items-center justify-between gap-6 text-text [&::-webkit-details-marker]:hidden">
                {item.q}
                <span aria-hidden className="type-h3 shrink-0 text-text-3 transition-transform duration-(--motion) group-open:rotate-45">+</span>
              </summary>
              <p className="type-body mt-3 max-w-2xl text-text-2">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta({ dict }: { dict: Dictionary }) {
  return (
    <section aria-labelledby="final" className="container-site section-pad">
      <div className="reveal mx-auto max-w-3xl text-center">
        <h2 id="final" className="type-h1 text-text">{dict.final.title}</h2>
        <p className="type-lead mt-5 text-text-2">{dict.final.lead}</p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="#note" className="type-body inline-flex rounded-pill bg-text px-6 py-3.5 font-medium text-text-on-light transition-transform duration-(--motion) hover:-translate-y-px">
            {dict.final.cta}
          </a>
          <a href="#note?direct=1" className="type-body inline-flex rounded-pill border border-line-strong px-6 py-3.5 text-text transition-colors duration-(--motion) hover:bg-glass">
            {dict.final.ctaSecondary}
          </a>
        </div>
      </div>
    </section>
  );
}
