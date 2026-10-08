import { RevealObserver } from "@/components/ds/reveal-observer";
import { Funnel } from "@/components/funnel/funnel";
import type { Dictionary } from "@/i18n/types";
import { localePath, type Locale } from "@/i18n/locale";
import { Footer } from "./footer";
import { Header } from "./header";
import { Hero } from "./hero";
import { About, Cases, Faq, FinalCta, Method, Mirror, Offer, Proof, SectionHeading, Services, Tools } from "./sections";

/** La page entière, dans l'ordre du tunnel : promesse, preuve, méthode, geste. */
export function Home({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const privacyHref = localePath(locale, locale === "fr" ? "/confidentialite" : "/privacy");
  return (
    <>
      <Header dict={dict} locale={locale} />
      <main>
        <Hero dict={dict} />
        <Proof dict={dict} />
        <Mirror dict={dict} />
        <Cases dict={dict} />
        <Services dict={dict} />
        <Method dict={dict} />
        <Tools dict={dict} />
        <About dict={dict} />
        <Offer dict={dict} />
        <section id="note" aria-labelledby="note-titre" className="scroll-mt-20 border-t border-line bg-ink-1">
          <div className="container-site section-pad">
            <div className="mx-auto max-w-3xl text-center">
              <SectionHeading eyebrow={dict.funnel.eyebrow} title={dict.funnel.title} lead={dict.funnel.lead} align="center" />
            </div>
            <div className="mx-auto mt-12 max-w-3xl">
              <Funnel dict={dict.funnel} locale={locale} privacyHref={privacyHref} />
            </div>
          </div>
        </section>
        <Faq dict={dict} />
        <FinalCta dict={dict} />
      </main>
      <Footer dict={dict} locale={locale} />
      <RevealObserver />
    </>
  );
}
