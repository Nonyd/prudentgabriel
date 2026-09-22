import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";

/**
 * SiteSetting key from Slice G2. Since BA2 it opens and closes the atelier:
 * when off, the enquiry form says the house is not taking new commissions and
 * offers the contact page, and new enquiries and their uploads are refused.
 * Invitations already sent still work — that is the house's own decision.
 * Missing or anything other than "true" is off (fail-closed).
 */
export const ATELIER_BOOKINGS_SETTING_KEY = "atelier_bookings_enabled";

export const ATELIER_CONTACT_HREF = "/contact";

/** Public copy on /consultation when the atelier is closed. */
export const ATELIER_CLOSED_COPY =
  "The house isn't taking new commissions at present. If you would like to write to us, the contact page reaches the atelier.";

export const ATELIER_CLOSED_MESSAGE = "The house isn't taking new commissions at present.";

export async function isAtelierOpenForEnquiries(): Promise<boolean> {
  return (await getSetting(ATELIER_BOOKINGS_SETTING_KEY)) === "true";
}

/** Gate for new enquiries (and their uploads). */
export async function rejectIfAtelierClosed(): Promise<NextResponse | null> {
  if (await isAtelierOpenForEnquiries()) return null;
  return NextResponse.json({ error: ATELIER_CLOSED_MESSAGE }, { status: 403 });
}
