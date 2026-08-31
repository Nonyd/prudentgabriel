/** Click-to-chat for an order. Nigerian 0-prefix numbers become 234. */

export function toWhatsAppDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length < 7) return null;
  if (digits.startsWith("0") && digits.length === 11) {
    digits = `234${digits.slice(1)}`;
  }
  return digits;
}

export function orderWhatsAppUrl(phone: string | null | undefined, orderNumber: string): string | null {
  const digits = toWhatsAppDigits(phone);
  if (!digits) return null;
  const text = encodeURIComponent(
    `Hello, this is Prudential Atelier regarding order ${orderNumber}.`,
  );
  return `https://wa.me/${digits}?text=${text}`;
}

export function phoneFromOrder(order: {
  guestPhone?: string | null;
  user?: { phone?: string | null } | null;
  addressSnapshot?: unknown;
}): string | null {
  const snap = order.addressSnapshot as { phone?: string | null } | null;
  const fromSnap = typeof snap?.phone === "string" ? snap.phone : null;
  return order.user?.phone || order.guestPhone || fromSnap || null;
}
