/**
 * Email the gateway must send the card receipt to — the client on the booking
 * or order, never the signed-in staff session.
 */
export function consultationGatewayEmail(booking: { clientEmail: string }): string {
  return booking.clientEmail.trim();
}

export function rtwGatewayEmail(order: {
  guestEmail?: string | null;
  user?: { email?: string | null } | null;
}): string | null {
  const email = (order.guestEmail ?? order.user?.email ?? "").trim();
  return email || null;
}

export function rtwGatewayName(order: {
  guestName?: string | null;
  user?: { name?: string | null } | null;
}): string {
  const name = (order.guestName ?? order.user?.name ?? "").trim();
  return name || "Client";
}
