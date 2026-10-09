import { RevealObserver } from "@/components/ds/reveal-observer";
import { Funnel } from "@/components/funnel/funnel";
import type { Dictionary } from "@/i18n/types";
import { localePath, type Locale } from "@/i18n/locale";
import { Footer } from "./footer";
import { Header } from "./header";
import { Hero } from "./hero";
import { Cases, Faq, Method, Services } from "./sections";

/**
 * La page entière, dans l'ordre de la charte : la lave en hero, les
 * capsules ensuite (univers Profondeur), puis le Verre clair — preuves,
 * méthode, quiz, questions — et le pied de page qui retourne au sombre.
 */
export function Home({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const privacyHref = localePath(locale, locale === "fr" ? "/confidentialite" : "/privacy");
  return (
    <>
      <Header dict={dict} locale={locale} />
      <main>
        <Hero dict={dict} />
        <Services dict={dict} />
        {/* L'aura remonte sous les coins arrondis de la bande sombre, pour qu'ils découvrent le même fond. */}
        <div className="bg-aura -mt-14 pt-14">
          <Cases dict={dict} />
          <Method dict={dict} />
        </div>
        <section id="note" aria-labelledby="note-titre" className="relative isolate scroll-mt-16 overflow-hidden">
          {/* L'aura et l'anneau de lumière derrière le verre (r-03 en 3a) : le quiz vit dans le Verre clair. */}
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(42%_48%_at_84%_32%,rgb(34_224_91/.2),transparent_70%),radial-gradient(36%_40%_at_12%_52%,rgb(47_211_198/.14),transparent_70%)]" />
          <span aria-hidden className="ring-light -left-[16vw] top-[8%] -z-10 w-[40vw] min-w-[380px] max-w-[620px]" />
          <div className="container-site section-pad">
            <Funnel dict={dict.funnel} locale={locale} privacyHref={privacyHref} />
          </div>
        </section>
        <Faq dict={dict} />
      </main>
      <Footer dict={dict} locale={locale} />
      <RevealObserver />
    </>
  );
}
