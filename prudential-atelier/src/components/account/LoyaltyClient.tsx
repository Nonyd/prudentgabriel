"use client";

import { useState } from "react";
import type { LoyaltyRule, LoyaltyTier, PointsTransaction } from "@prisma/client";
import Link from "next/link";
import { TIER_BENEFITS, TIER_LABELS } from "@/lib/loyalty";
import { formatDate } from "@/lib/utils";

type Props = {
  pointsBalance: number;
  tier: LoyaltyTier;
  tierLabel: string;
  nextTier: LoyaltyTier | null;
  pointsToNext: number;
  progressPercent: number;
  rules: LoyaltyRule[];
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
        <p className="font-sans text-sm text-cream/80">loyalty points</p>
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
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Points</th>
              <th className="py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {props.history.map((tx) => (
              <tr key={tx.id} className="border-b border-sand/40">
                <td className="py-2 text-text-mid">{formatDate(tx.createdAt, "dd MMM yyyy")}</td>
                <td className="py-2">{tx.description ?? tx.type}</td>
                <td className={`py-2 text-right ${tx.amount >= 0 ? "text-nut" : "text-red-600"}`}>
                  {tx.amount >= 0 ? "+" : ""}
                  {tx.amount}
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

      <section className="mt-10">
        <h2 className="font-display text-xl text-choc">How to earn points</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {props.rules.map((r) => (
            <div key={r.action} className="card-surface p-4">
              <p className="font-sans text-sm text-choc">{r.action.replace(/_/g, " ")}</p>
              <p className="mt-1 font-display text-xl text-nut">+{r.points} pts</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
