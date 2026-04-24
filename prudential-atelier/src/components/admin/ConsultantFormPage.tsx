"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  ConsultationDeliveryMode,
  ConsultationSessionType,
} from "@prisma/client";
import type { ConsultantAdminInput } from "@/validations/consultation";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const emptyAvailability = () =>
  Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    startTime: "09:00",
    endTime: "17:00",
    isActive: false,
  }));

export function ConsultantFormPage({ consultantId }: { consultantId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ConsultantAdminInput | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/admin/consultants/${consultantId}`);
      const j = (await res.json()) as { consultant: Record<string, unknown> };
      if (!res.ok) {
        toast.error("Could not load consultant");
        setLoading(false);
        return;
      }
      const c = j.consultant as {
        name: string;
        title: string;
        bio: string;
        image: string | null;
        isActive: boolean;
        isFlagship: boolean;
        displayOrder: number;
        offerings: {
          id: string;
          sessionType: ConsultationSessionType;
          deliveryMode: ConsultationDeliveryMode;
          durationMinutes: number;
          feeNGN: number;
          feeUSD: number | null;
          feeGBP: number | null;
          isActive: boolean;
          description: string | null;
        }[];
        availability: {
          dayOfWeek: number;
          startTime: string;
          endTime: string;
          isActive: boolean;
        }[];
      };
      setForm({
        name: c.name,
        title: c.title,
        bio: c.bio,
        image: c.image ?? undefined,
        isActive: c.isActive,
        isFlagship: c.isFlagship,
        displayOrder: c.displayOrder,
        offerings: c.offerings.map((o) => ({
          id: o.id,
          sessionType: o.sessionType,
          deliveryMode: o.deliveryMode,
          durationMinutes: o.durationMinutes,
          feeNGN: o.feeNGN,
          feeUSD: o.feeUSD ?? undefined,
          feeGBP: o.feeGBP ?? undefined,
          isActive: o.isActive,
          description: o.description ?? undefined,
        })),
        availability:
          c.availability.length > 0
            ? c.availability.map((a) => ({
                dayOfWeek: a.dayOfWeek,
                startTime: a.startTime,
                endTime: a.endTime,
                isActive: a.isActive,
              }))
            : emptyAvailability(),
      });
      setLoading(false);
    })();
  }, [consultantId]);

  async function save() {
    if (!form) return;
    setSaving(true);
    const payload = {
      ...form,
      image: form.image?.trim() ? form.image.trim() : undefined,
    };
    const res = await fetch(`/api/admin/consultants/${consultantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error((j as { error?: unknown }).error ? JSON.stringify((j as { error: unknown }).error) : "Save failed");
      return;
    }
    toast.success("Saved");
    router.refresh();
  }

  if (loading || !form) {
    return <p className="p-6 text-[#eaeaea]">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 text-[#eaeaea]">
      <Link href="/admin/consultants" className="text-sm text-gold underline">
        ← Consultants
      </Link>
      <div className="space-y-3 rounded-sm border border-[#EBEBEA] bg-[#FAFAFA] p-4">
        <label className="block text-xs text-[#aaa]">
          Name
          <input
            className="mt-1 w-full rounded-sm border border-[#444] bg-[#1e1e1e] px-2 py-2 text-sm"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label className="block text-xs text-[#aaa]">
          Title
          <input
            className="mt-1 w-full rounded-sm border border-[#444] bg-[#1e1e1e] px-2 py-2 text-sm"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </label>
        <label className="block text-xs text-[#aaa]">
          Bio
          <textarea
            className="mt-1 min-h-[120px] w-full rounded-sm border border-[#444] bg-[#1e1e1e] px-2 py-2 text-sm"
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </label>
        <label className="block text-xs text-[#aaa]">
          Image URL
          <input
            className="mt-1 w-full rounded-sm border border-[#444] bg-[#1e1e1e] px-2 py-2 text-sm"
            value={form.image ?? ""}
            onChange={(e) => setForm({ ...form, image: e.target.value || undefined })}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          Active
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isFlagship}
            onChange={(e) => setForm({ ...form, isFlagship: e.target.checked })}
          />
          Flagship (manual confirmation)
        </label>
        <label className="block text-xs text-[#aaa]">
          Display order
          <input
            type="number"
            className="mt-1 w-full rounded-sm border border-[#444] bg-[#1e1e1e] px-2 py-2 text-sm"
            value={form.displayOrder}
            onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })}
          />
        </label>
      </div>

      <div className="rounded-sm border border-[#EBEBEA] bg-[#FAFAFA] p-4">
        <h2 className="font-label text-gold">Offerings</h2>
        <div className="mt-3 space-y-3">
          {form.offerings.map((o, idx) => (
            <div key={o.id ?? idx} className="grid gap-2 border-b border-[#333] pb-3 sm:grid-cols-2">
              <select
                className="rounded-sm border border-[#444] bg-[#1e1e1e] px-2 py-2 text-xs"
                value={o.sessionType}
                onChange={(e) => {
                  const next = [...form.offerings];
                  next[idx] = { ...o, sessionType: e.target.value as ConsultationSessionType };
                  setForm({ ...form, offerings: next });
                }}
              >
                {Object.values(ConsultationSessionType).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <select
                className="rounded-sm border border-[#444] bg-[#1e1e1e] px-2 py-2 text-xs"
                value={o.deliveryMode}
                onChange={(e) => {
                  const next = [...form.offerings];
                  next[idx] = { ...o, deliveryMode: e.target.value as ConsultationDeliveryMode };
                  setForm({ ...form, offerings: next });
                }}
              >
                {Object.values(ConsultationDeliveryMode).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <input
                type="number"
                className="rounded-sm border border-[#444] bg-[#1e1e1e] px-2 py-2 text-xs"
                placeholder="Duration"
                value={o.durationMinutes}
                onChange={(e) => {
                  const next = [...form.offerings];
                  next[idx] = { ...o, durationMinutes: Number(e.target.value) };
                  setForm({ ...form, offerings: next });
                }}
              />
              <input
                type="number"
                className="rounded-sm border border-[#444] bg-[#1e1e1e] px-2 py-2 text-xs"
                placeholder="Fee NGN"
                value={o.feeNGN}
                onChange={(e) => {
                  const next = [...form.offerings];
                  next[idx] = { ...o, feeNGN: Number(e.target.value) };
                  setForm({ ...form, offerings: next });
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-sm border border-[#EBEBEA] bg-[#FAFAFA] p-4">
        <h2 className="font-label text-gold">Weekly availability</h2>
        <div className="mt-3 space-y-2">
          {form.availability.map((a, idx) => (
            <div key={a.dayOfWeek} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="w-10">{DAYS[a.dayOfWeek]}</span>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={a.isActive}
                  onChange={(e) => {
                    const next = [...form.availability];
                    next[idx] = { ...a, isActive: e.target.checked };
                    setForm({ ...form, availability: next });
                  }}
                />
                On
              </label>
              <input
                className="w-24 rounded-sm border border-[#444] bg-[#1e1e1e] px-1 py-1"
                value={a.startTime}
                onChange={(e) => {
                  const next = [...form.availability];
                  next[idx] = { ...a, startTime: e.target.value };
                  setForm({ ...form, availability: next });
                }}
              />
              <input
                className="w-24 rounded-sm border border-[#444] bg-[#1e1e1e] px-1 py-1"
                value={a.endTime}
                onChange={(e) => {
                  const next = [...form.availability];
                  next[idx] = { ...a, endTime: e.target.value };
                  setForm({ ...form, availability: next });
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="rounded-sm bg-wine px-6 py-3 text-sm font-medium text-charcoal disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
