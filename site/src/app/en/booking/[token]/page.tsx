import type { Metadata } from "next";

import { CancelBookingPage } from "@/components/site/cancel-booking";
import { getDictionary } from "@/i18n";

export const metadata: Metadata = { title: "Your call", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <CancelBookingPage token={token} dict={getDictionary("en")} locale="en" />;
}
