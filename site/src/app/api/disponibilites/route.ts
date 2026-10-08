import { availableSlots } from "@/lib/booking/calendar";
import { json } from "@/lib/http/request";
import type { AvailabilityResponse } from "@/lib/funnel-contract";

export const dynamic = "force-dynamic";

const MAX_WINDOW_MS = 35 * 86_400_000;

/** Les créneaux libres entre `du` et `au` (ISO), en instants UTC. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const from = new Date(url.searchParams.get("du") ?? "");
  const to = new Date(url.searchParams.get("au") ?? "");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from || to.getTime() - from.getTime() > MAX_WINDOW_MS) {
    return json<AvailabilityResponse>({ ok: false, error: "invalid" }, 400);
  }
  try {
    const { slots, calendarUsed } = await availableSlots({ from, to });
    return json<AvailabilityResponse>({
      ok: true,
      slots: slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() })),
      calendarUsed,
    });
  } catch (error) {
    console.error("[disponibilites]", error);
    return json<AvailabilityResponse>({ ok: false, error: "generic" }, 500);
  }
}
