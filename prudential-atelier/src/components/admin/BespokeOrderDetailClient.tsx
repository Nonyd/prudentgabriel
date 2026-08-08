"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  ClientMeasurementsPanel,
  patchClientMeasurements,
  type MeasurementData,
} from "@/components/admin/ClientMeasurementsPanel";
import { measurementFromRecord } from "@/lib/measurements";
import type {
  BespokeOrder,
  BespokeStage,
  ClientProfile,
  Material,
  Measurement,
  OrderAssignment,
  Payment,
  Quotation,
  StageUpdate,
  StaffProfile,
  User,
} from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConsultationBriefPanel } from "@/components/admin/ConsultationBriefPanel";
import { STAGE_LABELS, STAGE_ORDER, getStageProgress } from "@/lib/bespoke-stages";
import { cn, formatDate } from "@/lib/utils";

type LedgerPayment = Payment & {
  confirmedBy?: Pick<User, "id" | "name" | "email"> | null;
  amount: number | { toString(): string };
};

type OrderWithRelations = BespokeOrder & {
  stageHistory: StageUpdate[];
  assignments: (OrderAssignment & {
    staffProfile: StaffProfile & { user: Pick<User, "name" | "email"> };
  })[];
  materials: Material[];
  quotation: Quotation | null;
  clientProfile: (ClientProfile & { measurements: Measurement | null }) | null;
  consultation?: {
    id: string;
    bookingNumber: string;
    occasion: string;
  } | null;
  payments?: LedgerPayment[];
};

function ledgerAmount(p: LedgerPayment): number {
  return typeof p.amount === "number" ? p.amount : Number(p.amount.toString());
}

type StaffOption = { id: string; name: string; department: string; activeOrders: number };

export function BespokeOrderDetailClient({
  order: initial,
  staffList,
  trackingUrl,
}: {
  order: OrderWithRelations;
  staffList: StaffOption[];
  trackingUrl: string;
}) {
  const router = useRouter();
  const [order, setOrder] = useState(initial);
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [assignRole, setAssignRole] = useState("TAILOR");
  const [assignStaffId, setAssignStaffId] = useState("");
  const [materialForm, setMaterialForm] = useState({ name: "", quantity: "", unitCost: "" });
  const [paymentAmount, setPaymentAmount] = useState("");
  const [measurementsDraft, setMeasurementsDraft] = useState<MeasurementData | null>(null);

  const completedStages = new Set(order.stageHistory.map((s) => s.stage));

  const uploadFile = async (file: File, folder: string) => {
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const res = await fetch("/api/admin/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: base64, folder }),
    });
    if (!res.ok) throw new Error("Upload failed");
    const data = (await res.json()) as { url: string };
    return data.url;
  };

  const handleUpload = async (files: FileList | null, type: "images" | "videos") => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        urls.push(await uploadFile(file, type === "videos" ? "bespoke-videos" : "bespoke-stages"));
      }
      if (type === "images") setImages((prev) => [...prev, ...urls]);
      else setVideos((prev) => [...prev, ...urls]);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const completeStage = async () => {
    setCompleting(true);
    try {
      if (order.currentStage === "CONSULTATION_SESSION" && order.clientProfileId && measurementsDraft) {
        await patchClientMeasurements(order.clientProfileId, measurementsDraft);
      }
      const res = await fetch(`/api/bespoke/${order.id}/complete-stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, images, videos }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed");
      }
      const data = (await res.json()) as { item: OrderWithRelations };
      setOrder((o) => ({ ...o, ...data.item }));
      setNotes("");
      setImages([]);
      setVideos([]);
      setConfirmOpen(false);
      toast.success("Stage completed — client emailed");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete stage");
    } finally {
      setCompleting(false);
    }
  };

  const stageAssignments = order.assignments.filter((a) => a.stage === order.currentStage);

  const assignStaff = async (stage = order.currentStage) => {
    if (!assignStaffId) return;
    const res = await fetch(`/api/bespoke/${order.id}/assign-staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staffProfileId: assignStaffId,
        role: assignRole,
        stage,
      }),
    });
    if (!res.ok) {
      toast.error("Assignment failed");
      return;
    }
    const data = (await res.json()) as {
      item: OrderWithRelations["assignments"][number];
    };
    setOrder((o) => ({ ...o, assignments: [...o.assignments, data.item] }));
    setAssignStaffId("");
    toast.success("Staff assigned");
  };

  const removeAssignment = async (assignmentId: string) => {
    const res = await fetch(`/api/bespoke/${order.id}/assign-staff?assignmentId=${assignmentId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Could not remove assignment");
      return;
    }
    setOrder((o) => ({
      ...o,
      assignments: o.assignments.filter((a) => a.id !== assignmentId),
    }));
  };

  const recordPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount) return;
    const res = await fetch(`/api/bespoke/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountPaid: order.amountPaid + amount }),
    });
    if (!res.ok) {
      toast.error("Payment not recorded");
      return;
    }
    const data = (await res.json()) as { item: BespokeOrder };
    setOrder((o) => ({ ...o, ...data.item }));
    setPaymentAmount("");
    toast.success("Payment recorded");
  };

  const addMaterial = async () => {
    if (!materialForm.name.trim()) return;
    const unitCost = materialForm.unitCost ? parseFloat(materialForm.unitCost) : null;
    const res = await fetch(`/api/bespoke/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        material: {
          name: materialForm.name,
          quantity: materialForm.quantity || null,
          unitCost,
          totalCost: unitCost,
        },
      }),
    });
    if (res.ok) {
      toast.success("Material added");
      setMaterialForm({ name: "", quantity: "", unitCost: "" });
      router.refresh();
    }
  };

  return (
    <div className="space-y-8">
      <Link href="/admin/bespoke" className="font-sans text-[11px] uppercase text-text-light hover:text-nut">
        ← Orders pipeline
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink">{order.orderRef}</h1>
          <p className="mt-1 font-sans text-sm text-text-mid">{order.clientName}</p>
          <a
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block font-sans text-xs text-nut underline"
          >
            Public tracking link
          </a>
        </div>
        <BadgeStage stage={order.currentStage} />
      </div>

      {order.consultationId ? (
        <ConsultationBriefPanel
          variant="admin"
          brief={{
            consultationId: order.consultationId,
            bookingNumber: order.consultation?.bookingNumber ?? "—",
            occasion: order.occasionDetails ?? order.occasionType,
            outfitBrief: order.outfitBrief ?? order.sessionNotes ?? order.outfitDescription,
            moodboardImages: order.moodboardImages ?? [],
          }}
        />
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-8">
          <section className="card-surface p-6">
            <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-text-light">
              Production stages
            </h2>
            <ol className="mt-6 space-y-0">
              {STAGE_ORDER.map((stage, idx) => {
                const done = completedStages.has(stage);
                const active = stage === order.currentStage;
                return (
                  <li key={stage} className="flex gap-4 pb-6 last:pb-0">
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold",
                          done && "border-lightbr bg-lightbr text-cream",
                          active && !done && "border-nut bg-nut text-cream animate-pulse",
                          !done && !active && "border-sand bg-bg-card text-text-light",
                        )}
                      >
                        {idx + 1}
                      </div>
                      {idx < STAGE_ORDER.length - 1 ? (
                        <div className={cn("w-0.5 flex-1 min-h-[24px] mt-1", done ? "bg-lightbr" : "bg-sand")} />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 pt-1">
                      <p className={cn("font-sans text-sm", active && "font-semibold text-nut")}>
                        {STAGE_LABELS[stage]}
                      </p>
                      {order.assignments
                        .filter((a) => a.stage === stage)
                        .map((a) => (
                          <p key={a.id} className="mt-1 font-sans text-[11px] text-text-light">
                            {a.staffProfile.user.name ?? a.staffProfile.user.email}
                            {a.role ? ` · ${a.role}` : ""}
                          </p>
                        ))}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {order.stageHistory.length > 0 ? (
            <section className="card-surface p-6">
              <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-text-light">
                Stage history
              </h2>
              <ul className="mt-4 space-y-6">
                {order.stageHistory.map((h) => (
                  <li key={h.id} className="border-b border-sand pb-4 last:border-0">
                    <p className="font-sans text-sm font-medium text-ink">{STAGE_LABELS[h.stage]}</p>
                    <p className="mt-1 font-sans text-[11px] text-text-light">
                      {formatDate(h.completedAt)} · {h.completedByName ?? "Admin"}
                    </p>
                    {h.notes ? (
                      <p className="mt-2 whitespace-pre-wrap font-sans text-sm text-text-mid">{h.notes}</p>
                    ) : null}
                    {h.images.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {h.images.map((url) => (
                          <div key={url} className="relative h-16 w-16 overflow-hidden border border-sand">
                            <Image src={url} alt="" fill className="object-cover" unoptimized />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="card-surface p-6">
            <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-text-light">
              Complete current stage — {STAGE_LABELS[order.currentStage]}
            </h2>
            <div className="mt-4">
              <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-text-light">
                Assign staff to this stage
              </p>
              {stageAssignments.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {stageAssignments.map((a) => (
                    <li
                      key={a.id}
                      className="inline-flex items-center gap-2 rounded-full border border-sand bg-ivory px-3 py-1 font-sans text-xs text-ink"
                    >
                      <span>
                        {a.staffProfile.user.name ?? a.staffProfile.user.email}
                        {a.role ? ` — ${a.role}` : ""}
                      </span>
                      <button
                        type="button"
                        className="text-text-light hover:text-nut"
                        onClick={() => void removeAssignment(a.id)}
                        aria-label="Remove assignment"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 font-sans text-xs text-text-light">No staff assigned yet.</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <select
                  value={assignStaffId}
                  onChange={(e) => setAssignStaffId(e.target.value)}
                  className="min-w-[12rem] flex-1 rounded border border-sand px-2 py-2 font-sans text-sm"
                >
                  <option value="">Select staff…</option>
                  {staffList
                    .sort((a, b) => a.activeOrders - b.activeOrders)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {s.activeOrders} active order(s)
                      </option>
                    ))}
                </select>
                <select
                  value={assignRole}
                  onChange={(e) => setAssignRole(e.target.value)}
                  className="rounded border border-sand px-2 py-2 font-sans text-sm"
                >
                  <option value="TAILOR">Tailor</option>
                  <option value="BEADER">Beader</option>
                  <option value="DESIGNER">Designer</option>
                </select>
                <Button size="sm" variant="secondary" onClick={() => void assignStaff()}>
                  Add staff
                </Button>
              </div>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Stage notes for the client (required)…"
              rows={4}
              className="mt-4 w-full rounded border border-sand px-3 py-2 font-sans text-sm"
            />
            {order.currentStage === "CONSULTATION_SESSION" ? (
              <div className="mt-4">
                <p className="font-sans text-[11px] text-text-mid">
                  Capture measurements now to save a trip later (optional)
                </p>
                <ClientMeasurementsPanel
                  compact
                  clientId={order.clientProfileId}
                  clientName={order.clientName}
                  initial={measurementFromRecord(order.clientProfile?.measurements ?? null)}
                  onDraftChange={setMeasurementsDraft}
                />
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              <label className="cursor-pointer">
                <span className="inline-flex rounded border border-sand px-3 py-2 font-sans text-xs">
                  {uploading ? "Uploading…" : "Add images"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void handleUpload(e.target.files, "images")}
                />
              </label>
              <label className="cursor-pointer">
                <span className="inline-flex rounded border border-sand px-3 py-2 font-sans text-xs">
                  Add videos
                </span>
                <input
                  type="file"
                  accept="video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void handleUpload(e.target.files, "videos")}
                />
              </label>
            </div>
            {(images.length > 0 || videos.length > 0) && (
              <p className="mt-2 font-sans text-xs text-text-light">
                {images.length} image(s), {videos.length} video(s) attached
              </p>
            )}
            <Button
              className="mt-4"
              disabled={!notes.trim()}
              onClick={() => setConfirmOpen(true)}
            >
              Mark Stage Complete
            </Button>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card-surface p-6">
            <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-text-light">Client</h2>
            <dl className="mt-4 space-y-2 font-sans text-sm">
              <div>
                <dt className="text-text-light">Name</dt>
                <dd>{order.clientName}</dd>
              </div>
              <div>
                <dt className="text-text-light">Email</dt>
                <dd>{order.clientEmail}</dd>
              </div>
              {order.clientPhone ? (
                <div>
                  <dt className="text-text-light">Phone</dt>
                  <dd>{order.clientPhone}</dd>
                </div>
              ) : null}
              {order.deliveryDate ? (
                <div>
                  <dt className="text-text-light">Delivery</dt>
                  <dd>{formatDate(order.deliveryDate)}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="card-surface p-6">
            <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-text-light">
              All stage assignments
            </h2>
            <ul className="mt-3 space-y-2">
              {order.assignments.length === 0 ? (
                <li className="font-sans text-sm text-text-light">No assignments yet.</li>
              ) : (
                order.assignments.map((a) => (
                  <li key={a.id} className="font-sans text-sm">
                    {a.stage ? `${STAGE_LABELS[a.stage]} · ` : ""}
                    {a.role}: {a.staffProfile.user.name ?? a.staffProfile.user.email}
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="card-surface p-6">
            <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-text-light">Payment</h2>
            <dl className="mt-3 space-y-1 font-sans text-sm">
              <div className="flex justify-between">
                <dt>Total</dt>
                <dd>₦{order.totalAmount.toLocaleString("en-NG")}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Paid</dt>
                <dd>₦{order.amountPaid.toLocaleString("en-NG")}</dd>
              </div>
              <div className="flex justify-between font-medium text-nut">
                <dt>Balance</dt>
                <dd>₦{order.balance.toLocaleString("en-NG")}</dd>
              </div>
              {order.productionUnlockedAt ? (
                <div className="flex justify-between text-xs text-text-light">
                  <dt>Production unlocked</dt>
                  <dd>{formatDate(order.productionUnlockedAt)}</dd>
                </div>
              ) : (
                <div className="pt-1 text-xs text-[#C45E0A]">Deposit not yet satisfied — production locked</div>
              )}
            </dl>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse font-sans text-xs">
                <thead>
                  <tr className="border-b border-sand text-left text-[10px] font-medium uppercase tracking-wide text-text-light">
                    <th className="py-2 pr-2">Date</th>
                    <th className="py-2 pr-2 text-right">Amount</th>
                    <th className="py-2 pr-2">Method</th>
                    <th className="py-2 pr-2">Purpose</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2">Confirmed by</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.payments ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-3 text-text-light">
                        No ledger payments yet.
                      </td>
                    </tr>
                  ) : (
                    (order.payments ?? []).map((p) => (
                      <tr key={p.id} className="border-b border-sand last:border-0">
                        <td className="py-2 pr-2 whitespace-nowrap">
                          {formatDate(p.confirmedAt ?? p.createdAt)}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          ₦{ledgerAmount(p).toLocaleString("en-NG")}
                        </td>
                        <td className="py-2 pr-2">{p.method.replace(/_/g, " ")}</td>
                        <td className="py-2 pr-2">{p.purpose.replace(/_/g, " ")}</td>
                        <td className="py-2 pr-2">{p.status}</td>
                        <td className="py-2 text-text-light">
                          {p.confirmedBy?.name ?? p.confirmedBy?.email ?? "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex gap-2">
              <input
                type="number"
                placeholder="Amount"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="flex-1 rounded border border-sand px-2 py-2 font-sans text-sm"
              />
              <Button size="sm" onClick={() => void recordPayment()}>
                Record
              </Button>
            </div>
          </section>

          <section className="card-surface p-6">
            <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-text-light">Materials</h2>
            <ul className="mt-2 space-y-1 font-sans text-sm">
              {order.materials.map((m) => (
                <li key={m.id}>
                  {m.name}
                  {m.quantity ? ` · ${m.quantity}` : ""}
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-2">
              <input
                placeholder="Material name"
                value={materialForm.name}
                onChange={(e) => setMaterialForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded border border-sand px-2 py-2 font-sans text-sm"
              />
              <Button size="sm" variant="secondary" onClick={() => void addMaterial()}>
                Add material
              </Button>
            </div>
          </section>
        </div>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm stage completion">
        <p className="font-sans text-sm text-text-mid">
          This will send an email to <strong>{order.clientName}</strong> and advance the order to the next stage.
          Proceed?
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button loading={completing} onClick={() => void completeStage()}>
            Confirm &amp; Send Email
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function BadgeStage({ stage }: { stage: BespokeStage }) {
  return (
    <span className="rounded-full bg-nut/10 px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-wide text-nut">
      Stage {getStageProgress(stage)}/13
    </span>
  );
}
