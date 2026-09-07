import { redirect } from "next/navigation";

import { ANTIDOTES_HOME } from "@/lib/antidotes/navigation";

/** La racine du pôle n'est qu'une porte : elle mène à sa première page. */
export default function AntidotesPage() {
  redirect(ANTIDOTES_HOME);
}
