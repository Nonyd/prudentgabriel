"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { BespokeStage, StageApprovalStatus } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { STAGE_SHORT_LABELS } from "@/lib/bespoke-stages";

type Approval = {
  id: string;
  stage: BespokeStage;
  status: StageApprovalStatus;
  requestedAt: Date | string;
  clientComment: string | null;
};

type Media = { id: string; url: string; kind: "IMAGE" | "VIDEO" };

export function BespokeApprovalClient({
  orderId,
  orderRef,
  currentStage,
  notes,
  media,
  approvals,
}: {
  orderId: string;
  orderRef: string;
  currentStage: BespokeStage;
  notes: string | null;
  media: Media[];
  approvals: Approval[];
}) {
  const router = useRouter();
  const pending = approvals.find((a) => a.status === "PENDING" && a.stage === currentStage);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState<"APPROVED" | "CHANGES_REQUESTED" | null>(null);

  if (!pending) {
    return (
      <p className="mt-6 font-sans text-sm text-text-mid">
        No approval is waiting on this commission right now.
      </p>
    );
  }

  const respond = async (decision: "APPROVED" | "CHANGES_REQUESTED") => {
    if (decision === "CHANGES_REQUESTED" && !comment.trim()) {
      toast.error("Please describe the changes you would like.");
      return;
    }
    setSubmitting(decision);
    try {
      const res = await fetch(`/api/account/bespoke/${orderId}/approvals/${pending.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed");
      }
      toast.success(decision === "APPROVED" ? "Approved — thank you" : "Change request sent");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <section className="mt-8 rounded-sm border border-sand bg-ivory p-6">
      <p className="font-sans text-[10px] uppercase tracking-wider text-lightbr">{orderRef}</p>
      <h2 className="mt-1 font-display text-2xl text-choc">
        Review {STAGE_SHORT_LABELS[pending.stage]}
      </h2>
      {notes ? (
        <p className="mt-4 whitespace-pre-wrap font-sans text-sm text-text-mid">{notes}</p>
      ) : null}
      {media.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {media.map((m) =>
            m.kind === "IMAGE" ? (
              <div key={m.id} className="relative h-32 w-32 overflow-hidden border border-sand">
                <Image src={m.url} alt="" fill className="object-cover" unoptimized />
              </div>
            ) : (
              <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="font-sans text-xs text-nut underline">
                Video
              </a>
            ),
          )}
        </div>
      ) : null}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment — required if you request changes"
        rows={3}
        className="mt-6 w-full rounded border border-sand px-3 py-2 font-sans text-sm"
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button loading={submitting === "APPROVED"} onClick={() => void respond("APPROVED")}>
          Approve
        </Button>
        <Button
          variant="secondary"
          loading={submitting === "CHANGES_REQUESTED"}
          onClick={() => void respond("CHANGES_REQUESTED")}
        >
          Request changes
        </Button>
      </div>
    </section>
  );
}
