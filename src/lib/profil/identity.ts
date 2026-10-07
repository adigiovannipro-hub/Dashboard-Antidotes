/**
 * Ce qu'on affiche d'une personne, et ce qui manque à sa fiche. Pur.
 */

type Named = {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
};

const clean = (value: string | null | undefined) => value?.trim() ?? "";

/**
 * Le nom à l'écran : « Prénom Nom », sinon le nom composé, sinon l'adresse.
 * Jamais « Inconnu » quand on sait quelque chose — c'est ce qu'un retour de
 * cliente affichait faute de pouvoir lire sa fiche.
 */
export function displayName(person: Named | null | undefined): string {
  if (!person) return "Utilisateur";
  const composed = [clean(person.first_name), clean(person.last_name)].filter(Boolean).join(" ");
  return composed || clean(person.full_name) || clean(person.email) || "Utilisateur";
}

/**
 * La fiche demande-t-elle l'accueil ? Prénom **et** nom, rien d'autre : la
 * photo est proposée, jamais exigée — une personne sans photo sous la main ne
 * doit pas rester bloquée à la porte. Quand l'agence a déjà nommé la personne
 * à l'invitation, la fiche est complète et l'accueil ne s'affiche pas.
 */
export function needsOnboarding(profile: Named | null | undefined): boolean {
  if (!profile) return false;
  return clean(profile.first_name) === "" || clean(profile.last_name) === "";
}

/** Un chemin de retour interne, jamais une adresse externe. */
export function safeNext(raw: string | null | undefined): string {
  const value = raw ?? "";
  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/bienvenue")
    ? value
    : "/";
}
