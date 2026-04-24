import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getExchangeRates, convertFromNGN, formatPrice } from "@/lib/currency";
import Link from "next/link";

export default async function WalletPage() {
  const session = await auth();
  const userId = session!.user!.id!;
  const [user, txs] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { pointsBalance: true } }),
    prisma.pointsTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  const pts = user?.pointsBalance ?? 0;
  const rates = await getExchangeRates();
  const usd = convertFromNGN(pts, "USD", rates);
  const gbp = convertFromNGN(pts, "GBP", rates);

  return (
    <div className="mx-auto max-w-3xl">
      <div
        className="rounded-sm p-10 text-ivory"
        style={{
          background: "linear-gradient(135deg, #6B1C2A, #4A1019)",
        }}
      >
        <p className="font-label text-xs uppercase tracking-wider text-ivory/60">Your loyalty wallet</p>
        <p className="mt-2 font-display text-5xl italic text-gold">{pts}</p>
        <p className="font-label text-xs text-ivory/60">points</p>
        <p className="mt-4 font-body text-lg">= ₦{pts.toLocaleString()} store credit</p>
        <p className="text-sm text-ivory/50">
          ≈ {formatPrice(usd, "USD")} · {formatPrice(gbp, "GBP")}
        </p>
        <Link
          href="/shop"
          className="mt-6 inline-block rounded-sm border border-gold px-5 py-2 text-sm text-gold hover:bg-gold/10"
        >
          Shop & earn more
        </Link>
      </div>

      <div className="mt-8 rounded-sm border border-border bg-cream p-6 text-sm text-charcoal">
        <p className="font-medium text-wine">How points work</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-charcoal-mid">
          <li>Earn 1 point per ₦100 spent</li>
          <li>250 pts when a friend signs up with your link</li>
          <li>500 pts welcome when you join via referral</li>
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
                <p className={t.amount >= 0 ? "text-gold" : "text-wine"}>
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
