import { ogImage } from "@/lib/og";

export const alt = "Antidotes — social media & AI, closely managed";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return ogImage({ title: "Your social media deserves an antidote, not another agency.", subtitle: "Strategy, content, ads and reporting, run by a senior freelancer with in-house tools and AI." });
}
