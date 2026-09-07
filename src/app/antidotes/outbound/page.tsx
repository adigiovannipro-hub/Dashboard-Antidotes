import { redirect } from "next/navigation";

import { ANTIDOTES_HOME } from "@/lib/antidotes/navigation";

/** `/antidotes/outbound` sans page : on ouvre le pipeline. */
export default function OutboundPage() {
  redirect(ANTIDOTES_HOME);
}
