import { PillsCanvas } from "@/components/backdrop/pills-canvas";
import { FuseWordmark } from "@/components/site/fuse-wordmark";
import { LogoMarquee } from "@/components/site/logo-marquee";
import { PhoneCase } from "@/components/site/phone-case";

/* Page de laboratoire, temporaire : les composants de la refonte, isolés. À supprimer avant la mise en ligne. */
export const dynamic = "force-static";

const LOGOS = [
  { src: "/logos/i-way.png", name: "I-WAY", width: 164, height: 160, tone: "invert" as const },
  { src: "/logos/bondet.png", name: "Lunettes Bondet", width: 160, height: 160, tone: "lift" as const },
  { src: "/logos/catherine-osti.png", name: "Catherine Osti", width: 221, height: 160, tone: "invert" as const },
  { src: "/logos/chasseurs-de-graines.svg", name: "Chasseurs de Graines", width: 274, height: 97, tone: "invert" as const },
  { src: "/logos/anmf.png", name: "ANMF", width: 160, height: 160, tone: "lift" as const },
  { src: "/logos/banque-populaire.png", name: "Banque Populaire", width: 160, height: 160, tone: "lift" as const },
  { src: "/logos/kare.svg", name: "Kare Design", width: 160, height: 28, tone: "invert" as const },
  { src: "/logos/mediapilote.svg", name: "Mediapilote", width: 298, height: 47, tone: "light" as const },
];

export default function Labo() {
  return (
    <main className="relative z-10 min-h-[300vh]">
      <PillsCanvas />
      <section className="container-site py-24">
        <h1 className="type-h1">Labo</h1>
        <p className="type-lead mt-4 max-w-xl text-text-2">Les pilules défilent derrière. Le texte doit rester lisible partout.</p>
      </section>
      <section className="py-16">
        <LogoMarquee logos={LOGOS} label="Clients" />
      </section>
      <section className="container-site grid grid-cols-2 gap-6 py-16 md:grid-cols-4">
        <PhoneCase poster="/cas/anmf-meunier.webp" video="/cas/anmf-meunier.mp4" alt="Reel meunier" handle="@chasseursdegraines" stat={{ value: "10,3 M", label: "vues TikTok" }} />
        <PhoneCase poster="/cas/bondet-solaire.webp" video="/cas/bondet-solaire.mp4" alt="Reel solaire" handle="@lunettesbondet" stat={{ value: "+114 %", label: "abonnés" }} />
        <PhoneCase poster="/cas/anmf-carrousel.webp" alt="Carrousel" handle="@chasseursdegraines" />
        <PhoneCase poster="/cas/bondet-joy.webp" alt="Post" handle="@lunettesbondet" />
      </section>
      <section className="container-site py-24">
        <FuseWordmark />
      </section>
    </main>
  );
}
