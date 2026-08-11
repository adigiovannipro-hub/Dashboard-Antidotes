import {
  attachVisuals,
  prepareVisualUploads,
  type PlanningResult,
} from "@/app/actions/planning";
import { visualUploadError } from "./storage";

/**
 * L'envoi d'un visuel, vu du navigateur : les octets vont **droit au bucket**.
 *
 * Trois temps. Le serveur signe une URL d'envoi par fichier (petite requête,
 * aucun octet de média) ; le navigateur PUT chaque fichier sur son URL — le
 * proxy de Next et ses limites de corps ne voient jamais rien passer ; puis
 * le serveur accroche les chemins remplis à la publication. Un échec au
 * troisième fichier garde les deux premiers.
 */
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

  const filled: string[] = [];
  let refusal: string | null = null;

  for (const [index, upload] of prepared.uploads.entries()) {
    const file = files[index]!;
    try {
      const response = await fetch(upload.url, {
        method: "PUT",
        headers: {
          "content-type": file.type || "application/octet-stream",
        },
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
    filled.push(upload.path);
  }

  if (filled.length === 0) {
    return { ok: false, error: refusal ?? "Aucun fichier n'est parti." };
  }

  const attached = await attachVisuals(scope, { subjectId, paths: filled });
  if (attached.ok && refusal) {
    return { ok: false, error: `${refusal} Les précédents sont bien là.` };
  }
  return attached;
}
