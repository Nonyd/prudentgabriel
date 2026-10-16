"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { SUGGESTED_SCHEDULE, WEEKDAYS, WEEKDAY_LABEL, type WeeklySchedule } from "@/lib/chat-hours";

type Retention = { mode: "unset" } | { mode: "keep" } | { mode: "days"; days: number };
type Candidate = { id: string; name: string; email: string; role: string };
export type ChatSettingsView = {
  enabled: boolean;
  retention: Retention;
  hoursText: string;
  schedule: WeeklySchedule | null;
  closedDates: string[];
  live: boolean;
  opensLabel: string | null;
  greetingDelaySec: number | null;
  editWindowSec: number;
  renotifyMin: number;
  giveUpMin: number;
  claimIdleMin: number;
  recipients: { email: string[] | null; bell: string[] | null };
  candidates: Candidate[];
  canChooseRecipients: boolean;
  /** Admins and the Super Admin change chat settings; others with Live chat only answer. */
  canEdit: boolean;
};

async function patch(body: unknown): Promise<ChatSettingsView> {
  const res = await fetch("/api/admin/chat/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await res.json()) as ChatSettingsView & { error?: unknown };
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Could not save");
  return j;
}

const field = "border border-sand px-2 py-1 text-sm text-ink";
const sectionTitle = "font-sans text-[11px] uppercase tracking-[0.12em] text-text-mid";

/** BF9: who is told, by name, for one channel. */
function RecipientList({
  label,
  candidates,
  value,
  onChange,
  disabled,
}: {
  label: string;
  candidates: Candidate[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="text-xs text-text-mid">
      <legend className="mb-1">{label}</legend>
      {candidates.map((c) => (
        <label key={c.id} className="flex items-center gap-2 py-0.5 text-sm text-ink">
          <input
            type="checkbox"
            disabled={disabled}
            checked={value.includes(c.id)}
            onChange={(e) => onChange(e.target.checked ? [...value, c.id] : value.filter((v) => v !== c.id))}
          />
          {c.name}
          <span className="text-xs text-text-mid">
            {c.role === "SUPER_ADMIN" ? "Super Admin" : c.role === "ADMIN" ? "Admin" : c.role.replace(/_/g, " ").toLowerCase()}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/**
 * Admin → Chat → Settings. Everything the house can change without a deploy:
 * switching chat on (with BA5's retention decision), the weekly hours and the
 * closed dates (BF2), the greeting (BF3), the edit window (BF8), the two
 * unanswered periods (BF6), when a claim lapses (BF5), and who is told (BF9).
 */
export function AdminChatSettings() {
  const [s, setS] = useState<ChatSettingsView | null>(null);
  const [mode, setMode] = useState<"unset" | "keep" | "days">("unset");
  const [days, setDays] = useState("");
  const [hours, setHours] = useState("");
  const [schedule, setSchedule] = useState<WeeklySchedule | null>(null);
  const [closedDates, setClosedDates] = useState<string[]>([]);
  const [newDate, setNewDate] = useState("");
  const [greetOn, setGreetOn] = useState(true);
  const [greetSec, setGreetSec] = useState("15");
  const [editSec, setEditSec] = useState("30");
  const [renotify, setRenotify] = useState("3");
  const [giveUp, setGiveUp] = useState("10");
  const [idle, setIdle] = useState("10");
  const [emailTo, setEmailTo] = useState<string[]>([]);
  const [bellTo, setBellTo] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function load(j: ChatSettingsView) {
    setS(j);
    setMode(j.retention.mode);
    setDays(j.retention.mode === "days" ? String(j.retention.days) : "");
    setHours(j.hoursText);
    setSchedule(j.schedule);
    setClosedDates(j.closedDates);
    setGreetOn(j.greetingDelaySec !== null);
    setGreetSec(String(j.greetingDelaySec ?? 15));
    setEditSec(String(j.editWindowSec));
    setRenotify(String(j.renotifyMin));
    setGiveUp(String(j.giveUpMin));
    setIdle(String(j.claimIdleMin));
    setEmailTo(j.recipients.email ?? []);
    setBellTo(j.recipients.bell ?? []);
  }

  useEffect(() => {
    void fetch("/api/admin/chat/settings")
      .then((r) => r.json())
      .then((j: ChatSettingsView) => load(j));
  }, []);

  async function run(body: unknown, ok: (j: ChatSettingsView) => string) {
    setBusy(true);
    try {
      const j = await patch(body);
      load(j);
      toast.success(ok(j));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  function saveMain(enabled: boolean) {
    return run(
      {
        enabled,
        retention: mode === "keep" ? "keep" : mode === "days" && days.trim() ? Number(days) : null,
        hoursText: hours,
      },
      (j) => (j.enabled ? "Chat is on" : "Saved — chat is off"),
    );
  }

  function saveStaffing() {
    return run(
      {
        schedule,
        closedDates,
        greetingDelaySec: greetOn ? Number(greetSec) : null,
        editWindowSec: Number(editSec),
        renotifyMin: Number(renotify),
        giveUpMin: Number(giveUp),
        claimIdleMin: Number(idle),
      },
      () => "Hours and timings saved",
    );
  }

  if (!s) return null;
  // Chat answerers who are not Admins see the state, not the knobs.
  if (!s.canEdit) {
    return (
      <p className="mt-4 glass-1 p-4 font-body text-sm text-ink">
        Chat is <strong>{s.enabled ? "on" : "off"}</strong>
        {s.enabled ? <> · {s.live ? "open now" : `closed now${s.opensLabel ? `, opens ${s.opensLabel}` : ""}`}</> : null}
      </p>
    );
  }
  return (
    <details className="mt-4 glass-1 p-4 font-body text-sm" open={!s.enabled}>
      <summary className="cursor-pointer text-ink">
        Settings — chat is <strong>{s.enabled ? "on" : "off"}</strong>
        {s.enabled ? <> · {s.live ? "open now" : `closed now${s.opensLabel ? `, opens ${s.opensLabel}` : ""}`}</> : null}
      </summary>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <fieldset className="block text-xs text-text-mid">
          <legend>How long conversations are kept — a decision is required before chat can be switched on</legend>
          <label className="mt-2 flex items-center gap-2 text-sm text-ink">
            <input type="radio" name="chat-retention" checked={mode === "keep"} onChange={() => setMode("keep")} />
            Keep indefinitely (erase on request)
          </label>
          <label className="mt-1 flex items-center gap-2 text-sm text-ink">
            <input type="radio" name="chat-retention" checked={mode === "days"} onChange={() => setMode("days")} />
            Delete after
            <input
              inputMode="numeric"
              className={`w-20 ${field}`}
              value={days}
              onChange={(e) => {
                setMode("days");
                setDays(e.target.value.replace(/[^0-9]/g, ""));
              }}
            />
            days
          </label>
          {mode === "unset" ? <p className="mt-1 text-warning">Not decided yet.</p> : null}
        </fieldset>
        <label className="block text-xs text-text-mid">
          A note shown under the conversation (optional)
          <input
            className="mt-1 w-full border border-sand px-3 py-2 text-sm text-ink"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            maxLength={400}
            placeholder="e.g. For commissions, use the enquiry form."
          />
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" disabled={busy} onClick={() => void saveMain(true)} className="rounded-sm bg-[#37392d] px-4 py-2 text-xs uppercase text-white disabled:opacity-50">
          Save and switch on
        </button>
        <button type="button" disabled={busy} onClick={() => void saveMain(false)} className="rounded-sm border border-sand px-4 py-2 text-xs uppercase text-ink">
          Save, keep off
        </button>
      </div>

      <hr className="my-5 border-sand" />
      <p className={sectionTitle}>Hours (Lagos time)</p>
      <p className="mt-1 text-xs text-text-mid">
        Outside these hours chat still takes her message, says plainly that the house is closed and when it opens next, and
        promises a reply. With no hours set, chat counts as closed.
      </p>
      {schedule ? (
        <div className="mt-3 grid gap-1.5">
          {WEEKDAYS.map((d) => {
            const h = schedule[d];
            return (
              <div key={d} className="flex flex-wrap items-center gap-2 text-sm text-ink">
                <span className="w-24">{WEEKDAY_LABEL[d]}</span>
                <label className="flex items-center gap-1 text-xs text-text-mid">
                  <input
                    type="checkbox"
                    checked={h !== null}
                    onChange={(e) => setSchedule({ ...schedule, [d]: e.target.checked ? { open: "09:00", close: "18:00" } : null })}
                  />
                  Open
                </label>
                {h ? (
                  <>
                    <input type="time" className={field} value={h.open} onChange={(e) => setSchedule({ ...schedule, [d]: { ...h, open: e.target.value } })} aria-label={`${WEEKDAY_LABEL[d]} opens`} />
                    <span className="text-xs text-text-mid">to</span>
                    <input type="time" className={field} value={h.close} onChange={(e) => setSchedule({ ...schedule, [d]: { ...h, close: e.target.value } })} aria-label={`${WEEKDAY_LABEL[d]} closes`} />
                  </>
                ) : (
                  <span className="text-xs text-text-mid">Closed</span>
                )}
              </div>
            );
          })}
          <button type="button" className="mt-1 w-fit text-xs text-text-mid underline" onClick={() => setSchedule(null)}>
            Clear the hours (chat counts as closed)
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-warning">No hours set — chat counts as closed and takes messages for an email reply.</p>
          <button type="button" className="mt-2 rounded-sm border border-sand px-3 py-1.5 text-xs uppercase text-ink" onClick={() => setSchedule(SUGGESTED_SCHEDULE)}>
            Start from Mon–Fri 9–6, Sat 10–4
          </button>
        </div>
      )}

      <p className={`mt-5 ${sectionTitle}`}>Closed dates</p>
      <p className="mt-1 text-xs text-text-mid">Public holidays and any day the house is shut. Chat is closed all day on these dates.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {closedDates.map((d) => (
          <span key={d} className="admin-chip glass-1 glass-pill flex items-center gap-1 text-xs text-ink">
            {d}
            <button type="button" aria-label={`Remove ${d}`} onClick={() => setClosedDates(closedDates.filter((x) => x !== d))}>
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input type="date" className={field} value={newDate} onChange={(e) => setNewDate(e.target.value)} aria-label="Closed date" />
        <button
          type="button"
          className="rounded-sm border border-sand px-3 py-1 text-xs uppercase text-ink"
          onClick={() => {
            if (newDate && !closedDates.includes(newDate)) setClosedDates([...closedDates, newDate].sort());
            setNewDate("");
          }}
        >
          Add date
        </button>
      </div>

      <p className={`mt-5 ${sectionTitle}`}>Timings</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div className="text-xs text-text-mid">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={greetOn} onChange={(e) => setGreetOn(e.target.checked)} />
            Greeting
          </label>
          <label className="mt-1 flex items-center gap-2">
            &ldquo;Hello — how may I assist you today?&rdquo; appears after
            <input inputMode="numeric" disabled={!greetOn} className={`w-16 ${field}`} value={greetSec} onChange={(e) => setGreetSec(e.target.value.replace(/\D/g, ""))} />
            seconds (only while chat is open)
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs text-text-mid">
          A sent message can be edited for
          <input inputMode="numeric" className={`w-16 ${field}`} value={editSec} onChange={(e) => setEditSec(e.target.value.replace(/\D/g, ""))} />
          seconds
        </label>
        <label className="flex items-center gap-2 text-xs text-text-mid">
          Unanswered for
          <input inputMode="numeric" className={`w-16 ${field}`} value={renotify} onChange={(e) => setRenotify(e.target.value.replace(/\D/g, ""))} />
          minutes: tell the recipients again
        </label>
        <label className="flex items-center gap-2 text-xs text-text-mid">
          Unanswered for
          <input inputMode="numeric" className={`w-16 ${field}`} value={giveUp} onChange={(e) => setGiveUp(e.target.value.replace(/\D/g, ""))} />
          minutes: tell her nobody is free, reply by email
        </label>
        <label className="flex items-center gap-2 text-xs text-text-mid">
          A claimed chat returns to the pool after
          <input inputMode="numeric" className={`w-16 ${field}`} value={idle} onChange={(e) => setIdle(e.target.value.replace(/\D/g, ""))} />
          idle minutes
        </label>
      </div>
      <button type="button" disabled={busy} onClick={() => void saveStaffing()} className="mt-4 rounded-sm bg-[#37392d] px-4 py-2 text-xs uppercase text-white disabled:opacity-50">
        Save hours and timings
      </button>

      <hr className="my-5 border-sand" />
      <p className={sectionTitle}>Who is told about a new chat</p>
      <p className="mt-1 text-xs text-text-mid">
        {s.canChooseRecipients
          ? "Choose by name, for email and for the bell. Each needs at least one person."
          : "Only the Super Admin chooses this."}{" "}
        {!s.recipients.email || !s.recipients.bell ? "Until chosen, chats go to the contact desk." : null}
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <RecipientList label="By email" candidates={s.candidates} value={emailTo} onChange={setEmailTo} disabled={!s.canChooseRecipients} />
        <RecipientList label="By the bell (in the admin)" candidates={s.candidates} value={bellTo} onChange={setBellTo} disabled={!s.canChooseRecipients} />
      </div>
      {s.canChooseRecipients ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void run({ recipients: { email: emailTo, bell: bellTo } }, () => "Recipients saved")}
          className="mt-3 rounded-sm bg-[#37392d] px-4 py-2 text-xs uppercase text-white disabled:opacity-50"
        >
          Save recipients
        </button>
      ) : null}
    </details>
  );
}
