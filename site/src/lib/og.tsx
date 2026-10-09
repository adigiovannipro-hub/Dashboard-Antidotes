import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { LOGOTYPE } from "@/components/brand/logotype-paths";

/**
 * L'image de partage, univers Profondeur (r-05, r-16) : la lave en grandes
 * formes coupées par les bords, le logotype en Craie et son point Signal,
 * la promesse en Funnel Display. Rendue une fois à la compilation ; les
 * polices sont lues depuis le dépôt (OFL), aucune requête réseau.
 */
async function font(file: string) {
  return readFile(join(process.cwd(), "src/assets/og", file));
}

export async function ogImage(options: { title: string; subtitle: string }) {
  const [display, text, mono] = await Promise.all([font("FunnelDisplay-600.ttf"), font("Geist-400.ttf"), font("GeistMono-400.ttf")]);
  const [, , vw, vh] = LOGOTYPE.viewBox.split(" ").map(Number);
  const logoHeight = 40;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "68px 72px",
          backgroundColor: "#0B110C",
          backgroundImage:
            "radial-gradient(circle at 104% 18%, #22E05B 0%, #22E05B 16%, rgba(226,243,218,0.9) 24%, rgba(247,168,216,0.55) 31%, rgba(11,17,12,0) 42%), radial-gradient(circle at 88% 118%, #4EE67C 0%, rgba(34,224,91,0.85) 14%, rgba(247,168,216,0.5) 24%, rgba(11,17,12,0) 36%)",
          color: "#F7F8F4",
          fontFamily: "Geist",
        }}
      >
        <svg width={Math.round((logoHeight * vw) / vh)} height={logoHeight} viewBox={LOGOTYPE.viewBox}>
          <path d={LOGOTYPE.letters} fill="#F7F8F4" />
          <circle cx={LOGOTYPE.dot.cx} cy={LOGOTYPE.dot.cy} r={LOGOTYPE.dot.r} fill="#22E05B" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 26, maxWidth: 860 }}>
          <div style={{ fontFamily: "Funnel Display", fontSize: 66, lineHeight: 1.02, letterSpacing: "-2.3px" }}>{options.title}</div>
          <div style={{ fontSize: 28, color: "#C7CCC4", lineHeight: 1.38 }}>{options.subtitle}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: "Geist Mono", fontSize: 18, letterSpacing: "1.6px", color: "#9BA198" }}>
          <div style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: "#22E05B" }} />
          ANTIDOTES.AGENCY
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Funnel Display", data: display, weight: 600, style: "normal" },
        { name: "Geist", data: text, weight: 400, style: "normal" },
        { name: "Geist Mono", data: mono, weight: 400, style: "normal" },
      ],
    },
  );
}
