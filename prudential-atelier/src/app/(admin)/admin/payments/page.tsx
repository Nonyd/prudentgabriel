import Link from "next/link";
import { PaymentGateway, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const TAKE = 100;

type RowKind = "SHOP" | "CONSULTATION" | "BESPOKE";

type UnifiedRow = {
  kind: RowKind;
  id: string;
  ref: string;
  customer: string;
  amountNGN: number;
  statusLabel: string;
  gateway: PaymentGateway | null;
  paidAt: Date | null;
  createdAt: Date;
  href: string;
};

function gatewayClass(g: PaymentGateway | null): string {
  switch (g) {
    case "PAYSTACK":
      return "bg-[#E8F5E9] text-[#1B5E20]";
    case "FLUTTERWAVE":
      return "bg-[#E8F0FF] text-[#1A3FAD]";
    case "STRIPE":
      return "bg-[#F0E8FF] text-[#6B3FAD]";
    case "MONNIFY":
      return "bg-[#FFF3E0] text-[#C45E0A]";
    default:
      return "bg-[#FAFAFA] text-[#A8A8A4]";
  }
}

function statusTextClass(label: string): string {
  const u = label.toUpperCase();
  if (u.includes("PAID")) return "text-[#1B5E20]";
  if (u.includes("PENDING")) return "text-[#C45E0A]";
  if (u.includes("FAILED")) return "text-red-700";
  if (u.includes("REFUND")) return "text-[#6B6B68]";
  return "text-[#6B6B68]";
}

export default async function AdminPaymentsPage() {
  const [orders, bookings, bespokes] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: TAKE,
      select: {
        id: true,
        orderNumber: true,
        total: true,
        paymentStatus: true,
        paymentGateway: true,
        paidAt: true,
        createdAt: true,
        guestEmail: true,
        guestName: true,
        user: { select: { name: true, email: true } },
        isBespoke: true,
      },
    }),
    prisma.consultationBooking.findMany({
      orderBy: { createdAt: "desc" },
      take: TAKE,
      select: {
        id: true,
        bookingNumber: true,
        feeNGN: true,
        paymentStatus: true,
        paymentGateway: true,
        paidAt: true,
        createdAt: true,
        clientEmail: true,
        clientName: true,
      },
    }),
    prisma.bespokeRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: TAKE,
      select: {
        id: true,
        requestNumber: true,
        name: true,
        email: true,
        agreedPrice: true,
        depositPaid: true,
        paymentMethod: true,
        balancePaymentStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const rows: UnifiedRow[] = [];

  for (const o of orders) {
    const customer = o.user?.email ?? o.guestEmail ?? o.guestName ?? "—";
    rows.push({
      kind: "SHOP",
      id: o.id,
      ref: o.orderNumber,
      customer,
      amountNGN: o.total,
      statusLabel: o.paymentStatus,
      gateway: o.paymentGateway,
      paidAt: o.paidAt,
      createdAt: o.createdAt,
      href: `/admin/orders/${o.id}`,
    });
  }

  for (const b of bookings) {
    rows.push({
      kind: "CONSULTATION",
      id: b.id,
      ref: b.bookingNumber,
      customer: `${b.clientName} · ${b.clientEmail}`,
      amountNGN: b.feeNGN,
      statusLabel: b.paymentStatus,
      gateway: b.paymentGateway,
      paidAt: b.paidAt,
      createdAt: b.createdAt,
      href: `/admin/consultations/${b.id}`,
    });
  }

  for (const br of bespokes) {
    const agreed = br.agreedPrice ?? 0;
    const dep = br.depositPaid ?? 0;
    const balance = Math.max(0, agreed - dep);
    let statusLabel: string;
    let gateway: PaymentGateway | null = null;
    if (br.balancePaymentStatus === PaymentStatus.PAID) {
      statusLabel = "Balance paid (online)";
      gateway = PaymentGateway.PAYSTACK;
    } else if (br.balancePaymentStatus === PaymentStatus.PENDING) {
      statusLabel = "Balance link sent (pending)";
      gateway = PaymentGateway.PAYSTACK;
    } else if (br.balancePaymentStatus === PaymentStatus.FAILED) {
      statusLabel = "Online balance failed";
      gateway = PaymentGateway.PAYSTACK;
    } else if (agreed > 0 && dep >= agreed) {
      statusLabel = "Settled (deposit / offline)";
    } else {
      statusLabel = `${br.paymentMethod ?? "—"} · Bal ₦${Math.round(balance).toLocaleString("en-NG")}`;
    }

    rows.push({
      kind: "BESPOKE",
      id: br.id,
      ref: br.requestNumber,
      customer: `${br.name} · ${br.email}`,
      amountNGN: agreed || dep,
      statusLabel,
      gateway,
      paidAt: br.balancePaymentStatus === PaymentStatus.PAID ? br.updatedAt : null,
      createdAt: br.createdAt,
      href: `/admin/bespoke/${br.id}`,
    });
  }

  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const kindLabel = (k: RowKind) => {
    if (k === "SHOP") return "Shop";
    if (k === "CONSULTATION") return "Consultation";
    return "Bespoke";
  };

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Payments</h1>
      <p className="mt-2 max-w-2xl font-body text-sm text-[#6B6B68]">
        Recent checkout and fee activity: shop orders, consultation payments, and bespoke agreements (including
        online balance collection).
      </p>

      <div className="mt-8 overflow-x-auto border border-[#EBEBEA]">
        <table className="w-full min-w-[720px] border-collapse font-body text-sm">
          <thead>
            <tr className="border-b border-[#EBEBEA] bg-[#FAFAFA] text-left text-[10px] font-medium uppercase tracking-wide text-[#6B6B68]">
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3 text-right">Amount (₦)</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Gateway</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.kind}-${r.id}`} className="border-b border-[#EBEBEA] last:border-0 hover:bg-[#FAFAFA]">
                <td className="px-4 py-3 text-xs">{kindLabel(r.kind)}</td>
                <td className="px-4 py-3 font-medium text-ink">{r.ref}</td>
                <td className="max-w-[240px] truncate px-4 py-3 text-xs text-[#6B6B68]">{r.customer}</td>
                <td className="px-4 py-3 text-right tabular-nums">{Math.round(r.amountNGN).toLocaleString("en-NG")}</td>
                <td className={`px-4 py-3 text-xs font-medium ${statusTextClass(r.statusLabel)}`}>{r.statusLabel}</td>
                <td className="px-4 py-3">
                  {r.gateway ? (
                    <span className={`inline-block px-2 py-0.5 font-body text-[9px] font-medium uppercase ${gatewayClass(r.gateway)}`}>
                      {r.gateway}
                    </span>
                  ) : (
                    <span className="text-[#A8A8A4]">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-[#6B6B68]">
                  {r.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={r.href} className="text-xs uppercase text-[#37392d] underline-offset-2 hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 font-body text-sm text-[#6B6B68]">No payment records yet.</p>
      ) : null}
    </div>
  );
}
