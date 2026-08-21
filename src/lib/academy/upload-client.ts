import {
  attachVideo,
  prepareVideoUpload,
  type AcademyResult,
} from "@/app/actions/academy";
import { videoUploadError } from "./upload";

/**
 * L'envoi d'une vidéo de leçon, vu du navigateur : les octets vont **droit au
 * bucket** — le serveur signe une URL d'envoi, le navigateur PUT le fichier,
 * puis le serveur accroche le chemin à la leçon. Même mécanique que les
 * visuels du Planning, avec une différence : le PUT passe par `XMLHttpRequest`
 * et non `fetch`, parce que la barre de progression a besoin des événements
 * `upload.progress` que `fetch` ne fournit pas.
 */
export async function uploadVideoFromBrowser(
  lessonId: string,
  file: File,
  onProgress: (ratio: number) => void,
): Promise<AcademyResult> {
  const refused = videoUploadError(file);
  if (refused) return { ok: false, error: refused };

  const prepared = await prepareVideoUpload({
    lessonId,
    file: { name: file.name, type: file.type, size: file.size },
  });
  if (!prepared.ok) return prepared;

  const sent = await putWithProgress(prepared.url, file, onProgress);
  if (!sent.ok) return sent;

  return attachVideo({ lessonId, path: prepared.path });
}

function putWithProgress(
  url: string,
  file: File,
  onProgress: (ratio: number) => void,
): Promise<AcademyResult> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("content-type", file.type || "application/octet-stream");

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(event.loaded / event.total);
      }
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(1);
        resolve({ ok: true });
      } else {
        resolve({
          ok: false,
          error: `Le bucket a refusé l'envoi (${request.status}).`,
        });
      }
    });
    request.addEventListener("error", () => {
      resolve({ ok: false, error: "L'envoi s'est interrompu en route." });
    });

    request.send(file);
  });
}
