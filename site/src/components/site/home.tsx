import { PillsCanvas } from "@/components/backdrop/pills-canvas";
import { RevealObserver } from "@/components/ds/reveal-observer";
import { Funnel } from "@/components/funnel/funnel";
import type { Dictionary } from "@/i18n/types";
import { localePath, type Locale } from "@/i18n/locale";
import { Footer } from "./footer";
import { Header } from "./header";
import { Hero } from "./hero";
import { About, Cases, Faq, Method, Services } from "./sections";

/**
 * La page entière, sept sections : promesse, preuves, services, méthode,
 * qui, note, questions. Les pilules défilent derrière tout le corps ; le
 * hero, opaque, les cache le temps de l'ouverture.
 */
export function Home({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const privacyHref = localePath(locale, locale === "fr" ? "/confidentialite" : "/privacy");
  return (
    <>
      <PillsCanvas />
      <div className="relative z-10">
        <Header dict={dict} locale={locale} />
        <main>
          <Hero dict={dict} />
          <Cases dict={dict} />
          <Services dict={dict} />
          <Method dict={dict} />
          <About dict={dict} />
          <section id="note" aria-labelledby="note-titre" className="scroll-mt-20 border-t border-line">
            <div className="container-site section-pad">
              <div className="mx-auto max-w-3xl">
                <Funnel dict={dict.funnel} locale={locale} privacyHref={privacyHref} />
              </div>
            </div>
          </section>
          <Faq dict={dict} />
        </main>
        <Footer dict={dict} locale={locale} />
      </div>
      <RevealObserver />
    </>
  );
}
