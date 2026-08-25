import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";

/** SiteSetting key. Missing or anything other than "true" is off (fail-closed). */
export const ATELIER_BOOKINGS_SETTING_KEY = "atelier_bookings_enabled";

export const ATELIER_ENQUIRE_HREF = "/contact?subject=Atelier%20Commission";

export const ATELIER_ENQUIRE_CTA = "Enquire about a commission";

/** Public copy on /consultation when bookings are closed. Nony can change this. */
export const ATELIER_BOOKINGS_CLOSED_COPY =
  "Consultations aren't open for booking yet. Write to the house — Mrs. Prudent still reads every note.";

export const ATELIER_BOOKINGS_CLOSED_MESSAGE =
  "Consultations are not open for booking yet. Please enquire via the contact form.";

export async function isAtelierBookingsEnabled(): Promise<boolean> {
  return (await getSetting(ATELIER_BOOKINGS_SETTING_KEY)) === "true";
}

/**
 * Gate for *new* consultation bookings. Existing bookings stay viewable and payable.
 */
export async function rejectIfAtelierBookingsClosed(): Promise<NextResponse | null> {
  if (await isAtelierBookingsEnabled()) return null;
  return NextResponse.json({ error: ATELIER_BOOKINGS_CLOSED_MESSAGE }, { status: 403 });
}
