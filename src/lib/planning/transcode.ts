/**
 * Réencodage des vidéos reprises de Monday.
 *
 * Le stockage gratuit de Supabase plafonne à 1 Go pour tout le projet et à
 * 50 Mo par fichier ; les 71 vidéos d'ANMF et de Bondet pèsent 2,25 Go, dont
 * seize au-dessus du plafond. Ce sont des publications déjà parues, qui
 * servent d'archive : elles passent en 720p (bord court), H.264, son AAC —
 * la forme qu'un navigateur lit partout, `.mov` d'iPhone compris.
 *
 * Ce fichier ne fait que calculer les arguments : le script les passe à
 * ffmpeg. Tout se teste sans binaire.
 */

/** Ce que `ffprobe` dit d'une vidéo, réduit à ce qui décide de l'encodage. */
export type VideoProbe = {
  durationSeconds: number;
  hasAudio: boolean;
  /** `color_transfer` du premier flux vidéo : HLG ou PQ signalent du HDR. */
  colorTransfer: string | null;
};

/** Bord court : 720 px, qu'une vidéo soit verticale ou couchée. */
export const VIDEO_SHORT_EDGE = 720;

/** Plafond de débit vidéo par défaut, en kbit/s : net en 720p pour un reel. */
export const DEFAULT_VIDEO_KBPS = 1200;
const MIN_VIDEO_KBPS = 500;
export const AUDIO_KBPS = 96;

/** Plafond du bucket : au-delà, Supabase refuse l'envoi. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const HDR_TRANSFERS = new Set(["arib-std-b67", "smpte2084"]);

export function isHdr(probe: VideoProbe): boolean {
  return probe.colorTransfer !== null && HDR_TRANSFERS.has(probe.colorTransfer);
}

/**
 * Débit vidéo qui fait tenir l'ensemble dans le budget.
 *
 * Réparti à la durée, pas au fichier : une vidéo de dix secondes n'a pas
 * besoin de la même enveloppe qu'une de deux minutes. Sans budget, le
 * plafond par défaut ; jamais sous 500 kbit/s, en dessous l'image se défait.
 */
export function targetVideoKbps(input: {
  totalSeconds: number;
  budgetBytes: number | null;
}): number {
  if (input.budgetBytes === null || input.totalSeconds <= 0) return DEFAULT_VIDEO_KBPS;
  const totalKbps = (input.budgetBytes * 8) / 1000 / input.totalSeconds;
  const videoKbps = Math.floor(totalKbps - AUDIO_KBPS);
  return Math.max(MIN_VIDEO_KBPS, Math.min(DEFAULT_VIDEO_KBPS, videoKbps));
}

/**
 * Débit qui garantit le plafond de 50 Mo, pour une vidéo très longue.
 * Marge de 5 % : le débit d'un encodage à qualité constante n'est qu'un
 * plafond moyen.
 */
export function capForUploadLimit(videoKbps: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return videoKbps;
  const maxKbps = Math.floor((MAX_UPLOAD_BYTES * 0.95 * 8) / 1000 / durationSeconds) - AUDIO_KBPS;
  return Math.max(MIN_VIDEO_KBPS, Math.min(videoKbps, maxKbps));
}

/**
 * Arguments ffmpeg pour une vidéo.
 *
 * Qualité constante (CRF 26) sous plafond de débit : une image simple pèse
 * moins que le plafond, une image chargée ne le dépasse pas. ffmpeg applique
 * la rotation du téléphone avant le filtre, d'où l'échelle calculée sur les
 * dimensions **affichées**. Le HDR d'un iPhone est ramené en SDR — sans ça,
 * l'image sort grise et délavée sur tout écran qui ne le gère pas.
 */
export function transcodeArgs(input: {
  source: string;
  output: string;
  probe: VideoProbe;
  videoKbps: number;
}): string[] {
  const scale =
    `scale=w='if(gt(iw,ih),-2,min(${VIDEO_SHORT_EDGE},iw))'` +
    `:h='if(gt(iw,ih),min(${VIDEO_SHORT_EDGE},ih),-2)'`;

  const filters = isHdr(input.probe)
    ? [
        "zscale=t=linear:npl=100",
        "format=gbrpf32le",
        "zscale=p=bt709",
        "tonemap=tonemap=hable:desat=0",
        "zscale=t=bt709:m=bt709:r=tv",
        scale,
        "format=yuv420p",
      ]
    : [scale, "format=yuv420p"];

  const kbps = input.videoKbps;

  return [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    input.source,
    "-map",
    "0:v:0",
    ...(input.probe.hasAudio ? ["-map", "0:a:0"] : []),
    "-vf",
    filters.join(","),
    "-fpsmax",
    "30",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-profile:v",
    "high",
    "-crf",
    "26",
    "-maxrate",
    `${kbps}k`,
    "-bufsize",
    `${kbps * 2}k`,
    ...(input.probe.hasAudio
      ? ["-c:a", "aac", "-b:a", `${AUDIO_KBPS}k`, "-ac", "2"]
      : ["-an"]),
    "-movflags",
    "+faststart",
    input.output,
  ];
}

/** Sortie JSON de `ffprobe -show_streams -show_format` → ce qui nous sert. */
export function parseProbe(json: string): VideoProbe {
  const parsed = JSON.parse(json) as {
    streams?: { codec_type?: string; color_transfer?: string; duration?: string }[];
    format?: { duration?: string };
  };
  const streams = parsed.streams ?? [];
  const video = streams.find((stream) => stream.codec_type === "video");
  const duration = Number(parsed.format?.duration ?? video?.duration ?? 0);

  return {
    durationSeconds: Number.isFinite(duration) ? duration : 0,
    hasAudio: streams.some((stream) => stream.codec_type === "audio"),
    colorTransfer: video?.color_transfer ?? null,
  };
}

/** `CAPSULE 1 - VFINALE.mov` → `CAPSULE 1 - VFINALE.mp4` : le conteneur change. */
export function transcodedName(name: string): string {
  return /\.[a-z0-9]+$/i.test(name) ? name.replace(/\.[a-z0-9]+$/i, ".mp4") : `${name}.mp4`;
}

export function isVideoName(name: string): boolean {
  return /\.(mp4|mov|m4v|webm)$/i.test(name);
}
