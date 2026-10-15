import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getChatAvailability, getChatStaffing } from "@/lib/chat";
import type { ChatStatusView } from "@/lib/chat-shared";

export const dynamic = "force-dynamic";

/**
 * BF2/BF3: what the widget needs before it shows anything — is chat on, is
 * anyone there (the schedule, failing closed), when it opens next (computed),
 * and the greeting delay. Fetched after the page has settled, never during the
 * first paint. Records nothing about the visit.
 */
export async function GET() {
  const staffing = await getChatStaffing();
  const a = await getChatAvailability(new Date(), staffing);
  const session = await auth();
  const signedIn = session?.user?.id && !session.user.viewAs ? session.user : null;
  const body: ChatStatusView = {
    enabled: a.enabled,
    live: a.live,
    opensAt: a.opensAt?.toISOString() ?? null,
    opensLabel: a.opensLabel,
    // The greeting only when someone is there to answer it.
    greetingDelaySec: a.live ? staffing.greetingDelaySec : null,
    editWindowSec: staffing.editWindowSec,
    account: signedIn ? { name: signedIn.name?.trim() || signedIn.email || "" } : null,
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
