import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import { CopyReferralClient } from "@/components/account/CopyReferralClient";

export default async function ReferralPage() {
  const session = await auth();
  const userId = session!.user!.id!;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true, name: true },
  });
  const referred = await prisma.user.findMany({
    where: { referredById: userId },
    select: { id: true, name: true, createdAt: true, orders: { select: { id: true } } },
  });

  const base = getPublicAppUrl();
  const link = `${base}/ref/${user?.referralCode ?? ""}`;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl text-wine">Referrals</h1>
      <p className="mt-2 text-sm text-charcoal-mid">Share your link · friends get 500 pts on referral signup · you earn 250 pts.</p>

      <div
        className="mt-8 rounded-sm p-8 text-ivory"
        style={{ background: "linear-gradient(135deg, #6B1C2A, #4A1019)" }}
      >
        <p className="font-label text-xs text-ivory/60">Your referral link</p>
        <p className="mt-2 break-all font-mono text-sm text-gold">{link}</p>
        <CopyReferralClient link={link} />
      </div>

      <h2 className="mt-10 font-display text-lg text-charcoal">Your invites</h2>
      <ul className="mt-4 space-y-2 text-sm">
        {referred.length === 0 ? (
          <li className="text-charcoal-mid">Share your link to start earning.</li>
        ) : (
          referred.map((r) => {
            const nm = r.name ?? "Friend";
            const first = nm.split(/\s+/)[0] ?? "Friend";
            const last = nm.split(/\s+/)[1]?.[0];
            const label = last ? `${first} ${last}.` : first;
            return (
              <li key={r.id} className="flex justify-between border-b border-border py-2">
                <span>{label}</span>
                <span className="text-charcoal-mid">{r.orders.length ? "Has shopped" : "Signed up"}</span>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
