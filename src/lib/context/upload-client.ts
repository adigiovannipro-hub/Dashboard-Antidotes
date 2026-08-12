import {
  prepareAssetUploads,
  registerAssets,
  type ContextUploadResult,
} from "@/app/actions/context";

import { safeAction } from "./safe-action";
import { assetUploadError } from "./storage";
import type { ClientAssetType } from "./types";

/**
 * Le dépôt d'un document, vu du navigateur : les octets vont **droit au
 * bucket**, comme les visuels du Planning.
 *
 * Trois temps. Le serveur signe une URL d'envoi par fichier (petite requête,
 * aucun octet de média) ; le navigateur PUT chaque fichier sur son URL — le
 * proxy de Next et ses limites de corps ne voient jamais rien passer ; puis
 * le serveur enregistre les lignes des chemins remplis. Un échec au troisième
 * fichier garde les deux premiers.
 */
export async function uploadAssetsFromBrowser(
  scope: { workspace: string },
  type: ClientAssetType,
  files: File[],
): Promise<ContextUploadResult> {
  const refused = assetUploadError(files);
  if (refused) return { ok: false, error: refused };

  const prepared = await safeAction(() =>
    prepareAssetUploads(scope, {
      files: files.map((file) => ({
        name: file.name,
        type: file.type,
        size: file.size,
      })),
    }),
  );
  if (!prepared.ok) return prepared;

  const filled: { path: string; name: string; mimeType: string; size: number }[] = [];
  let refusal: string | null = null;

  for (const [index, upload] of prepared.uploads.entries()) {
    const file = files[index]!;
    try {
      const response = await fetch(upload.url, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!response.ok) {
        refusal = `${file.name} : le bucket a refusé l'envoi (${response.status}).`;
        break;
      }
    } catch {
      refusal = `${file.name} : l'envoi s'est interrompu en route.`;
      break;
    }
    filled.push({ path: upload.path, name: file.name, mimeType: file.type, size: file.size });
  }

  if (filled.length === 0) {
    return { ok: false, error: refusal ?? "Aucun fichier n'est parti." };
  }

  const registered = await safeAction(() => registerAssets(scope, { type, files: filled }));
  if (registered.ok && refusal) {
    return { ok: false, error: `${refusal} Les précédents sont bien là.` };
  }
  return registered;
}
