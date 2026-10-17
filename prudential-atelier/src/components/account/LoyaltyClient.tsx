"use client";

import { useState } from "react";
import type { LoyaltyTier, PointsTransaction } from "@prisma/client";
import Link from "next/link";
import type { ClientTierStatus } from "@/lib/loyalty-tiers";
import { formatDate } from "@/lib/utils";

type TierCard = { tier: LoyaltyTier; label: string; minSpendNGN: number; perks: string[] };

type Props = {
  pointsBalance: number;
  pointsValueNGN: number;
  rateNGN: number;
  status: ClientTierStatus;
  tiers: TierCard[];
  copy: string;
  expiringPoints: number;
  expiringOn: string | null;
  history: PointsTransaction[];
  page: number;
  totalPages: number;
};

const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;

export function LoyaltyClient(props: Props) {
  const [page, setPage] = useState(props.page);
  const { status } = props;

  return (
    <div className="mx-auto max-w-4xl">
      <section className="rounded-lg bg-choc p-8 text-cream">
        <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-sand">{status.tierLabel} member</p>
        <p className="mt-4 font-display text-[56px] leading-none">{props.pointsBalance.toLocaleString()}</p>
        <p className="font-sans text-sm text-cream/80">Prudent Points</p>
        <p className="mt-2 font-sans text-sm text-sand">
          Worth {naira(props.pointsValueNGN)} at ₦{props.rateNGN} per point
        </p>
        {status.heldUntil ? (
          <p className="mt-2 font-sans text-xs text-cream/70">Your {status.tierLabel} status runs to {status.heldUntil}.</p>
        ) : null}
        {status.nextTier ? (
          <>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-cream/20">
              <div className="h-full bg-lightbr" style={{ width: `${status.progressPercent}%` }} />
            </div>
            <p className="mt-2 font-sans text-xs text-cream/70">
              {naira(status.spendThisYear)} spent this year. {naira(status.spendToNext)} more this year to reach{" "}
              {status.nextTierLabel}.
            </p>
          </>
        ) : null}
      </section>

      {props.expiringPoints > 0 && props.expiringOn ? (
        <p className="mt-6 border border-[#92660A] bg-[#92660A]/10 px-4 py-3 font-sans text-sm text-choc">
          {props.expiringPoints.toLocaleString()} Prudent Points expire on{" "}
          {formatDate(props.expiringOn, "dd MMM yyyy")}. Use them on a piece before they lapse.
        </p>
      ) : null}

      <section className="mt-10">
        <h2 className="font-display text-xl text-choc">The programme</h2>
        <p className="mt-3 max-w-xl font-sans text-sm leading-relaxed text-text-mid">{props.copy}</p>
        <p className="mt-3 max-w-xl font-sans text-sm leading-relaxed text-text-mid">
          Your tier follows what you spend with the house in a calendar year. A tier you reach is yours for the rest
          of that year and all of the next.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl text-choc">Tier benefits</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {props.tiers.map((t) => {
            const current = t.tier === status.tier;
            return (
              <div
                key={t.tier}
                className={`rounded-lg border p-4 ${current ? "border-nut bg-nut/5" : "border-sand"}`}
              >
                <p className="font-display text-lg text-choc">{t.label}</p>
                <p className="mt-1 font-sans text-xs uppercase tracking-wide text-text-light">
                  {t.minSpendNGN > 0 ? `${naira(t.minSpendNGN)} a year` : "Every client"}
                  {current ? " · You" : ""}
                </p>
                <ul className="mt-3 space-y-1.5 font-sans text-sm text-choc">
                  {t.perks.map((perk) => (
                    <li key={perk}>✓ {perk}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl text-choc">Points history</h2>
        <table className="mt-4 w-full font-sans text-sm">
          <thead>
            <tr className="border-b border-sand text-left text-xs uppercase text-text-light">
              <th className="py-2">Date</th>
              <th className="py-2">Type</th>
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Points</th>
              <th className="py-2 text-right">Value</th>
              <th className="py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {props.history.map((tx) => (
              <tr key={tx.id} className="border-b border-sand/40">
                <td className="py-2 text-text-mid">{formatDate(tx.createdAt, "dd MMM yyyy")}</td>
                <td className="py-2 text-xs uppercase tracking-wide text-text-light">
                  {tx.type.replace(/_/g, " ").toLowerCase()}
                </td>
                <td className="py-2">
                  {tx.description ?? tx.type}
                  {tx.orderId ? (
                    <>
                      {" "}
                      <Link href={`/account/orders/${tx.orderId}`} className="text-nut underline">
                        Order
                      </Link>
                    </>
                  ) : null}
                </td>
                <td className={`py-2 text-right ${tx.amount >= 0 ? "text-nut" : "text-error"}`}>
                  {tx.amount >= 0 ? "+" : ""}
                  {tx.amount}
                </td>
                <td className="py-2 text-right text-text-mid">
                  ₦
                  {Math.round(
                    Math.abs(tx.amount) * (tx.rateNGN && tx.rateNGN > 0 ? tx.rateNGN : props.rateNGN),
                  ).toLocaleString("en-NG")}
                </td>
                <td className="py-2 text-right text-text-mid">{tx.balanceAfter}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {props.totalPages > 1 ? (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="btn-ghost-light"
            >
              Previous
            </button>
            <Link href={`/account/loyalty?page=${page + 1}`} className="btn-ghost-light">
              Next
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
