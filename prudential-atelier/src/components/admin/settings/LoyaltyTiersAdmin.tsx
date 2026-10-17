"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { LoyaltyTier } from "@prisma/client";

const TIERS: LoyaltyTier[] = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];
const LABEL: Record<LoyaltyTier, string> = { BRONZE: "Bronze", SILVER: "Silver", GOLD: "Gold", PLATINUM: "Platinum" };

type TierRow = { tier: LoyaltyTier; label: string; minSpendNGN: number; pointsPer100: number; members: number };
type PerkRow = { key: string; id?: string; label: string; tiers: LoyaltyTier[] };
type Recipient = {
  userId: string;
  name: string;
  email: string;
  announcedTier: LoyaltyTier;
  announcedOn: string;
  correctTier: LoyaltyTier;
  sentAt: string | null;
};
type Correction = {
  subject: string;
  defaultNote: string;
  recipients: Recipient[];
  previewFor: string | null;
  previewHtml: string | null;
};

const input = "border border-sand bg-ivory px-3 py-2 font-body text-sm";
const panel = "rounded-sm border border-sand bg-canvas p-6";
const heading = "font-body text-11px font-medium uppercase tracking-[0.14em] text-text-mid";
const primary =
  "h-10 bg-[#37392d] px-5 font-body text-11px font-medium uppercase tracking-[0.12em] text-white disabled:opacity-50";
const ghost = "h-9 min-w-9 border border-sand px-2.5 font-body text-xs text-choc hover:bg-sand/30 disabled:opacity-40";

let keySeq = 0;
const newKey = () => `k${++keySeq}`;

function naira(n: number) {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

export function LoyaltyTiersAdmin() {
  const [tiers, setTiers] = useState<TierRow[] | null>(null);
  const [perks, setPerks] = useState<PerkRow[]>([]);
  const [saving, setSaving] = useState(false);

  const apply = (j: { tiers: TierRow[]; perks: { id: string; label: string; tiers: LoyaltyTier[] }[] }) => {
    setTiers(j.tiers);
    setPerks(j.perks.map((p) => ({ key: newKey(), id: p.id, label: p.label, tiers: p.tiers })));
  };

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/loyalty/tiers");
    if (res.ok) apply(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!tiers) return <p className="font-body text-sm text-text-mid">Loading tiers…</p>;

  const setTier = (tier: LoyaltyTier, patch: Partial<TierRow>) =>
    setTiers((prev) => prev!.map((t) => (t.tier === tier ? { ...t, ...patch } : t)));
  const setPerk = (key: string, patch: Partial<PerkRow>) =>
    setPerks((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const move = (key: string, dir: -1 | 1) =>
    setPerks((prev) => {
      const i = prev.findIndex((p) => p.key === key);
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const save = async () => {
    const blank = perks.find((p) => !p.label.trim());
    if (blank) {
      toast.error("Give every perk a name, or remove the empty one.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/loyalty/tiers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tiers: tiers.map((t) => ({ tier: t.tier, minSpendNGN: t.minSpendNGN, pointsPer100: t.pointsPer100 })),
          perks: perks.map((p) => ({ id: p.id, label: p.label.trim(), tiers: p.tiers })),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Save failed");
      apply(j);
      toast.success(j.moved > 0 ? `Tiers saved. ${j.moved} client(s) moved tier.` : "Tiers saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className={panel}>
        <h2 className={heading}>Tiers</h2>
        <p className="mt-2 max-w-2xl font-body text-sm text-text-mid">
          A client&apos;s tier follows what they paid in a calendar year: shop orders, atelier commissions, invoices and
          consultations, less refunds. Points never count. A tier reached this year lasts to the end of next year.
          Saving moves every client to the tier their payments earn, without emailing anyone.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse font-body text-sm">
            <thead>
              <tr className="border-b border-sand text-left text-xs uppercase tracking-wide text-text-mid">
                <th className="py-2 pr-3">Tier</th>
                <th className="py-2 pr-3">Spend in a year (₦)</th>
                <th className="py-2 pr-3">Points per ₦100 on shop orders</th>
                <th className="py-2 text-right">Clients</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr key={t.tier} className="border-b border-sand/60">
                  <td className="py-3 pr-3 text-choc">{t.label}</td>
                  <td className="py-3 pr-3">
                    {t.tier === "BRONZE" ? (
                      <span className="text-text-mid">Every client</span>
                    ) : (
                      <input
                        id={`tier-min-${t.tier}`}
                        type="number"
                        min={0}
                        step={100000}
                        value={t.minSpendNGN}
                        onChange={(e) => setTier(t.tier, { minSpendNGN: Number(e.target.value) || 0 })}
                        className={`${input} w-40`}
                      />
                    )}
                    {t.tier !== "BRONZE" ? (
                      <span className="ml-2 text-xs text-text-mid">{naira(t.minSpendNGN)}</span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3">
                    <input
                      id={`tier-rate-${t.tier}`}
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={t.pointsPer100}
                      onChange={(e) => setTier(t.tier, { pointsPer100: Number.parseInt(e.target.value, 10) || 0 })}
                      className={`${input} w-20`}
                    />
                    <span className="ml-2 text-xs text-text-mid">= {t.pointsPer100}% back</span>
                  </td>
                  <td className="py-3 text-right tabular-nums">{t.members}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 font-body text-xs text-text-mid">
          Atelier commissions earn a flat rate for every tier, set under Earning below.
        </p>
      </div>

      <div className={panel}>
        <h2 className={heading}>Perks</h2>
        <p className="mt-2 max-w-2xl font-body text-sm text-text-mid">
          Clients see these on their account, under their tier. The team delivers them by hand, so only list what the
          house will honour. The points rate is shown to clients automatically.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[600px] table-fixed border-collapse font-body text-sm">
            <thead>
              <tr className="border-b border-sand text-left text-xs uppercase tracking-wide text-text-mid">
                <th className="py-2 pr-3">Perk</th>
                {TIERS.map((t) => (
                  <th key={t} className="w-[72px] px-1 py-2 text-center">
                    {LABEL[t]}
                  </th>
                ))}
                <th className="w-[128px] py-2" />
              </tr>
            </thead>
            <tbody>
              {perks.map((p, i) => (
                <tr key={p.key} className="border-b border-sand/60">
                  <td className="py-2 pr-3">
                    <textarea
                      id={`perk-${p.key}`}
                      aria-label="Perk"
                      rows={1}
                      value={p.label}
                      onChange={(e) => setPerk(p.key, { label: e.target.value })}
                      placeholder="e.g. Free gift wrapping"
                      className={`${input} block w-full resize-none [field-sizing:content]`}
                    />
                  </td>
                  {TIERS.map((t) => (
                    <td key={t} className="px-1 py-2 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${LABEL[t]} gets this perk`}
                        checked={p.tiers.includes(t)}
                        onChange={(e) =>
                          setPerk(p.key, {
                            tiers: e.target.checked ? [...p.tiers, t] : p.tiers.filter((x) => x !== t),
                          })
                        }
                      />
                    </td>
                  ))}
                  <td className="whitespace-nowrap py-2 pl-2 text-right">
                    <button type="button" className={ghost} disabled={i === 0} onClick={() => move(p.key, -1)} aria-label="Move up">
                      ↑
                    </button>{" "}
                    <button
                      type="button"
                      className={ghost}
                      disabled={i === perks.length - 1}
                      onClick={() => move(p.key, 1)}
                      aria-label="Move down"
                    >
                      ↓
                    </button>{" "}
                    <button
                      type="button"
                      className={ghost}
                      onClick={() => setPerks((prev) => prev.filter((x) => x.key !== p.key))}
                      aria-label={`Remove ${p.label || "this perk"}`}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className={`${ghost} mt-4`}
          onClick={() => setPerks((prev) => [...prev, { key: newKey(), label: "", tiers: [] }])}
        >
          + Add a perk
        </button>
      </div>

      <button type="button" disabled={saving} onClick={() => void save()} className={`${primary} w-full`}>
        {saving ? "Saving…" : "Save tiers and perks"}
      </button>

      <CorrectionPanel />
    </div>
  );
}

function CorrectionPanel() {
  const [data, setData] = useState<Correction | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (n: string | null) => {
    const q = n == null ? "" : `?note=${encodeURIComponent(n)}`;
    const res = await fetch(`/api/admin/loyalty/correction${q}`);
    if (!res.ok) return;
    const j = (await res.json()) as Correction;
    setData(j);
    setNote((cur) => (cur == null ? j.defaultNote : cur));
  }, []);

  useEffect(() => {
    void load(null);
  }, [load]);

  if (!data) return null;
  if (data.recipients.length === 0) return null;

  const unsent = data.recipients.filter((r) => !r.sentAt);

  const onNote = (v: string) => {
    setNote(v);
    setConfirming(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void load(v), 500);
  };

  const send = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/admin/loyalty/correction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note?.trim() ? note.trim() : null, confirm: true }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Send failed");
      toast.success(`Sent ${j.sent} correction email(s)`);
      setConfirming(false);
      await load(note);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-sm border border-[#92660A] bg-[#92660A]/5 p-6">
      <h2 className={heading}>Tier correction email</h2>
      <p className="mt-2 max-w-2xl font-body text-sm text-text-mid">
        These clients were told they had reached a tier under the old points rules. The email says that message was
        sent in error and gives their correct tier. Each client can receive it once.
      </p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse font-body text-sm">
          <thead>
            <tr className="border-b border-sand text-left text-xs uppercase tracking-wide text-text-mid">
              <th className="py-2 pr-3">Client</th>
              <th className="py-2 pr-3">Told</th>
              <th className="py-2 pr-3">Correct tier</th>
              <th className="py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.recipients.map((r) => (
              <tr key={r.userId} className="border-b border-sand/60">
                <td className="py-2 pr-3">
                  <span className="text-choc">{r.name || r.email}</span>
                  <span className="block text-xs text-text-mid">{r.email}</span>
                </td>
                <td className="py-2 pr-3">
                  {LABEL[r.announcedTier]} <span className="text-xs text-text-mid">on {r.announcedOn}</span>
                </td>
                <td className="py-2 pr-3">{LABEL[r.correctTier]}</td>
                <td className="py-2 text-right text-xs">
                  {r.sentAt ? `Sent ${new Date(r.sentAt).toLocaleDateString("en-GB")}` : "Not sent"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {unsent.length > 0 ? (
        <>
          <label htmlFor="correction-note" className="mt-6 block font-body text-xs text-charcoal">
            Extra paragraph (optional). Leave it empty to send the email as previewed.
          </label>
          <textarea
            id="correction-note"
            rows={3}
            value={note ?? ""}
            onChange={(e) => onNote(e.target.value)}
            className={`${input} mt-1.5 w-full`}
          />
        </>
      ) : null}

      {data.previewHtml ? (
        <div className="mt-6">
          <p className="font-body text-xs text-text-mid">
            Preview for {data.previewFor} · Subject: <span className="text-choc">{data.subject}</span>
          </p>
          <iframe
            title="Correction email preview"
            srcDoc={data.previewHtml}
            sandbox=""
            className="mt-2 h-[560px] w-full border border-sand bg-white"
          />
        </div>
      ) : null}

      {unsent.length > 0 ? (
        confirming ? (
          <div className="mt-6 border border-[#92660A] bg-white/60 p-4">
            <p className="font-body text-sm text-choc">
              Send this email to {unsent.length} client{unsent.length === 1 ? "" : "s"} now? This cannot be undone or
              sent again.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" disabled={sending} onClick={() => void send()} className={primary}>
                {sending ? "Sending…" : `Yes, send to ${unsent.length}`}
              </button>
              <button type="button" disabled={sending} onClick={() => setConfirming(false)} className={ghost}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className={`${primary} mt-6`}>
            Send correction to {unsent.length} client{unsent.length === 1 ? "" : "s"}
          </button>
        )
      ) : (
        <p className="mt-6 font-body text-sm text-text-mid">The correction has been sent to everyone listed.</p>
      )}
    </div>
  );
}
