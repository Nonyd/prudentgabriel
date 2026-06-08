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
import type { MeasurementData } from "@/lib/measurements";

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

export function AdminConsultationDetail({
  booking,
  clientId,
  measurements,
}: {
  booking: Booking;
  clientId: string | null;
  measurements?: MeasurementData | null;
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

  async function patchStatus(next: ConsultationStatus) {
    const res = await fetch(`/api/admin/consultations/${booking.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const j = await res.json();
    if (!res.ok) {
      toast.error((j as { error?: string }).error ?? "Update failed");
      return;
    }
    setStatus(next);
    toast.success("Status updated");
    router.refresh();
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
        <select
          value={status}
          onChange={(e) => void patchStatus(e.target.value as ConsultationStatus)}
          className="rounded-sm border border-sand bg-white px-3 py-2 text-sm text-ink"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-sm border border-sand bg-[#FAFAFA] p-5">
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

        <div className="space-y-4 rounded-sm border border-sand bg-[#FAFAFA] p-5">
          <h3 className="font-label text-gold">Session details</h3>
          <p className="text-sm text-ink">
            {typeIcon} {typeLabel}
          </p>
          {isVirtual && platformLabel ? (
            <p className="text-sm text-[#6B6B68]">Platform: {platformLabel}</p>
          ) : null}
          <p className="text-sm text-ink">
            Date: {formatWatDate(booking.confirmedDate ?? booking.preferredDate1)}
          </p>
          {booking.confirmedTime ? (
            <p className="text-sm text-ink">Time: {booking.confirmedTime} WAT</p>
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
        <div className="rounded-sm border border-sand bg-[#FAFAFA] p-5">
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

      <div className="rounded-sm border border-sand bg-[#FAFAFA] p-5">
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

      <div className="rounded-sm border border-sand bg-[#FAFAFA] p-5">
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
    </div>
  );
}
