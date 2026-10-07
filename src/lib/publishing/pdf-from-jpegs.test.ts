import sharp from "sharp";
import { getDocumentProxy } from "unpdf";
import { describe, expect, it } from "vitest";

import { pdfFromJpegs } from "./pdf-from-jpegs";

const jpeg = async (width: number, height: number, background: string) => ({
  jpeg: new Uint8Array(
    await sharp({ create: { width, height, channels: 3, background } }).jpeg().toBuffer(),
  ),
  width,
  height,
});

describe("pdfFromJpegs", () => {
  it("rend un PDF lisible, une page par image, dans l'ordre et aux bonnes dimensions", async () => {
    const pages = [
      await jpeg(1080, 1350, "#ff0000"),
      await jpeg(1080, 1080, "#00ff00"),
      await jpeg(1080, 1350, "#0000ff"),
    ];
    const pdf = await getDocumentProxy(pdfFromJpegs(pages));

    expect(pdf.numPages).toBe(3);
    const sizes = [];
    for (let index = 1; index <= 3; index += 1) {
      const page = await pdf.getPage(index);
      const { width, height } = page.getViewport({ scale: 1 });
      sizes.push([width, height]);
    }
    expect(sizes).toEqual([
      [1080, 1350],
      [1080, 1080],
      [1080, 1350],
    ]);
  });

  it("embarque les JPEG tels quels, sans les réencoder", async () => {
    const page = await jpeg(20, 30, "#123456");
    const pdf = pdfFromJpegs([page]);
    const haystack = Buffer.from(pdf);
    expect(haystack.indexOf(Buffer.from(page.jpeg))).toBeGreaterThan(0);
    expect(haystack.subarray(0, 8).toString("latin1")).toBe("%PDF-1.4");
  });

  it("refuse un document vide", () => {
    expect(() => pdfFromJpegs([])).toThrow();
  });
});
