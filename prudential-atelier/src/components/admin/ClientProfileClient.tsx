"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { STAGE_LABELS } from "@/lib/bespoke-stages";
import { formatDate, formatPrice, getInitials } from "@/lib/utils";

type ClientDetail = {
  id: string;
  loyaltyTier: string;
  loyaltyPoints: number;
  totalSpend: number;
  preferredSilhouettes: string[];
  preferredColors: string[];
  budgetRange: string | null;
  user: {
    name: string | null;
    email: string;
    phone: string | null;
    createdAt: string;
    orders: { id: string; orderNumber: string; status: string; total: number; createdAt: string }[];
    consultationBookings: {
      id: string;
      bookingNumber: string;
      status: string;
      confirmedDate: string | null;
      createdAt: string;
    }[];
  };
  measurements: {
    bust: number | null;
    waist: number | null;
    hips: number | null;
    shoulderWidth: number | null;
    sleeveLength: number | null;
    dressLength: number | null;
    unit: string;
    notes: string | null;
  } | null;
  bespokeOrders: {
    id: string;
    orderRef: string;
    currentStage: string;
    status: string;
    totalAmount: number | null;
    createdAt: string;
  }[];
  moodboards: { id: string; title: string; images: string[]; createdAt: string }[];
  adminNotes: { id: string; note: string; addedByName: string | null; createdAt: string }[];
  eventDates: { id: string; label: string; date: string }[];
};

export function ClientProfileClient({ clientId }: { clientId: string }) {
  const [item, setItem] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}`);
    if (!res.ok) {
      toast.error("Failed to load client");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { item: ClientDetail };
    setItem(data.item);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function addNote() {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteText }),
      });
      if (!res.ok) {
        toast.error("Failed to add note");
        return;
      }
      toast.success("Note added");
      setNoteText("");
      setNoteOpen(false);
      await refresh();
    } finally {
      setSavingNote(false);
    }
  }

  if (loading) return <p className="font-sans text-sm text-text-mid">Loading client…</p>;
  if (!item) {
    return (
      <div className="card-surface p-8 text-center">
        <p className="font-display text-xl text-ink">Client not found</p>
        <Link href="/admin/clients" className="mt-4 inline-block">
          <Button variant="secondary">Back to clients</Button>
        </Link>
      </div>
    );
  }

  const measurementFields = item.measurements
    ? ([
        ["Bust", item.measurements.bust],
        ["Waist", item.measurements.waist],
        ["Hips", item.measurements.hips],
        ["Shoulder", item.measurements.shoulderWidth],
        ["Sleeve", item.measurements.sleeveLength],
        ["Dress length", item.measurements.dressLength],
      ] as const)
    : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-choc font-sans text-lg text-cream">
            {getInitials(item.user.name ?? item.user.email)}
          </div>
          <div>
            <Link
              href="/admin/clients"
              className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light hover:text-nut"
            >
              ← Clients
            </Link>
            <h1 className="mt-1 font-display text-2xl text-ink">
              {item.user.name ?? item.user.email}
            </h1>
            <p className="font-sans text-sm text-text-mid">{item.user.email}</p>
            {item.user.phone ? (
              <p className="font-sans text-sm text-text-mid">{item.user.phone}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="gold">{item.loyaltyTier}</Badge>
              <Badge variant="grey">{item.loyaltyPoints} pts</Badge>
              <span className="font-sans text-xs text-text-mid">
                Joined {formatDate(item.user.createdAt)} · Spend{" "}
                {formatPrice(item.totalSpend, "NGN")}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/bespoke">
            <Button size="sm" variant="secondary">
              Create Bespoke Order
            </Button>
          </Link>
          <Button size="sm" variant="secondary" onClick={() => setNoteOpen(true)}>
            Add Note
          </Button>
        </div>
      </div>

      {item.measurements ? (
        <section className="card-surface p-6">
          <h2 className="font-display text-lg text-ink">Measurements</h2>
          <p className="font-sans text-xs text-text-mid">Unit: {item.measurements.unit}</p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {measurementFields.map(([label, value]) => (
              <div key={label}>
                <p className="font-sans text-[10px] uppercase text-text-light">{label}</p>
                <p className="font-sans text-sm text-ink">{value ?? "—"}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <Section title="Bespoke Orders" empty={item.bespokeOrders.length === 0}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-sand font-sans text-[10px] uppercase text-text-light">
              <th className="py-2">Ref</th>
              <th className="py-2">Stage</th>
              <th className="py-2">Status</th>
              <th className="py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {item.bespokeOrders.map((o) => (
              <tr key={o.id} className="border-b border-sand/60">
                <td className="py-2">
                  <Link href={`/admin/bespoke/${o.id}`} className="text-nut hover:underline">
                    {o.orderRef}
                  </Link>
                </td>
                <td className="py-2 text-xs">
                  {STAGE_LABELS[o.currentStage as keyof typeof STAGE_LABELS] ?? o.currentStage}
                </td>
                <td className="py-2 text-xs">{o.status}</td>
                <td className="py-2 text-xs">{formatDate(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="RTW Orders" empty={item.user.orders.length === 0}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-sand font-sans text-[10px] uppercase text-text-light">
              <th className="py-2">Order</th>
              <th className="py-2">Status</th>
              <th className="py-2">Total</th>
              <th className="py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {item.user.orders.map((o) => (
              <tr key={o.id} className="border-b border-sand/60">
                <td className="py-2">{o.orderNumber}</td>
                <td className="py-2 text-xs">{o.status}</td>
                <td className="py-2 text-xs">{formatPrice(o.total, "NGN")}</td>
                <td className="py-2 text-xs">{formatDate(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Consultations" empty={item.user.consultationBookings.length === 0}>
        <ul className="space-y-2">
          {item.user.consultationBookings.map((b) => (
            <li key={b.id} className="flex justify-between font-sans text-sm text-text-mid">
              <span>
                {b.bookingNumber} — {b.status}
              </span>
              <span className="text-xs">{formatDate(b.createdAt)}</span>
            </li>
          ))}
        </ul>
      </Section>

      {item.moodboards.length > 0 ? (
        <section className="card-surface p-6">
          <h2 className="font-display text-lg text-ink">Moodboards</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {item.moodboards.flatMap((m) =>
              m.images.slice(0, 1).map((url) => (
                <div key={m.id} className="overflow-hidden rounded border border-sand">
                  <img src={url} alt={m.title} className="aspect-square object-cover" />
                </div>
              )),
            )}
          </div>
        </section>
      ) : null}

      <Section title="Admin Notes" empty={item.adminNotes.length === 0}>
        <ul className="space-y-3">
          {item.adminNotes.map((n) => (
            <li key={n.id} className="rounded border border-sand/60 bg-bg/50 p-3">
              <p className="font-sans text-sm text-text-mid">{n.note}</p>
              <p className="mt-2 font-sans text-[10px] text-text-light">
                {n.addedByName ?? "Admin"} · {formatDate(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Modal open={noteOpen} onClose={() => setNoteOpen(false)} title="Add admin note">
        <textarea
          rows={4}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          className="mt-4 w-full rounded border border-sand px-3 py-2 font-sans text-sm"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setNoteOpen(false)}>
            Cancel
          </Button>
          <Button loading={savingNote} onClick={() => void addNote()}>
            Save Note
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="card-surface p-6">
      <h2 className="font-display text-lg text-ink">{title}</h2>
      {empty ? (
        <p className="mt-4 font-sans text-sm text-text-mid">No records</p>
      ) : (
        <div className="mt-4 overflow-x-auto">{children}</div>
      )}
    </section>
  );
}
