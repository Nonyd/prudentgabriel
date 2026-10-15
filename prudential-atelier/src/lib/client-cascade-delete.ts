/**
 * Cascade client delete — the Clients list's bulk delete.
 *
 * A "client" is the ClientProfile AND its User account (role CUSTOMER only; staff,
 * admins and the protected accounts are refused). Everything associated goes,
 * in one transaction per client, with the ledger bypass on (payments and
 * commission notes are append-only by trigger):
 *
 *   1. CommissionNote   — on her commissions or her consultations (append-only; Restrict)
 *   2. CostOfProduction — on her commissions or her shop orders (Restrict)
 *   3. Payment          — every kind: on her commissions, consultations, shop orders,
 *                         invoices, or carrying her ledger identity (User.id or
 *                         `email:<lowercase>`, as getClientPayments reads them)
 *   4. PointsTransaction — hers, or on her shop orders (Restrict on User)
 *   5. CheckoutSession  — hers (user, email) or on her shop orders (loose pointers)
 *   6. Review           — hers, or on her consultations; other reviews pointing at
 *                         her shop orders are detached (orderId → null)
 *   7. Testimonial      — hers
 *   8. Invoice          — to her email, on her quotations, consultations or bespoke requests
 *   9. BespokeOrder     — her commissions; the FK cascade takes stage history, stage
 *                         completions/media/drafts/approvals, assignments and work logs,
 *                         features, materials and alteration requests (as the
 *                         commission cascade does)
 *  10. Quotation        — on her commissions, consultations, or to her email
 *  11. ConsultationEnquiry — linked to her bookings or from her email
 *  12. ConsultationBooking — hers (user or email)
 *  13. CouponUsage, Order — her shop orders (OrderItem and CouponUsage cascade)
 *  14. BespokeRequest, ChatConversation (messages cascade)
 *  15. WishlistItem, Address (Restrict on User)
 *  16. ClientProfile    — cascades measurements, moodboards, event dates, client notes
 *  17. User             — cascades sessions, accounts, reset tokens, cart, saved cards,
 *                         notifications, helpful votes, permissions
 *  18. ActivityLog row  — under the actor who did it, with counts and payment refs
 *
 * Refused (per client, the others still go):
 *   - Store movements or requisitions on any of her commissions or shop orders: the
 *     store book records what physically left the shelf; deleting would change counts.
 *   - Not a customer account (staff/admin) or a protected account.
 *   - Payments would go and the actor is not a Super Admin.
 *
 * Active (in-progress) commissions and orders do not block.
 *
 * Kept on purpose: ActivityLog/ErrorLog rows (the audit trail), newsletter
 * subscriptions and email preferences, contact messages and job applications.
 *
 * After commit (best effort): receipts, consultation/commission reference and
 * moodboard uploads, stage photos, bespoke-request images. Moodboard.images are
 * not destroyed — they can point at catalogue images.
 */

import { ActivityAction, PaymentMethod, PaymentStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CASCADE_CONFIRMATION, type CascadePaymentSnap } from "@/lib/cascade-copy";
import { enableLedgerBypass, ProductCascadeError, type CascadeActor } from "@/lib/product-cascade-delete";
import { isProtectedAccount } from "@/lib/roles";
import { logServerError } from "@/lib/logger";
import { chatFileKeys, deleteOrphanedChatFiles } from "@/lib/chat-files";
import {
  CLIENT_CASCADE_MODULE,
  CLIENT_CASCADE_RECORD_TYPE,
  MAX_CLIENT_CASCADE,
  clientCascadeDescription,
  type ClientCascadeItem,
  type ClientCascadePreview,
  type ClientCascadeResult,
  type ClientCascadeSnapshot,
} from "@/lib/client-cascade-copy";

export type { ClientCascadeItem, ClientCascadePreview, ClientCascadeResult };

const DONE_STATUSES = ["DELIVERED", "CANCELLED"] as const;

function money(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

function isConfirmedMoney(status: PaymentStatus): boolean {
  return status === PaymentStatus.CONFIRMED || status === PaymentStatus.PAID;
}

function ci(email: string): Prisma.StringFilter {
  return { equals: email, mode: "insensitive" };
}

type ClientPlan = ClientCascadeItem & {
  commissionIds: string[];
  bookingIds: string[];
  orderIds: string[];
  quotationIds: string[];
  invoiceIds: string[];
  bespokeRequestIds: string[];
  ledgerIds: string[];
  mediaUrls: string[];
};

function normaliseIds(ids: string[]): string[] {
  const unique = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (unique.length === 0) throw new ProductCascadeError("EMPTY", "Select at least one client", 400);
  if (unique.length > MAX_CLIENT_CASCADE) {
    throw new ProductCascadeError("TOO_MANY", `Maximum ${MAX_CLIENT_CASCADE} clients per request`, 400);
  }
  return unique;
}

async function loadClientPlan(profile: {
  id: string;
  user: { id: string; name: string | null; email: string; role: Role; isStaff: boolean; staffProfile: { id: string } | null };
}): Promise<ClientPlan> {
  const user = profile.user;
  const email = user.email.trim().toLowerCase();
  const name = user.name?.trim() || user.email;
  const ledgerIds = [user.id, `email:${email}`];

  const commissions = await prisma.bespokeOrder.findMany({
    where: {
      OR: [{ clientProfileId: profile.id }, { clientProfileId: null, clientEmail: ci(email) }],
    },
    select: {
      id: true,
      orderRef: true,
      status: true,
      quotationId: true,
      paymentReceiptUrl: true,
      moodboardImages: true,
      stageMedia: { select: { url: true } },
      _count: { select: { storeMovements: true, requisitions: true, costsOfProduction: true } },
    },
  });
  const commissionIds = commissions.map((c) => c.id);

  const bookings = await prisma.consultationBooking.findMany({
    where: { OR: [{ userId: user.id }, { clientEmail: ci(email) }] },
    select: {
      id: true,
      bookingNumber: true,
      paymentReceiptUrl: true,
      referenceImages: true,
      moodboardImages: true,
    },
  });
  const bookingIds = bookings.map((b) => b.id);

  const orders = await prisma.order.findMany({
    where: { OR: [{ userId: user.id }, { guestEmail: ci(email) }] },
    select: {
      id: true,
      orderNumber: true,
      paymentReceiptUrl: true,
      _count: { select: { storeMovements: true, requisitions: true, costsOfProduction: true } },
    },
  });
  const orderIds = orders.map((o) => o.id);

  const bespokeRequests = await prisma.bespokeRequest.findMany({
    where: { OR: [{ userId: user.id }, { email: ci(email) }] },
    select: { id: true, referenceImages: true, sketchUrls: true },
  });
  const bespokeRequestIds = bespokeRequests.map((r) => r.id);

  const commissionQuotationIds = commissions.map((c) => c.quotationId).filter((q): q is string => Boolean(q));
  const quotations = await prisma.quotation.findMany({
    where: {
      OR: [
        { id: { in: commissionQuotationIds } },
        { consultationId: { in: bookingIds } },
        { clientEmail: ci(email) },
      ],
    },
    select: { id: true },
  });
  const quotationIds = quotations.map((q) => q.id);

  const invoices = await prisma.invoice.findMany({
    where: {
      OR: [
        { clientEmail: ci(email) },
        { quotationId: { in: quotationIds } },
        { consultationId: { in: bookingIds } },
        { bespokeRequestId: { in: bespokeRequestIds } },
      ],
    },
    select: { id: true, invoiceNumber: true },
  });
  const invoiceIds = invoices.map((i) => i.id);

  const payments = await prisma.payment.findMany({
    where: {
      OR: [
        { bespokeOrderId: { in: commissionIds } },
        { consultationId: { in: bookingIds } },
        { orderId: { in: orderIds } },
        { invoiceId: { in: invoiceIds } },
        { clientId: { in: ledgerIds } },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: {
      reference: true,
      method: true,
      status: true,
      amount: true,
      confirmedAt: true,
      createdAt: true,
      receiptUrl: true,
      bespokeOrder: { select: { orderRef: true } },
      consultation: { select: { bookingNumber: true } },
      order: { select: { orderNumber: true } },
      invoice: { select: { invoiceNumber: true } },
    },
  });
  const paymentSnaps: CascadePaymentSnap[] = payments.map((p) => ({
    reference: p.reference,
    method: p.method,
    status: p.status,
    amountNGN: money(Number(p.amount)),
    at: (p.confirmedAt ?? p.createdAt).toISOString(),
    orderNumber:
      p.bespokeOrder?.orderRef ?? p.order?.orderNumber ?? p.consultation?.bookingNumber ?? p.invoice?.invoiceNumber ?? null,
  }));
  const receivedNGN = money(
    payments
      .filter((p) => isConfirmedMoney(p.status) && p.method !== PaymentMethod.POINTS)
      .reduce((s, p) => s + Number(p.amount), 0),
  );

  const [
    notes,
    costSheets,
    enquiries,
    reviews,
    testimonials,
    pointsEntries,
    measurements,
    moodboards,
    eventDates,
    clientNotes,
    addresses,
    wishlist,
    cartItems,
    savedCards,
    chats,
    checkoutSessions,
  ] = await Promise.all([
    prisma.commissionNote.count({
      where: { OR: [{ orderId: { in: commissionIds } }, { consultationId: { in: bookingIds } }] },
    }),
    prisma.costOfProduction.count({
      where: { OR: [{ bespokeOrderId: { in: commissionIds } }, { orderId: { in: orderIds } }] },
    }),
    prisma.consultationEnquiry.count({
      where: { OR: [{ bookingId: { in: bookingIds } }, { clientEmail: ci(email) }] },
    }),
    prisma.review.count({ where: { OR: [{ userId: user.id }, { consultationId: { in: bookingIds } }] } }),
    prisma.testimonial.count({ where: { userId: user.id } }),
    prisma.pointsTransaction.count({ where: { OR: [{ userId: user.id }, { orderId: { in: orderIds } }] } }),
    prisma.measurement.count({ where: { clientId: profile.id } }),
    prisma.moodboard.count({ where: { clientId: profile.id } }),
    prisma.eventDate.count({ where: { clientId: profile.id } }),
    prisma.clientNote.count({ where: { clientId: profile.id } }),
    prisma.address.count({ where: { userId: user.id } }),
    prisma.wishlistItem.count({ where: { userId: user.id } }),
    prisma.cartItem.count({ where: { userId: user.id } }),
    prisma.savedPaymentMethod.count({ where: { userId: user.id } }),
    prisma.chatConversation.count({ where: { OR: [{ userId: user.id }, { visitorEmail: ci(email) }] } }),
    prisma.checkoutSession.count({
      where: { OR: [{ userId: user.id }, { email: ci(email) }, { orderId: { in: orderIds } }] },
    }),
  ]);

  const counts = {
    commissions: commissions.length,
    activeCommissions: commissions.filter((c) => !(DONE_STATUSES as readonly string[]).includes(c.status)).length,
    consultations: bookings.length,
    shopOrders: orders.length,
    payments: payments.length,
    quotations: quotationIds.length,
    invoices: invoiceIds.length,
    notes,
    costSheets,
    bespokeRequests: bespokeRequestIds.length,
    enquiries,
    reviews,
    testimonials,
    pointsEntries,
    measurements,
    moodboards,
    eventDates,
    clientNotes,
    addresses,
    wishlist,
    cartItems,
    savedCards,
    chats,
    checkoutSessions,
  };

  // Refusals: not a client account, or the store book has her pieces.
  let blockReason: string | null = null;
  if (user.role !== Role.CUSTOMER || user.isStaff || user.staffProfile) {
    blockReason = `${name} is a staff or admin account, not a client.`;
  } else if (isProtectedAccount(user.email)) {
    blockReason = `${name} is a protected account.`;
  } else {
    const storeRefs = [
      ...commissions
        .filter((c) => c._count.storeMovements > 0 || c._count.requisitions > 0)
        .map((c) => c.orderRef),
      ...orders.filter((o) => o._count.storeMovements > 0 || o._count.requisitions > 0).map((o) => o.orderNumber),
    ];
    if (storeRefs.length) {
      blockReason = `${storeRefs.join(", ")} ${storeRefs.length === 1 ? "has" : "have"} store movements or requisitions in the store book; deleting would change the shelf counts.`;
    }
  }

  const mediaUrls = Array.from(
    new Set(
      [
        ...commissions.flatMap((c) => [c.paymentReceiptUrl, ...c.moodboardImages, ...c.stageMedia.map((m) => m.url)]),
        ...bookings.flatMap((b) => [b.paymentReceiptUrl, ...b.referenceImages, ...b.moodboardImages]),
        ...orders.map((o) => o.paymentReceiptUrl),
        ...bespokeRequests.flatMap((r) => [...r.referenceImages, ...r.sketchUrls]),
        ...payments.map((p) => p.receiptUrl),
      ].filter((u): u is string => Boolean(u)),
    ),
  );

  const { savedCards: _s, cartItems: _c, checkoutSessions: _cs, ...weighty } = counts;
  void _s;
  void _c;
  void _cs;
  const loud = Object.values(weighty).some((n) => n > 0);

  return {
    clientProfileId: profile.id,
    userId: user.id,
    name,
    email: user.email,
    counts,
    commissionRefs: commissions.map((c) => c.orderRef),
    orderNumbers: orders.map((o) => o.orderNumber),
    bookingNumbers: bookings.map((b) => b.bookingNumber),
    payments: paymentSnaps,
    receivedNGN,
    loud,
    superAdminOnly: payments.length > 0,
    blocked: blockReason !== null,
    blockReason,
    commissionIds,
    bookingIds,
    orderIds,
    quotationIds,
    invoiceIds,
    bespokeRequestIds,
    ledgerIds,
    mediaUrls,
  };
}

async function loadPlans(ids: string[]): Promise<{ plans: ClientPlan[]; missingIds: string[] }> {
  const unique = normaliseIds(ids);
  const profiles = await prisma.clientProfile.findMany({
    where: { id: { in: unique } },
    select: {
      id: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isStaff: true,
          staffProfile: { select: { id: true } },
        },
      },
    },
  });
  const found = new Set(profiles.map((p) => p.id));
  const plans: ClientPlan[] = [];
  for (const p of profiles) plans.push(await loadClientPlan(p));
  return { plans, missingIds: unique.filter((id) => !found.has(id)) };
}

function toItem(plan: ClientPlan): ClientCascadeItem {
  const {
    commissionIds: _a,
    bookingIds: _b,
    orderIds: _c,
    quotationIds: _d,
    invoiceIds: _e,
    bespokeRequestIds: _f,
    ledgerIds: _g,
    mediaUrls: _h,
    ...item
  } = plan;
  void [_a, _b, _c, _d, _e, _f, _g, _h];
  return item;
}

function summarise(plans: ClientPlan[], missingIds: string[]): ClientCascadePreview {
  const deletable = plans.filter((p) => !p.blocked);
  return {
    clients: plans.map(toItem),
    missingIds,
    deletableCount: deletable.length,
    blockedCount: plans.length - deletable.length,
    loud: deletable.some((p) => p.loud),
    superAdminOnly: deletable.some((p) => p.superAdminOnly),
    receivedNGN: money(deletable.reduce((s, p) => s + p.receivedNGN, 0)),
  };
}

export async function previewClientCascade(clientProfileIds: string[]): Promise<ClientCascadePreview> {
  const { plans, missingIds } = await loadPlans(clientProfileIds);
  if (plans.length === 0) throw new ProductCascadeError("NOT_FOUND", "Client not found", 404);
  return summarise(plans, missingIds);
}

async function deleteClientGraph(tx: Prisma.TransactionClient, plan: ClientPlan): Promise<void> {
  const { commissionIds, bookingIds, orderIds, quotationIds, invoiceIds, ledgerIds, userId, clientProfileId } = plan;
  const email = plan.email.trim().toLowerCase();

  await tx.commissionNote.deleteMany({
    where: { OR: [{ orderId: { in: commissionIds } }, { consultationId: { in: bookingIds } }] },
  });
  await tx.costOfProduction.deleteMany({
    where: { OR: [{ bespokeOrderId: { in: commissionIds } }, { orderId: { in: orderIds } }] },
  });
  await tx.payment.deleteMany({
    where: {
      OR: [
        { bespokeOrderId: { in: commissionIds } },
        { consultationId: { in: bookingIds } },
        { orderId: { in: orderIds } },
        { invoiceId: { in: invoiceIds } },
        { clientId: { in: ledgerIds } },
      ],
    },
  });
  await tx.pointsTransaction.deleteMany({ where: { OR: [{ userId }, { orderId: { in: orderIds } }] } });
  await tx.checkoutSession.deleteMany({
    where: { OR: [{ userId }, { email: ci(email) }, { orderId: { in: orderIds } }] },
  });
  await tx.review.deleteMany({ where: { OR: [{ userId }, { consultationId: { in: bookingIds } }] } });
  if (orderIds.length) {
    await tx.review.updateMany({ where: { orderId: { in: orderIds } }, data: { orderId: null } });
  }
  await tx.testimonial.deleteMany({ where: { userId } });
  if (invoiceIds.length) await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
  // FK cascade: stage history/completions/media/drafts/approvals, assignments and work logs,
  // features, materials, alteration requests — as the commission cascade.
  if (commissionIds.length) await tx.bespokeOrder.deleteMany({ where: { id: { in: commissionIds } } });
  if (quotationIds.length) await tx.quotation.deleteMany({ where: { id: { in: quotationIds } } });
  await tx.consultationEnquiry.deleteMany({
    where: { OR: [{ bookingId: { in: bookingIds } }, { clientEmail: ci(email) }] },
  });
  if (bookingIds.length) await tx.consultationBooking.deleteMany({ where: { id: { in: bookingIds } } });
  await tx.couponUsage.deleteMany({ where: { OR: [{ userId }, { orderId: { in: orderIds } }] } });
  if (orderIds.length) await tx.order.deleteMany({ where: { id: { in: orderIds } } });
  if (plan.bespokeRequestIds.length) {
    await tx.bespokeRequest.deleteMany({ where: { id: { in: plan.bespokeRequestIds } } });
  }
  await tx.chatConversation.deleteMany({ where: { OR: [{ userId }, { visitorEmail: ci(email) }] } });
  await tx.wishlistItem.deleteMany({ where: { userId } });
  await tx.address.deleteMany({ where: { userId } });
  // Cascade: measurements, moodboards, event dates, client notes.
  await tx.clientProfile.delete({ where: { id: clientProfileId } });
  // Cascade: sessions, accounts, reset tokens, cart, saved cards, notifications, votes, permissions.
  await tx.user.delete({ where: { id: userId } });
}

async function writeClientLog(tx: Prisma.TransactionClient, plan: ClientPlan, actor: CascadeActor): Promise<string> {
  const snapshot: ClientCascadeSnapshot = {
    kind: CLIENT_CASCADE_RECORD_TYPE,
    clientProfileId: plan.clientProfileId,
    userId: plan.userId,
    clientName: plan.name,
    clientEmail: plan.email,
    counts: plan.counts,
    commissionRefs: plan.commissionRefs,
    orderNumbers: plan.orderNumbers,
    bookingNumbers: plan.bookingNumbers,
    payments: plan.payments,
    receivedNGN: plan.receivedNGN,
    actor: { userId: actor.userId, email: actor.email, role: actor.role, ip: actor.ip },
  };
  const row = await tx.activityLog.create({
    data: {
      userId: actor.userId,
      userEmail: actor.email,
      userRole: actor.role,
      action: ActivityAction.DELETE,
      module: CLIENT_CASCADE_MODULE,
      description: clientCascadeDescription(plan),
      recordId: plan.clientProfileId,
      recordType: CLIENT_CASCADE_RECORD_TYPE,
      ipAddress: actor.ip,
      snapshot: snapshot as Prisma.InputJsonValue,
    },
  });
  return row.id;
}

export async function executeClientCascade(opts: {
  clientProfileIds: string[];
  actor: CascadeActor;
  confirmation?: string;
  /** The route decides (a real Super Admin, not "view as"); defaults to the actor's role. */
  superAdmin?: boolean;
}): Promise<{ results: ClientCascadeResult[]; mediaUrls: string[]; missingIds: string[] }> {
  const { plans, missingIds } = await loadPlans(opts.clientProfileIds);
  if (plans.length === 0) throw new ProductCascadeError("NOT_FOUND", "Client not found", 404);

  const superAdmin = opts.superAdmin ?? opts.actor.role === "SUPER_ADMIN";
  const deletable = plans.filter((p) => !p.blocked && (!p.superAdminOnly || superAdmin));
  if (deletable.some((p) => p.loud) && opts.confirmation !== CASCADE_CONFIRMATION) {
    throw new ProductCascadeError(
      "CONFIRM",
      `Type ${CASCADE_CONFIRMATION} to delete these clients and everything that goes with them`,
      400,
    );
  }

  const results: ClientCascadeResult[] = [];
  const mediaUrls: string[] = [];
  for (const plan of plans) {
    if (plan.blocked) {
      results.push({ clientProfileId: plan.clientProfileId, name: plan.name, ok: false, error: plan.blockReason ?? "Cannot be deleted" });
      continue;
    }
    if (plan.superAdminOnly && !superAdmin) {
      results.push({
        clientProfileId: plan.clientProfileId,
        name: plan.name,
        ok: false,
        error: "Only a Super Admin can delete a client who has payments",
      });
      continue;
    }
    try {
      // BF7: chat files are read before the rows go, and removed from disk after.
      const chatIds = (
        await prisma.chatConversation.findMany({
          where: { OR: [{ userId: plan.userId }, { visitorEmail: ci(plan.email) }] },
          select: { id: true },
        })
      ).map((c) => c.id);
      const chatKeys = await chatFileKeys(chatIds);
      const logId = await prisma.$transaction(
        async (tx) => {
          await enableLedgerBypass(tx);
          await deleteClientGraph(tx, plan);
          return writeClientLog(tx, plan, opts.actor);
        },
        { timeout: 60_000, maxWait: 15_000 },
      );
      await deleteOrphanedChatFiles(chatKeys);
      results.push({ clientProfileId: plan.clientProfileId, name: plan.name, ok: true, logId });
      mediaUrls.push(...plan.mediaUrls);
    } catch (e) {
      await logServerError({ errorType: "CLIENT_CASCADE_DELETE", error: e, userId: plan.userId });
      results.push({
        clientProfileId: plan.clientProfileId,
        name: plan.name,
        ok: false,
        error: "Delete failed; nothing was removed for this client",
      });
    }
  }
  return { results, mediaUrls: Array.from(new Set(mediaUrls)), missingIds };
}
