import {
  attachVisuals,
  prepareVisualUploads,
  type PlanningResult,
} from "@/app/actions/planning";
import { toast } from "sonner";

import { makeVisualPreview } from "./preview-client";
import { MAX_VISUAL_BYTES, visualUploadError } from "./storage";
import { needsCompression } from "./video-compression";
import { VideoCompressionError, compressVideo } from "./video-compression-client";

/**
 * L'envoi d'un visuel, vu du navigateur : les octets vont **droit au bucket**.
 *
 * Trois temps. Le serveur signe une URL d'envoi par fichier (petite requête,
 * aucun octet de média) ; le navigateur PUT chaque fichier sur son URL — le
 * proxy de Next et ses limites de corps ne voient jamais rien passer — en
 * fabriquant au passage la miniature qui part à côté ; puis le serveur
 * accroche les chemins remplis à la publication. Un fichier en échec n'emporte
 * pas les autres : ils s'accrochent, et l'échec se dit.
 */

/** Trois fichiers de front : de quoi saturer la ligne montante sans ouvrir
    vingt connexions — l'envoi séquentiel faisait attendre chaque vidéo. */
const UPLOAD_CONCURRENCY = 3;

/**
 * Stocké par le bucket et resservi tel quel à chaque lecture. Sans lui,
 * Supabase sert `no-cache` et le navigateur revalide chaque visuel à chaque
 * affichage. `immutable` est exact : le chemin porte un horodatage, un même
 * chemin ne change jamais de contenu.
 */
const LONG_LIVED_CACHE = "max-age=31536000, immutable";

export async function uploadVisualsFromBrowser(
  scope: { workspace: string; board: string },
  subjectId: string,
  picked: File[],
): Promise<PlanningResult> {
  const refused = visualUploadError(picked);
  if (refused) return { ok: false, error: refused };

  let files: File[];
  try {
    files = await shrinkHeavyVideos(picked);
  } catch (error) {
    const message =
      error instanceof VideoCompressionError ? error.message : "La compression a échoué.";
    return { ok: false, error: message };
  }

  const prepared = await prepareVisualUploads(scope, {
    subjectId,
    files: files.map((file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
    })),
  });
  if (!prepared.ok) return prepared;

  // `filled` garde l'ordre d'origine — c'est l'ordre des slides du carrousel.
  const filled: (string | null)[] = new Array(prepared.uploads.length).fill(null);
  const refusals: string[] = [];

  const sendOne = async (index: number) => {
    const upload = prepared.uploads[index]!;
    const file = files[index]!;
    // La miniature se fabrique pendant que l'original monte.
    const preview = makeVisualPreview(file);

    try {
      const response = await fetch(upload.url, {
        method: "PUT",
        headers: {
          "content-type": file.type || "application/octet-stream",
          "cache-control": LONG_LIVED_CACHE,
        },
        body: file,
      });
      if (!response.ok) {
        refusals.push(`${file.name} : le bucket a refusé l'envoi (${response.status}).`);
        return;
      }
    } catch {
      refusals.push(`${file.name} : l'envoi s'est interrompu en route.`);
      return;
    }
    filled[index] = upload.path;

    // La miniature est un confort d'affichage : son échec ne retient jamais
    // l'original — la cellule retombera dessus.
    try {
      const blob = await preview;
      if (blob) {
        await fetch(upload.previewUrl, {
          method: "PUT",
          headers: {
            "content-type": "image/jpeg",
            "cache-control": LONG_LIVED_CACHE,
          },
          body: blob,
        });
      }
    } catch {
      // Voir ci-dessus : sans miniature, l'original s'affiche.
    }
  };

  for (let start = 0; start < prepared.uploads.length; start += UPLOAD_CONCURRENCY) {
    await Promise.all(
      Array.from(
        { length: Math.min(UPLOAD_CONCURRENCY, prepared.uploads.length - start) },
        (_, offset) => sendOne(start + offset),
      ),
    );
  }

  const paths = filled.filter((path): path is string => path !== null);
  const refusal = refusals[0] ?? null;

  if (paths.length === 0) {
    return { ok: false, error: refusal ?? "Aucun fichier n'est parti." };
  }

  const attached = await attachVisuals(scope, { subjectId, paths });
  if (attached.ok && refusal) {
    return { ok: false, error: `${refusal} Les autres sont bien là.` };
  }
  return attached;
}

/**
 * Les vidéos au-delà du plafond du bucket, ramenées dessous une par une — deux
 * encodages de front se disputeraient l'encodeur matériel. Le toast suit
 * l'avancement : un master d'une minute prend quelques dizaines de secondes,
 * et un spinner muet pendant ce temps se lirait comme un envoi bloqué.
 */
async function shrinkHeavyVideos(files: File[]): Promise<File[]> {
  const ready: File[] = [];
  for (const file of files) {
    if (!needsCompression(file)) {
      ready.push(file);
      continue;
    }
    // Une vidéo légère n'est pas compressée mais convertie en MP4 : le mot
    // dit ce qui se passe.
    const verb = file.size > MAX_VISUAL_BYTES ? "Compression" : "Conversion";
    const toastId = toast.loading(`${verb} de la vidéo… 0 %`);
    let shown = "";
    try {
      ready.push(
        await compressVideo(file, (ratio, attempt) => {
          const pass = attempt > 1 ? ` (passage ${attempt})` : "";
          const label = `${verb} de la vidéo${pass}… ${Math.floor(ratio * 100)} %`;
          if (label === shown) return;
          shown = label;
          toast.loading(label, { id: toastId });
        }),
      );
    } catch (error) {
      // Une vidéo légère que ce navigateur ne sait pas convertir part telle
      // quelle : le dépôt déclenche aussitôt sa conversion côté serveur
      // (`attachVisuals`), elle devient lisible chez le client en quelques
      // minutes. Mieux vaut ça qu'un envoi bloqué.
      if (file.size > MAX_VISUAL_BYTES) throw error;
      toast.info(`${file.name} : conversion en MP4 en cours, lisible par tous d'ici quelques minutes.`);
      ready.push(file);
    } finally {
      toast.dismiss(toastId);
    }
  }
  return ready;
}
