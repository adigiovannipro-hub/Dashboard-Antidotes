import type { Metadata, Viewport } from "next";

import { Root } from "@/components/site/root";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: { default: "Antidotes", template: "%s — Antidotes" },
};

export const viewport: Viewport = { themeColor: "#090c0b", colorScheme: "dark" };

export default function EnLayout({ children }: { children: React.ReactNode }) {
  return <Root locale="en">{children}</Root>;
}
