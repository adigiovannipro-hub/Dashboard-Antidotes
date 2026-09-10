import { redirect } from "next/navigation";

/** L'inbound tient sur une seule page : l'ancienne route y mène. */
export default function LegacyPage() {
  redirect("/antidotes/inbound");
}
