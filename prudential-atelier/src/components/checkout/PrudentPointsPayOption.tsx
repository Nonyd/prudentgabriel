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

  return (
    <div
      className={clsx(
        "rounded-sm border p-4",
        applied
          ? "border-[1.5px] border-choc bg-[rgba(68,41,19,0.04)]"
          : "border-[0.5px] border-sand bg-bg-card",
      )}
    >
      <div className="flex items-start gap-3">
        <Crown className="mt-0.5 h-5 w-5 shrink-0 text-choc" strokeWidth={1.25} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-body text-sm text-choc">Pay with Prudent Points</p>
            {!isGuest ? (
              <span className="font-sans text-[10px] uppercase text-lightbr">
                {availablePoints.toLocaleString()} pts
              </span>
            ) : null}
          </div>
          {isGuest ? (
            <>
              <p className="mt-0.5 font-body text-xs text-text-light">
                Sign in to apply your balance toward this order. Shipping cannot be paid with points.
              </p>
              <button
                type="button"
                onClick={() => openLogin("/checkout")}
                className="mt-3 font-sans text-[10px] uppercase tracking-wider text-choc underline underline-offset-4"
              >
                Sign in
              </button>
            </>
          ) : availablePoints <= 0 ? (
            <p className="mt-0.5 font-body text-xs text-text-light">
              You have no Prudent Points yet. Earn 1 point for every ₦10 you spend.
            </p>
          ) : (
            <>
              <p className="mt-0.5 font-body text-xs text-text-light">
                Worth up to {maxValueLabel}. Shipping cannot be paid with points.
              </p>
              {belowMin ? (
                <p className="mt-2 font-body text-xs text-text-mid">
                  Minimum redemption is {minRedemption.toLocaleString()} points.
                </p>
              ) : null}
              {canRedeem ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    id="points-redeem-payment"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={maxPts}
                    value={pointsToRedeem}
                    onChange={(e) => onChange(Number(e.target.value) || 0)}
                    aria-label="Prudent Points to redeem"
                    className="w-28 rounded-sm border border-sand bg-ivory px-2 py-1.5 font-body text-sm text-choc"
                  />
                  <button
                    type="button"
                    onClick={() => onChange(maxPts)}
                    className="font-sans text-[10px] uppercase tracking-wider text-choc underline underline-offset-4"
                  >
                    Apply all
                  </button>
                  {pointsToRedeem > 0 ? (
                    <button
                      type="button"
                      onClick={() => onChange(0)}
                      className="font-sans text-[10px] uppercase tracking-wider text-text-light underline underline-offset-4"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              ) : null}
              {applied ? (
                <p className="mt-2 font-sans text-xs text-nut">
                  {pointsToRedeem.toLocaleString()} pts applied · remaining {remainingLabel}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
