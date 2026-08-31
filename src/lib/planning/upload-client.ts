import {
  attachVisuals,
  prepareVisualUploads,
  type PlanningResult,
} from "@/app/actions/planning";
import { makeVisualPreview } from "./preview-client";
import { visualUploadError } from "./storage";

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
  files: File[],
): Promise<PlanningResult> {
  const refused = visualUploadError(files);
  if (refused) return { ok: false, error: refused };

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
