/**
 * Miniatures fabriquées dans le navigateur, au moment de l'envoi.
 *
 * Le serveur ne retouche jamais un média — pas de fonction image dans le free
 * tier, et l'original doit rester intact : c'est le format validé, celui qu'on
 * retélécharge en HD. C'est donc le poste qui envoie qui fabrique la version
 * légère : 1080 px de bord long en JPEG pour une image, la première frame pour
 * une vidéo. Un format que le navigateur ne sait pas décoder rend `null`, et
 * l'affichage retombera sur l'original — jamais un envoi bloqué pour une
 * vignette.
 */

export const PREVIEW_MAX_EDGE = 1080;
const PREVIEW_QUALITY = 0.82;

/** En deçà, l'original est déjà une miniature : rien à fabriquer. */
const PREVIEW_SKIP_BYTES = 150 * 1024;

export async function makeVisualPreview(file: File): Promise<Blob | null> {
  if (file.type.startsWith("image/")) return imagePreview(file);
  if (file.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.name)) {
    return videoPoster(file);
  }
  // PDF et le reste : pas de miniature, la cellule garde son trombone.
  return null;
}

async function imagePreview(file: File): Promise<Blob | null> {
  if (file.size < PREVIEW_SKIP_BYTES) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const blob = await drawToJpeg(bitmap, bitmap.width, bitmap.height);
    bitmap.close();
    return blob;
  } catch {
    return null;
  }
}

/**
 * La première image d'une vidéo, sans extraction serveur : le navigateur
 * décode, on se cale un dixième de seconde après le début — l'amorce des
 * exports est souvent noire — et on dessine la frame.
 */
function videoPoster(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;

    const done = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      resolve(blob);
    };
    // Un conteneur que le navigateur ne décode pas ne doit pas retenir l'envoi.
    const timer = setTimeout(() => done(null), 10_000);

    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onerror = () => done(null);
    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(0.1, (video.duration || 1) / 2);
      } catch {
        // Le seek peut être refusé sur un flux exotique : la frame courante
        // fera l'affaire.
        void drawToJpeg(video, video.videoWidth, video.videoHeight).then(done);
      }
    };
    video.onseeked = () => {
      void drawToJpeg(video, video.videoWidth, video.videoHeight).then(done);
    };
    video.src = url;
  });
}

function drawToJpeg(
  source: CanvasImageSource,
  width: number,
  height: number,
): Promise<Blob | null> {
  if (width <= 0 || height <= 0) return Promise.resolve(null);

  const scale = Math.min(1, PREVIEW_MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext("2d");
  if (!context) return Promise.resolve(null);

  // JPEG ne connaît pas la transparence : un PNG détouré tomberait sur du
  // noir. Le blanc est le fond neutre des grilles où la vignette s'affiche.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", PREVIEW_QUALITY),
  );
}
