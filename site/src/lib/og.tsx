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
/** Satori espace mal les blancs insécables : une espace ordinaire partout. */
function normalize(text: string): string {
  return text.replace(/[\u00a0\u202f\u2060]/g, " ");
}

function words(text: string): string[] {
  return normalize(text).split(" ").filter(Boolean);
}

async function font(file: string) {
  return readFile(join(process.cwd(), "src/assets/og", file));
}

export async function ogImage(options: { title: string; subtitle: string; keyword?: string }) {
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
          // La lave (r-05) : trois masses elliptiques coupées par les bords haut, droit et bas, cœur
          // Signal, frange Menthe puis Rose avant de rejoindre le noir — jamais le rose sur #0B110C.
          backgroundImage:
            "radial-gradient(ellipse 30% 46% at 100% 22%, #22E05B 0%, #22E05B 52%, #7AEC9D 66%, rgba(226,243,218,0.75) 74%, rgba(247,168,216,0.45) 82%, rgba(11,17,12,0) 100%), radial-gradient(ellipse 26% 38% at 92% 104%, #1EC94F 0%, #22E05B 48%, #A7F3BD 64%, rgba(247,168,216,0.5) 76%, rgba(11,17,12,0) 92%), radial-gradient(ellipse 14% 20% at 80% 58%, rgba(34,224,91,0.9) 0%, rgba(122,236,157,0.6) 55%, rgba(11,17,12,0) 100%)",
          color: "#F7F8F4",
          fontFamily: "Geist",
        }}
      >
        <svg width={Math.round((logoHeight * vw) / vh)} height={logoHeight} viewBox={LOGOTYPE.viewBox}>
          <path d={LOGOTYPE.letters} fill="#F7F8F4" />
          <circle cx={LOGOTYPE.dot.cx} cy={LOGOTYPE.dot.cy} r={LOGOTYPE.dot.r} fill="#22E05B" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 26, maxWidth: 700 }}>
          <div style={{ display: "flex", flexWrap: "wrap", fontFamily: "Funnel Display", fontSize: 62, lineHeight: 1.04, letterSpacing: "-2.2px" }}>
            {words(options.title).map((word, index) => {
              // Le mot-clé passe en Signal, sa ponctuation reste en Craie.
              const bare = word.replace(/[,.;:!?]+$/, "");
              const tail = word.slice(bare.length);
              return (
                <span key={index} style={{ display: "flex", marginRight: "0.24em" }}>
                  <span style={{ color: options.keyword && bare === options.keyword ? "#22E05B" : "#F7F8F4" }}>{bare}</span>
                  {tail ? <span>{tail}</span> : null}
                </span>
              );
            })}
          </div>
          <div style={{ fontSize: 26, color: "#C7CCC4", lineHeight: 1.4 }}>{normalize(options.subtitle)}</div>
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
