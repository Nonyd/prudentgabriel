"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { BespokeStage } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { STAGE_DESCRIPTIONS, STAGE_LABELS, STAGE_ORDER } from "@/lib/bespoke-stages";
import { formatNGN } from "@/lib/utils";

/**
 * Admin → Clients → New client. Five steps, one screen each: who she is, what she
 * commissioned, what she has paid, where the work stands, and a last look before
 * saving. The server (POST /api/admin/clients/onboard) makes her account, quotation,
 * commission, invoice, payments and stage history; the order code comes from the
 * website's own conversion. An unsent draft is kept in this browser only.
 */

type PaymentRow = { amount: string; date: string; method: "BANK_TRANSFER" | "MANUAL"; note: string };
type StageRow = { note: string; doneOn: string };
type Draft = {
  client: { name: string; noEmail: boolean; email: string; phone: string; street: string; city: string; state: string; country: string; teamNote: string };
  commission: {
    title: string;
    occasion: string;
    garmentTypeId: string;
    description: string;
    brief: string;
    orderDate: string;
    eventDate: string;
    eventLocation: string;
    deliveryDate: string;
  };
  money: { price: string; payments: PaymentRow[] };
  progress: { currentStage: BespokeStage; stages: Partial<Record<BespokeStage, StageRow>> };
};

type Created = {
  clientId: string;
  email: string;
  placeholder: boolean;
  orderId: string;
  orderRef: string;
  invoiceNumber: string;
  quoteRef: string;
  productionUnlocked: boolean;
};

const DRAFT_KEY = "pa:new-client-draft:v1";
const today = () => new Date().toISOString().slice(0, 10);

const INTAKE: BespokeStage[] = STAGE_ORDER.slice(0, STAGE_ORDER.indexOf("SKETCHING_CONCEPT" as BespokeStage));
const PRODUCTION: BespokeStage[] = STAGE_ORDER.slice(STAGE_ORDER.indexOf("SKETCHING_CONCEPT" as BespokeStage));
const IN_PERSON = new Set<string>(["DESIGN_APPROVAL", "FINAL_FITTING"]);

const OCCASIONS = ["Wedding", "Traditional wedding", "Birthday", "Engagement", "Owambe / party", "Red carpet", "Graduation", "Church service", "Anniversary"];

function blankDraft(): Draft {
  return {
    client: { name: "", noEmail: false, email: "", phone: "", street: "", city: "", state: "", country: "Nigeria", teamNote: "" },
    commission: { title: "", occasion: "", garmentTypeId: "", description: "", brief: "", orderDate: today(), eventDate: "", eventLocation: "", deliveryDate: "" },
    money: { price: "", payments: [] },
    progress: { currentStage: "SKETCHING_CONCEPT" as BespokeStage, stages: {} },
  };
}

/** "1,200,000" or "₦1.2m"-ish typing → 1200000; empty or nonsense → NaN. */
function amount(v: string): number {
  const cleaned = v.replace(/[₦,\s]/g, "");
  return cleaned ? Number(cleaned) : NaN;
}

const STEPS = [
  { key: "client", title: "The client", hint: "Who she is and where she is." },
  { key: "commission", title: "The commission", hint: "What she has asked the house to make." },
  { key: "money", title: "Price and payments", hint: "What was agreed and what she has paid so far." },
  { key: "progress", title: "Where it stands", hint: "The stage the work is at today." },
  { key: "review", title: "Check and save", hint: "One last look before the file is made." },
] as const;

const inputCls =
  "mt-1 w-full rounded-sm border border-input-border bg-input-bg px-3 py-2.5 font-sans text-sm text-ink focus:border-ink focus:outline-none";
const labelCls = "block font-sans text-xs font-semibold uppercase tracking-[0.08em] text-text-mid";

function Field({ label, hint, error, required, children }: { label: string; hint?: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelCls}>
        {label}
        {required ? <span className="text-error"> *</span> : null}
      </span>
      {children}
      {error ? <span className="mt-1 block font-sans text-xs text-error">{error}</span> : hint ? <span className="mt-1 block font-sans text-xs text-text-light">{hint}</span> : null}
    </label>
  );
}

export function ClientOnboardingWizard() {
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [restored, setRestored] = useState(false);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [garments, setGarments] = useState<{ id: string; label: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<{ message: string; clientId?: string } | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  // Restore an unsent draft, once.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Draft;
        if (saved?.client && saved?.commission && saved?.money && saved?.progress) {
          setDraft(saved);
          setRestored(true);
        }
      }
    } catch {
      /* no storage: start blank */
    }
  }, []);

  useEffect(() => {
    if (created) return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* no storage */
    }
  }, [draft, created]);

  useEffect(() => {
    void fetch("/api/bespoke/garment-types")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j: { items?: { id: string; label: string }[] }) => setGarments(j.items ?? []))
      .catch(() => undefined);
  }, []);

  const set = <K extends keyof Draft>(section: K, patch: Partial<Draft[K]>) =>
    setDraft((d) => ({ ...d, [section]: { ...d[section], ...patch } }));

  const price = amount(draft.money.price);
  const paid = draft.money.payments.reduce((s, p) => s + (amount(p.amount) || 0), 0);
  const balance = (Number.isFinite(price) ? price : 0) - paid;
  const targetIndex = PRODUCTION.indexOf(draft.progress.currentStage);
  const doneStages = PRODUCTION.slice(0, targetIndex);

  function validate(i: number): Record<string, string> {
    const e: Record<string, string> = {};
    const { client: c, commission: k, money: m } = draft;
    if (i === 0) {
      if (c.name.trim().length < 2) e.name = "Her name is needed.";
      if (!c.noEmail) {
        if (!c.email.trim()) e.email = "Add her email, or tick “She has no email”.";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) e.email = "That email does not look right.";
      }
      if (c.country.trim().length < 2) e.country = "Country is needed.";
    }
    if (i === 1) {
      if (k.title.trim().length < 2) e.title = "Name the piece, e.g. “Birthday dress”.";
      if (k.occasion.trim().length < 2) e.occasion = "The occasion is needed.";
      if (k.description.trim().length < 2) e.description = "Describe the piece in a line or two.";
      if (!k.orderDate) e.orderDate = "When did she order?";
      else if (k.orderDate > today()) e.orderDate = "The order date cannot be in the future.";
      if (k.deliveryDate && k.deliveryDate < k.orderDate) e.deliveryDate = "Delivery is before the order date.";
    }
    if (i === 2) {
      if (!(price > 0)) e.price = "Enter the agreed price.";
      m.payments.forEach((p, n) => {
        if (!(amount(p.amount) > 0)) e[`pay${n}`] = "Enter the amount.";
        else if (!p.date) e[`pay${n}`] = "Enter the date she paid.";
        else if (p.date > today()) e[`pay${n}`] = "A payment cannot be in the future.";
      });
      if (price > 0 && paid > price + 0.01) e.paid = "She has paid more than the agreed price.";
    }
    return e;
  }

  function goTo(next: number) {
    // Forward moves check every step on the way; going back never blocks.
    for (let i = step; i < next; i++) {
      const e = validate(i);
      if (Object.keys(e).length) {
        setErrors(e);
        setStep(i);
        return;
      }
    }
    setErrors({});
    setStep(next);
    document.getElementById("onboard-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function save() {
    for (let i = 0; i < 3; i++) {
      const e = validate(i);
      if (Object.keys(e).length) {
        setErrors(e);
        setStep(i);
        return;
      }
    }
    setSaving(true);
    setServerError(null);
    const { client: c, commission: k } = draft;
    const body = {
      client: {
        name: c.name,
        email: c.noEmail ? "" : c.email,
        phone: c.phone,
        street: c.street,
        city: c.city,
        state: c.state,
        country: c.country,
        teamNote: c.teamNote,
      },
      commission: { ...k, garmentTypeId: k.garmentTypeId || null },
      money: {
        price,
        payments: draft.money.payments.map((p) => ({ amount: amount(p.amount), date: p.date, method: p.method, note: p.note })),
      },
      progress: {
        currentStage: draft.progress.currentStage,
        stages: Object.fromEntries(doneStages.map((s) => [s, draft.progress.stages[s] ?? { note: "", doneOn: "" }])),
      },
    };
    try {
      const res = await fetch("/api/admin/clients/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as Partial<Created> & { error?: string; ok?: boolean };
      if (!res.ok || !j.ok) {
        setServerError({ message: j.error ?? "Could not add the client.", clientId: j.clientId });
        return;
      }
      setCreated(j as Created);
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* no storage */
      }
    } catch {
      setServerError({ message: "Could not reach the server. Your answers are kept; try again." });
    } finally {
      setSaving(false);
    }
  }

  function startOver() {
    setDraft(blankDraft());
    setRestored(false);
    setStep(0);
    setErrors({});
    setServerError(null);
    setCreated(null);
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* no storage */
    }
  }

  const garmentLabel = useMemo(() => garments.find((g) => g.id === draft.commission.garmentTypeId)?.label ?? null, [garments, draft.commission.garmentTypeId]);

  if (created) return <Done created={created} name={draft.client.name} onAnother={startOver} />;

  const { client: c, commission: k, money: m, progress: p } = draft;

  return (
    <div id="onboard-top" className="mx-auto max-w-4xl scroll-mt-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">CRM · Clients</p>
          <h1 className="font-display text-3xl font-bold text-ink">New client</h1>
          <p className="mt-1 max-w-2xl font-sans text-sm leading-relaxed text-text-mid">
            For a client who came to the house directly: by phone, in person, or before the website. Her file, commission, invoice and
            payment history are made in one go. Nothing is emailed to her.
          </p>
        </div>
        <Link href="/admin/clients" className="font-sans text-xs font-semibold uppercase tracking-[0.12em] text-text-light hover:text-ink">
          ← Clients
        </Link>
      </div>

      {restored ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-sand bg-bg-surface px-4 py-3 font-sans text-sm text-text-mid">
          <span>Your unsaved answers from last time are back.</span>
          <button type="button" onClick={startOver} className="text-xs font-semibold text-olive underline underline-offset-2">
            Start a blank form instead
          </button>
        </div>
      ) : null}

      {/* Steps: each is a button once reached, so going back is one click. */}
      <ol className="grid grid-cols-5 gap-2">
        {STEPS.map((s, i) => {
          const state = i === step ? "current" : i < step ? "done" : "todo";
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => (i < step ? goTo(i) : i > step ? goTo(i) : undefined)}
                aria-current={state === "current" ? "step" : undefined}
                className="group w-full text-left"
              >
                <span
                  className={`block h-1.5 rounded-full ${state === "todo" ? "bg-sand" : "bg-choc"} ${state === "current" ? "opacity-100" : state === "done" ? "opacity-60" : ""}`}
                />
                <span className={`mt-2 block font-sans text-11px font-semibold uppercase tracking-[0.08em] ${state === "current" ? "text-ink" : "text-text-light group-hover:text-ink"}`}>
                  <span className="hidden sm:inline">{i + 1}. </span>
                  <span className="hidden md:inline">{s.title}</span>
                  <span className="md:hidden">{i + 1}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <section className="card-surface p-6 md:p-8">
        <header className="border-b border-sand pb-4">
          <p className="font-sans text-11px font-semibold uppercase tracking-[0.12em] text-text-light">
            Step {step + 1} of {STEPS.length}
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-ink">{STEPS[step].title}</h2>
          <p className="mt-1 font-sans text-sm text-text-mid">{STEPS[step].hint}</p>
        </header>

        <div className="mt-6 space-y-5">
          {step === 0 ? (
            <>
              <Field label="Full name" required error={errors.name} hint="As the house addresses her, e.g. “Mrs Adaeze Azazi”.">
                <input className={inputCls} value={c.name} onChange={(e) => set("client", { name: e.target.value })} autoFocus />
              </Field>

              <div className="rounded-sm border border-sand bg-bg-surface p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-choc"
                    checked={c.noEmail}
                    onChange={(e) => set("client", { noEmail: e.target.checked })}
                  />
                  <span>
                    <span className="font-sans text-sm font-semibold text-ink">She has no email</span>
                    <span className="mt-0.5 block font-sans text-xs leading-relaxed text-text-mid">
                      The system gives her a placeholder address that never receives mail. She cannot sign in until her real email is added.
                      Approvals she gives in person are recorded by the team.
                    </span>
                  </span>
                </label>
                {!c.noEmail ? (
                  <div className="mt-4">
                    <Field label="Email" required error={errors.email} hint="Nothing is sent to it now.">
                      <input type="email" className={inputCls} value={c.email} onChange={(e) => set("client", { email: e.target.value })} />
                    </Field>
                  </div>
                ) : null}
              </div>

              <Field label="Phone" hint="With country code, e.g. +234 803 000 0000.">
                <input type="tel" className={inputCls} value={c.phone} onChange={(e) => set("client", { phone: e.target.value })} />
              </Field>

              <Field label="Street address" hint="Where the piece is delivered. Leave blank if you only know the city.">
                <input className={inputCls} value={c.street} onChange={(e) => set("client", { street: e.target.value })} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-3">
                <Field label="City">
                  <input className={inputCls} value={c.city} onChange={(e) => set("client", { city: e.target.value })} />
                </Field>
                <Field label="State">
                  <input className={inputCls} value={c.state} onChange={(e) => set("client", { state: e.target.value })} />
                </Field>
                <Field label="Country" required error={errors.country}>
                  <input className={inputCls} value={c.country} onChange={(e) => set("client", { country: e.target.value })} />
                </Field>
              </div>

              <Field label="Note for the team" hint="Only staff see this, e.g. how she found the house, who looks after her.">
                <textarea rows={3} className={inputCls} value={c.teamNote} onChange={(e) => set("client", { teamNote: e.target.value })} />
              </Field>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="What is being made" required error={errors.title} hint="Short, e.g. “Birthday dress”. It names the commission everywhere.">
                  <input className={inputCls} value={k.title} onChange={(e) => set("commission", { title: e.target.value })} autoFocus />
                </Field>
                <Field label="Occasion" required error={errors.occasion}>
                  <input list="onboard-occasions" className={inputCls} value={k.occasion} onChange={(e) => set("commission", { occasion: e.target.value })} />
                  <datalist id="onboard-occasions">
                    {OCCASIONS.map((o) => (
                      <option key={o} value={o} />
                    ))}
                  </datalist>
                </Field>
              </div>
              <Field label="Garment type" hint={garments.length ? undefined : "No garment types set up yet; you can skip this."}>
                <select className={inputCls} value={k.garmentTypeId} onChange={(e) => set("commission", { garmentTypeId: e.target.value })}>
                  <option value="">Not chosen</option>
                  {garments.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Description" required error={errors.description} hint="One or two lines: the shape and the fabric.">
                <textarea rows={3} className={inputCls} value={k.description} onChange={(e) => set("commission", { description: e.target.value })} />
              </Field>
              <Field label="Production brief" hint="Everything the workroom needs: details, beading, changes she asked for.">
                <textarea rows={5} className={inputCls} value={k.brief} onChange={(e) => set("commission", { brief: e.target.value })} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Date she ordered" required error={errors.orderDate} hint="When the price was agreed.">
                  <input type="date" max={today()} className={inputCls} value={k.orderDate} onChange={(e) => set("commission", { orderDate: e.target.value })} />
                </Field>
                <Field label="Delivery date" error={errors.deliveryDate} hint="When the house promised it.">
                  <input type="date" className={inputCls} value={k.deliveryDate} onChange={(e) => set("commission", { deliveryDate: e.target.value })} />
                </Field>
                <Field label="Event date">
                  <input type="date" className={inputCls} value={k.eventDate} onChange={(e) => set("commission", { eventDate: e.target.value })} />
                </Field>
                <Field label="Event location">
                  <input className={inputCls} value={k.eventLocation} onChange={(e) => set("commission", { eventLocation: e.target.value })} />
                </Field>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Field label="Agreed price (₦)" required error={errors.price} hint="The full price of the piece, in naira.">
                <input inputMode="decimal" className={inputCls} value={m.price} onChange={(e) => set("money", { price: e.target.value })} placeholder="e.g. 8,000,000" autoFocus />
              </Field>

              <div>
                <p className={labelCls}>Payments she has made</p>
                <p className="mt-1 font-sans text-xs text-text-light">Each transfer or cash payment on its own line, oldest first. Leave empty if she has paid nothing yet.</p>
                <ul className="mt-3 space-y-3">
                  {m.payments.map((row, n) => (
                    <li key={n} className="rounded-sm border border-sand p-4">
                      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                        <Field label={`Payment ${n + 1} (₦)`}>
                          <input
                            inputMode="decimal"
                            className={inputCls}
                            value={row.amount}
                            onChange={(e) => set("money", { payments: m.payments.map((x, i) => (i === n ? { ...x, amount: e.target.value } : x)) })}
                          />
                        </Field>
                        <Field label="Date paid">
                          <input
                            type="date"
                            max={today()}
                            className={inputCls}
                            value={row.date}
                            onChange={(e) => set("money", { payments: m.payments.map((x, i) => (i === n ? { ...x, date: e.target.value } : x)) })}
                          />
                        </Field>
                        <Field label="How">
                          <select
                            className={inputCls}
                            value={row.method}
                            onChange={(e) =>
                              set("money", { payments: m.payments.map((x, i) => (i === n ? { ...x, method: e.target.value as PaymentRow["method"] } : x)) })
                            }
                          >
                            <option value="BANK_TRANSFER">Bank transfer</option>
                            <option value="MANUAL">Cash or other</option>
                          </select>
                        </Field>
                        <button
                          type="button"
                          onClick={() => set("money", { payments: m.payments.filter((_, i) => i !== n) })}
                          className="pb-2.5 font-sans text-xs text-error underline underline-offset-2"
                        >
                          Remove
                        </button>
                      </div>
                      <input
                        className={`${inputCls} mt-3`}
                        placeholder="Note (optional), e.g. “paid by her sister”"
                        value={row.note}
                        onChange={(e) => set("money", { payments: m.payments.map((x, i) => (i === n ? { ...x, note: e.target.value } : x)) })}
                      />
                      {errors[`pay${n}`] ? <p className="mt-1 font-sans text-xs text-error">{errors[`pay${n}`]}</p> : null}
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => set("money", { payments: [...m.payments, { amount: "", date: today(), method: "BANK_TRANSFER", note: "" }] })}
                >
                  + Add a payment
                </Button>
              </div>

              <dl className="grid grid-cols-3 gap-3 rounded-sm bg-bg-surface p-4 font-sans">
                <div>
                  <dt className="text-11px uppercase tracking-[0.08em] text-text-light">Price</dt>
                  <dd className="mt-1 text-base font-semibold text-ink">{price > 0 ? formatNGN(price) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-11px uppercase tracking-[0.08em] text-text-light">Paid</dt>
                  <dd className="mt-1 text-base font-semibold text-ink">
                    {formatNGN(paid)}
                    {price > 0 ? <span className="ml-1 text-xs font-normal text-text-mid">({Math.round((paid / price) * 100)}%)</span> : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-11px uppercase tracking-[0.08em] text-text-light">Balance</dt>
                  <dd className={`mt-1 text-base font-semibold ${balance < 0 ? "text-error" : "text-ink"}`}>{price > 0 ? formatNGN(balance) : "—"}</dd>
                </div>
              </dl>
              {errors.paid ? <p className="font-sans text-xs text-error">{errors.paid}</p> : null}
              <p className="font-sans text-xs leading-relaxed text-text-light">
                Production unlocks in the app once the deposit set in Settings is paid. Payments are recorded as confirmed, with today’s
                admin as the person who confirmed them.
              </p>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <p className="font-sans text-sm leading-relaxed text-text-mid">
                Tap the stage the work is at <strong className="text-ink">now</strong>. Every stage before it is recorded as done; you can add when it
                was done and a note. Stages 1–4 (consultation and invoice) are recorded automatically.
              </p>
              <ol className="space-y-2">
                {INTAKE.map((s) => (
                  <li key={s} className="flex items-center gap-3 rounded-sm px-4 py-2 font-sans text-sm text-text-light">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sand text-xs text-text-mid">✓</span>
                    {STAGE_LABELS[s]} <span className="text-xs">· recorded automatically</span>
                  </li>
                ))}
                {PRODUCTION.map((s, i) => {
                  const isNow = s === p.currentStage;
                  const isDone = i < targetIndex;
                  const row = p.stages[s] ?? { note: "", doneOn: "" };
                  return (
                    <li
                      key={s}
                      className={`rounded-sm border transition-colors ${isNow ? "border-choc bg-choc/5" : isDone ? "border-sand" : "border-transparent"}`}
                    >
                      <button
                        type="button"
                        onClick={() => set("progress", { currentStage: s })}
                        aria-pressed={isNow}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left"
                      >
                        <span
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                            isNow ? "bg-choc text-cream" : isDone ? "bg-olive text-white" : "border border-sand text-text-light"
                          }`}
                        >
                          {isDone ? "✓" : STAGE_LABELS[s].split(".")[0]}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block font-sans text-sm font-semibold ${isNow || isDone ? "text-ink" : "text-text-mid"}`}>
                            {STAGE_LABELS[s]}
                            {isNow ? <span className="ml-2 rounded-full bg-choc px-2 py-0.5 text-10px uppercase tracking-wide text-cream">She is here</span> : null}
                          </span>
                          <span className="mt-0.5 block font-sans text-xs text-text-light">{STAGE_DESCRIPTIONS[s]}</span>
                        </span>
                      </button>
                      {isDone ? (
                        <div className="grid gap-3 border-t border-sand px-4 py-3 sm:grid-cols-[180px_1fr]">
                          <label className="block">
                            <span className="font-sans text-11px uppercase tracking-[0.08em] text-text-light">Done on</span>
                            <input
                              type="date"
                              max={today()}
                              className={inputCls}
                              value={row.doneOn}
                              onChange={(e) => set("progress", { stages: { ...p.stages, [s]: { ...row, doneOn: e.target.value } } })}
                            />
                          </label>
                          <label className="block">
                            <span className="font-sans text-11px uppercase tracking-[0.08em] text-text-light">Note (she can see it on her dashboard)</span>
                            <input
                              className={inputCls}
                              placeholder={IN_PERSON.has(s) ? (s === "DESIGN_APPROVAL" ? "Design approved in person." : "Final fitting approved in person.") : "Completed."}
                              value={row.note}
                              onChange={(e) => set("progress", { stages: { ...p.stages, [s]: { ...row, note: e.target.value } } })}
                            />
                          </label>
                          {IN_PERSON.has(s) ? (
                            <p className="font-sans text-xs text-text-mid sm:col-span-2">Recorded as her approval given in person, under your name.</p>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </>
          ) : null}

          {step === 4 ? (
            <div className="space-y-6">
              <Review title="The client" onEdit={() => goTo(0)}>
                <Row k="Name" v={c.name} />
                <Row k="Email" v={c.noEmail ? "None — a placeholder address is made for her" : c.email} />
                <Row k="Phone" v={c.phone || "—"} />
                <Row k="Address" v={[c.street, c.city, c.state, c.country].filter(Boolean).join(", ")} />
                {c.teamNote ? <Row k="Team note" v={c.teamNote} /> : null}
              </Review>
              <Review title="The commission" onEdit={() => goTo(1)}>
                <Row k="Piece" v={[k.title, garmentLabel].filter(Boolean).join(" · ")} />
                <Row k="Occasion" v={k.occasion} />
                <Row k="Description" v={k.description} />
                {k.brief ? <Row k="Brief" v={k.brief} /> : null}
                <Row k="Ordered" v={k.orderDate} />
                <Row k="Delivery" v={k.deliveryDate || "No date yet"} />
                {k.eventDate || k.eventLocation ? <Row k="Event" v={[k.eventDate, k.eventLocation].filter(Boolean).join(" · ")} /> : null}
              </Review>
              <Review title="Price and payments" onEdit={() => goTo(2)}>
                <Row k="Price" v={formatNGN(price || 0)} />
                <Row
                  k="Paid"
                  v={`${formatNGN(paid)} in ${m.payments.length} payment${m.payments.length === 1 ? "" : "s"}${m.payments.length ? ` (${m.payments.map((x) => x.date).join(", ")})` : ""}`}
                />
                <Row k="Balance" v={formatNGN(balance)} />
              </Review>
              <Review title="Where it stands" onEdit={() => goTo(3)}>
                <Row k="Now at" v={STAGE_LABELS[p.currentStage]} />
                <Row k="Recorded as done" v={doneStages.length ? doneStages.map((s) => STAGE_LABELS[s].replace(/^\d+\.\s*/, "")).join(", ") : "Nothing beyond intake"} />
              </Review>
              <div className="rounded-sm border border-sand bg-bg-surface p-4 font-sans text-sm leading-relaxed text-text-mid">
                <p className="font-semibold text-ink">When you save</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  <li>The order code (ORD-…), quotation and invoice numbers are given by the website, as for any order.</li>
                  <li>Her file opens with the brief, payments and stage history filled in.</li>
                  <li>No email, message or payment link is sent to her.</li>
                </ul>
              </div>
              {serverError ? (
                <div role="alert" className="rounded-sm border border-error/40 bg-error/5 p-4 font-sans text-sm text-error">
                  {serverError.message}
                  {serverError.clientId ? (
                    <Link href={`/admin/clients/${serverError.clientId}`} className="ml-2 font-semibold underline">
                      Open her file
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-sand pt-5">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={() => goTo(step - 1)}>
              ← Back
            </Button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={() => goTo(step + 1)}>
              Next: {STEPS[step + 1].title} →
            </Button>
          ) : (
            <Button type="button" onClick={() => void save()} loading={saving} disabled={saving}>
              {saving ? "Making her file…" : "Save client and commission"}
            </Button>
          )}
        </footer>
      </section>
    </div>
  );
}

function Review({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between border-b border-sand pb-2">
        <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
        <button type="button" onClick={onEdit} className="font-sans text-xs font-semibold text-olive underline underline-offset-2">
          Change
        </button>
      </div>
      <dl className="mt-2 space-y-1.5">{children}</dl>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid gap-1 font-sans text-sm sm:grid-cols-[160px_1fr]">
      <dt className="text-text-light">{k}</dt>
      <dd className="whitespace-pre-line text-ink">{v || "—"}</dd>
    </div>
  );
}

function Done({ created, name, onAnother }: { created: Created; name: string; onAnother: () => void }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="card-surface p-6 md:p-8">
        <p className="eyebrow">Client added</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-ink">{name}</h1>
        <dl className="mt-5 space-y-2 font-sans text-sm">
          <Row k="Order code" v={created.orderRef} />
          <Row k="Quotation" v={created.quoteRef} />
          <Row k="Invoice" v={created.invoiceNumber} />
          <Row k="Sign-in email" v={created.placeholder ? `${created.email} (placeholder, receives nothing)` : created.email} />
          <Row k="Production" v={created.productionUnlocked ? "Unlocked: the deposit is paid" : "Locked until the deposit is paid"} />
        </dl>
        {created.placeholder ? (
          <p className="mt-4 rounded-sm bg-bg-surface p-3 font-sans text-xs leading-relaxed text-text-mid">
            When she gives you her real email, a Super Admin can change it on her file with “Change sign-in email”. Until then, use “Record
            progress” on the commission for approvals she gives in person.
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/admin/clients/${created.clientId}`}>
            <Button>Open her file</Button>
          </Link>
          <Link href={`/admin/bespoke/${created.orderId}`}>
            <Button variant="secondary">Open the commission</Button>
          </Link>
          <Button variant="ghost" onClick={onAnother}>
            Add another client
          </Button>
        </div>
        <p className="mt-4 font-sans text-xs text-text-light">Next on her file: add her measurements under “Measurements”.</p>
      </section>
    </div>
  );
}
