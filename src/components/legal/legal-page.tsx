import Link from "next/link";

import { Wordmark } from "@/components/wordmark";
import { LEGAL_MAJ } from "@/lib/legal/entity";

/**
 * Le cadre des pages légales — confidentialité, conditions d'utilisation.
 *
 * Pas d'`AppShell` : ces pages sont **publiques** (`PUBLIC_PATHS`), lues par
 * un client, un visiteur, et le jour de la revue d'une app, par l'examinateur
 * d'une plateforme. Leur montrer le rail de navigation de l'outil interne
 * n'aurait aucun sens — et le rail suppose un `viewer`, qu'un visiteur
 * anonyme n'a pas.
 *
 * Une colonne unique, bornée à 42 rem : au-delà, l'œil perd la ligne suivante
 * dans un texte de cette longueur.
 */
export function LegalPage({
  title,
  children,
  other,
}: {
  title: string;
  children: React.ReactNode;
  /** L'autre page légale — les deux se citent, personne ne cherche l'URL. */
  other: { href: string; label: string };
}) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 md:py-16">
      <header className="mb-8">
        <Link
          href="/"
          aria-label="Antidotes, accueil"
          className="focus-visible:ring-ring inline-block rounded-sm focus-visible:ring-2 focus-visible:outline-none"
        >
          <Wordmark />
        </Link>
        <h1 className="type-h1 mt-6">{title}</h1>
        <p className="type-caption mt-2 text-text-secondary">
          Dernière mise à jour : {LEGAL_MAJ}
        </p>
      </header>

      {/* `space-y` plutôt qu'une classe de prose : le projet n'a pas de plugin
          typographique, et les sections portent déjà leur rythme. */}
      <div className="space-y-8">{children}</div>

      <footer className="mt-12 border-t border-border pt-6">
        <Link
          href={other.href}
          className="type-caption text-text-secondary underline underline-offset-4 hover:text-text-primary"
        >
          {other.label}
        </Link>
      </footer>
    </main>
  );
}

/** Une section : un titre, puis du texte. */
export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="type-h3 mb-2">{title}</h2>
      <div className="type-body space-y-3 text-text-secondary">{children}</div>
    </section>
  );
}

/**
 * Une liste de termes définis — « Composio — passerelle d'autorisation… ».
 *
 * Le séparateur est posé par le composant, jamais dans le JSX de l'appelant.
 * La raison est un piège vécu à l'écran : un nœud de texte JSX qui contient
 * une entité HTML (`&apos;`, qu'impose la règle `react/no-unescaped-entities`
 * sur une apostrophe française) perd l'espace qui le précède — « Composio—
 * passerelle » au lieu de « Composio — passerelle ». Trois entrées sur huit
 * étaient touchées, et rien ne le signalait : ni le typecheck, ni le lint,
 * ni les tests. Ici les descriptions sont des **chaînes**, où l'apostrophe
 * n'a rien à échapper.
 */
export function LegalTerms({
  items,
}: {
  items: readonly { term: string; text: string }[];
}) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item) => (
        <li key={item.term}>
          <strong className="text-text-primary">{item.term}</strong> — {item.text}
        </li>
      ))}
    </ul>
  );
}

/** Une liste à puces, au même rythme que le texte courant. */
export function LegalList({ items }: { items: readonly React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}
