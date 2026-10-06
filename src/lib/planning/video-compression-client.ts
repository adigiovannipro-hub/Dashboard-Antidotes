import { MAX_VISUAL_BYTES } from "./storage";
import {
  compressedName,
  formatDuration,
  planCompression,
  planRetry,
} from "./video-compression";

/**
 * Le réencodage lui-même, dans le navigateur qui envoie.
 *
 * WebCodecs par Mediabunny : le décodage et l'encodage passent par
 * l'accélération matérielle du poste, la vidéo est lue par morceaux — un
 * master de 1 Go ne charge jamais en mémoire — et seule la sortie, sous
 * 50 Mo, y tient. Les deux bibliothèques ne se chargent qu'au premier fichier
 * à compresser : le planning ne paie rien tant qu'on n'envoie que des images.
 *
 * Sortie en MP4 H.264, `moov` en tête : la forme qu'Instagram et Facebook
 * acceptent pour un reel, et qu'un navigateur lit avant d'avoir tout reçu. Le
 * son AAC est recopié tel quel ; un autre son est réencodé en AAC.
 */

export class VideoCompressionError extends Error {}

/** Trois passages au plus : les suivants ne servent que si le précédent a
    débordé, chacun un cran de définition plus bas. */
const MAX_ATTEMPTS = 3;

const TRANSCODED_AUDIO_BITRATE = 160_000;

let aacEncoderRegistered = false;

export async function compressVideo(
  file: File,
  onProgress: (ratio: number, attempt: number) => void,
): Promise<File> {
  const mb = await import("mediabunny");
  const fail = (reason: string) => new VideoCompressionError(`${file.name} : ${reason}`);

  if (!(await mb.canEncodeVideo("avc"))) {
    throw fail(
      "ce navigateur ne sait pas compresser une vidéo. Ouvre le planning dans Chrome ou Safari, ou exporte-la sous 50 Mo.",
    );
  }

  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  try {
    const videoTrack = await input.getPrimaryVideoTrack().catch(() => null);
    if (!videoTrack) throw fail("aucune image lisible dans ce fichier.");
    const audioTrack = await input.getPrimaryAudioTrack().catch(() => null);

    const durationSeconds = await input.computeDuration();
    const copyAudio = audioTrack ? (await audioTrack.getCodec()) === "aac" : false;
    const audioBitrate = !audioTrack
      ? 0
      : copyAudio
        ? (await audioTrack.computePacketStats(200)).averageBitrate
        : TRANSCODED_AUDIO_BITRATE;

    // Chrome sous Windows et Firefox n'ont pas toujours d'encodeur AAC : un
    // encodeur WASM prend le relais, chargé seulement quand il sert.
    if (audioTrack && !copyAudio && !aacEncoderRegistered && !(await mb.canEncodeAudio("aac"))) {
      const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
      registerAacEncoder();
      aacEncoderRegistered = true;
    }

    const plan = planCompression({
      durationSeconds,
      displayWidth: await videoTrack.getDisplayWidth(),
      displayHeight: await videoTrack.getDisplayHeight(),
      audioBitrate,
    });
    if (!plan.ok) {
      throw fail(
        plan.reason === "too_long"
          ? `${formatDuration(durationSeconds)}, trop longue pour tenir sous 50 Mo. Raccourcis-la ou exporte-la plus légère.`
          : "durée ou dimensions illisibles.",
      );
    }

    let settings = { videoBitrate: plan.videoBitrate, width: plan.width, height: plan.height };
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const output = new mb.Output({
        format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }),
        target: new mb.BufferTarget(),
      });
      const conversion = await mb.Conversion.init({
        input,
        output,
        tracks: "primary",
        showWarnings: false,
        video: {
          codec: "avc",
          width: settings.width,
          height: settings.height,
          fit: "fill",
          quality: new mb.Quality({ bitrate: settings.videoBitrate, bitrateMode: "variable" }),
          // La rotation d'un tournage au téléphone est inscrite dans les
          // images, pas laissée en métadonnée qu'un lecteur pourrait ignorer.
          allowTransformationMetadata: false,
          forceTranscode: true,
        },
        audio: copyAudio
          ? { codec: "aac" }
          : {
              codec: "aac",
              quality: new mb.Quality({ bitrate: TRANSCODED_AUDIO_BITRATE }),
            },
      });

      // Un reel muet publié sans prévenir serait pire qu'un refus.
      const used = conversion.utilizedTracks;
      if (!used.some((track) => track.isVideoTrack())) {
        throw fail("ce navigateur ne sait pas lire cette vidéo (ProRes ?). Exporte-la en H.264.");
      }
      if (audioTrack && !used.some((track) => track.isAudioTrack())) {
        throw fail("le son ne peut pas être conservé par ce navigateur. Essaie dans Chrome.");
      }
      if (!conversion.isValid) throw fail("la compression n'a pas pu démarrer.");

      conversion.onProgress = (ratio) => onProgress(ratio, attempt);
      await conversion.execute();

      const buffer = output.target.buffer;
      if (!buffer) throw fail("la compression n'a rien produit.");
      if (buffer.byteLength <= MAX_VISUAL_BYTES) {
        return new File([buffer], compressedName(file.name), { type: "video/mp4" });
      }
      settings = planRetry(settings, buffer.byteLength);
    }
    throw fail("encore au-dessus de 50 Mo après compression. Exporte-la plus légère.");
  } catch (error) {
    if (error instanceof VideoCompressionError) throw error;
    throw fail("la compression a échoué. Exporte-la sous 50 Mo.");
  } finally {
    input.dispose();
  }
}
