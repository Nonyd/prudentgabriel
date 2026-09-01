"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export function AdminCustomerPointsForm({ userId, currentBalance }: { userId: string; currentBalance: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const n = Number.parseInt(amount, 10);
    if (!Number.isFinite(n) || n === 0) {
      toast.error("Enter a non-zero point amount (negative to deduct)");
      return;
    }
    if (!reason.trim()) {
      toast.error("A reason is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/customers/${userId}/points`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: n, description: reason.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error ?? "Could not adjust points");
      toast.success(`Balance is now ${(j as { pointsBalance?: number }).pointsBalance ?? n}`);
      setAmount("");
      setReason("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-sm border border-sand bg-canvas p-6">
      <h2 className="font-display text-lg text-gold">Grant or deduct points</h2>
      <p className="mt-1 font-body text-xs text-[#6B6B68]">Current balance {currentBalance.toLocaleString()} pts. Reason is recorded on the ledger.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input
          type="number"
          placeholder="Amount (+ grant / − deduct)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="border border-sand bg-ivory px-3 py-2 font-body text-sm"
        />
        <input
          type="text"
          placeholder="Reason (required)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="border border-sand bg-ivory px-3 py-2 font-body text-sm"
        />
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={() => void submit()}
        className="mt-4 h-10 bg-[#37392d] px-5 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Record adjustment"}
      </button>
    </div>
  );
}
