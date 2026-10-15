"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { BIRTHDAY_MONTHS, daysInBirthdayMonth, isValidBirthday } from "@/lib/birthday";

const TONES = {
  storefront: {
    label: "block font-sans text-sm text-choc",
    hint: "mt-1 font-sans text-xs text-text-mid",
    select: "border border-sand bg-ivory px-3 py-2 font-sans text-sm text-ink",
    save: "border border-choc bg-choc px-5 py-2 font-sans text-xs uppercase tracking-[0.14em] text-ivory disabled:opacity-50",
    clear: "font-sans text-xs text-text-mid underline",
  },
  portal: {
    label: "block text-sm font-medium text-ink",
    hint: "mt-1 text-xs text-text-mid",
    select: "rounded-sm border border-sand bg-white/60 px-3 py-2 text-sm text-ink",
    save: "rounded-sm bg-wine px-4 py-2 text-sm text-white disabled:opacity-50",
    clear: "text-xs text-text-mid underline",
  },
} as const;

/**
 * Day and month only, saved to the signed-in account. Used on the client,
 * staff and admin settings pages; the wish goes out on the day.
 */
export function BirthdayField({
  tone = "portal",
  hint = "Day and month only. We will send you a little something on the day.",
}: {
  tone?: keyof typeof TONES;
  hint?: string;
}) {
  const t = TONES[tone];
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [saved, setSaved] = useState<{ day: string; month: string }>({ day: "", month: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/me/birthday")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { day: number | null; month: number | null } | null) => {
        const next = { day: data?.day ? String(data.day) : "", month: data?.month ? String(data.month) : "" };
        setDay(next.day);
        setMonth(next.month);
        setSaved(next);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const maxDay = month ? daysInBirthdayMonth(Number(month)) : 31;
  const dirty = day !== saved.day || month !== saved.month;

  async function save(next: { day: number; month: number } | { day: null; month: null }) {
    setSaving(true);
    try {
      const res = await fetch("/api/me/birthday", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save your birthday");
      const shown = { day: next.day ? String(next.day) : "", month: next.month ? String(next.month) : "" };
      setDay(shown.day);
      setMonth(shown.month);
      setSaved(shown);
      toast.success(next.day ? "Birthday saved" : "Birthday removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your birthday");
    } finally {
      setSaving(false);
    }
  }

  function submit() {
    const d = Number(day);
    const m = Number(month);
    if (!isValidBirthday(d, m)) {
      toast.error("Choose a day and a month");
      return;
    }
    void save({ day: d, month: m });
  }

  return (
    <div>
      <span className={t.label}>Birthday</span>
      <p className={t.hint}>{hint}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          aria-label="Birthday day"
          className={t.select}
          value={day}
          disabled={loading}
          onChange={(e) => setDay(e.target.value)}
        >
          <option value="">Day</option>
          {Array.from({ length: maxDay }, (_, i) => i + 1).map((n) => (
            <option key={n} value={String(n)}>
              {n}
            </option>
          ))}
        </select>
        <select
          aria-label="Birthday month"
          className={t.select}
          value={month}
          disabled={loading}
          onChange={(e) => {
            setMonth(e.target.value);
            if (day && Number(day) > daysInBirthdayMonth(Number(e.target.value))) setDay("");
          }}
        >
          <option value="">Month</option>
          {BIRTHDAY_MONTHS.map((name, i) => (
            <option key={name} value={String(i + 1)}>
              {name}
            </option>
          ))}
        </select>
        <button type="button" className={t.save} disabled={loading || saving || !dirty} onClick={submit}>
          {saving ? "Saving…" : "Save birthday"}
        </button>
        {saved.day && !saving ? (
          <button type="button" className={t.clear} onClick={() => void save({ day: null, month: null })}>
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}
