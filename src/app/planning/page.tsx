import { redirect } from "next/navigation";

import { requirePlanning } from "@/lib/planning/access";

/** Le module s'ouvre sur le premier client : pas d'écran de choix. */
export default async function PlanningIndexPage() {
  const { clients } = await requirePlanning();
  redirect(`/planning/${clients[0]!.slug}`);
}
