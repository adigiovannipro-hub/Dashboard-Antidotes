/**
 * Un PDF d'images, une page par image — le carrousel LinkedIn.
 *
 * LinkedIn fait défiler un **document** : c'est la forme qu'y prend un
 * carrousel. Plutôt que d'exiger un PDF fabriqué à la main pour chaque
 * carrousel, on assemble les visuels de la ligne, dans leur ordre, chacun sur
 * une page à ses propres dimensions.
 *
 * Écrit à la main plutôt qu'avec une bibliothèque : un PDF qui ne contient
 * que des JPEG tient en trois objets par page — la page, son dessin, l'image
 * — parce que le format sait embarquer un JPEG tel quel (`/DCTDecode`), sans
 * le décoder. Les images doivent donc être des JPEG **RGB** : c'est à
 * l'appelant de les convertir (`media.ts`).
 */

export type PdfPage = { jpeg: Uint8Array; width: number; height: number };

export function pdfFromJpegs(pages: PdfPage[]): Uint8Array {
  if (pages.length === 0) throw new Error("Un PDF demande au moins une page.");

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;

  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: (string | Uint8Array)[]) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    body.forEach(push);
    push("\nendobj\n");
  };

  // Le commentaire binaire signale aux lecteurs que le fichier n'est pas du texte.
  push("%PDF-1.4\n");
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const pageId = (index: number) => 3 + index * 3;
  const kids = pages.map((_, index) => `${pageId(index)} 0 R`).join(" ");

  object(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  object(2, [`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`]);

  pages.forEach((page, index) => {
    const id = pageId(index);
    const contentId = id + 1;
    const imageId = id + 2;
    const { width, height } = page;
    if (!(width > 0 && height > 0)) throw new Error(`Page ${index + 1} sans dimensions.`);

    object(id, [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] ` +
        `/Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    ]);
    const drawing = `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`;
    object(contentId, [`<< /Length ${drawing.length} >>\nstream\n${drawing}\nendstream`]);
    object(imageId, [
      `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
      page.jpeg,
      "\nendstream",
    ]);
  });

  const size = pageId(pages.length);
  const xrefAt = length;
  push(`xref\n0 ${size}\n0000000000 65535 f \n`);
  for (let id = 1; id < size; id += 1) {
    push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}
