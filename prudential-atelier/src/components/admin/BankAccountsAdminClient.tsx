"use client";

import { useState } from "react";
import type { BankAccount } from "@prisma/client";
import toast from "react-hot-toast";
import {
  BANK_ACCOUNT_CURRENCIES,
  BUSINESS_LINES,
  type BankAccountCurrencyCode,
  type BusinessLineCode,
  type WireFeeBearerCode,
} from "@/lib/payments/bank-account";

type Slot = {
  currency: BankAccountCurrencyCode;
  businessLine: BusinessLineCode;
  account: BankAccount | null;
};

type FormState = {
  accountName: string;
  accountNumber: string;
  bankName: string;
  swiftBic: string;
  iban: string;
  sortCode: string;
  routingNumber: string;
  intermediaryBank: string;
  instructions: string;
  feeBearer: WireFeeBearerCode | "";
  feeTolerance: string;
  isActive: boolean;
};

function emptyForm(): FormState {
  return {
    accountName: "",
    accountNumber: "",
    bankName: "",
    swiftBic: "",
    iban: "",
    sortCode: "",
    routingNumber: "",
    intermediaryBank: "",
    instructions: "",
    feeBearer: "",
    feeTolerance: "",
    isActive: true,
  };
}

function fromAccount(a: BankAccount): FormState {
  return {
    accountName: a.accountName,
    accountNumber: a.accountNumber,
    bankName: a.bankName,
    swiftBic: a.swiftBic ?? "",
    iban: a.iban ?? "",
    sortCode: a.sortCode ?? "",
    routingNumber: a.routingNumber ?? "",
    intermediaryBank: a.intermediaryBank ?? "",
    instructions: a.instructions ?? "",
    feeBearer: (a.feeBearer as WireFeeBearerCode | null) ?? "",
    feeTolerance: a.feeTolerance != null ? String(a.feeTolerance) : "",
    isActive: a.isActive,
  };
}

function Field({
  label,
  value,
  onChange,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
}) {
  return (
    <label className="block font-body text-xs text-[#6B6B68]">
      {label}
      {textarea ? (
        <textarea
          className="mt-1 w-full border border-sand bg-bg-card px-3 py-2 font-body text-sm text-ink"
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="mt-1 w-full border border-sand bg-bg-card px-3 py-2 font-body text-sm text-ink"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

export function BankAccountsAdminClient({ initialSlots }: { initialSlots: Slot[] }) {
  const [slots, setSlots] = useState(initialSlots);
  const [editing, setEditing] = useState<{ currency: BankAccountCurrencyCode; businessLine: BusinessLineCode } | null>(
    null,
  );
  const [form, setForm] = useState<FormState>(emptyForm());
  const [busy, setBusy] = useState(false);

  const editingAccount = editing
    ? slots.find((s) => s.currency === editing.currency && s.businessLine === editing.businessLine)?.account ?? null
    : null;

  async function reload() {
    const res = await fetch("/api/admin/bank-accounts");
    if (!res.ok) return;
    const data = (await res.json()) as { slots: Slot[] };
    setSlots(data.slots);
  }

  function open(slot: Slot) {
    setEditing({ currency: slot.currency, businessLine: slot.businessLine });
    setForm(slot.account ? fromAccount(slot.account) : emptyForm());
  }

  async function save() {
    if (!editing) return;
    if (!form.accountName.trim() || !form.accountNumber.trim() || !form.bankName.trim()) {
      toast.error("Account name, number, and bank are required");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        accountName: form.accountName.trim(),
        accountNumber: form.accountNumber.trim(),
        bankName: form.bankName.trim(),
        swiftBic: form.swiftBic.trim() || null,
        iban: form.iban.trim() || null,
        sortCode: form.sortCode.trim() || null,
        routingNumber: form.routingNumber.trim() || null,
        intermediaryBank: form.intermediaryBank.trim() || null,
        instructions: form.instructions.trim() || null,
        feeBearer: form.feeBearer || null,
        feeTolerance: form.feeTolerance.trim() ? Number(form.feeTolerance) : null,
        isActive: form.isActive,
      };
      const existing = editingAccount;
      const res = existing
        ? await fetch(`/api/admin/bank-accounts/${existing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/bank-accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, currency: editing.currency, businessLine: editing.businessLine }),
          });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(typeof j.error === "string" ? j.error : "Could not save");
      }
      toast.success(existing ? "Account updated" : "Account added");
      setEditing(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function retire(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/bank-accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      if (!res.ok) throw new Error("Could not retire");
      toast.success("Account retired — bank transfer will not be offered for this currency and line");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not retire");
    } finally {
      setBusy(false);
    }
  }

  async function activate(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/bank-accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(typeof j.error === "string" ? j.error : "Could not activate");
      }
      toast.success("Account active");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not activate");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-8">
      <div>
        <h1 className="font-display text-[24px] text-ink">Bank accounts</h1>
        <p className="mt-1 max-w-2xl font-body text-[13px] text-[#6B6B68]">
          One account per currency and business line. Bank transfer only appears when an active account matches the
          cart. EUR is for quotations and invoices — it is not a storefront checkout currency.
        </p>
      </div>

      {BUSINESS_LINES.map((line) => (
        <section key={line} className="border border-sand bg-bg-card p-6">
          <h2 className="font-display text-xl text-ink">{line === "RTW" ? "Ready-to-Wear" : "Atelier"}</h2>
          <p className="mt-1 font-body text-xs text-[#6B6B68]">
            {line === "RTW"
              ? "Checkout and shipping top-ups on shop orders."
              : "Consultations, quotations, invoices, and bespoke deposits. Configurable even while bookings are closed."}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {BANK_ACCOUNT_CURRENCIES.map((currency) => {
              const slot = slots.find((s) => s.currency === currency && s.businessLine === line);
              const account = slot?.account ?? null;
              return (
                <div key={`${line}-${currency}`} className="border border-[#F5F5F3] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-body text-sm text-ink">
                      {currency}
                      {currency === "EUR" ? (
                        <span className="ml-2 font-body text-[10px] uppercase tracking-wide text-[#A8A8A4]">
                          invoices only
                        </span>
                      ) : null}
                    </p>
                    {account ? (
                      <span
                        className={`font-body text-[10px] uppercase tracking-wide ${
                          account.isActive ? "text-[#1B5E20]" : "text-[#A8A8A4]"
                        }`}
                      >
                        {account.isActive ? "Active" : "Retired"}
                      </span>
                    ) : (
                      <span className="font-body text-[10px] uppercase tracking-wide text-[#A8A8A4]">Empty</span>
                    )}
                  </div>
                  {account ? (
                    <>
                      <p className="mt-2 font-body text-xs text-[#6B6B68]">{account.bankName}</p>
                      <p className="font-body text-sm text-ink">{account.accountNumber}</p>
                      <p className="font-body text-xs text-[#6B6B68]">{account.accountName}</p>
                    </>
                  ) : (
                    <p className="mt-2 font-body text-xs text-[#6B6B68]">
                      No account. Bank transfer will not be offered.
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-xs uppercase text-[#37392d] underline"
                      onClick={() => open(slot ?? { currency, businessLine: line, account: null })}
                    >
                      {account ? "Edit" : "Add"}
                    </button>
                    {account?.isActive ? (
                      <button
                        type="button"
                        disabled={busy}
                        className="text-xs uppercase text-red-700 underline disabled:opacity-50"
                        onClick={() => void retire(account.id)}
                      >
                        Retire
                      </button>
                    ) : null}
                    {account && !account.isActive ? (
                      <button
                        type="button"
                        disabled={busy}
                        className="text-xs uppercase text-[#37392d] underline disabled:opacity-50"
                        onClick={() => void activate(account.id)}
                      >
                        Activate
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {editing ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto bg-bg-card p-6">
            <p className="font-display text-lg text-ink">
              {editing.currency} · {editing.businessLine === "RTW" ? "Ready-to-Wear" : "Atelier"}
            </p>
            <div className="mt-4 grid gap-3">
              <Field label="Bank name" value={form.bankName} onChange={(v) => setForm((f) => ({ ...f, bankName: v }))} />
              <Field
                label="Account name"
                value={form.accountName}
                onChange={(v) => setForm((f) => ({ ...f, accountName: v }))}
              />
              <Field
                label="Account number"
                value={form.accountNumber}
                onChange={(v) => setForm((f) => ({ ...f, accountNumber: v }))}
              />
              <Field label="IBAN" value={form.iban} onChange={(v) => setForm((f) => ({ ...f, iban: v }))} />
              <Field
                label="SWIFT / BIC"
                value={form.swiftBic}
                onChange={(v) => setForm((f) => ({ ...f, swiftBic: v }))}
              />
              <Field label="Sort code" value={form.sortCode} onChange={(v) => setForm((f) => ({ ...f, sortCode: v }))} />
              <Field
                label="Routing number"
                value={form.routingNumber}
                onChange={(v) => setForm((f) => ({ ...f, routingNumber: v }))}
              />
              <Field
                label="Intermediary bank"
                value={form.intermediaryBank}
                onChange={(v) => setForm((f) => ({ ...f, intermediaryBank: v }))}
                textarea
              />
              <Field
                label="Instructions shown to the customer"
                value={form.instructions}
                onChange={(v) => setForm((f) => ({ ...f, instructions: v }))}
                textarea
              />
              <label className="block font-body text-xs text-[#6B6B68]">
                Who bears wire fees
                <select
                  className="mt-1 w-full border border-sand bg-bg-card px-3 py-2 font-body text-sm text-ink"
                  value={form.feeBearer}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, feeBearer: e.target.value as WireFeeBearerCode | "" }))
                  }
                >
                  <option value="">Not stated (local NGN typically)</option>
                  <option value="CUSTOMER">Customer — send the full amount</option>
                  <option value="HOUSE">House — we absorb ordinary fees</option>
                  <option value="SHARED">Shared — match arrivals against the tolerance</option>
                </select>
              </label>
              <Field
                label="Fee tolerance (amount in this currency that may arrive short and still settle)"
                value={form.feeTolerance}
                onChange={(v) => setForm((f) => ({ ...f, feeTolerance: v }))}
              />
              <label className="flex items-center gap-2 font-body text-sm text-ink">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                Active — bank transfer is offered when this pair matches
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="px-4 py-2 text-xs uppercase" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                className="bg-[#37392d] px-4 py-2 text-xs uppercase text-white disabled:opacity-50"
                onClick={() => void save()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
