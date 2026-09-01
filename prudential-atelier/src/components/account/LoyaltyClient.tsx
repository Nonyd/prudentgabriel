"use client";

import { useState } from "react";
import type { LoyaltyTier, PointsTransaction } from "@prisma/client";
import Link from "next/link";
import { TIER_BENEFITS, TIER_LABELS } from "@/lib/loyalty";
import { formatDate } from "@/lib/utils";

type Props = {
  pointsBalance: number;
  pointsValueNGN: number;
  rateNGN: number;
  tier: LoyaltyTier;
  tierLabel: string;
  nextTier: LoyaltyTier | null;
  pointsToNext: number;
  progressPercent: number;
  copy: string;
  expiringPoints: number;
  expiringOn: string | null;
  history: PointsTransaction[];
  page: number;
  totalPages: number;
};

export function LoyaltyClient(props: Props) {
  const [page, setPage] = useState(props.page);

  return (
    <div className="mx-auto max-w-4xl">
      <section className="rounded-lg bg-choc p-8 text-cream">
        <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-lightbr">{props.tierLabel}</p>
        <p className="mt-4 font-display text-[56px] leading-none">{props.pointsBalance.toLocaleString()}</p>
        <p className="font-sans text-sm text-cream/80">Prudent Points</p>
        <p className="mt-2 font-sans text-sm text-lightbr">
          Worth ₦{Math.round(props.pointsValueNGN).toLocaleString("en-NG")} at ₦{props.rateNGN} per point
        </p>
        {props.nextTier ? (
          <>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-cream/20">
              <div className="h-full bg-lightbr" style={{ width: `${props.progressPercent}%` }} />
            </div>
            <p className="mt-2 font-sans text-xs text-cream/70">
              {props.pointsToNext} points needed to reach {TIER_LABELS[props.nextTier]}
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
      </section>

      <section className="mt-10 overflow-x-auto">
        <h2 className="font-display text-xl text-choc">Tier benefits</h2>
        <table className="mt-4 w-full min-w-[480px] border-collapse font-sans text-sm">
          <thead>
            <tr className="border-b border-sand text-left text-xs uppercase text-text-light">
              <th className="py-2 pr-4">Benefit</th>
              {(["BRONZE", "SILVER", "GOLD", "PLATINUM"] as LoyaltyTier[]).map((t) => (
                <th
                  key={t}
                  className={`px-2 py-2 text-center ${t === props.tier ? "border-x-2 border-nut" : ""}`}
                >
                  {TIER_LABELS[t]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIER_BENEFITS.map((b) => (
              <tr key={b.label} className="border-b border-sand/60">
                <td className="py-3 pr-4 text-choc">{b.label}</td>
                {(["BRONZE", "SILVER", "GOLD", "PLATINUM"] as LoyaltyTier[]).map((t) => (
                  <td
                    key={t}
                    className={`px-2 py-3 text-center ${t === props.tier ? "border-x-2 border-nut bg-nut/5" : ""}`}
                  >
                    {b.tiers.includes(t) ? "✓" : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
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
                <td className={`py-2 text-right ${tx.amount >= 0 ? "text-nut" : "text-red-600"}`}>
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
