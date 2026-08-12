/**
 * Bouclier autour d'un appel de Server Action côté navigateur.
 *
 * Une action qui échoue au transport — corps rejeté par la plateforme,
 * connexion coupée, fonction expirée — ne **retourne** pas d'erreur : elle
 * jette, l'exception traverse la transition React, et l'écran entier tombe.
 * C'est le crash « page buggée » déjà payé deux fois par le Planning. Ici,
 * tout échec finit en union `{ ok: false }`, donc en toast.
 */
export async function safeAction<T extends { ok: boolean }>(
  run: () => Promise<T>,
): Promise<T | { ok: false; error: string }> {
  try {
    return await run();
  } catch {
    return {
      ok: false,
      error:
        "L'action n'a pas abouti (connexion interrompue ou serveur indisponible). Réessayer.",
    };
  }
}
