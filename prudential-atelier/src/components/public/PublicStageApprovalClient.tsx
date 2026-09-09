"use client";

import { useState } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import type { StageApprovalStatus } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import type { PublicStageApprovalPayload } from "@/lib/public-stage-approval-payload";

export function PublicStageApprovalClient({
  token,
  view,
}: {
  token: string;
  view: PublicStageApprovalPayload;
}) {
  const [status, setStatus] = useState<StageApprovalStatus>(view.status);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState<"APPROVED" | "CHANGES_REQUESTED" | null>(null);

  const pending = status === "PENDING";

  const respond = async (decision: "APPROVED" | "CHANGES_REQUESTED") => {
    if (decision === "CHANGES_REQUESTED" && !comment.trim()) {
      toast.error("Please describe the changes you would like.");
      return;
    }
    setSubmitting(decision);
    try {
      const res = await fetch(`/api/approve/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed");
      }
      toast.success(decision === "APPROVED" ? "Approved — thank you" : "Change request sent");
      setStatus(decision === "APPROVED" ? "APPROVED" : "CHANGES_REQUESTED");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-bg px-4 py-16">
      <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-lightbr">
        Prudential Atelier
      </p>
      <p className="mt-4 font-sans text-[10px] uppercase tracking-wider text-lightbr">{view.orderRef}</p>
      <h1 className="mt-1 font-display text-3xl text-choc">Review {view.stageLabel}</h1>

      {!pending ? (
        <p className="mt-6 font-sans text-sm text-text-mid">
          {status === "APPROVED"
            ? "You have already approved this stage. Thank you."
            : status === "CHANGES_REQUESTED"
              ? "You have already asked for changes on this stage."
              : "This review is no longer waiting for a response."}
        </p>
      ) : null}

      {view.notes ? (
        <p className="mt-6 whitespace-pre-wrap font-sans text-sm text-text-mid">{view.notes}</p>
      ) : null}

      {view.media.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-3">
          {view.media.map((m) =>
            m.kind === "IMAGE" ? (
              <div key={m.id} className="relative h-48 w-48 overflow-hidden border border-sand">
                <Image src={m.url} alt="" fill className="object-cover" unoptimized />
              </div>
            ) : (
              <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="font-sans text-xs text-nut underline">
                Video
              </a>
            ),
          )}
        </div>
      ) : (
        <p className="mt-6 font-sans text-sm text-text-light">No photograph is attached to this review.</p>
      )}

      {pending ? (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional comment — required if you request changes"
            rows={3}
            className="mt-8 w-full rounded border border-sand px-3 py-2 font-sans text-sm"
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
        </>
      ) : null}
    </main>
  );
}
