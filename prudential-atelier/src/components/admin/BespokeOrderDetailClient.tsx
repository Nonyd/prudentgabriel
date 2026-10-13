"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import toast from "react-hot-toast";
import {
  ClientMeasurementsPanel,
  patchCommissionMeasurements,
  type MeasurementData,
} from "@/components/admin/ClientMeasurementsPanel";
import { measurementFromRecord } from "@/lib/measurements";
import {
  CommissionIdentityPanel,
  CommissionMeasurementsCard,
  CostPanel,
  LockedSection,
  SpecificationPanel,
} from "@/components/admin/CommissionFilePanels";
import { NotesStream } from "@/components/admin/NotesStream";
import { CommissionDeleteControl } from "@/components/admin/CommissionDeleteControl";
import { NOTE_SECTIONS } from "@/lib/atelier/commission-notes-shared";
import { formatNgnKobo } from "@/lib/money";
import type {
  BespokeOrder,
  BespokeStage,
  ClientProfile,
  CommissionFeature,
  ConstructionFeature,
  Material,
  Measurement,
  OrderAssignment,
  OrderStageCompletion,
  OrderStageDraft,
  OrderStageMedia,
  Payment,
  Quotation,
  StageApproval,
  StageUpdate,
  StaffProfile,
  User,
} from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConsultationBriefPanel } from "@/components/admin/ConsultationBriefPanel";
import { CommissionSpecPanel } from "@/components/admin/CommissionSpecPanel";
import { specificationRows } from "@/lib/atelier/spec-rows";
import { BESPOKE_MANAGER_ROLES, sessionHasRole } from "@/lib/bespoke-roles";
import { useHasPermission } from "@/hooks/useHasPermission";
import { STAGE_LABELS, STAGE_ORDER, getStageProgress } from "@/lib/bespoke-stages";
import { getStageRequirement, stageRoleAllows } from "@/lib/atelier/stage-requirements";
import {
  buildStageChecklistFacts,
  mergeStageMedia,
  notesDraftForStage,
  presentStageChecklist,
} from "@/lib/atelier/stage-checklist";
import { cn, formatDate } from "@/lib/utils";
import { uploadAdminAsset, uploadAdminVideo } from "@/lib/admin-upload-xhr";

type LedgerPayment = Payment & {
  confirmedBy?: Pick<User, "id" | "name" | "email"> | null;
  amount: number | { toString(): string };
};

type OrderWithRelations = BespokeOrder & {
  stageHistory: StageUpdate[];
  stageCompletions?: OrderStageCompletion[];
  stageMedia?: OrderStageMedia[];
  stageDrafts?: OrderStageDraft[];
  stageApprovals?: StageApproval[];
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
  /** Slice BC2: ticked construction features. */
  features?: (CommissionFeature & {
    feature: Pick<ConstructionFeature, "key" | "label" | "group" | "sortOrder">;
  })[];
  /** Slice AZ8: set by the API when this viewer may not see payments / measurements. */
  paymentsHidden?: boolean;
  measurementsHidden?: boolean;
  /** BD4: the balance itself is hidden from non-money viewers; this says whether it is cleared. */
  balanceCleared?: boolean;
};

function ledgerAmount(p: LedgerPayment): number {
  return typeof p.amount === "number" ? p.amount : Number(p.amount.toString());
}

type StaffOption = { id: string; userId: string; name: string; department: string; activeOrders: number };

export function BespokeOrderDetailClient({
  order: initial,
  staffList,
  trackingUrl,
  actorRole,
  actorUserId,
  access,
  title,
}: {
  order: OrderWithRelations;
  staffList: StaffOption[];
  trackingUrl: string;
  actorRole?: string | null;
  actorUserId?: string | null;
  /** What this viewer's APIs allow — the same facts they gate on (bespokeView). */
  access?: {
    manage: boolean;
    money: boolean;
    admin: boolean;
    materialCost?: boolean;
    labourCost?: boolean;
    specEdit?: boolean;
  };
  /** BD1: composed on the server ("Mrs. Prudent — 60th birthday outfit — 25 November"). */
  title?: { text: string; composed: string };
}) {
  const [order, setOrder] = useState(initial);
  const [notes, setNotes] = useState(() => notesDraftForStage(initial.stageDrafts, initial.currentStage));
  const savedNotesRef = useRef(notes);
  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [assignRole, setAssignRole] = useState("TAILOR");
  const [assignStaffId, setAssignStaffId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [measurementsDraft, setMeasurementsDraft] = useState<MeasurementData | null>(null);
  const [requestingApproval, setRequestingApproval] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);
  const [revertTarget, setRevertTarget] = useState<BespokeStage | "">("");
  const [revertReason, setRevertReason] = useState("");
  const [reverting, setReverting] = useState(false);

  const completedStages = new Set(
    (order.stageCompletions ?? []).filter((s) => !s.revertedAt).map((s) => s.stage),
  );
  const req = getStageRequirement(order.currentStage);
  const stageMedia = (order.stageMedia ?? []).filter((m) => m.stage === order.currentStage);
  const draftNotes = notes.trim() || notesDraftForStage(order.stageDrafts, order.currentStage).trim();
  const latestApproval = (order.stageApprovals ?? [])
    .filter((a) => a.stage === order.currentStage && a.status !== "SUPERSEDED")
    .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())[0];
  const checklist = presentStageChecklist(
    buildStageChecklistFacts({
      currentStage: order.currentStage,
      completedStages,
      draftNotes,
      mediaCount: stageMedia.length,
      latestApprovalStatus: latestApproval?.status,
      productionUnlockedAt: order.productionUnlockedAt,
      // Non-money viewers get no figure, only whether it is cleared (BD4).
      balance: order.balance ?? (order.balanceCleared ? 0 : Number.POSITIVE_INFINITY),
    }),
  );
  const unmet = checklist.filter((c) => c.required && !c.met);
  const canComplete = unmet.length === 0;
  const canRequestApproval =
    req.requiresClientApproval &&
    latestApproval?.status !== "PENDING" &&
    latestApproval?.status !== "APPROVED" &&
    Boolean(draftNotes) &&
    (!req.requiresMedia || stageMedia.length >= req.minMediaCount);
  // The client file opens on the `clients` key; link to it only for those who can open it.
  const canOpenClients = useHasPermission("clients");
  const isAdminActor = access ? access.admin : actorRole === "SUPER_ADMIN" || actorRole === "ADMIN";
  const canManage = access ? access.manage : sessionHasRole(actorRole, null, BESPOKE_MANAGER_ROLES);
  const canRecordMoney = access ? access.money : sessionHasRole(actorRole, null, BESPOKE_MANAGER_ROLES);
  // The stage gate engine's own role rule; the page does not offer what it will refuse.
  const roleMayWorkStage = stageRoleAllows(actorRole, order.currentStage);
  const isArchived = order.status === "ARCHIVED";
  const deliveryComplete = Boolean(order.deliveredAt);

  const seedNotesFromOrder = (next: OrderWithRelations) => {
    const seeded = notesDraftForStage(next.stageDrafts, next.currentStage);
    setNotes(seeded);
    savedNotesRef.current = seeded;
  };

  const persistNotes = useCallback(async (value: string) => {
    if (value === savedNotesRef.current) return;
    const res = await fetch(`/api/bespoke/${order.id}/stage-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: value }),
    });
    if (!res.ok) return;
    savedNotesRef.current = value;
    setOrder((o) => ({
      ...o,
      stageDrafts: [
        ...(o.stageDrafts ?? []).filter((d) => d.stage !== o.currentStage),
        ...(value.trim()
          ? [
              {
                id: `draft-${o.currentStage}`,
                orderId: o.id,
                stage: o.currentStage,
                notes: value,
                updatedById: null,
                updatedAt: new Date(),
              } satisfies OrderStageDraft,
            ]
          : []),
      ],
    }));
  }, [order.id]);

  useEffect(() => {
    if (notes === savedNotesRef.current) return;
    const t = window.setTimeout(() => {
      void persistNotes(notes);
    }, 800);
    return () => window.clearTimeout(t);
  }, [notes, persistNotes]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (notes !== savedNotesRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [notes]);

  const handleUpload = async (files: FileList | null, type: "images" | "videos") => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const folder = type === "videos" ? "bespoke-videos" : "bespoke-stages";
        urls.push(
          type === "videos"
            ? await uploadAdminVideo(file, folder)
            : await uploadAdminAsset(file, folder),
        );
      }
      const mediaRes = await fetch(`/api/bespoke/${order.id}/stage-media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, kind: type === "videos" ? "VIDEO" : "IMAGE" }),
      });
      if (!mediaRes.ok) throw new Error("Stage media save failed");
      const mediaData = (await mediaRes.json()) as { items?: OrderStageMedia[] };
      const persisted = mediaData.items ?? [];
      setOrder((o) => mergeStageMedia(o, persisted));
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
      // BD6: taken at the session, these are this commission's measurements (and her latest).
      if (order.currentStage === "CONSULTATION_SESSION" && measurementsDraft) {
        await patchCommissionMeasurements(order.id, measurementsDraft);
      }
      const res = await fetch(`/api/bespoke/${order.id}/complete-stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, images, videos }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string; failures?: { message: string }[] };
        throw new Error(err.failures?.map((f) => f.message).join(" · ") || err.error || "Failed");
      }
      const data = (await res.json()) as { item: OrderWithRelations };
      setOrder((o) => ({ ...o, ...data.item }));
      seedNotesFromOrder(data.item);
      setImages([]);
      setVideos([]);
      setConfirmOpen(false);
      toast.success("Stage completed — client emailed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete stage");
    } finally {
      setCompleting(false);
    }
  };

  const requestApproval = async () => {
    setRequestingApproval(true);
    try {
      const res = await fetch(`/api/bespoke/${order.id}/request-approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, images, videos }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string; failures?: { message: string }[] };
        throw new Error(err.failures?.map((f) => f.message).join(" · ") || err.error || "Failed");
      }
      const data = (await res.json()) as { approval?: StageApproval };
      if (data.approval) {
        setOrder((o) => ({
          ...o,
          stageApprovals: [data.approval!, ...(o.stageApprovals ?? []).filter((a) => a.id !== data.approval!.id)],
        }));
      }
      toast.success("Client approval requested");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not request approval");
    } finally {
      setRequestingApproval(false);
    }
  };

  const revertStage = async () => {
    if (!revertTarget || !revertReason.trim()) return;
    setReverting(true);
    try {
      const res = await fetch(`/api/bespoke/${order.id}/revert-stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStage: revertTarget, reason: revertReason }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string; failures?: { message: string }[] };
        throw new Error(err.failures?.map((f) => f.message).join(" · ") || err.error || "Failed");
      }
      const data = (await res.json()) as { item?: OrderWithRelations };
      if (data.item) {
        setOrder((o) => ({ ...o, ...data.item! }));
        seedNotesFromOrder(data.item);
      }
      toast.success("Stage reverted");
      setRevertOpen(false);
      setRevertReason("");
      setRevertTarget("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not revert");
    } finally {
      setReverting(false);
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

  return (
    <div className="space-y-8">
      <Link href="/admin/bespoke" className="font-sans text-11px uppercase text-text-light hover:text-nut">
        ← Orders pipeline
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 glass-1 glass-panel px-5 py-4">
        <div>
          <h1 className="font-display text-2xl text-ink">{title?.text ?? order.orderRef}</h1>
          <p className="mt-1 font-sans text-sm text-text-mid">
            {order.orderRef} · {order.clientName}
          </p>
          <a
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block font-sans text-xs text-nut underline"
          >
            Public tracking link
          </a>
        </div>
        <div className="flex flex-col items-end gap-2">
          {isArchived ? (
            <span className="rounded-full bg-sand px-3 py-1 font-sans text-10px font-semibold uppercase tracking-wide text-text-mid">
              Archived
            </span>
          ) : deliveryComplete ? (
            <span className="rounded-full bg-lightbr/15 px-3 py-1 font-sans text-10px font-semibold uppercase tracking-wide text-nut">
              Delivered
            </span>
          ) : null}
          <BadgeStage stage={order.currentStage} />
          {isAdminActor ? <CommissionDeleteControl orderId={order.id} orderRef={order.orderRef} /> : null}
        </div>
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
          <NotesStream
            endpoint={`/api/bespoke/${order.id}/notes`}
            sections={[...NOTE_SECTIONS]}
            defaultSection="brief"
            canAdd={canManage && !isArchived}
            title="Notes"
            intro="Call summaries and changes she asks for. The consultation record and the brief are never rewritten by a note."
          />

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
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-11px font-semibold",
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
                          <p key={a.id} className="mt-1 font-sans text-11px text-text-light">
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
                    <p className="mt-1 font-sans text-11px text-text-light">
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
            {isArchived ? (
              <>
                <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-text-light">
                  Archived
                </h2>
                <p className="mt-3 font-sans text-sm text-text-mid">
                  This commission is archived and read-only. Complete and revert are closed.
                </p>
                {order.archivedReason ? (
                  <p className="mt-2 font-sans text-sm text-text-light">{order.archivedReason}</p>
                ) : null}
              </>
            ) : deliveryComplete ? (
              <>
                <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-text-light">
                  Delivery complete
                </h2>
                <p className="mt-3 font-sans text-sm text-text-mid">
                  Marked delivered {order.deliveredAt ? formatDate(order.deliveredAt) : ""}. Waiting
                  for the client to confirm receipt, then the alteration window.
                </p>
                {order.receiptConfirmedAt ? (
                  <p className="mt-2 font-sans text-sm text-nut">
                    Receipt confirmed {formatDate(order.receiptConfirmedAt)}.
                  </p>
                ) : null}
              </>
            ) : (
              <>
            <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-text-light">
              Complete current stage — {STAGE_LABELS[order.currentStage]}
            </h2>
            <div className="mt-4">
              <p className="font-sans text-11px font-semibold uppercase tracking-wider text-text-light">
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
                  <option value="PATTERN_CUTTER">Pattern cutter</option>
                  <option value="BEADER">Beader</option>
                  <option value="DESIGNER">Designer</option>
                </select>
                <Button size="sm" variant="secondary" onClick={() => void assignStaff()}>
                  Add staff
                </Button>
              </div>
            </div>
            <ul className="mt-4 space-y-1.5">
              {checklist.map((item) => (
                <li
                  key={item.key}
                  className={cn(
                    "flex items-start gap-2 font-sans text-xs",
                    item.tone === "not_required"
                      ? "text-text-light"
                      : item.tone === "done"
                        ? "text-ink"
                        : "text-warning",
                  )}
                >
                  <span aria-hidden>{item.mark === "tick" ? "✓" : item.mark === "open" ? "○" : "–"}</span>
                  <span>{item.displayLabel}</span>
                </li>
              ))}
            </ul>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => void persistNotes(notes)}
              placeholder="Stage notes for the client (required)…"
              rows={4}
              className="mt-4 w-full rounded border border-sand px-3 py-2 font-sans text-sm"
            />
            {order.currentStage === "CONSULTATION_SESSION" && !order.measurementsHidden ? (
              <div className="mt-4">
                <p className="font-sans text-11px text-text-mid">
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
            <div className="mt-4 flex flex-wrap gap-2">
              {req.requiresClientApproval ? (
                <Button
                  variant="secondary"
                  loading={requestingApproval}
                  disabled={!canRequestApproval}
                  onClick={() => void requestApproval()}
                >
                  Request client approval
                </Button>
              ) : null}
              <Button
                disabled={!canComplete || !roleMayWorkStage}
                onClick={() => setConfirmOpen(true)}
              >
                Mark Stage Complete
              </Button>
              {isAdminActor ? (
                <Button variant="ghost" onClick={() => setRevertOpen(true)}>
                  Revert stage
                </Button>
              ) : null}
            </div>
            {!roleMayWorkStage ? (
              <p className="mt-2 font-sans text-11px text-text-light">
                Your role can follow this commission but not complete its stages.
              </p>
            ) : !canComplete ? (
              <p className="mt-2 font-sans text-11px text-text-light">
                Complete the checklist above. The server will still refuse if anything is missing.
              </p>
            ) : null}
              </>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <CommissionIdentityPanel
            orderId={order.id}
            composedTitle={title?.composed ?? order.orderRef}
            canEdit={canManage && !isArchived}
            initial={{
              title: order.title ?? null,
              garmentTypeId: order.garmentTypeId ?? null,
              occasionDetails: order.occasionDetails ?? null,
              eventDate: order.eventDate ? new Date(order.eventDate).toISOString() : null,
              clientLocation: order.clientLocation ?? null,
              eventLocation: order.eventLocation ?? null,
            }}
          />

          {order.measurementsHidden ? (
            <LockedSection title="Measurements" reason="Measurements are kept for managers and the tailor or pattern cutter on this gown." />
          ) : (
            <CommissionMeasurementsCard orderId={order.id} clientId={order.clientProfileId} clientName={order.clientName} />
          )}

          <section className="card-surface p-6">
            <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-text-light">Client</h2>
            <dl className="mt-4 space-y-2 font-sans text-sm">
              <div>
                <dt className="text-text-light">Name</dt>
                <dd>
                  {order.clientProfileId && canOpenClients ? (
                    <Link href={`/admin/clients/${order.clientProfileId}`} className="underline hover:text-nut">
                      {order.clientName}
                    </Link>
                  ) : (
                    order.clientName
                  )}
                </dd>
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
            </dl>
          </section>

          <CommissionSpecPanel
            orderId={order.id}
            initialSpec={specificationRows(order.features ?? [])}
            initialDeliveryDate={order.deliveryDate}
            canEdit={canManage}
          />

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

          {!canRecordMoney && order.paymentsHidden ? (
            <LockedSection title="Price and balance" reason="The price agreed, payments and the balance are kept for managers and finance." />
          ) : (
          <section className="card-surface p-6">
            <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-text-light">Payment</h2>
            <dl className="mt-3 space-y-1 font-sans text-sm">
              <div className="flex justify-between">
                <dt>Total</dt>
                <dd>{formatNgnKobo(order.totalAmount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Paid</dt>
                <dd>{formatNgnKobo(order.amountPaid)}</dd>
              </div>
              <div className="flex justify-between font-medium text-nut">
                <dt>Balance</dt>
                <dd>{formatNgnKobo(order.balance)}</dd>
              </div>
              {order.productionUnlockedAt ? (
                <div className="flex justify-between text-xs text-text-light">
                  <dt>Production unlocked</dt>
                  <dd>{formatDate(order.productionUnlockedAt)}</dd>
                </div>
              ) : (
                <div className="pt-1 text-xs text-warning">Deposit not yet satisfied — production locked</div>
              )}
            </dl>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse font-sans text-xs">
                <thead>
                  <tr className="border-b border-sand text-left text-10px font-medium uppercase tracking-wide text-text-light">
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
                        {order.paymentsHidden ? "Payments are visible to managers and finance." : "No ledger payments yet."}
                      </td>
                    </tr>
                  ) : (
                    (order.payments ?? []).map((p) => (
                      <tr key={p.id} className="border-b border-sand last:border-0">
                        <td className="py-2 pr-2 whitespace-nowrap">
                          {formatDate(p.confirmedAt ?? p.createdAt)}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {formatNgnKobo(ledgerAmount(p))}
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
            {canRecordMoney ? (
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
            ) : null}
          </section>

          )}

          <SpecificationPanel
            orderId={order.id}
            mayIssue={canManage}
            staffList={staffList.map((st) => ({ userId: st.userId, name: st.name }))}
            actorUserId={actorUserId ?? null}
            archived={isArchived}
          />

          {access?.materialCost || access?.labourCost ? (
            <CostPanel
              orderId={order.id}
              canDraftLabour={Boolean(access?.labourCost)}
              assignments={order.assignments.map((a) => ({
                id: a.id,
                role: a.role,
                name: a.staffProfile.user.name ?? a.staffProfile.user.email ?? "Staff",
              }))}
            />
          ) : null}
        </div>
      </div>

      <Modal open={revertOpen} onClose={() => setRevertOpen(false)} title="Revert to an earlier stage">
        <p className="font-sans text-sm text-text-mid">
          Staff cannot reverse a stage. This is logged with your reason.
        </p>
        <select
          value={revertTarget}
          onChange={(e) => setRevertTarget(e.target.value as BespokeStage | "")}
          className="mt-4 w-full rounded border border-sand px-3 py-2 font-sans text-sm"
        >
          <option value="">Select earlier stage…</option>
          {STAGE_ORDER.filter((s) => STAGE_ORDER.indexOf(s) < STAGE_ORDER.indexOf(order.currentStage)).map(
            (s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ),
          )}
        </select>
        <textarea
          value={revertReason}
          onChange={(e) => setRevertReason(e.target.value)}
          placeholder="Reason (required)"
          rows={3}
          className="mt-3 w-full rounded border border-sand px-3 py-2 font-sans text-sm"
        />
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRevertOpen(false)}>
            Cancel
          </Button>
          <Button
            loading={reverting}
            disabled={!revertTarget || !revertReason.trim()}
            onClick={() => void revertStage()}
          >
            Revert
          </Button>
        </div>
      </Modal>

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
    <span className="rounded-full bg-nut/10 px-3 py-1 font-sans text-10px font-semibold uppercase tracking-wide text-nut">
      Stage {getStageProgress(stage)}/13
    </span>
  );
}
