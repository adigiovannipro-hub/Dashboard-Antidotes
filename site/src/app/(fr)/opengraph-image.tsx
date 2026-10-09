import { ogImage } from "@/lib/og";

export const alt = "Antidotes — social media & IA, piloté de près";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return ogImage({ keyword: "antidote", title: "Vos réseaux sociaux méritent un antidote, pas une énième agence.", subtitle: "Stratégie, contenus, publicité et reporting, pilotés par un expert freelance avec des outils maison et l'IA." });
}
