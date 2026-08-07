/**
 * Le nom d'une échéance vient de son engagement : le client et la prestation.
 * Passé en objet plat — il traverse la frontière serveur → client.
 */
export type EngagementNames = Record<
  string,
  { client: string; label: string }
>;
