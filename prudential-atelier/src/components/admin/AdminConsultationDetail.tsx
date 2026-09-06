"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ConsultationDeliveryMode, ConsultationStatus } from "@prisma/client";
import toast from "react-hot-toast";
import {
  getOfferingTypeIcon,
  getOfferingTypeLabel,
  getVirtualPlatformLabel,
  isOfferingTypeVirtual,
  type OfferingTypeKey,
} from "@/lib/consultation-types";
import { isVirtualDelivery } from "@/lib/consultation";
import { ClientMeasurementsPanel } from "@/components/admin/ClientMeasurementsPanel";
import { ConsultationDeleteControl } from "@/components/admin/ConsultationDeleteControl";
import type { MeasurementData } from "@/lib/measurements";

type LinkedQuotation = {
  id: string;
  quoteRef: string;
  status: string;
};

type Booking = {
  id: string;
  userId: string | null;
  bookingNumber: string;
  status: ConsultationStatus;
  offeringType: string | null;
  virtualPlatform: string | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientCountry: string;
  clientInstagram: string | null;
  occasion: string;
  description: string;
  preferredDate1: string | null;
  preferredDate2: string | null;
  preferredDate3: string | null;
  confirmedDate: string | null;
  confirmedTime: string | null;
  meetingLink: string | null;
  meetingPlatform: string | null;
  meetingLinkSentAt: string | null;
  feeNGN: number;
  paymentStatus: string;
  paymentGateway: string | null;
  paymentRef: string | null;
  paidAt: string | null;
  adminNotes: string | null;
  sessionNotes: string | null;
  moodboardImages: string[];
  moodboardNotes: string | null;
  consultant: { id: string; name: string; title: string; image: string | null };
  offering: { durationMinutes: number; deliveryMode: string; sessionType?: string };
};

const STATUS_OPTIONS: ConsultationStatus[] = [
  ConsultationStatus.PENDING_PAYMENT,
  ConsultationStatus.PENDING_CONFIRMATION,
  ConsultationStatus.CONFIRMED,
  ConsultationStatus.SCHEDULED,
  ConsultationStatus.IN_SESSION,
  ConsultationStatus.COMPLETED,
  ConsultationStatus.NO_SHOW,
  ConsultationStatus.CANCELLED_BY_ADMIN,
];

function formatWatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Lagos",
  }).format(date);
}

function formatWatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(date);
}

function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dateInputToWatIso(ymd: string): string {
  return `${ymd}T12:00:00+01:00`;
}

export function AdminConsultationDetail({
  booking,
  clientId,
  measurements,
  quotation,
}: {
  booking: Booking;
  clientId: string | null;
  measurements?: MeasurementData | null;
  quotation?: LinkedQuotation | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(booking.status as ConsultationStatus);
  const [linkInput, setLinkInput] = useState(booking.meetingLink ?? "");
  const [sessionNotes, setSessionNotes] = useState(booking.sessionNotes ?? "");
  const [moodboardNotes, setMoodboardNotes] = useState(booking.moodboardNotes ?? "");
  const [moodboardImages, setMoodboardImages] = useState<string[]>(booking.moodboardImages ?? []);
  const [adminNotes, setAdminNotes] = useState(booking.adminNotes ?? "");
  const [uploading, setUploading] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDate, setConfirmDate] = useState("");
  const [confirmTime, setConfirmTime] = useState("10:00");
  const [confirming, setConfirming] = useState(false);

  const deliveryMode = booking.offering?.deliveryMode as ConsultationDeliveryMode | undefined;
  const isVirtual =
    (booking.offeringType && isOfferingTypeVirtual(booking.offeringType as OfferingTypeKey)) ||
    (deliveryMode ? isVirtualDelivery(deliveryMode) : false);

  const typeLabel = getOfferingTypeLabel(booking.offeringType);
  const typeIcon = getOfferingTypeIcon(booking.offeringType);
  const platformLabel = getVirtualPlatformLabel(booking.virtualPlatform) || booking.meetingPlatform;

  async function sendLink() {
    if (!linkInput.trim()) {
      toast.error("Enter a meeting link");
      return;
    }
    setSendingLink(true);
    try {
      const res = await fetch(`/api/admin/consultations/${booking.id}/send-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingLink: linkInput.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error((j as { error?: string }).error ?? "Failed to send link");
      toast.success("Meeting link sent to client");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send link");
    } finally {
      setSendingLink(false);
    }
  }

  async function saveSession(markComplete = false) {
    setSavingSession(true);
    try {
      const res = await fetch(`/api/admin/consultations/${booking.id}/session`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionNotes,
          moodboardImages,
          moodboardNotes,
          ...(markComplete ? { status: ConsultationStatus.COMPLETED } : {}),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error((j as { error?: string }).error ?? "Save failed");
      toast.success(markComplete ? "Marked as completed" : "Session notes saved");
      if (markComplete) setStatus(ConsultationStatus.COMPLETED);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingSession(false);
    }
  }

  async function uploadMoodboard(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/consultations/upload", { method: "POST", body: fd });
      const j = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) throw new Error(j.error ?? "Upload failed");
      if (j.url) setMoodboardImages((prev) => [...prev, j.url!]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function patchStatus(
    next: ConsultationStatus,
    extra?: { confirmedDate?: string; confirmedTime?: string },
  ) {
    const res = await fetch(`/api/admin/consultations/${booking.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, ...extra }),
    });
    const j = await res.json();
    if (!res.ok) {
      const err = j as { error?: string | { formErrors?: string[] } };
      const msg =
        typeof err.error === "string"
          ? err.error
          : Array.isArray(err.error?.formErrors)
            ? err.error.formErrors.join(", ")
            : "Update failed";
      toast.error(msg);
      return false;
    }
    setStatus(next);
    toast.success("Status updated");
    router.refresh();
    return true;
  }

  function openConfirmDialog() {
    setConfirmDate(
      isoToDateInput(booking.confirmedDate) || isoToDateInput(booking.preferredDate1),
    );
    setConfirmTime(booking.confirmedTime ?? "10:00");
    setConfirmOpen(true);
  }

  async function submitConfirmation() {
    if (!confirmDate || !confirmTime) {
      toast.error("Select a date and time");
      return;
    }
    setConfirming(true);
    try {
      const ok = await patchStatus(ConsultationStatus.CONFIRMED, {
        confirmedDate: dateInputToWatIso(confirmDate),
        confirmedTime: confirmTime,
      });
      if (ok) setConfirmOpen(false);
    } finally {
      setConfirming(false);
    }
  }

  function handleStatusChange(next: ConsultationStatus) {
    if (
      next === ConsultationStatus.CONFIRMED &&
      status === ConsultationStatus.PENDING_CONFIRMATION
    ) {
      openConfirmDialog();
      return;
    }
    void patchStatus(next);
  }

  async function saveAdminNotes() {
    const res = await fetch(`/api/admin/consultations/${booking.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminNotes }),
    });
    if (!res.ok) {
      toast.error("Could not save notes");
      return;
    }
    toast.success("Internal notes saved");
  }

  const canEditSession =
    status === ConsultationStatus.IN_SESSION ||
    status === ConsultationStatus.COMPLETED ||
    status === ConsultationStatus.SCHEDULED ||
    status === ConsultationStatus.CONFIRMED;

  return (
    <div className="mt-8 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-label text-xs uppercase tracking-widest text-gold">Consultation</p>
          <h2 className="font-display text-xl text-ink">{booking.bookingNumber}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value as ConsultationStatus)}
            className="rounded-sm border border-sand bg-white px-3 py-2 text-sm text-ink"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <ConsultationDeleteControl
            id={booking.id}
            bookingNumber={booking.bookingNumber}
            afterDeleteHref="/admin/consultations"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 glass-opaque p-5">
          <h3 className="font-label text-gold">Client</h3>
          <p className="font-medium text-ink">{booking.clientName}</p>
          <a href={`mailto:${booking.clientEmail}`} className="text-sm text-olive underline">
            {booking.clientEmail}
          </a>
          <p className="text-sm text-[#6B6B68]">{booking.clientPhone}</p>
          {clientId ? (
            <Link href={`/admin/customers/${booking.userId}`} className="text-xs text-olive underline">
              View client profile →
            </Link>
          ) : null}
          <div className="border-t border-sand pt-4">
            <p className="font-label text-xs text-gold">Occasion</p>
            <p className="mt-1 text-sm text-ink">{booking.occasion}</p>
            <p className="mt-2 text-sm text-[#6B6B68]">{booking.description}</p>
          </div>
        </div>

        <div className="space-y-4 glass-opaque p-5">
          <h3 className="font-label text-gold">Session details</h3>
          <p className="text-sm text-ink">
            {typeIcon} {typeLabel}
          </p>
          {isVirtual && platformLabel ? (
            <p className="text-sm text-[#6B6B68]">Platform: {platformLabel}</p>
          ) : null}
          <p className="text-sm text-ink">
            {booking.confirmedDate ? "Confirmed date" : "Preferred date"}:{" "}
            {formatWatDate(booking.confirmedDate ?? booking.preferredDate1)}
          </p>
          {booking.confirmedTime ? (
            <p className="text-sm text-ink">Time: {booking.confirmedTime} WAT</p>
          ) : (
            <p className="text-sm text-[#6B6B68]">Time: pending confirmation</p>
          )}
          {status === ConsultationStatus.PENDING_CONFIRMATION ? (
            <button
              type="button"
              onClick={openConfirmDialog}
              className="mt-2 rounded-sm bg-wine px-3 py-1.5 text-xs text-white"
            >
              Confirm date & time →
            </button>
          ) : null}
          <p className="text-sm text-[#6B6B68]">
            Duration: up to {booking.offering?.durationMinutes ?? 45} minutes
          </p>
          <div className="border-t border-sand pt-4">
            <p className="font-label text-xs text-gold">Payment</p>
            <p className="mt-1 text-sm text-ink">
              ₦{(Number(booking.feeNGN) || 0).toLocaleString("en-NG")}
            </p>
            <p className="text-sm text-[#6B6B68]">
              {booking.paymentStatus}
              {booking.paymentGateway ? ` · ${booking.paymentGateway}` : ""}
            </p>
            {booking.paidAt ? (
              <p className="text-xs text-[#6B6B68]">Paid {formatWatDate(booking.paidAt)}</p>
            ) : null}
          </div>
        </div>
      </div>

      {isVirtual ? (
        <div className="glass-opaque p-5">
          <h3 className="font-label text-gold">Virtual meeting link</h3>
          {booking.meetingLinkSentAt ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-emerald-800">
                ✓ Link sent on {formatWatDateTime(booking.meetingLinkSentAt)}
              </p>
              <a href={booking.meetingLink ?? "#"} className="break-all text-sm text-olive underline">
                {booking.meetingLink}
              </a>
            </div>
          ) : null}
          <label className="mt-4 block text-xs text-[#6B6B68]">
            Paste meeting link
            <input
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="https://zoom.us/j/..."
              className="mt-1 w-full rounded-sm border border-sand px-3 py-2 text-sm text-ink"
            />
          </label>
          <button
            type="button"
            disabled={sendingLink}
            onClick={() => void sendLink()}
            className="mt-3 rounded-sm bg-wine px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {sendingLink ? "Sending…" : "Send link to client →"}
          </button>
          <p className="mt-2 text-xs text-[#6B6B68]">This will email the link to {booking.clientEmail}</p>
        </div>
      ) : null}

      <div className="glass-opaque p-5">
        <h3 className="font-label text-gold">Session notes & moodboard</h3>
        {!canEditSession ? (
          <p className="mt-3 text-sm text-[#6B6B68]">Complete after the consultation session.</p>
        ) : (
          <div className="mt-4 space-y-4">
            <label className="block text-xs text-[#6B6B68]">
              Session notes
              <textarea
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-sm border border-sand px-3 py-2 text-sm text-ink"
              />
            </label>
            <div>
              <p className="text-xs text-[#6B6B68]">Moodboard / reference images</p>
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                className="mt-2 text-sm"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadMoodboard(f);
                  e.target.value = "";
                }}
              />
              {moodboardImages.length > 0 ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {moodboardImages.map((url) => (
                    <div key={url} className="relative aspect-square overflow-hidden rounded-sm border border-sand">
                      <Image src={url} alt="" fill className="object-cover" sizes="120px" />
                      <button
                        type="button"
                        onClick={() => setMoodboardImages((prev) => prev.filter((u) => u !== url))}
                        className="absolute right-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <label className="block text-xs text-[#6B6B68]">
              Moodboard notes
              <textarea
                value={moodboardNotes}
                onChange={(e) => setMoodboardNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-sm border border-sand px-3 py-2 text-sm text-ink"
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={savingSession}
                onClick={() => void saveSession(false)}
                className="rounded-sm border border-olive px-4 py-2 text-sm text-olive"
              >
                Save session notes
              </button>
              <button
                type="button"
                disabled={savingSession}
                onClick={() => void saveSession(true)}
                className="rounded-sm bg-emerald-800 px-4 py-2 text-sm text-white"
              >
                Mark as completed
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="glass-opaque p-5">
        <h3 className="font-label text-gold">Internal notes (admin only)</h3>
        <textarea
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          rows={3}
          className="mt-3 w-full rounded-sm border border-sand px-3 py-2 text-sm text-ink"
        />
        <button
          type="button"
          onClick={() => void saveAdminNotes()}
          className="mt-3 rounded-sm border border-sand px-4 py-2 text-sm text-ink"
        >
          Save notes
        </button>
      </div>

      <ClientMeasurementsPanel clientId={clientId} clientName={booking.clientName} initial={measurements} />

      <div className="glass-opaque p-5">
        <h3 className="font-label text-gold">Actions</h3>
        <div className="mt-4">
          {status === ConsultationStatus.COMPLETED && !quotation ? (
            <Link
              href={`/admin/invoices/quotations/new?consultationId=${booking.id}`}
              className="admin-cta"
            >
              + Create Quotation
            </Link>
          ) : quotation ? (
            <p className="font-sans text-sm text-ink">
              Quotation{" "}
              <Link href="/admin/quotations" className="font-medium text-olive underline">
                {quotation.quoteRef}
              </Link>{" "}
              created ({quotation.status.replace(/_/g, " ").toLowerCase()}) →{" "}
              <Link href="/admin/quotations" className="text-olive underline">
                View quotation
              </Link>
            </p>
          ) : (
            <p className="font-sans text-sm text-[#6B6B68]">
              Mark the consultation as completed to create a quotation.
            </p>
          )}
        </div>
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-md glass-3 glass-panel p-6"
            role="dialog"
            aria-labelledby="confirm-consultation-title"
          >
            <h3 id="confirm-consultation-title" className="font-display text-lg text-ink">
              Confirm consultation
            </h3>
            <p className="mt-2 text-sm text-[#6B6B68]">
              Set the final date and time for {booking.clientName}. A confirmation email will be sent.
            </p>
            {booking.preferredDate1 ? (
              <p className="mt-3 text-xs text-[#6B6B68]">
                Client preferred: {formatWatDate(booking.preferredDate1)}
                {booking.preferredDate2 ? ` · alt ${formatWatDate(booking.preferredDate2)}` : ""}
                {booking.preferredDate3 ? ` · alt ${formatWatDate(booking.preferredDate3)}` : ""}
              </p>
            ) : null}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-xs text-[#6B6B68]">
                Date (WAT)
                <input
                  type="date"
                  value={confirmDate}
                  onChange={(e) => setConfirmDate(e.target.value)}
                  className="mt-1 w-full rounded-sm border border-sand px-3 py-2 text-sm text-ink"
                />
              </label>
              <label className="block text-xs text-[#6B6B68]">
                Time (WAT)
                <input
                  type="time"
                  value={confirmTime}
                  onChange={(e) => setConfirmTime(e.target.value)}
                  className="mt-1 w-full rounded-sm border border-sand px-3 py-2 text-sm text-ink"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={confirming}
                onClick={() => setConfirmOpen(false)}
                className="rounded-sm border border-sand px-4 py-2 text-sm text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirming}
                onClick={() => void submitConfirmation()}
                className="rounded-sm bg-wine px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {confirming ? "Confirming…" : "Confirm & notify client"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
