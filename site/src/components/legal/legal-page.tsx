import Link from "next/link";

import { Logo } from "@/components/ds/logo";
import { LEGAL_MAJ } from "@/lib/legal/entity";

/**
 * Le cadre des pages légales — confidentialité, conditions d'utilisation.
 * Une colonne unique, bornée à 42 rem : au-delà, l'œil perd la ligne
 * suivante dans un texte de cette longueur.
 */
export function LegalPage({
  title,
  children,
  other,
  home,
  updatedLabel,
  updated = LEGAL_MAJ,
}: {
  title: string;
  children: React.ReactNode;
  other: { href: string; label: string };
  home: string;
  updatedLabel: string;
  updated?: string;
}) {
  return (
    <main className="bg-aura min-h-svh w-full px-5 py-10 md:py-16">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-8">
          <Link href={home} aria-label="antidotes" className="inline-block text-text">
            <Logo height={22} />
          </Link>
          <h1 className="type-h1 mt-8 text-text">{title}</h1>
          <p className="type-data mt-3 text-text-3">
            {updatedLabel} {updated}
          </p>
        </header>
        <div className="space-y-8">{children}</div>
        <footer className="mt-12 border-t border-line-strong pt-6">
          <Link href={other.href} className="type-caption text-text-2 underline underline-offset-4 hover:text-text">
            {other.label}
          </Link>
        </footer>
      </div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="type-h3 mb-2 text-text">{title}</h2>
      <div className="type-body space-y-3 text-text-2">{children}</div>
    </section>
  );
}

/** Une liste de termes définis. Le séparateur est posé ici, jamais dans le JSX appelant. */
export function LegalTerms({ items }: { items: readonly { term: string; text: string }[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item) => (
        <li key={item.term}>
          <strong className="text-text">{item.term}</strong> — {item.text}
        </li>
      ))}
    </ul>
  );
}

export function LegalList({ items }: { items: readonly React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="underline underline-offset-4 hover:text-text">
      {children}
    </a>
  );
}
