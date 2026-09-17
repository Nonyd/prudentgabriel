"use client";

import clsx from "clsx";
import { Crown } from "lucide-react";
import { useAuthModalStore } from "@/store/authModalStore";

type Props = {
  isGuest: boolean;
  availablePoints: number;
  maxPts: number;
  minRedemption: number;
  pointsToRedeem: number;
  onChange: (n: number) => void;
  maxValueLabel: string;
  remainingLabel: string;
  applied: boolean;
};

export function PrudentPointsPayOption({
  isGuest,
  availablePoints,
  maxPts,
  minRedemption,
  pointsToRedeem,
  onChange,
  maxValueLabel,
  remainingLabel,
  applied,
}: Props) {
  const openLogin = useAuthModalStore((s) => s.openLogin);
  const canRedeem = !isGuest && maxPts >= minRedemption && maxPts > 0;
  const belowMin = !isGuest && availablePoints > 0 && (maxPts < minRedemption || availablePoints < minRedemption);

  // Quiet one-liner when there is nothing to redeem — do not compete with payment methods.
  if (isGuest) {
    return (
      <p className="font-body text-sm text-charcoal-mid">
        Have Prudent Points?{" "}
        <button
          type="button"
          onClick={() => openLogin("/checkout")}
          className="text-choc underline underline-offset-4 hover:text-choc/80"
        >
          Sign in
        </button>{" "}
        to use them. Shipping cannot be paid with points.
      </p>
    );
  }

  if (availablePoints <= 0) {
    return (
      <p className="font-body text-sm text-charcoal-mid">
        Earn 1 Prudent Point for every ₦10 you spend on this order.
      </p>
    );
  }

  return (
    <div
      className={clsx(
        "border-b border-border pb-5",
        applied && "border-choc/30",
      )}
    >
      <div className="flex items-start gap-3">
        <Crown className="mt-0.5 h-5 w-5 shrink-0 text-choc" strokeWidth={1.25} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-display text-lg text-choc">Prudent Points</p>
            <span className="font-body text-sm tabular-nums text-charcoal-mid">
              {availablePoints.toLocaleString()} available
            </span>
          </div>
          <p className="mt-1 font-body text-sm text-charcoal-mid">
            Worth up to {maxValueLabel}. Shipping cannot be paid with points.
          </p>
          {belowMin ? (
            <p className="mt-2 font-body text-sm text-charcoal-mid">
              Minimum redemption is {minRedemption.toLocaleString()} points.
            </p>
          ) : null}
          {canRedeem ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                id="points-redeem-payment"
                type="number"
                inputMode="numeric"
                min={0}
                max={maxPts}
                value={pointsToRedeem}
                onChange={(e) => onChange(Number(e.target.value) || 0)}
                aria-label="Prudent Points to redeem"
                className="w-28 border-0 border-b border-border bg-transparent py-2 font-body text-base text-charcoal outline-none focus:border-b-2 focus:border-choc"
              />
              <button
                type="button"
                onClick={() => onChange(maxPts)}
                className="min-h-11 font-body text-[11px] uppercase tracking-wider text-choc underline underline-offset-4"
              >
                Use all
              </button>
              {pointsToRedeem > 0 ? (
                <button
                  type="button"
                  onClick={() => onChange(0)}
                  className="min-h-11 font-body text-[11px] uppercase tracking-wider text-charcoal-mid underline underline-offset-4 hover:text-choc"
                >
                  Clear
                </button>
              ) : null}
            </div>
          ) : null}
          {applied ? (
            <p className="mt-2 font-body text-sm text-choc">
              {pointsToRedeem.toLocaleString()} pts applied · remaining {remainingLabel}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
