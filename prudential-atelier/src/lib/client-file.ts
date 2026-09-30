import { Prisma, type BespokeStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BESPOKE_MANAGER_ROLES, sessionHasRole } from "@/lib/bespoke-roles";
import { MEASUREMENT_ASSIGNMENT_ROLES, canSeePaymentDetails } from "@/lib/bespoke-data-access";
import { STAGE_SHORT_LABELS } from "@/lib/bespoke-stages";
import { parseSnapshot } from "@/lib/custom-size";
import { specificationInclude, specificationRows } from "@/lib/atelier/construction-features";
import type { AdminPermission } from "@/lib/roles";

/**
 * Slice BC1 — the client file: everything about her gown on one page.
 *
 * The page composes what a viewer may already see; it never widens it. Each
 * section is decided here, at the API, from the same rules the rest of the
 * house uses:
 *   - reaching the file: the `clients` key (the /admin/clients page gate), or a
 *     workroom assignment on one of her commissions (then only those commissions,
 *     and only what the staff portal already shows for them);
 *   - measurements: AZ8 — managers, and the tailor or pattern cutter on her gown;
 *   - payments and receipts: AZ8 — managers and finance, never STAFF;
 *   - consultation notes: the `consultations` key;
 *   - the quotation: the `quotations` key, or a money role.
 * A section the viewer may not see is sent as `{ visible: false, reason }` —
 * never its data — so the page can say it exists and is not theirs.
 */

export const FILE_SECTIONS = [
  "consultation",
  "measurements",
  "specification",
  "quotation",
  "payments",
  "illustrations",
  "making",
  "delivery",
] as const;
export type FileSection = (typeof FILE_SECTIONS)[number];

export function isFileSection(value: string | null | undefined): value is FileSection {
  return (FILE_SECTIONS as readonly string[]).includes(value ?? "");
}

export type FileViewer = {
  userId: string | null;
  /** Effective role (preview / "view as" already applied). */
  role: string | null;
  email: string | null;
  /** Slice T resolved permission check, grants and revokes applied. */
  allows: (permission: AdminPermission) => boolean;
  /** This viewer's workroom assignments on this client's commissions. */
  assignments: { orderId: string; role: string }[];
};

export type FileAccess = {
  admitted: boolean;
  /** house: every commission; workroom: only the ones she is assigned to. */
  scope: "house" | "workroom" | "none";
  /** Contact details and address. */
  contact: boolean;
  sections: Record<FileSection, boolean>;
};

export const HIDDEN_REASONS: Record<FileSection, string> = {
  consultation: "Consultation notes are kept for the consultations desk.",
  measurements: "Measurements are kept for managers and the tailor or pattern cutter on this gown.",
  specification: "The specification is kept for the house and the workroom on this gown.",
  quotation: "The quotation is kept for those who hold quotations or handle money.",
  payments: "Payments and receipts are kept for managers and finance.",
  illustrations: "Illustrations are kept for the house and the workroom on this gown.",
  making: "The workroom list is kept for the house and the workroom on this gown.",
  delivery: "Delivery is kept for the house and the workroom on this gown.",
};

/** Pure: who sees which section. Mirrors AZ8 and Slice T; adds nothing. */
export function clientFileAccess(v: FileViewer): FileAccess {
  const house = v.allows("clients");
  const workroom = !house && v.assignments.length > 0;
  const admitted = house || workroom;
  const manager = sessionHasRole(v.role, v.email, BESPOKE_MANAGER_ROLES);
  const cutter = v.assignments.some((a) => MEASUREMENT_ASSIGNMENT_ROLES.includes(a.role));
  const money = canSeePaymentDetails({ role: v.role, email: v.email });

  return {
    admitted,
    scope: house ? "house" : workroom ? "workroom" : "none",
    contact: house,
    sections: {
      // Workroom: the brief and moodboard copied onto her commission, as the staff portal shows today.
      consultation: admitted && (house ? v.allows("consultations") : true),
      measurements: admitted && (manager || cutter),
      specification: admitted,
      quotation: house && (v.allows("quotations") || money),
      payments: admitted && money,
      illustrations: admitted,
      making: admitted,
      delivery: admitted,
    },
  };
}

/** The words the house uses for the workroom stages. */
export const WORKROOM_STAGE_WORDS: Partial<Record<BespokeStage, string>> = {
  TAILORING: "Cutting & sewing",
  BEADING_FINISHING: "Beading & finishing",
};

export function workroomStageLabel(stage: BespokeStage | null | undefined): string | null {
  if (!stage) return null;
  return WORKROOM_STAGE_WORDS[stage] ?? STAGE_SHORT_LABELS[stage];
}

export const ASSIGNMENT_ROLE_LABELS: Record<string, string> = {
  TAILOR: "Tailor",
  PATTERN_CUTTER: "Pattern cutter",
  BEADER: "Beader",
  DESIGNER: "Designer",
};

export function assignmentRoleLabel(role: string): string {
  return ASSIGNMENT_ROLE_LABELS[role] ?? role.charAt(0) + role.slice(1).toLowerCase().replace(/_/g, " ");
}

type Hidden = { visible: false; reason: string };
type Shown<T> = { visible: true; data: T };
export type SectionPayload<T> = Hidden | Shown<T>;

function hidden(section: FileSection): Hidden {
  return { visible: false, reason: HIDDEN_REASONS[section] };
}

export type ComposeResult =
  | { status: 200; body: Record<string, unknown> }
  | { status: 403 | 404; body: { error: string; section?: FileSection; reason?: string } };

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

async function viewerAssignments(userId: string | null, clientProfileId: string) {
  if (!userId) return [];
  const rows = await prisma.orderAssignment.findMany({
    where: { staffProfile: { userId }, order: { clientProfileId } },
    select: { orderId: true, role: true },
  });
  return rows;
}

/**
 * Build the file for one viewer. With `section`, return only that section and
 * refuse (403) when the viewer is not entitled to it.
 */
export async function composeClientFile(
  viewer: Omit<FileViewer, "assignments">,
  clientProfileId: string,
  section?: FileSection,
): Promise<ComposeResult> {
  const client = await prisma.clientProfile.findUnique({
    where: { id: clientProfileId },
    select: {
      id: true,
      userId: true,
      loyaltyTier: true,
      user: { select: { name: true, email: true, phone: true } },
    },
  });
  if (!client) return { status: 404, body: { error: "Not found" } };

  const assignments = await viewerAssignments(viewer.userId, client.id);
  const access = clientFileAccess({ ...viewer, assignments });
  if (!access.admitted) return { status: 403, body: { error: "Forbidden" } };
  if (section && !access.sections[section]) {
    return { status: 403, body: { error: "Forbidden", section, reason: HIDDEN_REASONS[section] } };
  }

  const wanted = (s: FileSection) => access.sections[s] && (!section || section === s);
  const workroomOrderIds = Array.from(new Set(assignments.map((a) => a.orderId)));
  const orderWhere =
    access.scope === "house"
      ? { clientProfileId: client.id }
      : { clientProfileId: client.id, id: { in: workroomOrderIds } };

  const commissions = await prisma.bespokeOrder.findMany({
    where: orderWhere,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      orderRef: true,
      currentStage: true,
      status: true,
      createdAt: true,
      consultationId: true,
      quotationId: true,
    },
  });
  const orderIds = commissions.map((c) => c.id);
  const refOf = new Map(commissions.map((c) => [c.id, c.orderRef]));

  const sections: Partial<Record<FileSection, SectionPayload<unknown>>> = {};
  for (const s of FILE_SECTIONS) {
    if (!section || section === s) sections[s] = hidden(s);
  }

  if (wanted("consultation")) {
    sections.consultation = { visible: true, data: await loadConsultation(access.scope, client, orderIds, refOf) };
  }
  if (wanted("measurements")) {
    sections.measurements = { visible: true, data: await loadMeasurements(client.id, client.userId) };
  }
  if (wanted("specification")) {
    const rows = await prisma.bespokeOrder.findMany({
      where: { id: { in: orderIds } },
      orderBy: { createdAt: "asc" },
      select: { id: true, outfitDescription: true, ...specificationInclude },
    });
    sections.specification = {
      visible: true,
      data: rows.map((r) => ({
        orderId: r.id,
        orderRef: refOf.get(r.id),
        description: r.outfitDescription,
        features: specificationRows(r.features),
      })),
    };
  }
  if (wanted("quotation")) {
    const quotes = await prisma.quotation.findMany({
      where: { bespokeOrders: { some: { id: { in: orderIds } } } },
      select: {
        id: true,
        quoteRef: true,
        version: true,
        status: true,
        currency: true,
        total: true,
        depositPercent: true,
        lineItems: true,
        notes: true,
        sentAt: true,
        approvedAt: true,
        expectedDeliveryDate: true,
        bespokeOrders: { select: { id: true } },
      },
    });
    const firstOrder = (q: { bespokeOrders: { id: string }[] }) =>
      Math.min(...q.bespokeOrders.map((o) => orderIds.indexOf(o.id)).filter((i) => i >= 0));
    quotes.sort((a, b) => firstOrder(a) - firstOrder(b));
    sections.quotation = {
      visible: true,
      data: quotes.map((q) => ({
        orderRefs: q.bespokeOrders.map((o) => refOf.get(o.id)).filter(Boolean),
        quoteRef: q.quoteRef,
        version: q.version,
        status: q.status,
        currency: q.currency,
        total: q.total,
        depositPercent: q.depositPercent,
        lines: quoteLines(q.lineItems),
        notes: q.notes,
        sentAt: iso(q.sentAt),
        agreedAt: iso(q.approvedAt),
        expectedDeliveryDate: iso(q.expectedDeliveryDate),
      })),
    };
  }
  if (wanted("payments")) {
    const rows = await prisma.bespokeOrder.findMany({
      where: { id: { in: orderIds } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        currency: true,
        totalAmount: true,
        amountPaid: true,
        balance: true,
        payments: {
          orderBy: { createdAt: "desc" },
          select: {
            reference: true,
            amount: true,
            currency: true,
            purpose: true,
            status: true,
            receiptUrl: true,
            createdAt: true,
            confirmedAt: true,
          },
        },
      },
    });
    sections.payments = {
      visible: true,
      data: rows.map((r) => ({
        orderRef: refOf.get(r.id),
        totalNGN: r.totalAmount,
        paidNGN: r.amountPaid,
        balanceNGN: r.balance,
        payments: r.payments.map((p) => ({
          reference: p.reference,
          amount: Number(p.amount),
          currency: p.currency,
          purpose: p.purpose,
          status: p.status,
          receiptUrl: p.receiptUrl,
          createdAt: iso(p.createdAt),
          confirmedAt: iso(p.confirmedAt),
        })),
      })),
    };
  }
  if (wanted("illustrations")) {
    const rows = await prisma.bespokeOrder.findMany({
      where: { id: { in: orderIds } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        stageMedia: {
          where: { stage: "SKETCHING_CONCEPT" },
          orderBy: { createdAt: "asc" },
          select: { id: true, url: true, kind: true, createdAt: true },
        },
        stageApprovals: {
          where: { stage: "DESIGN_APPROVAL", status: { not: "SUPERSEDED" } },
          orderBy: { requestedAt: "desc" },
          take: 1,
          select: { status: true, requestedAt: true, respondedAt: true, clientComment: true },
        },
      },
    });
    sections.illustrations = {
      visible: true,
      data: rows.map((r) => {
        const approval = r.stageApprovals[0];
        return {
          orderRef: refOf.get(r.id),
          sketches: r.stageMedia.map((m) => ({ id: m.id, url: m.url, kind: m.kind, uploadedAt: iso(m.createdAt) })),
          designApproval: approval
            ? {
                status: approval.status,
                requestedAt: iso(approval.requestedAt),
                respondedAt: iso(approval.respondedAt),
                clientComment: approval.clientComment,
              }
            : { status: "NOT_REQUESTED" as const },
        };
      }),
    };
  }
  if (wanted("making")) {
    const rows = await prisma.orderAssignment.findMany({
      where: {
        orderId: { in: orderIds },
        // Workroom viewers see their own place on the gown, as the staff portal shows today.
        ...(access.scope === "workroom" && viewer.userId ? { staffProfile: { userId: viewer.userId } } : {}),
      },
      orderBy: { assignedAt: "asc" },
      select: {
        orderId: true,
        role: true,
        stage: true,
        assignedAt: true,
        staffProfile: { select: { user: { select: { name: true, email: true } } } },
      },
    });
    sections.making = {
      visible: true,
      data: commissions.map((c) => ({
        orderRef: c.orderRef,
        currentStage: c.currentStage,
        currentStageLabel: workroomStageLabel(c.currentStage),
        people: rows
          .filter((r) => r.orderId === c.id)
          .map((r) => ({
            name: r.staffProfile.user.name ?? r.staffProfile.user.email ?? "Staff",
            role: r.role,
            roleLabel: assignmentRoleLabel(r.role),
            stage: r.stage,
            stageLabel: workroomStageLabel(r.stage ?? c.currentStage),
            assignedAt: iso(r.assignedAt),
          })),
      })),
    };
  }
  if (wanted("delivery")) {
    const rows = await prisma.bespokeOrder.findMany({
      where: { id: { in: orderIds } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        deliveryDate: true,
        deliveredAt: true,
        receiptConfirmedAt: true,
        clientLocation: true,
        eventLocation: true,
      },
    });
    const address = access.contact
      ? await prisma.address.findFirst({
          where: { userId: client.userId },
          orderBy: [{ isDefault: "desc" }, { id: "desc" }],
          select: { street: true, addressLine2: true, city: true, state: true, country: true, postalCode: true },
        })
      : null;
    sections.delivery = {
      visible: true,
      data: rows.map((r) => ({
        orderRef: refOf.get(r.id),
        expectedDate: iso(r.deliveryDate),
        deliveredAt: iso(r.deliveredAt),
        receiptConfirmedAt: iso(r.receiptConfirmedAt),
        confirmation: deliveryConfirmation(r),
        address: access.contact
          ? {
              saved: address
                ? [address.street, address.addressLine2, address.city, address.state, address.postalCode, address.country]
                    .filter(Boolean)
                    .join(", ")
                : null,
              clientLocation: r.clientLocation,
              eventLocation: r.eventLocation,
            }
          : null,
      })),
    };
  }

  const name = client.user.name ?? "";
  return {
    status: 200,
    body: {
      client: {
        id: client.id,
        firstName: name.split(/\s+/)[0] || null,
        ...(access.contact
          ? { name: client.user.name, email: client.user.email, phone: client.user.phone, loyaltyTier: client.loyaltyTier }
          : {}),
      },
      scope: access.scope,
      contactHidden: !access.contact,
      commissions: commissions.map((c) => ({
        id: c.id,
        orderRef: c.orderRef,
        currentStage: c.currentStage,
        currentStageLabel: workroomStageLabel(c.currentStage),
        status: c.status,
        createdAt: iso(c.createdAt),
      })),
      sections,
    },
  };
}

export function deliveryConfirmation(r: {
  deliveryDate: Date | null;
  deliveredAt: Date | null;
  receiptConfirmedAt: Date | null;
}): "RECEIPT_CONFIRMED" | "DELIVERED_AWAITING_CLIENT" | "DATE_SET" | "NO_DATE" {
  if (r.receiptConfirmedAt) return "RECEIPT_CONFIRMED";
  if (r.deliveredAt) return "DELIVERED_AWAITING_CLIENT";
  if (r.deliveryDate) return "DATE_SET";
  return "NO_DATE";
}

function quoteLines(raw: unknown): { description: string; quantity: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const r = (row ?? {}) as { description?: unknown; quantity?: unknown };
      return { description: String(r.description ?? "").trim(), quantity: Number(r.quantity) || 1 };
    })
    .filter((l) => l.description);
}

async function loadConsultation(
  scope: FileAccess["scope"],
  client: { id: string; userId: string; user: { email: string } },
  orderIds: string[],
  refOf: Map<string, string>,
) {
  if (scope === "workroom") {
    const rows = await prisma.bespokeOrder.findMany({
      where: { id: { in: orderIds } },
      orderBy: { createdAt: "asc" },
      select: { id: true, occasionType: true, occasionDetails: true, outfitBrief: true, sessionNotes: true, moodboardImages: true },
    });
    return {
      bookings: [],
      enquiries: [],
      moodboards: [],
      briefs: rows.map((r) => ({
        orderRef: refOf.get(r.id),
        occasion: r.occasionDetails ?? r.occasionType,
        brief: r.outfitBrief ?? r.sessionNotes,
        moodboardImages: r.moodboardImages,
      })),
    };
  }

  const email = client.user.email;
  const [bookings, enquiries, moodboards] = await Promise.all([
    prisma.consultationBooking.findMany({
      where: { OR: [{ userId: client.userId }, { clientEmail: { equals: email, mode: "insensitive" } }] },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        bookingNumber: true,
        status: true,
        occasion: true,
        description: true,
        referenceImages: true,
        confirmedDate: true,
        confirmedTime: true,
        completedAt: true,
        sessionNotes: true,
        moodboardImages: true,
        moodboardNotes: true,
        consultant: { select: { name: true } },
        createdAt: true,
      },
    }),
    prisma.consultationEnquiry.findMany({
      where: { clientEmail: { equals: email, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      select: { enquiryNumber: true, eventDate: true, eventType: true, notes: true, moodboardImages: true, createdAt: true },
    }),
    prisma.moodboard.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, images: true, notes: true, createdAt: true },
    }),
  ]);

  return {
    bookings: bookings.map((b) => ({
      id: b.id,
      bookingNumber: b.bookingNumber,
      status: b.status,
      consultant: b.consultant.name,
      date: iso(b.confirmedDate),
      time: b.confirmedTime,
      completedAt: iso(b.completedAt),
      occasion: b.occasion,
      discussed: b.description,
      referenceImages: b.referenceImages,
      sessionNotes: b.sessionNotes,
      moodboardImages: b.moodboardImages,
      moodboardNotes: b.moodboardNotes,
      bookedAt: iso(b.createdAt),
    })),
    enquiries: enquiries.map((e) => ({
      enquiryNumber: e.enquiryNumber,
      eventDate: iso(e.eventDate),
      eventType: e.eventType,
      notes: e.notes,
      moodboardImages: e.moodboardImages,
      receivedAt: iso(e.createdAt),
    })),
    moodboards: moodboards.map((m) => ({ ...m, createdAt: iso(m.createdAt) })),
    briefs: [],
  };
}

const PROFILE_COLUMNS = [
  ["bust", "Bust"],
  ["waist", "Waist"],
  ["hips", "Hips"],
  ["shoulderWidth", "Shoulder"],
  ["sleeveLength", "Sleeve length"],
  ["dressLength", "Dress length"],
  ["thigh", "Thigh"],
  ["inseam", "Inseam"],
  ["neck", "Neck"],
  ["armhole", "Armhole"],
] as const;

async function loadMeasurements(clientProfileId: string, userId: string) {
  const [profile, fields, lines] = await Promise.all([
    prisma.measurement.findUnique({ where: { clientId: clientProfileId } }),
    prisma.measurementField.findMany({ select: { key: true, label: true } }),
    prisma.orderItem.findMany({
      where: { sizeMode: "CUSTOM", measurements: { not: Prisma.AnyNull }, order: { userId } },
      orderBy: { order: { createdAt: "desc" } },
      select: {
        measurements: true,
        product: { select: { name: true } },
        order: { select: { orderNumber: true, createdAt: true } },
      },
    }),
  ]);
  const labelOf = new Map(fields.map((f) => [f.key, f.label]));

  const profileRows: { key: string; label: string; value: number; unit: string }[] = [];
  if (profile) {
    for (const [key, label] of PROFILE_COLUMNS) {
      const value = profile[key];
      if (typeof value === "number") profileRows.push({ key, label, value, unit: profile.unit });
    }
    const extra = profile.values && typeof profile.values === "object" ? (profile.values as Record<string, unknown>) : {};
    for (const [key, value] of Object.entries(extra)) {
      const n = typeof value === "number" ? value : Number(value);
      if (Number.isFinite(n)) profileRows.push({ key, label: labelOf.get(key) ?? key, value: n, unit: "cm" });
    }
  }

  return {
    profile: profile
      ? {
          rows: profileRows,
          notes: profile.notes,
          firstRecordedAt: iso(profile.createdAt),
          lastUpdatedAt: iso(profile.updatedAt),
        }
      : null,
    orderLines: lines
      .map((l) => ({
        orderNumber: l.order.orderNumber,
        product: l.product.name,
        takenAt: iso(l.order.createdAt),
        rows: parseSnapshot(l.measurements).map((e) => ({
          key: e.key,
          label: e.label,
          value: e.typedValue,
          unit: e.typedUnit,
          valueCm: e.valueCm,
        })),
      }))
      .filter((l) => l.rows.length > 0),
  };
}
