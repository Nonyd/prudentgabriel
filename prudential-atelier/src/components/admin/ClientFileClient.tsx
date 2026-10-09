"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatPrice } from "@/lib/utils";

/**
 * Slice BC1 — the client file. Everything about her gown on one page, in the
 * order Mrs. Prudent described it. What each viewer gets is decided by the API
 * (GET /api/clients/:id/file); a section that is not theirs arrives as a reason,
 * never as data, and is shown as such rather than left blank.
 */

type Hidden = { visible: false; reason: string };
type Shown<T> = { visible: true; data: T };
type Section<T> = Hidden | Shown<T>;

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
};
type MeasureRow = { key: string; label: string; value: number; unit: string };
type Measurements = {
  profile: { rows: MeasureRow[]; notes: string | null; firstRecordedAt: string | null; lastUpdatedAt: string | null } | null;
  orderLines: { orderNumber: string; product: string; takenAt: string | null; rows: MeasureRow[] }[];
};
type Spec = {
  orderRef: string;
  description: string | null;
  features: { key: string; label: string; group: string | null; note: string | null }[];
}[];
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
type Payments = {
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
type Illustrations = {
  orderRef: string;
  sketches: { id: string; url: string; kind: string; uploadedAt: string | null }[];
  designApproval: { status: string; requestedAt?: string | null; respondedAt?: string | null; clientComment?: string | null };
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
}[];

type ClientFile = {
  client: { id: string; firstName: string | null; name?: string | null; email?: string; phone?: string | null; loyaltyTier?: string };
  scope: "house" | "workroom";
  contactHidden: boolean;
  /** Decided on the server by canPreviewClientDashboard, the same check as the preview page. */
  canPreviewDashboard: boolean;
  commissions: { id: string; orderRef: string; currentStageLabel: string | null; status: string; createdAt: string }[];
  sections: {
    consultation: Section<Consultation>;
    measurements: Section<Measurements>;
    specification: Section<Spec>;
    quotation: Section<Quote>;
    payments: Section<Payments>;
    illustrations: Section<Illustrations>;
    making: Section<Making>;
    delivery: Section<Delivery>;
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

  useEffect(() => {
    let live = true;
    void (async () => {
      const res = await fetch(`/api/clients/${clientId}/file`);
      if (!live) return;
      if (!res.ok) {
        setError(res.status === 403 ? "This client's file is not open to you." : "Could not load the client file.");
        return;
      }
      setFile((await res.json()) as ClientFile);
    })();
    return () => {
      live = false;
    };
  }, [clientId]);

  if (error) return <p className="card-surface p-6 font-sans text-sm text-text-mid">{error}</p>;
  if (!file) return <p className="font-sans text-sm text-text-mid">Loading the client file…</p>;

  const { sections: s } = file;
  const orderHref = (id: string) => (portal === "admin" ? `/admin/bespoke/${id}` : `/staff/orders/${id}`);

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-display text-2xl text-ink">{file.client.name ?? file.client.firstName ?? "Client"}</h1>
          {portal === "admin" && file.canPreviewDashboard ? (
            <Link
              href={`/admin/clients/${clientId}/dashboard`}
              className="border border-sand px-3 py-1.5 font-sans text-xs uppercase tracking-[0.12em] text-ink hover:border-ink"
            >
              Preview her dashboard
            </Link>
          ) : null}
        </div>
        {file.contactHidden ? (
          <p className="font-sans text-xs text-text-mid">Contact details are kept for the client desk.</p>
        ) : (
          <p className="font-sans text-sm text-text-mid">
            {[file.client.email, file.client.phone].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {file.commissions.length === 0 ? (
            <span className="font-sans text-xs text-text-mid">No commissions yet.</span>
          ) : (
            file.commissions.map((c) => (
              <Link key={c.id} href={orderHref(c.id)} className="hover:opacity-80">
                <Badge variant="outline-gold">
                  {c.orderRef} · {c.currentStageLabel}
                </Badge>
              </Link>
            ))
          )}
        </div>
      </header>

      <FileSection title="Consultation" section={s.consultation}>
        {(d) => <ConsultationView data={d} />}
      </FileSection>

      <FileSection title="Measurements" section={s.measurements}>
        {(d) => <MeasurementsView data={d} />}
      </FileSection>

      <FileSection title="The gown" section={s.specification}>
        {(d) => (
          <div className="space-y-5">
            {d.length === 0 ? <Empty>No commission yet.</Empty> : null}
            {d.map((g) => (
              <div key={g.orderRef}>
                <SubHead>{g.orderRef}</SubHead>
                {g.features.length === 0 ? (
                  <Empty>No specification ticked yet.</Empty>
                ) : (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {g.features.map((f) => (
                      <li key={f.key} className="border border-sand px-3 py-1.5 font-sans text-sm text-ink">
                        {f.label}
                        {f.note ? <span className="text-text-mid"> — {f.note}</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
                {g.description ? <p className="mt-2 font-sans text-sm text-text-mid">{g.description}</p> : null}
              </div>
            ))}
          </div>
        )}
      </FileSection>
      <div className="grid gap-6 lg:grid-cols-2">
        <FileSection title="Quotation — what was agreed" section={s.quotation}>
          {(d) => <QuotationView data={d} />}
        </FileSection>
        <FileSection title="Payments" section={s.payments}>
          {(d) => <PaymentsView data={d} />}
        </FileSection>
      </div>

      <FileSection title="Illustrations" section={s.illustrations}>
        {(d) => (
          <div className="space-y-5">
            {d.map((g) => (
              <div key={g.orderRef}>
                <SubHead>
                  {g.orderRef} · {APPROVAL_LABEL[g.designApproval.status] ?? g.designApproval.status}
                  {g.designApproval.respondedAt ? ` (${date(g.designApproval.respondedAt)})` : ""}
                </SubHead>
                {g.designApproval.clientComment ? (
                  <p className="mt-1 font-sans text-sm italic text-text-mid">“{g.designApproval.clientComment}”</p>
                ) : null}
                <Gallery urls={g.sketches.map((m) => m.url)} empty="No sketches uploaded at Sketching yet." />
              </div>
            ))}
            {d.length === 0 ? <Empty>No commission yet.</Empty> : null}
          </div>
        )}
      </FileSection>

      <FileSection title="Who is making it" section={s.making}>
        {(d) => (
          <div className="space-y-4">
            {d.map((g) => (
              <div key={g.orderRef}>
                <SubHead>
                  {g.orderRef} · now at {g.currentStageLabel}
                </SubHead>
                {g.people.length === 0 ? (
                  <Empty>Nobody assigned yet.</Empty>
                ) : (
                  <ul className="mt-2 space-y-1 font-sans text-sm">
                    {g.people.map((p, i) => (
                      <li key={`${p.name}-${i}`}>
                        <span className="text-ink">{p.name}</span>{" "}
                        <span className="text-text-mid">
                          — {p.roleLabel}, on {p.stageLabel ?? "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {d.length === 0 ? <Empty>No commission yet.</Empty> : null}
          </div>
        )}
      </FileSection>

      <FileSection title="Delivery" section={s.delivery}>
        {(d) => (
          <div className="space-y-4">
            {d.map((g) => (
              <div key={g.orderRef} className="font-sans text-sm">
                <SubHead>
                  {g.orderRef} · {g.expectedDate ? date(g.expectedDate) : "no date"}
                </SubHead>
                <p className="mt-1 text-text-mid">{CONFIRMATION_LABEL[g.confirmation]}</p>
                {g.address ? (
                  <p className="mt-1 text-ink">
                    {g.address.saved ?? g.address.clientLocation ?? "No address on file"}
                    {g.address.eventLocation ? (
                      <span className="text-text-mid"> · Event: {g.address.eventLocation}</span>
                    ) : null}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-text-light">The address is kept for the client desk.</p>
                )}
              </div>
            ))}
            {d.length === 0 ? <Empty>No commission yet.</Empty> : null}
          </div>
        )}
      </FileSection>
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
  return <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-text-light">{children}</p>;
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
  if (nothing) return <Empty>No consultation on record.</Empty>;
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
      {data.moodboards.map((m) => (
        <div key={m.id}>
          <SubHead>Moodboard · {m.title}</SubHead>
          <Gallery urls={m.images} />
          {m.notes ? <p className="mt-1 text-text-mid">{m.notes}</p> : null}
        </div>
      ))}
    </div>
  );
}

function MeasureGrid({ rows }: { rows: MeasureRow[] }) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {rows.map((r) => (
        <div key={r.key}>
          <p className="font-sans text-[10px] uppercase text-text-light">{r.label}</p>
          <p className="font-sans text-sm text-ink">
            {r.value} {r.unit}
          </p>
        </div>
      ))}
    </div>
  );
}

function MeasurementsView({ data }: { data: Measurements }) {
  if (!data.profile && data.orderLines.length === 0) return <Empty>No measurements recorded.</Empty>;
  return (
    <div className="space-y-5">
      {data.profile ? (
        <div>
          <SubHead>
            Her profile · first taken {date(data.profile.firstRecordedAt)} · last updated {date(data.profile.lastUpdatedAt)}
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

function PaymentsView({ data }: { data: Payments }) {
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
                  <dt className="text-[10px] uppercase text-text-light">{label}</dt>
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
