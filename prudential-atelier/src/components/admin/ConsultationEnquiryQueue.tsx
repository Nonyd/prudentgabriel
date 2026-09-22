"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import toast from "react-hot-toast";
import { wearerLabel } from "@/lib/consultation-enquiry-shared";

type Status = "PENDING" | "APPROVED" | "BOOKED" | "DECLINED";

type Enquiry = {
  id: string;
  enquiryNumber: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  eventDate: string;
  eventType: string;
  wearer: string;
  outfitType: string;
  notes: string | null;
  moodboardImages: string[];
  shortNotice: boolean;
  status: Status;
  decisionReason: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  publicTokenExpiresAt: string | null;
  bookingId: string | null;
  booking: { bookingNumber: string } | null;
  createdAt: string;
};

const TABS: { status: Status; label: string }[] = [
  { status: "PENDING", label: "Waiting" },
  { status: "APPROVED", label: "Invited" },
  { status: "BOOKED", label: "Booked" },
  { status: "DECLINED", label: "Declined" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function hoursWaiting(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 3_600_000);
}

function waitingLabel(h: number): string {
  if (h < 1) return "just now";
  if (h < 48) return `${h}h waiting`;
  return `${Math.floor(h / 24)} days waiting`;
}

function eventLabel(ymd: string): string {
  const d = new Date(ymd);
  const days = Math.round((d.getTime() - Date.now()) / DAY_MS);
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${date} (${days <= 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`})`;
}

function DecisionForm({
  enquiry,
  onDone,
}: {
  enquiry: Enquiry;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"approve" | "decline" | null>(null);
  const [reason, setReason] = useState("");
  const [notifyClient, setNotifyClient] = useState(true);
  const [busy, setBusy] = useState(false);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/consultations/enquiries/${enquiry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as { error?: unknown };
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not save the decision");
      toast.success(
        body.action === "approve"
          ? "Approved — booking link emailed"
          : body.action === "resend"
            ? "A fresh booking link was emailed"
            : "Declined — reason recorded",
      );
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  if (enquiry.status === "APPROVED") {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[#6B6B68]">
        <span>
          Link valid until{" "}
          {enquiry.publicTokenExpiresAt ? new Date(enquiry.publicTokenExpiresAt).toLocaleDateString("en-GB") : "—"}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => void send({ action: "resend" })}
          className="admin-chip glass-1 glass-pill uppercase tracking-[0.08em] text-ink"
        >
          Send a fresh link
        </button>
      </div>
    );
  }
  if (enquiry.status !== "PENDING") return null;

  if (!mode) {
    return (
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("approve")}
          className="rounded-sm bg-[#37392d] px-4 py-2 font-sans text-[11px] uppercase tracking-[0.1em] text-white"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => setMode("decline")}
          className="rounded-sm border border-sand px-4 py-2 font-sans text-[11px] uppercase tracking-[0.1em] text-ink"
        >
          Decline
        </button>
      </div>
    );
  }

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void send(mode === "approve" ? { action: "approve", reason } : { action: "decline", reason, notifyClient });
      }}
    >
      <label className="block text-xs text-[#6B6B68]">
        {mode === "approve" ? "Why approve? (recorded, not sent)" : "Why decline? (recorded, not sent to her)"}
        <textarea
          className="input-field mt-1 min-h-[70px] w-full text-sm"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          minLength={3}
          maxLength={1000}
        />
      </label>
      {mode === "decline" ? (
        <label className="flex items-center gap-2 text-xs text-[#6B6B68]">
          <input type="checkbox" checked={notifyClient} onChange={(e) => setNotifyClient(e.target.checked)} />
          Send her the courteous decline email
        </label>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || reason.trim().length < 3}
          className="rounded-sm bg-[#37392d] px-4 py-2 font-sans text-[11px] uppercase tracking-[0.1em] text-white disabled:opacity-50"
        >
          {mode === "approve" ? "Approve and email the link" : "Decline"}
        </button>
        <button type="button" onClick={() => setMode(null)} className="px-3 text-xs underline">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ConsultationEnquiryQueue({ openId }: { openId: string | null }) {
  const [status, setStatus] = useState<Status>("PENDING");
  const [items, setItems] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/consultations/enquiries?status=${status}`, { cache: "no-store" });
      const j = (await res.json()) as { items?: Enquiry[] };
      setItems(j.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!openId || loading) return;
    document.getElementById(`enquiry-${openId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [openId, loading]);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2 font-body text-[11px]">
        {TABS.map((t) => (
          <button
            key={t.status}
            type="button"
            onClick={() => setStatus(t.status)}
            className={clsx(
              "admin-chip glass-1 glass-pill uppercase tracking-[0.08em]",
              status === t.status ? "border-[var(--glass-edge-bright)] text-choc" : "text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-6 font-body text-sm text-[#6B6B68]">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-6 font-body text-sm text-[#6B6B68]">Nothing here.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {items.map((e) => {
            const h = hoursWaiting(e.createdAt);
            const overdue = e.status === "PENDING" && h >= 24;
            return (
              <li
                key={e.id}
                id={`enquiry-${e.id}`}
                className={clsx(
                  "glass-1 border p-5 font-body text-sm",
                  openId === e.id ? "border-choc" : overdue ? "border-amber-400" : "border-sand",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[11px] text-olive">{e.enquiryNumber}</p>
                    <p className="mt-1 text-base font-medium text-ink">{e.clientName}</p>
                    <p className="text-xs text-[#6B6B68]">
                      <a href={`tel:${e.clientPhone}`} className="underline">
                        {e.clientPhone}
                      </a>{" "}
                      · {e.clientEmail}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.08em]">
                    {e.shortNotice ? (
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-800">Short notice — call her</span>
                    ) : null}
                    {e.status === "PENDING" ? (
                      <span
                        className={clsx(
                          "rounded-full px-2.5 py-1",
                          overdue ? "bg-amber-100 text-amber-900" : "bg-[#f1ede6] text-[#6B6B68]",
                        )}
                      >
                        {waitingLabel(h)}
                      </span>
                    ) : null}
                  </div>
                </div>

                <dl className="mt-4 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="inline text-[#6B6B68]">Event: </dt>
                    <dd className="inline text-ink">
                      {e.eventType}, {eventLabel(e.eventDate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-[#6B6B68]">Wearer: </dt>
                    <dd className="inline text-ink">{wearerLabel(e.wearer)}</dd>
                  </div>
                  <div>
                    <dt className="inline text-[#6B6B68]">Outfit: </dt>
                    <dd className="inline text-ink">{e.outfitType}</dd>
                  </div>
                  <div>
                    <dt className="inline text-[#6B6B68]">Received: </dt>
                    <dd className="inline text-ink">{new Date(e.createdAt).toLocaleString("en-GB")}</dd>
                  </div>
                </dl>
                {e.notes ? <p className="mt-3 whitespace-pre-line text-sm text-ink">{e.notes}</p> : null}
                {e.moodboardImages.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {e.moodboardImages.map((src) => (
                      <a key={src} href={src} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element -- private media, served by our own route */}
                        <img src={src} alt="" className="h-20 w-20 rounded-sm object-cover" />
                      </a>
                    ))}
                  </div>
                ) : null}

                {e.decisionReason ? (
                  <p className="mt-3 text-xs text-[#6B6B68]">
                    {e.status === "DECLINED" ? "Declined" : "Approved"} by {e.decidedBy ?? "—"}
                    {e.decidedAt ? ` on ${new Date(e.decidedAt).toLocaleDateString("en-GB")}` : ""}: {e.decisionReason}
                  </p>
                ) : null}
                {e.bookingId && e.booking ? (
                  <p className="mt-2 text-xs">
                    Booked as{" "}
                    <Link href={`/admin/consultations/${e.bookingId}`} className="font-mono text-olive underline">
                      {e.booking.bookingNumber}
                    </Link>
                  </p>
                ) : null}

                <DecisionForm enquiry={e} onDone={() => void load()} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
