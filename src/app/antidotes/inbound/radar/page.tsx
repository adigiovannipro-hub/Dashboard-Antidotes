import { redirect } from "next/navigation";

/** L'inbound tient sur une page à vues : l'ancienne route y mène. */
export default function LegacyPage() {
  redirect("/antidotes/inbound?vue=contenus");
}
