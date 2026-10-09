import { ImageResponse } from "next/og";

/** L'image de partage : le mot-marque, l'anneau, la promesse. 1200 × 630. */
export function ogImage(options: { title: string; subtitle: string }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(160deg, #141414 0%, #0b2414 100%)",
          color: "#F7F8F4",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: 44, fontWeight: 600, letterSpacing: "-1.5px" }}>
          <span>antid</span>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              border: "8px solid transparent",
              backgroundImage: "linear-gradient(#141414, #141414), linear-gradient(118deg, #0F6529, #189D40, #22E05B, #7AEC9D, #A7F3BD)",
              backgroundOrigin: "border-box",
              backgroundClip: "content-box, border-box",
            }}
          />
          <span>tes</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 68, fontWeight: 600, lineHeight: 1.05, letterSpacing: "-2.5px", maxWidth: 1000 }}>{options.title}</div>
          <div style={{ fontSize: 30, color: "#aeb8b2", maxWidth: 900, lineHeight: 1.35 }}>{options.subtitle}</div>
        </div>
        <div style={{ height: 6, width: "100%", borderRadius: 999, background: "linear-gradient(90deg, #0F6529, #189D40, #22E05B, #7AEC9D, #A7F3BD)" }} />
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
