/**
 * Purge demo / fixture transactional data.
 *
 * Plan-only by default. Writes require `--apply`.
 *
 *   pnpm purge:demo
 *   pnpm purge:demo --apply
 *
 * Production stays untouched until the plan output is approved and `--apply`
 * is run against a reviewed connection string.
 *
 * Does not delete: SiteSetting, email templates, products/collections,
 * staff/admin/SUPER_ADMIN users, legal pages, careers postings, _prisma_migrations.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma, PrismaClient, Role } from "@prisma/client";
import { publicIdFromCloudinaryUrl } from "../src/lib/cloudinary-public-id";
import { looksLikeProductionDatabase } from "./fixture-guard";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const ALLOW_PROD = process.env.ALLOW_PROD_PURGE === "true";

type PlanRow = {
  table: string;
  delete: number;
  keep: number;
  deleteSample: string[];
  keepSample: string[];
  note?: string;
};

const plan: PlanRow[] = [];

function sample(ids: string[], n = 5): string[] {
  return ids.slice(0, n);
}

function printPlan() {
  console.log("\n=== PURGE PLAN ===");
  console.log(
    [
      "table".padEnd(28),
      "delete".padStart(7),
      "keep".padStart(7),
      "delete sample",
    ].join("  "),
  );
  for (const p of plan) {
    console.log(
      [
        p.table.padEnd(28),
        String(p.delete).padStart(7),
        String(p.keep).padStart(7),
        (p.deleteSample.join(", ") || "—").slice(0, 80),
      ].join("  "),
    );
    if (p.keepSample.length) {
      console.log(`${" ".repeat(30)}keep sample: ${p.keepSample.join(", ")}`);
    }
    if (p.note) console.log(`${" ".repeat(30)}↳ ${p.note}`);
  }
}

function collectUrls(...values: unknown[]): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (!v) return;
    if (typeof v === "string") {
      if (v.startsWith("http")) out.push(v);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (typeof v === "object") {
      Object.values(v as Record<string, unknown>).forEach(walk);
    }
  };
  values.forEach(walk);
  return out;
}

async function main() {
  if (APPLY && looksLikeProductionDatabase() && !ALLOW_PROD) {
    console.error(
      "purge-demo-data: refused --apply against production Neon host.\n" +
        "Run on a branch first. To apply on production after approval, set ALLOW_PROD_PURGE=true.",
    );
    process.exit(1);
  }

  console.log(APPLY ? "MODE: APPLY (writes enabled)" : "MODE: PLAN ONLY (no writes)");
  console.log(
    `DATABASE host: ${(() => {
      try {
        return new URL((process.env.DATABASE_URL ?? "").replace(/^prisma\+/, "")).hostname;
      } catch {
        return "(unparsed)";
      }
    })()}`,
  );

  console.log("\n=== INTENDED DELETE ORDER ===");
  console.log(
    [
      "1. Payment (if table exists — empty after cancelled backfill)",
      "2. CouponUsage, OrderItem, CartItem",
      "3. ReviewHelpfulVote, Review, Testimonial, PointsTransaction",
      "4. AdminNotification / CustomerNotification / StaffNotification (entity-linked)",
      "5. ActivityLog rows whose recordId is a deleted entity",
      "6. StageUpdate, OrderStageCompletion/Media/Draft, StageApproval, OrderAssignment, Material (bespoke children; also CASCADE)",
      "7. Invoice, Quotation, BespokeOrder",
      "8. ConsultationBooking",
      "9. BespokeRequest",
      "10. Order (RTW)",
      "11. ClientNote, EventDate, Moodboard, Measurement, ClientProfile (demo clients only)",
      "12. Address, WishlistItem, SavedPaymentMethod, Session, Account, PasswordResetToken (demo clients)",
      "13. User (CUSTOMER, no remaining FKs, not staff/admin)",
      "KEEP: SiteSetting, products, collections, gallery, consultants, staff/admin,",
      "      JobPosting, ErrorLog, AttendanceLog/PerformanceRecord (staff), _prisma_migrations",
    ].join("\n"),
  );

  // ------------------------------------------------------------------ inventory
  const [
    paymentsExist,
    couponUsages,
    orderItems,
    cartItems,
    reviews,
    reviewVotes,
    testimonials,
    pointsTx,
    adminNotifs,
    customerNotifs,
    staffNotifs,
    activityLogs,
    stageUpdates,
    assignments,
    materials,
    invoices,
    quotations,
    bespokeOrders,
    consultations,
    bespokeRequests,
    rtwOrders,
    clientNotes,
    eventDates,
    moodboards,
    measurements,
    clientProfiles,
    addresses,
    wishlists,
    savedPay,
    sessions,
    accounts,
    resetTokens,
    users,
    contactMessages,
    jobApplications,
    emailJobs,
    products,
    collections,
    siteSettings,
    consultants,
    staffProfiles,
    jobPostings,
  ] = await Promise.all([
    prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'Payment'
      ) AS exists
    `.then((r) => Boolean(r[0]?.exists)),
    prisma.couponUsage.findMany({ select: { id: true, couponId: true, orderId: true } }),
    prisma.orderItem.findMany({ select: { id: true, orderId: true } }),
    prisma.cartItem.findMany({ select: { id: true, userId: true } }),
    prisma.review.findMany({ select: { id: true, userId: true, productId: true, consultationId: true, title: true } }),
    prisma.reviewHelpfulVote.findMany({ select: { id: true, reviewId: true } }),
    prisma.testimonial.findMany({ select: { id: true, userId: true, displayName: true } }),
    prisma.pointsTransaction.findMany({ select: { id: true, userId: true, description: true } }),
    prisma.adminNotification.findMany({ select: { id: true, entityId: true, title: true, link: true } }),
    prisma.customerNotification.findMany({ select: { id: true, entityId: true, title: true, userId: true } }),
    prisma.staffNotification.findMany({ select: { id: true, entityId: true, title: true, userId: true } }),
    prisma.activityLog.findMany({
      select: { id: true, recordId: true, recordType: true, description: true, module: true },
    }),
    prisma.stageUpdate.findMany({ select: { id: true, orderId: true, images: true, videos: true } }),
    prisma.orderAssignment.findMany({ select: { id: true, orderId: true } }),
    prisma.material.findMany({ select: { id: true, orderId: true } }),
    prisma.invoice.findMany({
      select: {
        id: true,
        invoiceNumber: true,
        paymentHistory: true,
        notes: true,
        clientNote: true,
      },
    }),
    prisma.quotation.findMany({ select: { id: true, quoteRef: true, pdfUrl: true } }),
    prisma.bespokeOrder.findMany({
      select: {
        id: true,
        orderRef: true,
        moodboardImages: true,
        paymentReceiptUrl: true,
        clientEmail: true,
      },
    }),
    prisma.consultationBooking.findMany({
      select: {
        id: true,
        bookingNumber: true,
        moodboardImages: true,
        referenceImages: true,
        paymentReceiptUrl: true,
        clientEmail: true,
      },
    }),
    prisma.bespokeRequest.findMany({
      select: {
        id: true,
        requestNumber: true,
        email: true,
        referenceImages: true,
        sketchUrls: true,
      },
    }),
    prisma.order.findMany({
      select: { id: true, orderNumber: true, userId: true, guestEmail: true, paymentReceiptUrl: true },
    }),
    prisma.clientNote.findMany({ select: { id: true, clientId: true } }),
    prisma.eventDate.findMany({ select: { id: true, clientId: true, label: true } }),
    prisma.moodboard.findMany({ select: { id: true, clientId: true, title: true, images: true } }),
    prisma.measurement.findMany({ select: { id: true, clientId: true } }),
    prisma.clientProfile.findMany({
      select: { id: true, userId: true, user: { select: { email: true, role: true, isStaff: true } } },
    }),
    prisma.address.findMany({ select: { id: true, userId: true } }),
    prisma.wishlistItem.findMany({ select: { id: true, userId: true } }),
    prisma.savedPaymentMethod.findMany({ select: { id: true, userId: true } }),
    prisma.session.findMany({ select: { id: true, userId: true } }),
    prisma.account.findMany({ select: { id: true, userId: true } }),
    prisma.passwordResetToken.findMany({ select: { id: true, userId: true } }),
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isStaff: true,
        referredById: true,
      },
    }),
    prisma.contactMessage.findMany({
      select: { id: true, email: true, name: true, subject: true, createdAt: true },
    }),
    prisma.jobApplication.findMany({
      select: { id: true, email: true, fullName: true, jobId: true, createdAt: true },
    }),
    prisma.emailSendJob.findMany({ select: { id: true, subject: true, recipientType: true } }),
    prisma.product.findMany({ select: { id: true, slug: true } }),
    prisma.collection.findMany({ select: { id: true, slug: true } }),
    prisma.siteSetting.findMany({ select: { key: true } }),
    prisma.consultant.findMany({ select: { id: true, name: true } }),
    prisma.staffProfile.findMany({ select: { id: true, userId: true } }),
    prisma.jobPosting.findMany({ select: { id: true, slug: true, title: true } }),
  ]);

  let paymentRows: { id: string; reference: string }[] = [];
  if (paymentsExist) {
    paymentRows = await prisma.$queryRaw<{ id: string; reference: string }[]>`
      SELECT id, reference FROM "Payment"
    `;
  }

  const demoCustomerUsers = users.filter((u) => u.role === Role.CUSTOMER && !u.isStaff);
  const demoCustomerIds = new Set(demoCustomerUsers.map((u) => u.id));

  const demoClientProfiles = clientProfiles.filter(
    (p) => demoCustomerIds.has(p.userId) && p.user.role === Role.CUSTOMER && !p.user.isStaff,
  );
  const keepClientProfiles = clientProfiles.filter((p) => !demoClientProfiles.some((d) => d.id === p.id));

  const invoiceIds = new Set(invoices.map((i) => i.id));
  const quotationIds = new Set(quotations.map((q) => q.id));
  const bespokeOrderIds = new Set(bespokeOrders.map((o) => o.id));
  const consultationIds = new Set(consultations.map((c) => c.id));
  const requestIds = new Set(bespokeRequests.map((r) => r.id));
  const rtwOrderIds = new Set(rtwOrders.map((o) => o.id));
  const demoProfileIds = new Set(demoClientProfiles.map((p) => p.id));

  const deletedEntityIds = new Set<string>(
    Array.from(invoiceIds).concat(
      Array.from(quotationIds),
      Array.from(bespokeOrderIds),
      Array.from(consultationIds),
      Array.from(requestIds),
      Array.from(rtwOrderIds),
    ),
  );

  const adminNotifsDelete = adminNotifs.filter(
    (n) => (n.entityId && deletedEntityIds.has(n.entityId)) || (n.link && /\/admin\/(consultations|bespoke|invoices|orders)\//.test(n.link)),
  );
  const customerNotifsDelete = customerNotifs.filter((n) => n.entityId && deletedEntityIds.has(n.entityId));
  const staffNotifsDelete = staffNotifs.filter((n) => n.entityId && deletedEntityIds.has(n.entityId));
  const activityDelete = activityLogs.filter(
    (a) =>
      (a.recordId && deletedEntityIds.has(a.recordId)) ||
      a.module === "payments" ||
      a.module === "quotations" ||
      /CB-|ORD-|INV-|QT-|BQ-/.test(a.description),
  );
  const activityKeep = activityLogs.filter((a) => !activityDelete.some((d) => d.id === a.id));

  plan.push({
    table: "Payment",
    delete: paymentRows.length,
    keep: 0,
    deleteSample: sample(paymentRows.map((p) => p.reference)),
    keepSample: [],
    note: paymentsExist ? "ledger table present" : "Payment table not yet migrated — skip",
  });
  plan.push({
    table: "CouponUsage",
    delete: couponUsages.length,
    keep: 0,
    deleteSample: sample(couponUsages.map((c) => c.id)),
    keepSample: [],
  });
  plan.push({
    table: "OrderItem",
    delete: orderItems.length,
    keep: 0,
    deleteSample: sample(orderItems.map((i) => i.id)),
    keepSample: [],
  });
  plan.push({
    table: "CartItem",
    delete: cartItems.length,
    keep: 0,
    deleteSample: sample(cartItems.map((c) => c.id)),
    keepSample: [],
  });
  plan.push({
    table: "ReviewHelpfulVote",
    delete: reviewVotes.length,
    keep: 0,
    deleteSample: sample(reviewVotes.map((v) => v.id)),
    keepSample: [],
  });
  plan.push({
    table: "Review",
    delete: reviews.length,
    keep: 0,
    deleteSample: sample(reviews.map((r) => r.title || r.id)),
    keepSample: [],
    note: "purchase-gated; all current reviews are demo",
  });
  plan.push({
    table: "Testimonial",
    delete: testimonials.length,
    keep: 0,
    deleteSample: sample(testimonials.map((t) => t.displayName || t.id)),
    keepSample: [],
    note: "purchase-gated; homepage falls back to FALLBACK_TESTIMONIALS",
  });
  plan.push({
    table: "PointsTransaction",
    delete: pointsTx.length,
    keep: 0,
    deleteSample: sample(pointsTx.map((p) => p.description)),
    keepSample: [],
  });
  plan.push({
    table: "AdminNotification",
    delete: adminNotifsDelete.length,
    keep: adminNotifs.length - adminNotifsDelete.length,
    deleteSample: sample(adminNotifsDelete.map((n) => n.title)),
    keepSample: sample(adminNotifs.filter((n) => !adminNotifsDelete.includes(n)).map((n) => n.title)),
  });
  plan.push({
    table: "CustomerNotification",
    delete: customerNotifsDelete.length,
    keep: customerNotifs.length - customerNotifsDelete.length,
    deleteSample: sample(customerNotifsDelete.map((n) => n.title)),
    keepSample: [],
  });
  plan.push({
    table: "StaffNotification",
    delete: staffNotifsDelete.length,
    keep: staffNotifs.length - staffNotifsDelete.length,
    deleteSample: sample(staffNotifsDelete.map((n) => n.title)),
    keepSample: [],
  });
  plan.push({
    table: "ActivityLog",
    delete: activityDelete.length,
    keep: activityKeep.length,
    deleteSample: sample(activityDelete.map((a) => a.description)),
    keepSample: sample(activityKeep.map((a) => a.description)),
    note: "keeps WooCommerce import logs",
  });
  plan.push({
    table: "StageUpdate",
    delete: stageUpdates.length,
    keep: 0,
    deleteSample: sample(stageUpdates.map((s) => s.id)),
    keepSample: [],
  });
  plan.push({
    table: "OrderAssignment",
    delete: assignments.length,
    keep: 0,
    deleteSample: sample(assignments.map((a) => a.id)),
    keepSample: [],
  });
  plan.push({
    table: "Material",
    delete: materials.length,
    keep: 0,
    deleteSample: sample(materials.map((m) => m.id)),
    keepSample: [],
  });
  plan.push({
    table: "Invoice",
    delete: invoices.length,
    keep: 0,
    deleteSample: sample(invoices.map((i) => i.invoiceNumber)),
    keepSample: [],
  });
  plan.push({
    table: "Quotation",
    delete: quotations.length,
    keep: 0,
    deleteSample: sample(quotations.map((q) => q.quoteRef)),
    keepSample: [],
  });
  plan.push({
    table: "BespokeOrder",
    delete: bespokeOrders.length,
    keep: 0,
    deleteSample: sample(bespokeOrders.map((o) => o.orderRef)),
    keepSample: [],
  });
  plan.push({
    table: "ConsultationBooking",
    delete: consultations.length,
    keep: 0,
    deleteSample: sample(consultations.map((c) => c.bookingNumber)),
    keepSample: [],
  });
  plan.push({
    table: "BespokeRequest",
    delete: bespokeRequests.length,
    keep: 0,
    deleteSample: sample(bespokeRequests.map((r) => r.requestNumber)),
    keepSample: [],
  });
  plan.push({
    table: "Order (RTW)",
    delete: rtwOrders.length,
    keep: 0,
    deleteSample: sample(rtwOrders.map((o) => o.orderNumber)),
    keepSample: [],
  });

  const notesDel = clientNotes.filter((n) => demoProfileIds.has(n.clientId));
  const eventsDel = eventDates.filter((e) => demoProfileIds.has(e.clientId));
  const boardsDel = moodboards.filter((m) => demoProfileIds.has(m.clientId));
  const measDel = measurements.filter((m) => demoProfileIds.has(m.clientId));

  plan.push({
    table: "ClientNote",
    delete: notesDel.length,
    keep: clientNotes.length - notesDel.length,
    deleteSample: sample(notesDel.map((n) => n.id)),
    keepSample: [],
  });
  plan.push({
    table: "EventDate",
    delete: eventsDel.length,
    keep: eventDates.length - eventsDel.length,
    deleteSample: sample(eventsDel.map((e) => e.label)),
    keepSample: [],
  });
  plan.push({
    table: "Moodboard",
    delete: boardsDel.length,
    keep: moodboards.length - boardsDel.length,
    deleteSample: sample(boardsDel.map((m) => m.title)),
    keepSample: [],
  });
  plan.push({
    table: "Measurement",
    delete: measDel.length,
    keep: measurements.length - measDel.length,
    deleteSample: sample(measDel.map((m) => m.id)),
    keepSample: [],
  });
  plan.push({
    table: "ClientProfile",
    delete: demoClientProfiles.length,
    keep: keepClientProfiles.length,
    deleteSample: sample(demoClientProfiles.map((p) => p.user.email)),
    keepSample: sample(keepClientProfiles.map((p) => p.user.email)),
    note: "keeps profiles attached to staff/admin (nony, admin, tunde)",
  });

  const addrDel = addresses.filter((a) => demoCustomerIds.has(a.userId));
  const wishDel = wishlists.filter((w) => demoCustomerIds.has(w.userId));
  const savedDel = savedPay.filter((s) => demoCustomerIds.has(s.userId));
  const sessDel = sessions.filter((s) => demoCustomerIds.has(s.userId));
  const acctDel = accounts.filter((a) => demoCustomerIds.has(a.userId));
  const resetDel = resetTokens.filter((t) => demoCustomerIds.has(t.userId));

  plan.push({
    table: "Address",
    delete: addrDel.length,
    keep: addresses.length - addrDel.length,
    deleteSample: sample(addrDel.map((a) => a.id)),
    keepSample: [],
  });
  plan.push({
    table: "WishlistItem",
    delete: wishDel.length,
    keep: wishlists.length - wishDel.length,
    deleteSample: sample(wishDel.map((w) => w.id)),
    keepSample: [],
  });
  plan.push({
    table: "SavedPaymentMethod",
    delete: savedDel.length,
    keep: savedPay.length - savedDel.length,
    deleteSample: sample(savedDel.map((s) => s.id)),
    keepSample: [],
  });
  plan.push({
    table: "Session / Account / ResetToken",
    delete: sessDel.length + acctDel.length + resetDel.length,
    keep: sessions.length + accounts.length + resetTokens.length - (sessDel.length + acctDel.length + resetDel.length),
    deleteSample: sample([...sessDel, ...acctDel, ...resetDel].map((r) => r.id)),
    keepSample: [],
  });

  plan.push({
    table: "User (CUSTOMER demo)",
    delete: demoCustomerUsers.length,
    keep: users.length - demoCustomerUsers.length,
    deleteSample: sample(demoCustomerUsers.map((u) => u.email)),
    keepSample: sample(users.filter((u) => !demoCustomerIds.has(u.id)).map((u) => `${u.email} (${u.role})`)),
    note: "staff/admin/SUPER_ADMIN untouched",
  });

  plan.push({
    table: "ContactMessage",
    delete: 0,
    keep: contactMessages.length,
    deleteSample: [],
    keepSample: sample(contactMessages.map((m) => `${m.email}: ${m.subject}`)),
    note:
      contactMessages.length === 0
        ? "none present — nothing to decide"
        : "REAL submissions listed above — NOT deleted",
  });
  plan.push({
    table: "JobApplication",
    delete: 0,
    keep: jobApplications.length,
    deleteSample: [],
    keepSample: sample(jobApplications.map((a) => `${a.email}`)),
    note:
      jobApplications.length === 0
        ? "none present — nothing to decide"
        : "REAL applications listed — NOT deleted",
  });
  plan.push({
    table: "EmailSendJob",
    delete: emailJobs.length,
    keep: 0,
    deleteSample: sample(emailJobs.map((j) => j.subject)),
    keepSample: [],
    note: emailJobs.length === 0 ? "none" : "broadcast jobs referencing demo audience",
  });

  plan.push({
    table: "Product (KEEP)",
    delete: 0,
    keep: products.length,
    deleteSample: [],
    keepSample: sample(products.map((p) => p.slug)),
  });
  plan.push({
    table: "Collection (KEEP)",
    delete: 0,
    keep: collections.length,
    deleteSample: [],
    keepSample: sample(collections.map((c) => c.slug)),
  });
  plan.push({
    table: "SiteSetting (KEEP)",
    delete: 0,
    keep: siteSettings.length,
    deleteSample: [],
    keepSample: sample(siteSettings.map((s) => s.key)),
  });
  plan.push({
    table: "Consultant (KEEP)",
    delete: 0,
    keep: consultants.length,
    deleteSample: [],
    keepSample: sample(consultants.map((c) => c.name)),
  });
  plan.push({
    table: "StaffProfile (KEEP)",
    delete: 0,
    keep: staffProfiles.length,
    deleteSample: [],
    keepSample: sample(staffProfiles.map((s) => s.id)),
  });
  plan.push({
    table: "JobPosting (KEEP)",
    delete: 0,
    keep: jobPostings.length,
    deleteSample: [],
    keepSample: sample(jobPostings.map((j) => j.slug)),
  });

  printPlan();

  // ------------------------------------------------------------------ Cloudinary orphans
  const orphanUrls = collectUrls(
    consultations.map((c) => c.paymentReceiptUrl),
    consultations.map((c) => c.moodboardImages),
    consultations.map((c) => c.referenceImages),
    bespokeOrders.map((o) => o.paymentReceiptUrl),
    bespokeOrders.map((o) => o.moodboardImages),
    stageUpdates.map((s) => s.images),
    stageUpdates.map((s) => s.videos),
    rtwOrders.map((o) => o.paymentReceiptUrl),
    quotations.map((q) => q.pdfUrl),
    bespokeRequests.map((r) => r.referenceImages),
    bespokeRequests.map((r) => r.sketchUrls),
    moodboards.map((m) => m.images),
  );
  const orphanIds = Array.from(
    new Set(orphanUrls.map((u) => publicIdFromCloudinaryUrl(u)).filter((id): id is string => Boolean(id))),
  );
  const orphanPath = join(__dirname, "orphaned-cloudinary-ids.json");
  writeFileSync(
    orphanPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        note: "Do not delete from Cloudinary in this pass. Cleanup is a separate reversible step.",
        count: orphanIds.length,
        publicIds: orphanIds,
        urls: orphanUrls.filter((u) => u.includes("cloudinary.com")),
      },
      null,
      2,
    ),
  );
  console.log(`\nCloudinary orphans: ${orphanIds.length} public ID(s) → ${orphanPath}`);
  for (const id of orphanIds.slice(0, 10)) console.log(`  - ${id}`);

  if (!APPLY) {
    console.log("\nPLAN ONLY — no rows deleted. Re-run with --apply to write.");
    return;
  }

  // ------------------------------------------------------------------ apply
  console.log("\nApplying purge…");

  try {
    await prisma.$transaction(
      async (tx) => {
        if (paymentsExist && paymentRows.length > 0) {
          await tx.$executeRaw`DELETE FROM "Payment"`;
        }

        if (couponUsages.length) await tx.couponUsage.deleteMany({});
        if (orderItems.length) await tx.orderItem.deleteMany({});
        if (cartItems.length) await tx.cartItem.deleteMany({ where: { userId: { in: Array.from(demoCustomerIds) } } });
        if (reviewVotes.length) await tx.reviewHelpfulVote.deleteMany({});
        if (reviews.length) await tx.review.deleteMany({});
        if (testimonials.length) await tx.testimonial.deleteMany({});
        if (pointsTx.length) await tx.pointsTransaction.deleteMany({});

        if (adminNotifsDelete.length) {
          await tx.adminNotification.deleteMany({ where: { id: { in: adminNotifsDelete.map((n) => n.id) } } });
        }
        if (customerNotifsDelete.length) {
          await tx.customerNotification.deleteMany({
            where: { id: { in: customerNotifsDelete.map((n) => n.id) } },
          });
        }
        if (staffNotifsDelete.length) {
          await tx.staffNotification.deleteMany({ where: { id: { in: staffNotifsDelete.map((n) => n.id) } } });
        }
        if (activityDelete.length) {
          await tx.activityLog.deleteMany({ where: { id: { in: activityDelete.map((a) => a.id) } } });
        }

        if (stageUpdates.length) await tx.stageUpdate.deleteMany({});
        if (assignments.length) await tx.orderAssignment.deleteMany({});
        if (materials.length) await tx.material.deleteMany({});

        if (invoices.length) await tx.invoice.deleteMany({});
        if (quotations.length) {
          await tx.bespokeOrder.updateMany({ data: { quotationId: null } });
          await tx.quotation.deleteMany({});
        }
        if (bespokeOrders.length) await tx.bespokeOrder.deleteMany({});
        if (consultations.length) await tx.consultationBooking.deleteMany({});
        if (bespokeRequests.length) await tx.bespokeRequest.deleteMany({});
        if (rtwOrders.length) await tx.order.deleteMany({});

        if (notesDel.length) await tx.clientNote.deleteMany({ where: { id: { in: notesDel.map((n) => n.id) } } });
        if (eventsDel.length) await tx.eventDate.deleteMany({ where: { id: { in: eventsDel.map((e) => e.id) } } });
        if (boardsDel.length) await tx.moodboard.deleteMany({ where: { id: { in: boardsDel.map((m) => m.id) } } });
        if (measDel.length) await tx.measurement.deleteMany({ where: { id: { in: measDel.map((m) => m.id) } } });
        if (demoClientProfiles.length) {
          await tx.clientProfile.deleteMany({ where: { id: { in: Array.from(demoProfileIds) } } });
        }

        if (addrDel.length) await tx.address.deleteMany({ where: { id: { in: addrDel.map((a) => a.id) } } });
        if (wishDel.length) await tx.wishlistItem.deleteMany({ where: { id: { in: wishDel.map((w) => w.id) } } });
        if (savedDel.length) {
          await tx.savedPaymentMethod.deleteMany({ where: { id: { in: savedDel.map((s) => s.id) } } });
        }
        if (sessDel.length) await tx.session.deleteMany({ where: { id: { in: sessDel.map((s) => s.id) } } });
        if (acctDel.length) await tx.account.deleteMany({ where: { id: { in: acctDel.map((a) => a.id) } } });
        if (resetDel.length) {
          await tx.passwordResetToken.deleteMany({ where: { id: { in: resetDel.map((t) => t.id) } } });
        }

        if (emailJobs.length) await tx.emailSendJob.deleteMany({});

        // Clear referral pointers among demo customers so user delete is not blocked.
        await tx.user.updateMany({
          where: { referredById: { in: Array.from(demoCustomerIds) } },
          data: { referredById: null },
        });

        if (demoCustomerIds.size) {
          await tx.user.deleteMany({ where: { id: { in: Array.from(demoCustomerIds) } } });
        }
      },
      { timeout: 120_000 },
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      console.error("FK blocked a delete (P2003). Stopped without adding cascades.");
      console.error(e.meta ?? e.message);
      process.exit(1);
    }
    throw e;
  }

  const [bo, inv, cb, ord, paidBo] = await Promise.all([
    prisma.bespokeOrder.count(),
    prisma.invoice.count(),
    prisma.consultationBooking.count(),
    prisma.order.count(),
    prisma.bespokeOrder.count({ where: { amountPaid: { gt: 0 } } }),
  ]);
  console.log("\n=== AFTER ===");
  console.log(`BespokeOrder=${bo} Invoice=${inv} ConsultationBooking=${cb} Order=${ord} amountPaid>0=${paidBo}`);
  console.log(
    `Users remaining: ${(await prisma.user.findMany({ select: { email: true, role: true } })).map((u) => `${u.email} (${u.role})`).join(", ")}`,
  );
  console.log("Purge applied.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
