import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getExchangeRates, convertFromNGN, formatPrice } from "@/lib/currency";
import { getPointRateNGN, pointsToNaira } from "@/lib/points";
import Link from "next/link";

export default async function WalletPage() {
  const session = await auth();
  const userId = session!.user!.id!;
  const [user, txs, rateNGN] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { pointsBalance: true } }),
    prisma.pointsTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    getPointRateNGN(),
  ]);
  const pts = user?.pointsBalance ?? 0;
  const valueNGN = pointsToNaira(pts, rateNGN);
  const rates = await getExchangeRates();
  const usd = convertFromNGN(valueNGN, "USD", rates);
  const gbp = convertFromNGN(valueNGN, "GBP", rates);

  return (
    <div className="mx-auto max-w-3xl">
      <div
        className="rounded-sm p-10 text-ivory"
        style={{
          background: "linear-gradient(135deg, var(--olive), var(--olive-hover))",
        }}
      >
        <p className="font-label text-xs uppercase tracking-wider text-ivory/60">Prudent Points</p>
        <p className="mt-2 font-display text-5xl italic text-gold">{pts}</p>
        <p className="font-label text-xs text-ivory/60">points</p>
        <p className="mt-4 font-body text-lg">= ₦{Math.round(valueNGN).toLocaleString("en-NG")} at ₦{rateNGN} per point</p>
        <p className="text-sm text-ivory/50">
          ≈ {formatPrice(usd, "USD")} · {formatPrice(gbp, "GBP")}
        </p>
        <Link
          href="/rtw"
          className="mt-6 inline-block rounded-sm border border-gold px-5 py-2 text-sm text-gold hover:bg-gold/10"
        >
          Shop & earn more
        </Link>
      </div>

      <div className="mt-8 rounded-sm border border-border bg-cream p-6 text-sm text-charcoal">
        <p className="font-medium text-olive">How points work</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-charcoal-mid">
          <li>Earn points per ₦100 of garment spend — the rate is set in the atelier</li>
          <li>Referral points arrive when your friend completes their first paid order</li>
          <li>Points cover the garment, never shipping, and may pay an order in full</li>
        </ul>
      </div>

      <h2 className="mt-10 font-display text-xl text-charcoal">Transaction history</h2>
      <ul className="mt-4 space-y-2">
        {txs.length === 0 ? (
          <li className="text-charcoal-mid">No transactions yet.</li>
        ) : (
          txs.map((t) => (
            <li key={t.id} className="flex justify-between rounded-sm border border-border bg-ivory px-4 py-3 text-sm">
              <div>
                <p className="text-charcoal">{t.description}</p>
                <p className="text-xs text-charcoal-light">{new Date(t.createdAt).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className={t.amount >= 0 ? "text-olive" : "text-error"}>
                  {t.amount >= 0 ? "+" : ""}
                  {t.amount}
                </p>
                {t.balanceAfter != null && <p className="text-xs text-charcoal-mid">bal {t.balanceAfter}</p>}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
