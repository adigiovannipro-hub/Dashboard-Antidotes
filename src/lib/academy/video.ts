/**
 * Reconnaissance des URL vidéo collées dans le back-office.
 *
 * L'admin colle une URL YouTube, Vimeo ou Mux sous n'importe quelle forme —
 * page de visionnage, lien court, lien d'embed — et on en extrait le
 * fournisseur et l'identifiant. La colonne `video_url` garde l'URL telle que
 * collée : c'est elle qui reste lisible et corrigeable ; l'identifiant se
 * recalcule à l'affichage.
 *
 * Fonctions pures, sans import Supabase : elles servent au serveur (actions)
 * comme au navigateur (aperçu du back-office, lecteur).
 */

export type ParsedVideo = {
  provider: "youtube" | "vimeo" | "mux";
  id: string;
};

/** Identifiant YouTube : 11 caractères, lettres, chiffres, `-` et `_`. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function parseVideoUrl(input: string): ParsedVideo | null {
  const raw = input.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  // --- YouTube ---------------------------------------------------------------
  if (host === "youtu.be") {
    const id = segments[0] ?? "";
    return YOUTUBE_ID.test(id) ? { provider: "youtube", id } : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "m.youtube.com") {
    const fromParam = url.searchParams.get("v");
    if (fromParam && YOUTUBE_ID.test(fromParam)) {
      return { provider: "youtube", id: fromParam };
    }
    // /embed/<id>, /shorts/<id>, /live/<id>, /v/<id>
    if (["embed", "shorts", "live", "v"].includes(segments[0] ?? "")) {
      const id = segments[1] ?? "";
      if (YOUTUBE_ID.test(id)) return { provider: "youtube", id };
    }
    return null;
  }

  // --- Vimeo -----------------------------------------------------------------
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    // vimeo.com/123456, vimeo.com/123456/abcdef (lien privé),
    // player.vimeo.com/video/123456
    const numeric = segments.find((segment) => /^\d{6,}$/.test(segment));
    if (numeric) {
      // Le hash d'un lien privé suit l'identifiant : on le garde, l'embed en
      // a besoin (`?h=`), et le perdre rendrait la vidéo « introuvable ».
      const hashIndex = segments.indexOf(numeric) + 1;
      const hash = segments[hashIndex];
      const id =
        hash && /^[a-f0-9]{8,12}$/i.test(hash) ? `${numeric}/${hash}` : numeric;
      return { provider: "vimeo", id };
    }
    return null;
  }

  // --- Mux -------------------------------------------------------------------
  if (host === "player.mux.com" || host === "stream.mux.com") {
    const first = segments[0] ?? "";
    const id = first.replace(/\.m3u8$/, "");
    if (/^[A-Za-z0-9]{10,}$/.test(id)) return { provider: "mux", id };
    return null;
  }

  return null;
}

/** L'URL d'iframe du lecteur embarqué, pour un identifiant déjà extrait. */
export function embedUrl(video: ParsedVideo): string {
  switch (video.provider) {
    case "youtube":
      // `youtube-nocookie` : pas de cookie de suivi avant lecture.
      return `https://www.youtube-nocookie.com/embed/${video.id}?rel=0`;
    case "vimeo": {
      const [id, hash] = video.id.split("/");
      const suffix = hash ? `?h=${hash}` : "";
      return `https://player.vimeo.com/video/${id}${suffix}`;
    }
    case "mux":
      return `https://player.mux.com/${video.id}`;
  }
}
