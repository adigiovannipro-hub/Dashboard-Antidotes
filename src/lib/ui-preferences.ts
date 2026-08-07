/**
 * Préférences d'affichage mémorisées dans un cookie.
 *
 * Ni `"use client"`, ni `import "server-only"` : ce module est lu des deux
 * côtés, et c'est tout son intérêt. Une constante exportée depuis un fichier
 * `"use client"` devient une **référence opaque** quand un composant serveur
 * l'importe — elle ne vaut plus la chaîne qu'elle contient, et le cookie
 * n'est jamais retrouvé. Le défaut est silencieux : rien ne casse, le réglage
 * ne se souvient simplement de rien.
 *
 * Un cookie plutôt que le stockage local : c'est le serveur qui doit connaître
 * la préférence, puisque c'est lui qui rend la première image.
 */

/** Rail de navigation replié. `"1"` replié, tout le reste déplié. */
export const RAIL_COOKIE = "antidotes_rail";

/**
 * Montants de trésorerie masqués sur l'écran Finance. `"1"` masqué.
 *
 * Le défaut est « visible » : c'est un écran privé, et un chiffre caché par
 * défaut obligerait à un clic à chaque ouverture. Le masque sert au moment où
 * quelqu'un regarde par-dessus l'épaule, pas en permanence.
 */
export const CASH_HIDDEN_COOKIE = "antidotes_cash_hidden";

/** Un an, limité à ce site : une préférence d'affichage ne voyage pas. */
export const PREFERENCE_MAX_AGE = 31_536_000;
