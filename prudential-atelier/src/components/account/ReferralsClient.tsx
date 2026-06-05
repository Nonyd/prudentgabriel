"use client";

import toast from "react-hot-toast";
import { CopyReferralClient } from "@/components/account/CopyReferralClient";

type ReferralRow = {
  firstName: string;
  joinedAt: string;
  status: "Joined" | "Ordered";
};

export function ReferralsClient({
  link,
  stats,
  referrals,
}: {
  link: string;
  stats: { totalReferred: number; converted: number; pointsEarned: number };
  referrals: ReferralRow[];
}) {
  function shareWhatsApp() {
    const text = encodeURIComponent(
      `Join me at Prudential Atelier — atelier fashion worth celebrating. ${link}`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-4xl text-choc">Refer a Friend</h1>
      <p className="mt-2 font-sans text-sm text-text-mid">
        Share your link and earn rewards when friends join and shop.
      </p>

      <div className="mt-8 rounded-lg bg-choc p-8 text-cream">
        <p className="font-sans text-[10px] uppercase tracking-wider text-lightbr">Your referral link</p>
        <p className="mt-2 break-all font-mono text-sm">{link}</p>
        <CopyReferralClient link={link} />
        <div className="mt-4 flex gap-3">
          <button type="button" onClick={shareWhatsApp} className="btn-ghost-light text-cream">
            Share on WhatsApp
          </button>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(link);
              toast.success("Link copied");
            }}
            className="font-sans text-xs text-lightbr underline"
          >
            Copy link
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          ["Total Referred", stats.totalReferred],
          ["Converted", stats.converted],
          ["Points Earned", stats.pointsEarned],
        ].map(([label, val]) => (
          <div key={label as string} className="card-surface p-4 text-center">
            <p className="font-display text-2xl text-choc">{val}</p>
            <p className="font-sans text-xs text-text-mid">{label}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 font-display text-xl text-choc">Referred friends</h2>
      <ul className="mt-4 space-y-2">
        {referrals.length === 0 ? (
          <li className="font-sans text-sm text-text-mid">Share your link to start earning.</li>
        ) : (
          referrals.map((r, i) => (
            <li key={i} className="flex justify-between border-b border-sand py-2 font-sans text-sm">
              <span>{r.firstName}</span>
              <span className="text-text-light">
                {new Date(r.joinedAt).toLocaleDateString("en-GB")} · {r.status}
              </span>
            </li>
          ))
        )}
      </ul>

      <div className="mt-10 card-surface p-6">
        <h3 className="font-display text-lg text-choc">How it works</h3>
        <ol className="mt-4 list-decimal space-y-2 pl-5 font-sans text-sm text-text-mid">
          <li>Share your unique link with friends</li>
          <li>They register and receive a welcome bonus</li>
          <li>You earn points when they join — and more when they order</li>
        </ol>
      </div>
    </div>
  );
}
