import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Package, Heart, Users, Zap } from "lucide-react";

export default async function AccountOverviewPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const [orders, wishlistCount, referralCount, user] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: {
        items: { take: 1, include: { product: { select: { name: true } } } },
      },
    }),
    prisma.wishlistItem.count({ where: { userId } }),
    prisma.user.count({ where: { referredById: userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { pointsBalance: true, name: true },
    }),
  ]);

  const firstName = (user?.name ?? "there").split(/\s+/)[0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const orderTotal = await prisma.order.count({ where: { userId } });

  return (
    <div className="mx-auto max-w-4xl">
      <p className="font-body text-sm text-charcoal-light">{greet},</p>
      <h1 className="font-display text-3xl text-wine">{firstName}</h1>
      <p className="mt-1 font-body text-sm text-charcoal-mid">Welcome to your Prudential Atelier account.</p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Package} label="Orders" value={orderTotal} tone="wine" />
        <StatCard icon={Zap} label="Points" value={`${user?.pointsBalance ?? 0} pts`} sub="Store credit" tone="gold" />
        <StatCard icon={Heart} label="Wishlist" value={wishlistCount} sub="Saved" tone="wine" />
        <StatCard icon={Users} label="Referrals" value={referralCount} sub="Friends referred" tone="gold" />
      </div>

      <section className="mt-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-charcoal">Recent orders</h2>
          <Link href="/account/orders" className="text-sm text-wine hover:underline">
            View all
          </Link>
        </div>
        {orders.length === 0 ? (
          <div className="rounded-sm border border-border bg-cream p-8 text-center text-charcoal-mid">
            <p>No orders yet.</p>
            <Link
              href="/shop"
              className="mt-4 inline-block rounded-sm bg-wine px-6 py-2 text-sm text-ivory hover:bg-wine-hover"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/account/orders/${o.id}`}
                  className="flex items-center justify-between rounded-sm border border-border bg-cream p-4 transition hover:border-wine/40"
                >
                  <div>
                    <p className="font-label text-xs text-gold">{o.orderNumber}</p>
                    <p className="text-xs text-charcoal-light">
                      {new Date(o.createdAt).toLocaleDateString()} · {o.items[0]?.product.name ?? "Order"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-charcoal">₦{Math.round(o.total).toLocaleString()}</p>
                    <span className="text-xs text-charcoal-mid">{o.status}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/shop" className="rounded-sm bg-wine px-5 py-2 text-sm text-ivory hover:bg-wine-hover">
          Shop now
        </Link>
        <Link href="/bespoke" className="rounded-sm border border-wine px-5 py-2 text-sm text-wine hover:bg-wine/5">
          Book bespoke
        </Link>
        <Link href="/account/referral" className="rounded-sm border border-border px-5 py-2 text-sm text-charcoal">
          Invite friends
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: typeof Package;
  label: string;
  value: number | string;
  sub?: string;
  tone: "wine" | "gold";
}) {
  return (
    <div className="rounded-sm border border-border bg-cream p-5">
      <Icon className={tone === "wine" ? "h-5 w-5 text-gold" : "h-5 w-5 text-wine"} />
      <p className="mt-3 font-display text-2xl text-wine">{value}</p>
      <p className="font-body text-sm text-charcoal">{label}</p>
      {sub && <p className="text-xs text-charcoal-mid">{sub}</p>}
    </div>
  );
}
