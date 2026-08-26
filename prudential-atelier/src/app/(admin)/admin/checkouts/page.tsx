import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { parseCartSnapshot, RECENT_MANUAL_WARN_MS } from "@/lib/checkout-session";
import { AbandonedCheckoutsClient } from "@/components/admin/AbandonedCheckoutsClient";

function whatsappUrl(number: string, email: string, value: string): string | null {
  const digits = number.replace(/\D/g, "");
  if (!digits) return null;
  const text = encodeURIComponent(`Hello, this is Prudential Atelier about the bag at ${email} (${value}).`);
  return `https://wa.me/${digits}?text=${text}`;
}

export default async function AdminAbandonedCheckoutsPage() {
  const [sessions, wa] = await Promise.all([
    prisma.checkoutSession.findMany({ take: 80 }),
    getSetting("social_whatsapp"),
  ]);

  const valued = sessions
    .map((s) => {
      const snap = parseCartSnapshot(s.cartSnapshot);
      return { s, snap, value: snap.subtotalNGN };
    })
    .sort((a, b) => b.value - a.value);

  const now = Date.now();
  const rows = valued.map(({ s, snap, value }) => {
    const valueLabel = `₦${Math.round(value).toLocaleString("en-NG")}`;
    const highValue = value >= 150_000;
    return {
      id: s.id,
      email: s.email,
      itemsLabel: snap.lines.map((l) => `${l.productName} ×${l.quantity}`).join(", ") || "—",
      valueLabel,
      furthestStep: s.furthestStep,
      lastActiveAt: s.lastActiveAt.toISOString().slice(0, 16).replace("T", " "),
      remindersSent: s.remindersSent,
      recovered: Boolean(s.recoveredAt),
      whatsappUrl: highValue ? whatsappUrl(wa ?? "", s.email, valueLabel) : null,
      recentWarning: Boolean(s.lastReminderAt && now - s.lastReminderAt.getTime() < RECENT_MANUAL_WARN_MS),
    };
  });

  return (
    <div>
      <h1 className="font-display text-2xl text-charcoal">Abandoned checkouts</h1>
      <p className="mt-1 max-w-2xl font-body text-[13px] text-[#6B6B68]">
        Email captured at checkout step 1. High value first. Two automatic reminders, then stop.
        No discount codes.
      </p>
      <AbandonedCheckoutsClient rows={rows} />
    </div>
  );
}
