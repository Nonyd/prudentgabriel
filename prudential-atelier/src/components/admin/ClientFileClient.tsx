"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatDate, formatPrice, formatNGN } from "@/lib/utils";

/**
 * Slice BC1 — the client file. Everything about her gown on one page, in the
 * order Mrs. Prudent described it. What each viewer gets is decided by the API
 * (GET /api/clients/:id/file); a section that is not theirs arrives as a reason,
 * never as data, and is shown as such rather than left blank.
 *
 * Slice BD3 — the sections as the house named them on 12 October.
 */

type Hidden = { visible: false; reason: string };
type Shown<T> = { visible: true; data: T };
type Section<T> = Hidden | Shown<T>;

type FileNote = {
  sectionLabel: string;
  body: string;
  authorName: string;
  createdAt: string;
  corrected: boolean;
  correction: boolean;
  /** Left at a pipeline step; sectionLabel names the step. */
  stage?: boolean;
};

type Booking = {
  id: string;
  bookingNumber: string;
  status: string;
  consultant: string;
  date: string | null;
  time: string | null;
  completedAt: string | null;
  occasion: string;
  discussed: string;
  referenceImages: string[];
  sessionNotes: string | null;
  moodboardImages: string[];
  moodboardNotes: string | null;
};
type Consultation = {
  bookings: Booking[];
  enquiries: {
    enquiryNumber: string;
    eventDate: string | null;
    eventType: string;
    /** Her answers on the enquiry form, as lines. */
    answers?: string[];
    notes: string | null;
    moodboardImages: string[];
  }[];
  moodboards: { id: string; title: string; images: string[]; notes: string | null; createdAt: string }[];
  briefs: { orderRef: string; occasion: string | null; brief: string | null; moodboardImages: string[] }[];
  notes?: FileNote[];
};
type MeasureRow = { key: string; label: string; value: number; unit: string };
type Measurements = {
  profile: { rows: MeasureRow[]; notes: string | null; firstRecordedAt: string | null; lastUpdatedAt: string | null } | null;
  orderLines: { orderNumber: string; product: string; takenAt: string | null; rows: MeasureRow[] }[];
  commissions?: { orderRef: string; source: "commission" | "client" | "none"; takenAt: string | null }[];
};
type About = {
  orderRef: string;
  occasion: string | null;
  garment: string | null;
  description: string | null;
  features: { key: string; label: string; group: string | null; note: string | null }[];
  notes: FileNote[];
}[];
type Brief = { orderId: string; orderRef: string; brief: string | null; notes: FileNote[] }[];
type Quote = {
  orderRefs: string[];
  quoteRef: string;
  status: string;
  currency: string;
  total: number;
  depositPercent: number;
  lines: { description: string; quantity: number }[];
  notes: string | null;
  agreedAt: string | null;
  expectedDeliveryDate: string | null;
}[];
type Invoices = {
  orderRef: string;
  invoices: {
    invoiceNumber: string;
    status: string;
    currency: string;
    total: number;
    depositRequired: number;
    balanceDue: number;
    dueDate: string | null;
    paidAt: string | null;
    raisedAt: string | null;
  }[];
}[];
type Balance = {
  orderRef: string;
  totalNGN: number;
  paidNGN: number;
  balanceNGN: number;
  payments: {
    reference: string;
    amount: number;
    currency: string;
    purpose: string;
    status: string;
    receiptUrl: string | null;
    createdAt: string | null;
  }[];
}[];
type SpecItem = { id: string; name: string; quantity: string | null; notes: string | null; images: string[]; kindLabel: string; issued: boolean };
type Spec = { orderRef: string; items: SpecItem[]; notes: FileNote[] }[];
type Illustrations = {
  houseMoodboards: { id: string; title: string; images: string[]; notes: string | null; createdAt: string | null }[];
  commissions: {
    orderRef: string;
    herUploads: string[];
    sessionMoodboard: string[];
    sketches: { id: string; url: string; kind: string; uploadedAt: string | null }[];
    designApproval: { status: string; requestedAt?: string | null; respondedAt?: string | null; clientComment?: string | null };
  }[];
};
type Fitting = {
  orderRef: string;
  stages: { stage: string; label: string | null; doneAt: string | null; history: { notes: string | null; at: string | null; by: string | null; images: string[] }[] }[];
  alterationRequests: { description: string; reason: string; status: string; at: string | null }[];
  notes: FileNote[];
}[];
type Making = {
  orderRef: string;
  currentStageLabel: string | null;
  people: { name: string; roleLabel: string; stageLabel: string | null; assignedAt: string | null }[];
}[];
type Delivery = {
  orderRef: string;
  expectedDate: string | null;
  deliveredAt: string | null;
  receiptConfirmedAt: string | null;
  confirmation: "RECEIPT_CONFIRMED" | "DELIVERED_AWAITING_CLIENT" | "DATE_SET" | "NO_DATE";
  address: { saved: string | null; clientLocation: string | null; eventLocation: string | null } | null;
  notes?: FileNote[];
}[];
type Cost = {
  orderRef: string;
  cost: {
    materials: { totalNGN: number; unpriced: number };
    sheet: { status: string; labourNGN?: number; labour?: { id: string; role: string; person: string | null; amountNGN: number }[] } | null;
    costOfProductionNGN?: number;
    agreedPriceNGN?: number;
    marginNGN?: number;
  } | null;
}[];

type ClientFile = {
  client: { id: string; firstName: string | null; name?: string | null; email?: string; phone?: string | null; loyaltyTier?: string };
  scope: "house" | "workroom";
  contactHidden: boolean;
  /** Decided on the server by canPreviewClientDashboard, the same check as the preview page. */
  canViewAs: boolean;
  commissions: { id: string; orderRef: string; title: string; currentStageLabel: string | null; status: string; createdAt: string }[];
  sections: {
    consultation: Section<Consultation>;
    measurements: Section<Measurements>;
    about: Section<About>;
    brief: Section<Brief>;
    quotation: Section<Quote>;
    invoice: Section<Invoices>;
    balance: Section<Balance>;
    beads: Section<Spec>;
    fabric: Section<Spec>;
    illustrations: Section<Illustrations>;
    fitting: Section<Fitting>;
    making: Section<Making>;
    delivery: Section<Delivery>;
    cost: Section<Cost>;
  };
};

const CONFIRMATION_LABEL: Record<Delivery[number]["confirmation"], string> = {
  RECEIPT_CONFIRMED: "Delivered — she has confirmed receipt",
  DELIVERED_AWAITING_CLIENT: "Delivered — waiting for her to confirm receipt",
  DATE_SET: "Expected — not yet delivered",
  NO_DATE: "No delivery date set",
};

const APPROVAL_LABEL: Record<string, string> = {
  APPROVED: "Design approved by the client",
  PENDING: "Sent for approval — waiting on the client",
  CHANGES_REQUESTED: "The client asked for changes",
  NOT_REQUESTED: "Not yet sent for approval",
};

const QUOTE_STATUS: Record<string, string> = {
  DRAFT: "Draft, not sent",
  SENT: "Sent, awaiting her answer",
  APPROVED: "Agreed",
  CONVERTED: "Agreed, commission started",
  REJECTED: "Declined",
  SUPERSEDED: "Replaced by a revision",
};

function money(amount: number, currency: string) {
  return formatPrice(amount, (["NGN", "USD", "GBP"].includes(currency) ? currency : "NGN") as "NGN" | "USD" | "GBP");
}

function date(value: string | null | undefined) {
  return value ? formatDate(value, "d MMM yyyy") : "—";
}

export function ClientFileClient({ clientId, portal = "admin" }: { clientId: string; portal?: "admin" | "staff" }) {
  const [file, setFile] = useState<ClientFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/file`);
    if (!res.ok) {
      setError(res.status === 403 ? "This client's file is not open to you." : "Could not load the client file.");
      return;
    }
    setFile((await res.json()) as ClientFile);
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <p className="card-surface p-6 font-sans text-sm text-text-mid">{error}</p>;
  if (!file) return <p className="font-sans text-sm text-text-mid">Loading the client file…</p>;

  const { sections: s } = file;
  const orderHref = (id: string) => (portal === "admin" ? `/admin/bespoke/${id}` : `/staff/orders/${id}`);

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-display text-2xl text-ink">{file.client.name ?? file.client.firstName ?? "Client"}</h1>
          {portal === "admin" && file.canViewAs ? <ViewAsClientButton clientId={clientId} /> : null}
        </div>
        {file.contactHidden ? (
          <p className="font-sans text-xs text-text-mid">Contact details are kept for the client desk.</p>
        ) : (
          <p className="font-sans text-sm text-text-mid">
            {[file.client.email, file.client.phone].filter(Boolean).join(" · ")}
          </p>
        )}
        {/* BD6: one header, every job she has commissioned, each its own file. */}
        <div className="mt-3 space-y-2">
          {file.commissions.length === 0 ? (
            <span className="font-sans text-xs text-text-mid">No commissions yet.</span>
          ) : (
            file.commissions.map((c) => (
              <Link key={c.id} href={orderHref(c.id)} className="pill-card block px-6 py-3 hover:opacity-90">
                <span className="font-sans text-base font-semibold text-ink">{c.title}</span>
                <span className="ml-2 font-sans text-xs text-text-mid">
                  {c.orderRef} · {c.currentStageLabel}
                </span>
              </Link>
            ))
          )}
        </div>
      </header>

      <FileSection title="Consultation" section={s.consultation}>
        {(d) => <ConsultationView data={d} />}
      </FileSection>

      {/* The brief sits under the consultation: what she asked for, then everything since. */}
      <FileSection title="Production brief" section={s.brief}>
        {(d) => (
          <PerCommission rows={d}>
            {(g) => (
              <>
                {g.brief ? <p className="whitespace-pre-line font-sans text-sm text-ink">{g.brief}</p> : <Empty>No brief written yet.</Empty>}
                <Notes notes={g.notes} />
                {portal === "admin" ? <AddBriefNote orderId={g.orderId} onAdded={() => void load()} /> : null}
              </>
            )}
          </PerCommission>
        )}
      </FileSection>

      <FileSection title="Measurements" section={s.measurements}>
        {(d) => <MeasurementsView data={d} />}
      </FileSection>

      <FileSection title="About the dress" section={s.about}>
        {(d) => (
          <PerCommission rows={d}>
            {(g) => (
              <>
                <p className="font-sans text-sm text-ink">
                  {[g.occasion, g.garment].filter(Boolean).join(" · ") || "Occasion not recorded"}
                </p>
                {g.features.length ? (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {g.features.map((f) => (
                      <li key={f.key} className="border border-sand px-3 py-1.5 font-sans text-sm text-ink">
                        {f.label}
                        {f.note ? <span className="text-text-mid"> — {f.note}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {g.description ? <p className="mt-2 whitespace-pre-line font-sans text-sm text-text-mid">{g.description}</p> : null}
                <Notes notes={g.notes} />
              </>
            )}
          </PerCommission>
        )}
      </FileSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <FileSection title="Quotation — what was agreed" section={s.quotation}>
          {(d) => <QuotationView data={d} />}
        </FileSection>
        <FileSection title="Invoice" section={s.invoice}>
          {(d) => <InvoiceView data={d} />}
        </FileSection>
      </div>

      <FileSection title="Balance" section={s.balance}>
        {(d) => <BalanceView data={d} />}
      </FileSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <FileSection title="Beads needed" section={s.beads}>
          {(d) => <SpecView data={d} empty="No beads specified yet." />}
        </FileSection>
        <FileSection title="Fabric type" section={s.fabric}>
          {(d) => <SpecView data={d} empty="No fabric specified yet." />}
        </FileSection>
      </div>

      <FileSection title="Illustration and mood board" section={s.illustrations}>
        {(d) => <IllustrationsView data={d} clientId={clientId} canAdd={portal === "admin" && file.scope === "house"} onAdded={() => void load()} />}
      </FileSection>

      <FileSection title="Fitting and alteration" section={s.fitting}>
        {(d) => <FittingView data={d} />}
      </FileSection>

      <FileSection title="Who is making it" section={s.making}>
        {(d) => (
          <PerCommission rows={d} head={(g) => `${g.orderRef} · now at ${g.currentStageLabel}`}>
            {(g) =>
              g.people.length === 0 ? (
                <Empty>Nobody assigned yet.</Empty>
              ) : (
                <ul className="space-y-1 font-sans text-sm">
                  {g.people.map((p, i) => (
                    <li key={`${p.name}-${i}`}>
                      <span className="text-ink">{p.name}</span>{" "}
                      <span className="text-text-mid">
                        — {p.roleLabel}, on {p.stageLabel ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            }
          </PerCommission>
        )}
      </FileSection>

      <FileSection title="Delivery" section={s.delivery}>
        {(d) => (
          <PerCommission rows={d} head={(g) => `${g.orderRef} · ${g.expectedDate ? date(g.expectedDate) : "no date"}`}>
            {(g) => (
              <div className="font-sans text-sm">
                <p className="text-text-mid">{CONFIRMATION_LABEL[g.confirmation]}</p>
                {g.address ? (
                  <p className="mt-1 text-ink">
                    {g.address.saved ?? g.address.clientLocation ?? "No address on file"}
                    {g.address.eventLocation ? <span className="text-text-mid"> · Event: {g.address.eventLocation}</span> : null}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-text-light">The address is kept for the client desk.</p>
                )}
                <Notes notes={g.notes ?? []} />
              </div>
            )}
          </PerCommission>
        )}
      </FileSection>

      <FileSection title="Cost of production" section={s.cost}>
        {(d) => <CostView data={d} />}
      </FileSection>
    </div>
  );
}

/** Each commission under its own subhead, in the order she commissioned them. */
function PerCommission<T extends { orderRef?: string }>({
  rows,
  head,
  children,
}: {
  rows: T[];
  head?: (row: T) => string;
  children: (row: T) => React.ReactNode;
}) {
  if (rows.length === 0) return <Empty>No commission yet.</Empty>;
  return (
    <div className="space-y-5">
      {rows.map((r, i) => (
        <div key={r.orderRef ?? i}>
          <SubHead>{head ? head(r) : r.orderRef}</SubHead>
          <div className="mt-1">{children(r)}</div>
        </div>
      ))}
    </div>
  );
}

/** BD2: notes under the record they belong to. A corrected note stays, struck through. */
function Notes({ notes }: { notes: FileNote[] }) {
  if (!notes.length) return null;
  return (
    <ol className="mt-3 space-y-2 border-l-2 border-sand pl-3">
      {notes.map((n, i) => (
        <li key={`${n.createdAt}-${i}`} className={n.corrected ? "opacity-60" : undefined}>
          <p className="font-sans text-10px uppercase tracking-wide text-text-light">
            {n.stage ? `Step · ${n.sectionLabel}` : "Note"} · {n.authorName} · {formatDate(n.createdAt, "d MMM yyyy, HH:mm")}
            {n.correction ? " · correction" : ""}
          </p>
          <p className={`whitespace-pre-wrap font-sans text-sm text-ink ${n.corrected ? "line-through" : ""}`}>{n.body}</p>
        </li>
      ))}
    </ol>
  );
}

/** "Add note" under the brief: appended with its author and time, never an edit (BD2). */
function AddBriefNote({ orderId, onAdded }: { orderId: string; onAdded: () => void }) {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!body.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/bespoke/${orderId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: "brief", body }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(res.status === 403 ? "You cannot add notes to this commission." : (j.error ?? "Could not add the note"));
      setBody("");
      toast.success("Note added — the team has been told");
      onAdded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the note");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        maxLength={4000}
        placeholder="Add a note to the brief — a change she asked for, a call, a decision…"
        aria-label="Add a note to the production brief"
        className="input-field min-h-[4rem] rounded-xl text-sm"
      />
      <button
        type="button"
        disabled={!body.trim() || saving}
        onClick={() => void save()}
        className="admin-chip glass-1 glass-pill font-sans text-xs uppercase tracking-[0.12em] text-ink disabled:opacity-50"
      >
        {saving ? "Adding…" : "Add note"}
      </button>
    </div>
  );
}

function InvoiceView({ data }: { data: Invoices }) {
  return (
    <PerCommission rows={data}>
      {(g) =>
        g.invoices.length === 0 ? (
          <Empty>No invoice raised yet.</Empty>
        ) : (
          <ul className="space-y-1 font-sans text-sm">
            {g.invoices.map((i) => (
              <li key={i.invoiceNumber}>
                <span className="text-ink">{i.invoiceNumber}</span>{" "}
                <span className="text-text-mid">
                  · {i.status.toLowerCase().replace(/_/g, " ")} · {money(i.total, i.currency)} · deposit{" "}
                  {money(i.depositRequired, i.currency)} · raised {date(i.raisedAt)}
                  {i.paidAt ? ` · paid ${date(i.paidAt)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )
      }
    </PerCommission>
  );
}

function SpecView({ data, empty }: { data: Spec; empty: string }) {
  return (
    <PerCommission rows={data}>
      {(g) => (
        <>
          {g.items.length === 0 ? (
            <Empty>{empty}</Empty>
          ) : (
            <ul className="space-y-2 font-sans text-sm">
              {g.items.map((m) => (
                <li key={m.id}>
                  <span className="font-medium text-ink">{m.name}</span>
                  {m.quantity ? <span className="text-text-mid"> · {m.quantity}</span> : null}
                  {m.issued ? <span className="ml-2 text-10px uppercase tracking-wide text-text-light">Issued</span> : null}
                  {m.notes ? <p className="text-text-mid">{m.notes}</p> : null}
                  <Gallery urls={m.images} />
                </li>
              ))}
            </ul>
          )}
          <Notes notes={g.notes} />
        </>
      )}
    </PerCommission>
  );
}

function IllustrationsView({
  data,
  clientId,
  canAdd,
  onAdded,
}: {
  data: Illustrations;
  clientId: string;
  canAdd: boolean;
  onAdded: () => void;
}) {
  return (
    <div className="space-y-6">
      <PerCommission
        rows={data.commissions}
        head={(g) =>
          `${g.orderRef} · ${APPROVAL_LABEL[g.designApproval.status] ?? g.designApproval.status}${
            g.designApproval.respondedAt ? ` (${date(g.designApproval.respondedAt)})` : ""
          }`
        }
      >
        {(g) => (
          <div className="space-y-3">
            {g.designApproval.clientComment ? (
              <p className="font-sans text-sm italic text-text-mid">“{g.designApproval.clientComment}”</p>
            ) : null}
            <div>
              <p className="font-sans text-xs uppercase tracking-wide text-text-light">Illustrations</p>
              <Gallery urls={g.sketches.map((m) => m.url)} empty="No sketches uploaded at Sketching yet." />
            </div>
            {g.herUploads.length ? (
              <div>
                <p className="font-sans text-xs uppercase tracking-wide text-text-light">Her mood board (from her forms)</p>
                <Gallery urls={g.herUploads} />
              </div>
            ) : null}
            {g.sessionMoodboard.length ? (
              <div>
                <p className="font-sans text-xs uppercase tracking-wide text-text-light">Mood board from the session</p>
                <Gallery urls={g.sessionMoodboard} />
              </div>
            ) : null}
          </div>
        )}
      </PerCommission>
      <div>
        <SubHead>Mood boards made by the house</SubHead>
        {data.houseMoodboards.length === 0 ? <Empty>None yet.</Empty> : null}
        {data.houseMoodboards.map((m) => (
          <div key={m.id} className="mt-2">
            <p className="font-sans text-sm text-ink">{m.title}</p>
            <Gallery urls={m.images} />
            {m.notes ? <p className="mt-1 font-sans text-sm text-text-mid">{m.notes}</p> : null}
          </div>
        ))}
        {canAdd ? <AddHouseMoodboard clientId={clientId} onAdded={onAdded} /> : null}
      </div>
    </div>
  );
}

function AddHouseMoodboard({ clientId, onAdded }: { clientId: string; onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/admin/consultations/upload", { method: "POST", body: fd });
      const j = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !j.url) throw new Error(j.error ?? "Upload failed");
      setImages((prev) => [...prev, j.url!]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/moodboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, title, images }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Could not save");
      toast.success("Mood board added");
      setTitle("");
      setImages([]);
      onAdded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-2 border-t border-sand pt-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Name this mood board"
        className="w-full rounded border border-sand px-3 py-2 font-sans text-sm"
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer font-sans text-xs">
          <span className="inline-flex rounded border border-sand px-3 py-2">{busy ? "Working…" : "Add a picture"}</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
        </label>
        {images.length ? <span className="font-sans text-xs text-text-mid">{images.length} picture(s)</span> : null}
        <button
          type="button"
          disabled={busy || !title.trim() || images.length === 0}
          onClick={() => void save()}
          className="border border-sand px-3 py-2 font-sans text-xs uppercase tracking-[0.12em] text-ink disabled:opacity-50"
        >
          Add house mood board
        </button>
      </div>
    </div>
  );
}

function FittingView({ data }: { data: Fitting }) {
  return (
    <PerCommission rows={data}>
      {(g) => (
        <div className="space-y-3 font-sans text-sm">
          {g.stages.map((st) => (
            <div key={st.stage}>
              <p className="text-ink">
                {st.label}
                <span className="text-text-mid"> · {st.doneAt ? `done ${date(st.doneAt)}` : "not yet"}</span>
              </p>
              {st.history.map((h, i) =>
                h.notes ? (
                  <p key={i} className="whitespace-pre-line text-text-mid">
                    {h.notes} <span className="text-xs text-text-light">— {h.by ?? "the house"}, {date(h.at)}</span>
                  </p>
                ) : null,
              )}
            </div>
          ))}
          {g.alterationRequests.length ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-text-light">Alterations she asked for after delivery</p>
              <ul className="space-y-1">
                {g.alterationRequests.map((a, i) => (
                  <li key={i} className="text-ink">
                    {a.description} <span className="text-text-mid">· {a.reason.toLowerCase()} · {a.status.toLowerCase()} · {date(a.at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <Notes notes={g.notes} />
        </div>
      )}
    </PerCommission>
  );
}

function CostView({ data }: { data: Cost }) {
  return (
    <PerCommission rows={data}>
      {(g) =>
        !g.cost ? (
          <Empty>Nothing recorded.</Empty>
        ) : (
          <dl className="grid max-w-md grid-cols-[1fr_auto] gap-x-6 gap-y-1 font-sans text-sm">
            <dt className="text-text-mid">Materials taken</dt>
            <dd className="text-right">{formatNGN(g.cost.materials.totalNGN)}</dd>
            {g.cost.sheet?.labour?.map((l) => (
              <div key={l.id} className="contents">
                <dt className="text-text-mid">{l.person ?? l.role.toLowerCase()} · {l.role.toLowerCase().replace(/_/g, " ")}</dt>
                <dd className="text-right">{formatNGN(l.amountNGN)}</dd>
              </div>
            ))}
            {g.cost.costOfProductionNGN != null ? (
              <>
                <dt className="font-medium text-ink">Cost of production</dt>
                <dd className="text-right font-medium">{formatNGN(g.cost.costOfProductionNGN)}</dd>
              </>
            ) : null}
            {g.cost.agreedPriceNGN != null ? (
              <>
                <dt className="text-text-mid">Price agreed</dt>
                <dd className="text-right">{formatNGN(g.cost.agreedPriceNGN)}</dd>
                <dt className="font-medium text-nut">Left after cost</dt>
                <dd className="text-right font-medium text-nut">{formatNGN(g.cost.marginNGN ?? 0)}</dd>
              </>
            ) : null}
            {!g.cost.sheet ? <dd className="col-span-2 text-xs text-text-light">No cost sheet yet — labour not counted.</dd> : null}
            {g.cost.materials.unpriced ? (
              <dd className="col-span-2 text-xs text-warning">{g.cost.materials.unpriced} material(s) have no cost recorded.</dd>
            ) : null}
          </dl>
        )
      }
    </PerCommission>
  );
}

/** "View as client": your session becomes hers until you exit (lib/client-view-as.ts). */
function ViewAsClientButton({ clientId }: { clientId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/view-as`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { redirect?: string; error?: string };
      if (!res.ok || !body.redirect) throw new Error(body.error ?? "Could not start viewing as this client.");
      window.location.assign(body.redirect);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start viewing as this client.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="border border-sand px-3 py-1.5 font-sans text-xs uppercase tracking-[0.12em] text-ink hover:border-ink disabled:opacity-60"
      >
        {busy ? "Opening her account…" : "View as client"}
      </button>
      <p className="max-w-[18rem] text-right font-sans text-11px text-text-mid">
        {error ?? "Opens her account as her, for up to an hour. Everything you do is recorded in the activity log."}
      </p>
    </div>
  );
}

function FileSection<T>({
  title,
  section,
  children,
}: {
  title: string;
  section: Section<T> | undefined;
  children: (data: T) => React.ReactNode;
}) {
  if (!section) return null;
  if (!section.visible) {
    return (
      <section className="card-surface border-dashed p-6 opacity-80">
        <h2 className="font-display text-lg text-ink">{title}</h2>
        <p className="mt-2 font-sans text-sm text-text-mid">
          This section exists on her file but is not open to you. {section.reason}
        </p>
      </section>
    );
  }
  return (
    <section className="card-surface p-6">
      <h2 className="font-display text-lg text-ink">{title}</h2>
      <div className="mt-4">{children(section.data)}</div>
    </section>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return <p className="font-sans text-11px font-semibold uppercase tracking-[0.12em] text-text-light">{children}</p>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 font-sans text-sm text-text-mid">{children}</p>;
}

function Gallery({ urls, empty }: { urls: string[]; empty?: string }) {
  if (urls.length === 0) return empty ? <Empty>{empty}</Empty> : null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {urls.map((url) => (
        <a key={url} href={url} target="_blank" rel="noreferrer" className="block h-24 w-24 overflow-hidden bg-sand/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
        </a>
      ))}
    </div>
  );
}


function ConsultationView({ data }: { data: Consultation }) {
  const nothing =
    data.bookings.length + data.enquiries.length + data.moodboards.length + data.briefs.length === 0;
  if (nothing && !data.notes?.length) return <Empty>No consultation on record.</Empty>;
  return (
    <div className="space-y-6 font-sans text-sm">
      {data.briefs.map((b) => (
        <div key={b.orderRef}>
          <SubHead>
            {b.orderRef}
            {b.occasion ? ` · ${b.occasion}` : ""}
          </SubHead>
          {b.brief ? <p className="mt-1 whitespace-pre-line text-ink">{b.brief}</p> : <Empty>No brief recorded.</Empty>}
          <Gallery urls={b.moodboardImages} />
        </div>
      ))}
      {data.bookings.map((b) => (
        <div key={b.id}>
          <SubHead>
            {b.bookingNumber} · {b.date ? `${date(b.date)}${b.time ? `, ${b.time}` : ""}` : "not yet dated"} · {b.consultant}
            {b.completedAt ? ` · held ${date(b.completedAt)}` : ""}
          </SubHead>
          <p className="mt-1 text-text-mid">
            <span className="text-ink">{b.occasion}.</span> {b.discussed}
          </p>
          {b.sessionNotes ? (
            <div className="mt-2">
              <p className="text-xs uppercase tracking-wide text-text-light">Session notes</p>
              <p className="whitespace-pre-line text-ink">{b.sessionNotes}</p>
            </div>
          ) : null}
          {b.moodboardImages.length ? (
            <div className="mt-2">
              <p className="text-xs uppercase tracking-wide text-text-light">Moodboard</p>
              <Gallery urls={b.moodboardImages} />
              {b.moodboardNotes ? <p className="mt-1 text-text-mid">{b.moodboardNotes}</p> : null}
            </div>
          ) : null}
          {b.referenceImages.length ? (
            <div className="mt-2">
              <p className="text-xs uppercase tracking-wide text-text-light">Her reference images</p>
              <Gallery urls={b.referenceImages} />
            </div>
          ) : null}
        </div>
      ))}
      {data.enquiries.map((e) => (
        <div key={e.enquiryNumber}>
          <SubHead>
            Enquiry {e.enquiryNumber} · {e.eventType} on {date(e.eventDate)}
          </SubHead>
          {e.answers?.length ? (
            <ul className="mt-1 space-y-0.5 text-text-mid">
              {e.answers.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          {e.notes ? <p className="mt-1 text-text-mid">{e.notes}</p> : null}
          <Gallery urls={e.moodboardImages} />
        </div>
      ))}
      {data.notes?.length ? (
        <div>
          <SubHead>Notes since the session</SubHead>
          <Notes notes={data.notes} />
        </div>
      ) : null}
    </div>
  );
}

function MeasureGrid({ rows }: { rows: MeasureRow[] }) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {rows.map((r) => (
        <div key={r.key}>
          <p className="font-sans text-10px uppercase text-text-light">{r.label}</p>
          <p className="font-sans text-sm text-ink">
            {r.value} {r.unit}
          </p>
        </div>
      ))}
    </div>
  );
}

const MEASURE_SOURCE: Record<"commission" | "client" | "none", string> = {
  commission: "taken for this commission",
  client: "not yet taken for this commission — her last set would be used",
  none: "none on record",
};

function MeasurementsView({ data }: { data: Measurements }) {
  if (!data.profile && data.orderLines.length === 0 && !data.commissions?.length) {
    return <Empty>No measurements recorded.</Empty>;
  }
  return (
    <div className="space-y-5">
      {data.commissions?.length ? (
        <ul className="space-y-1 font-sans text-sm">
          {data.commissions.map((c) => (
            <li key={c.orderRef}>
              <span className="text-ink">{c.orderRef}</span>{" "}
              <span className={c.source === "client" ? "text-warning" : "text-text-mid"}>
                · {MEASURE_SOURCE[c.source]}
                {c.source === "commission" && c.takenAt ? `, ${date(c.takenAt)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {data.profile ? (
        <div>
          <SubHead>
            Her latest set · first taken {date(data.profile.firstRecordedAt)} · last updated {date(data.profile.lastUpdatedAt)}
          </SubHead>
          <MeasureGrid rows={data.profile.rows} />
          {data.profile.notes ? <p className="mt-2 font-sans text-sm text-text-mid">{data.profile.notes}</p> : null}
        </div>
      ) : null}
      {data.orderLines.map((l) => (
        <div key={`${l.orderNumber}-${l.product}`}>
          <SubHead>
            As entered on {l.orderNumber} ({l.product}) · {date(l.takenAt)}
          </SubHead>
          <MeasureGrid rows={l.rows} />
        </div>
      ))}
    </div>
  );
}

function QuotationView({ data }: { data: Quote }) {
  if (data.length === 0) return <Empty>No quotation on a commission yet.</Empty>;
  return (
    <div className="space-y-4 font-sans text-sm">
      {data.map((q) => (
        <div key={q.quoteRef}>
          <SubHead>
            {q.quoteRef} · {QUOTE_STATUS[q.status] ?? q.status}
            {q.agreedAt ? ` · ${date(q.agreedAt)}` : ""}
          </SubHead>
          <ul className="mt-1 text-ink">
            {q.lines.map((l, i) => (
              <li key={i}>
                {l.quantity > 1 ? `${l.quantity} × ` : ""}
                {l.description}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-text-mid">
            {money(q.total, q.currency)} · {q.depositPercent}% deposit
            {q.expectedDeliveryDate ? ` · delivery ${date(q.expectedDeliveryDate)}` : ""}
          </p>
          {q.notes ? <p className="mt-1 text-text-mid">{q.notes}</p> : null}
        </div>
      ))}
    </div>
  );
}

function BalanceView({ data }: { data: Balance }) {
  if (data.length === 0) return <Empty>No commission yet.</Empty>;
  return (
    <div className="space-y-4 font-sans text-sm">
      {data.map((p) => (
        <div key={p.orderRef}>
          <SubHead>{p.orderRef}</SubHead>
          {p.totalNGN > 0 ? (
            <dl className="mt-1 grid grid-cols-3 gap-2">
              {(
                [
                  ["Price", p.totalNGN],
                  ["Paid", p.paidNGN],
                  ["Balance", p.balanceNGN],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-10px uppercase text-text-light">{label}</dt>
                  <dd className="text-ink">{money(value, "NGN")}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-1 text-text-mid">No price agreed yet.</p>
          )}
          <ul className="mt-1 space-y-1">
            {p.payments.map((row) => (
              <li key={row.reference} className="flex flex-wrap justify-between gap-2">
                <span className="text-ink">
                  {money(row.amount, row.currency)} · {row.purpose.toLowerCase()} · {row.status.toLowerCase()}
                </span>
                <span className="text-text-mid">
                  {date(row.createdAt)}
                  {row.receiptUrl ? (
                    <>
                      {" · "}
                      <a href={row.receiptUrl} target="_blank" rel="noreferrer" className="underline">
                        receipt
                      </a>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
            {p.payments.length === 0 && p.totalNGN > 0 ? (
              <li className="text-text-mid">No payments in the ledger yet.</li>
            ) : null}
          </ul>
        </div>
      ))}
    </div>
  );
}
