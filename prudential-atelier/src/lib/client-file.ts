import { Prisma, type BespokeStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BESPOKE_MANAGER_ROLES, sessionHasRole } from "@/lib/bespoke-roles";
import { MEASUREMENT_ASSIGNMENT_ROLES, canSeePaymentDetails } from "@/lib/bespoke-data-access";
import { STAGE_SHORT_LABELS } from "@/lib/bespoke-stages";
import { parseSnapshot } from "@/lib/custom-size";
import { enquiryAnswerLines } from "@/lib/consultation-enquiry-shared";
import { specificationInclude, specificationRows } from "@/lib/atelier/construction-features";
import type { AdminPermission } from "@/lib/roles";
import { commissionTitle, occasionPhrase } from "@/lib/atelier/commission-list";
import { materialView, splitSpecification } from "@/lib/atelier/commission-materials";
import { commissionMeasurements } from "@/lib/atelier/commission-measurements";
import {
  atelierExtrasFrom,
  isAtelierFieldKey,
  measurementSheetRows,
  readAtelierMeasurementFields,
} from "@/lib/atelier/measurement-fields";
import { commissionCost } from "@/lib/atelier/commission-cost";
import { isProtectedAccount } from "@/lib/roles";
import { NOTE_SECTION_LABELS, isNoteSection, type NoteSection } from "@/lib/atelier/commission-notes-shared";

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
 *
 * Slice BD3 — the sections as the house named them on 12 October, in her order:
 * consultation, measurement, about the dress, production brief, quotation,
 * invoice, balance, beads needed, fabric type, illustration and mood board,
 * fitting and alteration, delivery. Plus who is making it, and what it costs
 * (the cost of production key only; never the workroom, never the client).
 */

export const FILE_SECTIONS = [
  "consultation",
  "measurements",
  "about",
  "brief",
  "quotation",
  "invoice",
  "balance",
  "beads",
  "fabric",
  "illustrations",
  "fitting",
  "making",
  "delivery",
  "cost",
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
  about: "What she asked for is kept for Prudent Gabriel and the workroom on this gown.",
  brief: "The production brief is kept for Prudent Gabriel and the workroom on this gown.",
  quotation: "The quotation is kept for those who hold quotations or handle money.",
  invoice: "Invoices are kept for those who hold invoices or handle money.",
  balance: "Payments and the balance are kept for managers and finance.",
  beads: "The beads are kept for Prudent Gabriel and the workroom on this gown.",
  fabric: "The fabric is kept for Prudent Gabriel and the workroom on this gown.",
  illustrations: "Illustrations are kept for Prudent Gabriel and the workroom on this gown.",
  fitting: "Fittings are kept for Prudent Gabriel and the workroom on this gown.",
  making: "The workroom list is kept for Prudent Gabriel and the workroom on this gown.",
  delivery: "Delivery is kept for Prudent Gabriel and the workroom on this gown.",
  cost: "What the gown costs to make is kept for cost of production.",
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
      about: admitted,
      brief: admitted,
      quotation: house && (v.allows("quotations") || money),
      invoice: house && (v.allows("invoices") || money),
      balance: admitted && money,
      beads: admitted,
      fabric: admitted,
      illustrations: admitted,
      fitting: admitted,
      making: admitted,
      delivery: admitted,
      cost: house && v.allows("production.cost"),
    },
  };
}

/**
 * "View as client" puts the viewer in her account: balances, measurements,
 * consultations, and acting in her name. So it opens only for an Admin or
 * Super Admin who already sees every section of her file.
 */
export function canViewAsClient(access: FileAccess, role: string | null | undefined): boolean {
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") return false;
  return access.scope === "house" && FILE_SECTIONS.every((s) => access.sections[s]);
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

/** One viewer's access to one client's file, workroom assignments included. */
export async function resolveClientFileAccess(
  viewer: Omit<FileViewer, "assignments">,
  clientProfileId: string,
): Promise<FileAccess> {
  const assignments = await viewerAssignments(viewer.userId, clientProfileId);
  return clientFileAccess({ ...viewer, assignments });
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
      clientName: true,
      title: true,
      occasionType: true,
      occasionDetails: true,
      deliveryDate: true,
    },
  });
  const orderIds = commissions.map((c) => c.id);
  const refOf = new Map(commissions.map((c) => [c.id, c.orderRef]));
  // BD2: notes sit beside the record they belong to, by section, oldest first.
  const notesBySection = await loadNotes(commissions);

  const sections: Partial<Record<FileSection, SectionPayload<unknown>>> = {};
  for (const s of FILE_SECTIONS) {
    if (!section || section === s) sections[s] = hidden(s);
  }

  if (wanted("consultation")) {
    const data = await loadConsultation(access.scope, client, orderIds, refOf);
    sections.consultation = {
      visible: true,
      data: { ...data, notes: commissions.flatMap((c) => notesBySection(c.id, "consultation")) },
    };
  }
  if (wanted("measurements")) {
    const [base, perCommission] = await Promise.all([
      loadMeasurements(client.id, client.userId),
      prisma.bespokeOrder.findMany({
        where: { id: { in: orderIds } },
        orderBy: { createdAt: "asc" },
        select: { id: true, measurementsSnapshot: true, measurementsTakenAt: true },
      }),
    ]);
    const profileRow = await prisma.measurement.findUnique({ where: { clientId: client.id } });
    sections.measurements = {
      visible: true,
      data: {
        ...base,
        // BD6: what each commission is cut to; "client" means not yet taken for it.
        commissions: perCommission.map((o) => {
          const m = commissionMeasurements(o, profileRow);
          return { orderRef: refOf.get(o.id), source: m.source, takenAt: m.takenAt };
        }),
      },
    };
  }
  if (wanted("about") || wanted("brief")) {
    const rows = await prisma.bespokeOrder.findMany({
      where: { id: { in: orderIds } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        outfitDescription: true,
        outfitBrief: true,
        sessionNotes: true,
        occasionType: true,
        occasionDetails: true,
        garmentType: { select: { label: true } },
        ...specificationInclude,
      },
    });
    if (wanted("about")) {
      sections.about = {
        visible: true,
        data: rows.map((r) => ({
          orderRef: refOf.get(r.id),
          occasion: occasionPhrase(r),
          garment: r.garmentType?.label ?? null,
          description: r.outfitDescription,
          features: specificationRows(r.features),
          notes: notesBySection(r.id, "about_dress"),
        })),
      };
    }
    if (wanted("brief")) {
      // The brief is the running story of the gown: notes added to it, and the
      // note left at every pipeline step, in the order they happened.
      const stageNotes = await prisma.stageUpdate.findMany({
        where: { orderId: { in: orderIds }, notes: { not: null } },
        orderBy: { completedAt: "asc" },
        select: { orderId: true, stage: true, notes: true, completedAt: true, completedByName: true },
      });
      sections.brief = {
        visible: true,
        data: rows.map((r) => {
          const fromStages: FileNote[] = stageNotes
            .filter((s) => s.orderId === r.id && s.notes?.trim())
            .map((s) => ({
              section: "brief",
              sectionLabel: workroomStageLabel(s.stage) ?? s.stage,
              body: s.notes!.trim(),
              authorName: s.completedByName ?? "Prudent Gabriel",
              createdAt: s.completedAt.toISOString(),
              corrected: false,
              correction: false,
              stage: true,
            }));
          return {
            orderId: r.id,
            orderRef: refOf.get(r.id),
            brief: r.outfitBrief ?? r.sessionNotes,
            notes: [...notesBySection(r.id, "brief"), ...fromStages].sort((a, b) =>
              a.createdAt.localeCompare(b.createdAt),
            ),
          };
        }),
      };
    }
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
  if (wanted("invoice")) {
    const quoteIds = commissions.map((c) => c.quotationId).filter((v): v is string => Boolean(v));
    const invoices = quoteIds.length
      ? await prisma.invoice.findMany({
          where: { quotationId: { in: quoteIds } },
          orderBy: { createdAt: "asc" },
          select: {
            invoiceNumber: true,
            status: true,
            currency: true,
            total: true,
            depositRequired: true,
            balanceDue: true,
            dueDate: true,
            paidAt: true,
            createdAt: true,
            quotationId: true,
          },
        })
      : [];
    // Every commission is listed: one with no invoice says so in words (BD: "No invoice raised yet").
    sections.invoice = {
      visible: true,
      data: commissions.map((c) => ({
        orderRef: c.orderRef,
        invoices: invoices
          .filter((i) => i.quotationId && i.quotationId === c.quotationId)
          .map((i) => ({
            invoiceNumber: i.invoiceNumber,
            status: i.status,
            currency: i.currency,
            total: i.total,
            depositRequired: i.depositRequired,
            balanceDue: i.balanceDue,
            dueDate: iso(i.dueDate),
            paidAt: iso(i.paidAt),
            raisedAt: iso(i.createdAt),
          })),
      })),
    };
  }
  if (wanted("balance")) {
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
    sections.balance = {
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
        moodboardImages: true,
        consultation: { select: { referenceImages: true, enquiry: { select: { moodboardImages: true } } } },
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
    // BD3: illustration and mood board are one section, two sources — what she
    // uploaded with her enquiry and booking, and boards the house made itself.
    const houseBoards = await prisma.moodboard.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, images: true, notes: true, createdAt: true },
    });
    sections.illustrations = {
      visible: true,
      data: {
        houseMoodboards: houseBoards.map((m) => ({ ...m, createdAt: iso(m.createdAt) })),
        commissions: rows.map((r) => {
        const approval = r.stageApprovals[0];
        const hers = Array.from(
          new Set([...(r.consultation?.enquiry?.moodboardImages ?? []), ...(r.consultation?.referenceImages ?? [])]),
        );
        return {
          orderRef: refOf.get(r.id),
          herUploads: hers,
          sessionMoodboard: r.moodboardImages,
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
      },
    };
  }
  if (wanted("beads") || wanted("fabric")) {
    const rows = await prisma.material.findMany({ where: { orderId: { in: orderIds } }, orderBy: { createdAt: "asc" } });
    const byOrder = (id: string) =>
      splitSpecification(rows.filter((m) => m.orderId === id).map((m) => materialView(m, false)));
    if (wanted("beads")) {
      sections.beads = {
        visible: true,
        data: commissions.map((c) => ({ orderRef: c.orderRef, items: byOrder(c.id).beads, notes: notesBySection(c.id, "beads") })),
      };
    }
    if (wanted("fabric")) {
      sections.fabric = {
        visible: true,
        data: commissions.map((c) => ({ orderRef: c.orderRef, items: byOrder(c.id).fabric, notes: notesBySection(c.id, "fabric") })),
      };
    }
  }
  if (wanted("fitting")) {
    const FITTING_STAGES: BespokeStage[] = ["FIRST_FITTING", "ALTERATIONS", "FINAL_FITTING"];
    const rows = await prisma.bespokeOrder.findMany({
      where: { id: { in: orderIds } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        stageCompletions: { where: { stage: { in: FITTING_STAGES }, revertedAt: null }, select: { stage: true, completedAt: true } },
        stageHistory: {
          where: { stage: { in: FITTING_STAGES } },
          orderBy: { completedAt: "asc" },
          select: { stage: true, notes: true, completedAt: true, completedByName: true, images: true },
        },
        alterationRequests: {
          orderBy: { createdAt: "asc" },
          select: { description: true, reason: true, status: true, createdAt: true },
        },
      },
    });
    sections.fitting = {
      visible: true,
      data: rows.map((r) => ({
        orderRef: refOf.get(r.id),
        stages: FITTING_STAGES.map((stage) => {
          const done = r.stageCompletions.find((c) => c.stage === stage);
          return {
            stage,
            label: workroomStageLabel(stage),
            doneAt: iso(done?.completedAt),
            history: r.stageHistory
              .filter((h) => h.stage === stage)
              .map((h) => ({ notes: h.notes, at: iso(h.completedAt), by: h.completedByName, images: h.images })),
          };
        }),
        alterationRequests: r.alterationRequests.map((a) => ({
          description: a.description,
          reason: a.reason,
          status: a.status,
          at: iso(a.createdAt),
        })),
        notes: notesBySection(r.id, "fitting"),
      })),
    };
  }
  if (wanted("cost")) {
    const money = canSeePaymentDetails({ role: viewer.role, email: viewer.email });
    const costs = await Promise.all(
      commissions.map(async (c) => ({
        orderRef: c.orderRef,
        cost: await commissionCost(c.id, { money, materialCost: true, labourCost: true }),
      })),
    );
    sections.cost = { visible: true, data: costs };
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
        notes: notesBySection(r.id, "delivery"),
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
      canViewAs: canViewAsClient(access, viewer.role),
      // Super Admin only (decided 16 October 2026); the owner accounts change in server config.
      canChangeEmail: viewer.role === "SUPER_ADMIN" && access.contact && !isProtectedAccount(client.user.email),
      accountUserId: viewer.role === "SUPER_ADMIN" && access.contact ? client.userId : null,
      commissions: commissions.map((c) => ({
        id: c.id,
        orderRef: c.orderRef,
        title: commissionTitle(c).text,
        currentStage: c.currentStage,
        currentStageLabel: workroomStageLabel(c.currentStage),
        status: c.status,
        createdAt: iso(c.createdAt),
      })),
      sections,
    },
  };
}

type FileNote = {
  section: NoteSection;
  sectionLabel: string;
  body: string;
  authorName: string;
  createdAt: string;
  corrected: boolean;
  correction: boolean;
  /** Left when a pipeline step was completed; sectionLabel names the step. */
  stage?: boolean;
};

/**
 * BD2: one query for every note on these commissions and the consultations
 * they came from; returns a lookup by commission and section.
 */
async function loadNotes(commissions: { id: string; consultationId: string | null }[]) {
  const orderIds = commissions.map((c) => c.id);
  const consultationIds = commissions.map((c) => c.consultationId).filter((v): v is string => Boolean(v));
  const rows = orderIds.length
    ? await prisma.commissionNote.findMany({
        where: {
          OR: [
            { orderId: { in: orderIds } },
            ...(consultationIds.length ? [{ consultationId: { in: consultationIds }, orderId: null }] : []),
          ],
        },
        orderBy: { createdAt: "asc" },
        select: {
          orderId: true,
          consultationId: true,
          section: true,
          body: true,
          authorName: true,
          createdAt: true,
          supersedesId: true,
          correctedBy: { select: { id: true } },
        },
      })
    : [];
  return (orderId: string, section: NoteSection): FileNote[] => {
    const consultationId = commissions.find((c) => c.id === orderId)?.consultationId ?? null;
    return rows
      .filter((n) => (n.orderId === orderId || (n.orderId === null && consultationId && n.consultationId === consultationId)) && n.section === section)
      .map((n) => ({
        section: isNoteSection(n.section) ? n.section : section,
        sectionLabel: NOTE_SECTION_LABELS[section],
        body: n.body,
        authorName: n.authorName ?? "Prudent Gabriel",
        createdAt: n.createdAt.toISOString(),
        corrected: Boolean(n.correctedBy),
        correction: Boolean(n.supersedesId),
      }));
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
      select: {
        enquiryNumber: true,
        eventDate: true,
        eventType: true,
        occasionDetails: true,
        wearer: true,
        outfitType: true,
        dressCount: true,
        eventLocation: true,
        presentCity: true,
        presentState: true,
        presentCountry: true,
        fittingMode: true,
        fittingNote: true,
        deliveryDate: true,
        colourPalette: true,
        notes: true,
        moodboardImages: true,
        createdAt: true,
      },
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
      answers: enquiryAnswerLines(e).slice(1),
      notes: e.notes,
      moodboardImages: e.moodboardImages,
      receivedAt: iso(e.createdAt),
    })),
    moodboards: moodboards.map((m) => ({ ...m, createdAt: iso(m.createdAt) })),
    briefs: [],
  };
}

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

  const profileRows: { key: string; label: string; value: number | string; unit: string }[] = [];
  if (profile) {
    // The atelier sheet, in its order and under its names (lengths in the set's unit, sizes as words)…
    const sheet = await readAtelierMeasurementFields();
    for (const r of measurementSheetRows(sheet, { ...profile, extra: atelierExtrasFrom(profile.values) })) {
      profileRows.push({ key: r.key, label: r.label, value: r.value, unit: r.text ? "" : profile.unit });
    }
    // …then the shop's custom-size extras, which are kept in centimetres.
    const extra = profile.values && typeof profile.values === "object" ? (profile.values as Record<string, unknown>) : {};
    for (const [key, value] of Object.entries(extra)) {
      if (isAtelierFieldKey(key)) continue;
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
