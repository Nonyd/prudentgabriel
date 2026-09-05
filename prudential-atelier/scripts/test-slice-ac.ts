/**
 * Slice AC: cascade product delete — quiet vs loud, snapshot, rollback.
 *
 *   pnpm test:slice-ac
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import "./preload-test-env";
import {
  ConsultationDeliveryMode,
  ConsultationSessionType,
  ConsultationStatus,
  OrderStatus,
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  ProductCategory,
  ProductType,
  QuoteStatus,
  Role,
  StockMovementReason,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  assertCascadeAllowed,
  cascadeDeletionsInPeriod,
  executeProductCascade,
  previewProductCascade,
  PRODUCT_CASCADE_DEPENDENCIES,
  ProductCascadeError,
} from "../src/lib/product-cascade-delete";
import { cascadeDialogCopy } from "../src/lib/product-cascade-copy";
import {
  CONSULTATION_CASCADE_DEPENDENCIES,
  executeConsultationCascade,
  previewConsultationCascade,
} from "../src/lib/consultation-cascade-delete";
import { consultationDialogCopy } from "../src/lib/consultation-cascade-copy";
import { customRange } from "../src/lib/finance/period";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const stamp = `ac-${Date.now()}`;
const ids = {
  productIds: [] as string[],
  userIds: [] as string[],
  orderIds: [] as string[],
  sessionIds: [] as string[],
  bookingIds: [] as string[],
  consultantIds: [] as string[],
};

async function cleanup() {
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.ledger_bypass = 'on'`);
      if (ids.orderIds.length) {
        await tx.payment.deleteMany({ where: { orderId: { in: ids.orderIds } } });
        await tx.pointsTransaction.deleteMany({ where: { orderId: { in: ids.orderIds } } });
        await tx.order.deleteMany({ where: { id: { in: ids.orderIds } } });
      }
      if (ids.sessionIds.length) {
        await tx.checkoutSession.deleteMany({ where: { id: { in: ids.sessionIds } } });
      }
      if (ids.bookingIds.length) {
        await tx.payment.deleteMany({ where: { consultationId: { in: ids.bookingIds } } });
        await tx.review.deleteMany({ where: { consultationId: { in: ids.bookingIds } } });
        await tx.bespokeOrder.deleteMany({ where: { consultationId: { in: ids.bookingIds } } });
        await tx.quotation.deleteMany({ where: { consultationId: { in: ids.bookingIds } } });
        await tx.consultationBooking.deleteMany({ where: { id: { in: ids.bookingIds } } });
      }
      if (ids.consultantIds.length) {
        await tx.consultant.deleteMany({ where: { id: { in: ids.consultantIds } } });
      }
      if (ids.productIds.length) {
        await tx.cartItem.deleteMany({ where: { productId: { in: ids.productIds } } });
        await tx.wishlistItem.deleteMany({ where: { productId: { in: ids.productIds } } });
        await tx.review.deleteMany({ where: { productId: { in: ids.productIds } } });
        await tx.product.deleteMany({ where: { id: { in: ids.productIds } } });
      }
      await tx.activityLog.deleteMany({ where: { recordId: { in: [...ids.productIds, ...ids.bookingIds] } } });
      if (ids.userIds.length) {
        await tx.clientProfile.deleteMany({ where: { userId: { in: ids.userIds } } });
        await tx.user.deleteMany({ where: { id: { in: ids.userIds } } });
      }
    },
    { timeout: 60_000 },
  );
}

function actor(role: "SUPER_ADMIN" | "ADMIN") {
  return {
    userId: `ac-actor-${stamp}`,
    email: `${role.toLowerCase()}+${stamp}@example.test`,
    role,
    ip: "127.0.0.1",
  };
}

async function makeProduct(slug: string, extras?: { sku?: string }) {
  const product = await prisma.product.create({
    data: {
      name: `AC ${slug}`,
      slug: `${stamp}-${slug}`,
      description: "cascade test",
      category: ProductCategory.FORMAL,
      type: ProductType.RTW,
      priceNGN: 90_000,
      basePriceNGN: 90_000,
      isPublished: true,
      images: { create: [{ url: `/media/public/test/${stamp}-${slug}.jpg`, isPrimary: true, sortOrder: 0 }] },
      variants: {
        create: [{ size: "12", priceNGN: 90_000, stock: 2, sku: extras?.sku ?? `${stamp}-${slug}-12` }],
      },
    },
    include: { variants: true },
  });
  ids.productIds.push(product.id);
  return product;
}

async function makeCustomer(tag: string) {
  const user = await prisma.user.create({
    data: { email: `${tag}+${stamp}@example.test`, name: tag, role: Role.CUSTOMER },
  });
  ids.userIds.push(user.id);
  return user;
}

let offeringCache: { consultantId: string; offeringId: string } | null = null;
let bookingSeq = 0;

async function getOffering() {
  if (offeringCache) return offeringCache;
  const consultant = await prisma.consultant.create({
    data: {
      name: `AC Consultant ${stamp}`,
      title: "Stylist",
      bio: "cascade test",
      offerings: {
        create: {
          sessionType: ConsultationSessionType.BESPOKE_DESIGN,
          deliveryMode: ConsultationDeliveryMode.VIRTUAL_STANDARD,
          durationMinutes: 60,
          feeNGN: 50_000,
        },
      },
    },
    include: { offerings: true },
  });
  ids.consultantIds.push(consultant.id);
  offeringCache = { consultantId: consultant.id, offeringId: consultant.offerings[0]!.id };
  return offeringCache;
}

async function makeBooking(tag: string, extras?: {
  status?: ConsultationStatus;
  userId?: string;
  referenceImages?: string[];
  paymentReceiptUrl?: string | null;
}) {
  bookingSeq += 1;
  const offering = await getOffering();
  const booking = await prisma.consultationBooking.create({
    data: {
      bookingNumber: `CB-AC-${stamp}-${bookingSeq}`,
      offeringId: offering.offeringId,
      consultantId: offering.consultantId,
      userId: extras?.userId,
      clientName: tag,
      clientEmail: `${tag}+${stamp}@example.test`,
      clientPhone: "+2348000000000",
      clientCountry: "NG",
      occasion: "Test",
      description: "cascade test",
      offeringType: "VIRTUAL_STANDARD",
      feeNGN: 50_000,
      status: extras?.status ?? ConsultationStatus.CANCELLED_BY_ADMIN,
      referenceImages: extras?.referenceImages ?? [],
      paymentReceiptUrl: extras?.paymentReceiptUrl ?? undefined,
    },
  });
  ids.bookingIds.push(booking.id);
  return booking;
}

function runCopy() {
  assert(PRODUCT_CASCADE_DEPENDENCIES.includes("Payment"), "dependency list names Payment");
  assert(PRODUCT_CASCADE_DEPENDENCIES.includes("CheckoutSession"), "dependency list names CheckoutSession");
  const quiet = cascadeDialogCopy({
    loud: false,
    productCount: 17,
    productsWithOrders: 0,
    products: [],
    orders: [],
    payments: [],
    siblingPieces: [],
    customerEmails: [],
    receivedNGN: 0,
    mediaUrls: [],
  });
  assert(quiet.heading === "17 pieces will be deleted.", "quiet heading counts pieces");
  assert(quiet.lines.some((l) => l.includes("None have been ordered")), "quiet path says none were ordered");

  const loud = cascadeDialogCopy({
    loud: true,
    productCount: 17,
    productsWithOrders: 2,
    products: [],
    orders: [{ id: "o1", orderNumber: "PG-1", date: new Date().toISOString(), totalNGN: 0, receivedNGN: 0, customerEmail: "a@b.c" }],
    payments: [],
    siblingPieces: [
      { id: "avril", name: "Avril" },
      { id: "celine", name: "Celine Jumpsuit" },
    ],
    customerEmails: ["a@b.c"],
    receivedNGN: 0,
    mediaUrls: [],
  });
  assert(loud.lines.some((l) => l.includes("2 have been ordered")), "loud path says how many were ordered");
  assert(loud.lines.some((l) => l.includes("₦0 received")), "loud path shows the money");
  assert(loud.lines.some((l) => l.includes("1 customer's order history")), "loud path counts customers");
  assert(
    loud.lines.some((l) => l.includes("2 other pieces lose their sale record") && l.includes("Avril") && l.includes("Celine Jumpsuit")),
    "loud path names other pieces that lose history",
  );

  try {
    assertCascadeAllowed("ADMIN", true);
    throw new Error("ADMIN must not pass the loud gate");
  } catch (e) {
    assert(e instanceof ProductCascadeError && e.status === 403, "ADMIN gets 403 on the loud path");
  }
  assertCascadeAllowed("ADMIN", false);
  assertCascadeAllowed("SUPER_ADMIN", true);

  const cascadeSrc = readFileSync(join(process.cwd(), "src/app/api/admin/products/cascade/route.ts"), "utf8");
  assert(cascadeSrc.includes("requireSuperAdminApi"), "loud execute is Super Admin gated");

  assert(CONSULTATION_CASCADE_DEPENDENCIES.includes("Payment"), "consultation deps name Payment");
  assert(CONSULTATION_CASCADE_DEPENDENCIES.includes("Quotation"), "consultation deps name Quotation");
  assert(CONSULTATION_CASCADE_DEPENDENCIES.includes("ClientProfile (never)"), "consultation deps keep the client");
  const consultSrc = readFileSync(join(process.cwd(), "src/app/api/admin/consultations/cascade/route.ts"), "utf8");
  assert(consultSrc.includes("requireSuperAdminApi"), "loud consultation execute is Super Admin gated");
  assert(consultSrc.includes("destroyStoredMedia"), "private media is removed after commit");
  const consultIdx = consultSrc.indexOf("executeConsultationCascade");
  assert(consultIdx >= 0 && consultSrc.indexOf("destroyStoredMedia", consultIdx) > consultIdx, "media destroy runs after the transaction");

  const quietConsult = consultationDialogCopy({
    loud: false,
    blocked: false,
    blockReason: null,
    bookingCount: 1,
    bookings: [{
      id: "b1",
      bookingNumber: "CB-26-92143",
      clientName: "Ada",
      clientEmail: "ada@example.test",
      type: "VIRTUAL_STANDARD",
      date: new Date().toISOString(),
      feeNGN: 0,
      feePaidNGN: 0,
      quotationRefs: [],
    }],
    payments: [],
    quotationRefs: [],
    commissionRefs: [],
    invoiceRefs: [],
    receivedNGN: 0,
    mediaUrls: [],
  });
  assert(quietConsult.lines.some((l) => l.includes("No payment and no quotation")), "quiet consultation copy");
  assert(quietConsult.lines.some((l) => l.includes("client record is kept")), "quiet consultation keeps the client");

  const blockedConsult = consultationDialogCopy({
    loud: false,
    blocked: true,
    blockReason: "This consultation produced commission BO-1.",
    bookingCount: 1,
    bookings: [],
    payments: [],
    quotationRefs: ["QT-1"],
    commissionRefs: ["BO-1"],
    invoiceRefs: [],
    receivedNGN: 0,
    mediaUrls: [],
  });
  assert(blockedConsult.blocked === true, "blocked consultation has no Delete path");
  assert(blockedConsult.lines.some((l) => l.includes("atelier order")), "blocked copy points at the atelier order");
}

async function quietDeletesCleanly() {
  const user = await makeCustomer("quiet");
  const product = await makeProduct("quiet");
  const variant = product.variants[0]!;
  await prisma.stockMovement.create({
    data: { variantId: variant.id, delta: 2, reason: StockMovementReason.OPENING },
  });
  await prisma.cartItem.create({
    data: { userId: user.id, productId: product.id, variantId: variant.id, quantity: 1, lineKey: `STANDARD:${variant.id}:none` },
  });
  await prisma.wishlistItem.create({ data: { userId: user.id, productId: product.id } });
  await prisma.review.create({ data: { userId: user.id, productId: product.id, rating: 5, body: "nice" } });
  await prisma.stockAlert.create({ data: { email: user.email, variantId: variant.id } });

  const preview = await previewProductCascade([product.id]);
  assert(preview.loud === false, "no orders means the quiet path");
  assert(preview.receivedNGN === 0, "quiet preview has no money");

  const result = await executeProductCascade({
    productIds: [product.id],
    actor: actor("ADMIN"),
  });
  assert(result.loud === false, "quiet execute does not require DELETE");
  assert(!(await prisma.product.findUnique({ where: { id: product.id } })), "quiet product is gone");
  assert((await prisma.cartItem.count({ where: { productId: product.id } })) === 0, "cart lines are gone");
  assert((await prisma.wishlistItem.count({ where: { productId: product.id } })) === 0, "wishlist rows are gone");
  assert((await prisma.review.count({ where: { productId: product.id } })) === 0, "reviews are gone");
  assert((await prisma.stockMovement.count({ where: { variantId: variant.id } })) === 0, "stock movements are gone");
  assert((await prisma.stockAlert.count({ where: { variantId: variant.id } })) === 0, "stock alerts are gone");
}

async function loudNeedsTypedDeleteAndRemovesDependents() {
  const user = await makeCustomer("loud");
  const product = await makeProduct("loud");
  const variant = product.variants[0]!;
  const order = await prisma.order.create({
    data: {
      orderNumber: `AC-LOUD-${stamp}`,
      userId: user.id,
      subtotal: 90_000,
      total: 90_000,
      paymentStatus: PaymentStatus.PAID,
      status: OrderStatus.CONFIRMED,
      items: {
        create: { productId: product.id, variantId: variant.id, quantity: 1, size: "12", price: 90_000, lineTotal: 90_000 },
      },
    },
  });
  ids.orderIds.push(order.id);
  await prisma.payment.create({
    data: {
      reference: `AC-LOUD-${stamp}`,
      amount: 90_000,
      currency: "NGN",
      method: PaymentMethod.BANK_TRANSFER,
      status: PaymentStatus.CONFIRMED,
      purpose: PaymentPurpose.RTW_ORDER,
      orderId: order.id,
      clientId: user.id,
      confirmedAt: new Date("2026-09-05T10:00:00+01:00"),
    },
  });
  const session = await prisma.checkoutSession.create({
    data: {
      email: user.email,
      orderId: order.id,
      cartSnapshot: {
        lines: [{ productId: product.id, productName: product.name, productSlug: product.slug, variantId: variant.id, size: "12", imageUrl: "", priceNGN: 90_000, quantity: 1 }],
        subtotalNGN: 90_000,
      },
      furthestStep: 3,
    },
  });
  ids.sessionIds.push(session.id);

  const preview = await previewProductCascade([product.id]);
  assert(preview.loud === true, "orders make the loud path");
  assert(preview.orders.some((o) => o.orderNumber === `AC-LOUD-${stamp}`), "preview lists the order");
  assert(preview.receivedNGN === 90_000, `preview money is 90000, got ${preview.receivedNGN}`);

  try {
    await executeProductCascade({ productIds: [product.id], actor: actor("ADMIN") });
    throw new Error("ADMIN must not cascade orders");
  } catch (e) {
    assert(e instanceof ProductCascadeError && e.status === 403, "ADMIN gets 403 on the loud path");
  }
  assert(await prisma.product.findUnique({ where: { id: product.id } }), "ADMIN refusal left the product");

  try {
    await executeProductCascade({ productIds: [product.id], actor: actor("SUPER_ADMIN") });
    throw new Error("loud path must require DELETE");
  } catch (e) {
    assert(e instanceof ProductCascadeError && e.code === "CONFIRM", "loud path requires typed DELETE");
  }

  const result = await executeProductCascade({
    productIds: [product.id],
    actor: actor("SUPER_ADMIN"),
    confirmation: "DELETE",
  });
  assert(result.loud === true, "loud execute ran");
  assert(!(await prisma.product.findUnique({ where: { id: product.id } })), "ordered product is gone");
  assert(!(await prisma.order.findUnique({ where: { id: order.id } })), "the order is gone");
  assert((await prisma.payment.count({ where: { orderId: order.id } })) === 0, "payments are gone");
  assert((await prisma.orderItem.count({ where: { productId: product.id } })) === 0, "order items are gone");
  assert((await prisma.checkoutSession.count({ where: { id: session.id } })) === 0, "checkout sessions are gone");

  const log = await prisma.activityLog.findUnique({ where: { id: result.logId } });
  assert(log, "ActivityLog row exists");
  const snap = log!.snapshot as { orders?: { orderNumber: string; totalNGN: number }[]; payments?: { amountNGN: number }[]; receivedNGN?: number };
  assert(snap.orders?.some((o) => o.orderNumber === `AC-LOUD-${stamp}`), "snapshot contains the order number");
  assert(snap.payments?.some((p) => p.amountNGN === 90_000), "snapshot contains the payment amount");
  assert(snap.receivedNGN === 90_000, "snapshot stores received money");

  const sept = customRange("2026-09-01", "2026-09-30");
  const note = await cascadeDeletionsInPeriod(sept.from, sept.to);
  assert(note.paymentCount >= 1, "September ledger notes the deleted payment");
  assert(note.logIds.includes(result.logId), "ledger note links the log entry");
}

async function failureRollsBack() {
  const user = await makeCustomer("fail");
  const product = await makeProduct("fail");
  const order = await prisma.order.create({
    data: {
      orderNumber: `AC-FAIL-${stamp}`,
      userId: user.id,
      subtotal: 40_000,
      total: 40_000,
      paymentStatus: PaymentStatus.PAID,
      status: OrderStatus.CONFIRMED,
      items: {
        create: { productId: product.id, quantity: 1, size: "10", price: 40_000, lineTotal: 40_000 },
      },
    },
  });
  ids.orderIds.push(order.id);
  await prisma.payment.create({
    data: {
      reference: `AC-FAIL-${stamp}`,
      amount: 40_000,
      currency: "NGN",
      method: PaymentMethod.PAYSTACK,
      status: PaymentStatus.CONFIRMED,
      purpose: PaymentPurpose.RTW_ORDER,
      orderId: order.id,
      clientId: user.id,
    },
  });

  try {
    await executeProductCascade({
      productIds: [product.id],
      actor: actor("SUPER_ADMIN"),
      confirmation: "DELETE",
      injectFailure: "after-graph",
    });
    throw new Error("injected failure should throw");
  } catch (e) {
    assert(e instanceof Error && e.message === "injected cascade failure", "injected failure escaped");
  }
  assert(await prisma.product.findUnique({ where: { id: product.id } }), "failed txn left the product");
  assert(await prisma.order.findUnique({ where: { id: order.id } }), "failed txn left the order");
  assert((await prisma.payment.count({ where: { orderId: order.id } })) === 1, "failed txn left the payment");
}

async function siblingPiecesNamedInWarning() {
  const user = await makeCustomer("sib");
  const dress = await makeProduct("avril");
  const kept = await makeProduct("celine");
  const order = await prisma.order.create({
    data: {
      orderNumber: `AC-SIB-${stamp}`,
      userId: user.id,
      subtotal: 180_000,
      total: 180_000,
      paymentStatus: PaymentStatus.PAID,
      status: OrderStatus.CONFIRMED,
      items: {
        create: [
          { productId: dress.id, variantId: dress.variants[0]!.id, quantity: 1, size: "12", price: 90_000, lineTotal: 90_000 },
          { productId: kept.id, variantId: kept.variants[0]!.id, quantity: 1, size: "12", price: 90_000, lineTotal: 90_000 },
        ],
      },
    },
  });
  ids.orderIds.push(order.id);
  await prisma.payment.create({
    data: {
      reference: `AC-SIB-${stamp}`,
      amount: 180_000,
      currency: "NGN",
      method: PaymentMethod.BANK_TRANSFER,
      status: PaymentStatus.CONFIRMED,
      purpose: PaymentPurpose.RTW_ORDER,
      orderId: order.id,
      clientId: user.id,
    },
  });

  const preview = await previewProductCascade([dress.id]);
  assert(preview.siblingPieces.some((p) => p.id === kept.id && p.name === kept.name), "preview names the other piece on the order");
  const copy = cascadeDialogCopy(preview);
  assert(
    copy.lines.some((l) => l.includes("1 other piece loses its sale record") && l.includes(kept.name)),
    "warning names the piece that stays in the catalogue",
  );

  const result = await executeProductCascade({
    productIds: [dress.id],
    actor: actor("SUPER_ADMIN"),
    confirmation: "DELETE",
  });
  assert(await prisma.product.findUnique({ where: { id: kept.id } }), "the other piece stays in the catalogue");
  assert(!(await prisma.order.findUnique({ where: { id: order.id } })), "the shared order is gone");
  const log = await prisma.activityLog.findUnique({ where: { id: result.logId } });
  const snap = log!.snapshot as { siblingPieces?: { id: string; name: string }[] };
  assert(snap.siblingPieces?.some((p) => p.id === kept.id), "snapshot records the sibling piece");
}

async function quietConsultationDeletesAndKeepsClient() {
  const user = await makeCustomer("cq");
  const profile = await prisma.clientProfile.create({ data: { userId: user.id } });
  const booking = await makeBooking("quiet-consult", {
    status: ConsultationStatus.CANCELLED_BY_ADMIN,
    userId: user.id,
  });

  const preview = await previewConsultationCascade([booking.id]);
  assert(preview.loud === false, "cancelled with no payment is quiet");
  assert(preview.blocked === false, "quiet consultation is not blocked");

  const result = await executeConsultationCascade({
    ids: [booking.id],
    actor: actor("ADMIN"),
  });
  assert(result.loud === false, "quiet consultation does not require DELETE");
  assert(!(await prisma.consultationBooking.findUnique({ where: { id: booking.id } })), "quiet booking is gone");
  assert(await prisma.clientProfile.findUnique({ where: { id: profile.id } }), "client profile survived");
  assert(await prisma.user.findUnique({ where: { id: user.id } }), "client user survived");
}

async function paidConsultationNeedsTypedDelete() {
  const user = await makeCustomer("cp");
  const booking = await makeBooking("paid-consult", {
    status: ConsultationStatus.CONFIRMED,
    userId: user.id,
    paymentReceiptUrl: "/media/private/ac-test/receipt.jpg",
    referenceImages: ["/media/private/ac-test/ref.jpg"],
  });
  await prisma.payment.create({
    data: {
      reference: `AC-CFEE-${stamp}`,
      amount: 50_000,
      currency: "NGN",
      method: PaymentMethod.BANK_TRANSFER,
      status: PaymentStatus.CONFIRMED,
      purpose: PaymentPurpose.CONSULTATION,
      consultationId: booking.id,
      clientId: user.id,
      receiptUrl: "/media/private/ac-test/pay-receipt.jpg",
      confirmedAt: new Date("2026-09-05T11:00:00+01:00"),
    },
  });

  const preview = await previewConsultationCascade([booking.id]);
  assert(preview.loud === true, "a paid fee is the loud path");
  assert(preview.receivedNGN === 50_000, `paid preview money is 50000, got ${preview.receivedNGN}`);
  assert(preview.mediaUrls.includes("/media/private/ac-test/ref.jpg"), "preview lists reference stills");
  assert(preview.mediaUrls.includes("/media/private/ac-test/receipt.jpg"), "preview lists the booking receipt");
  assert(preview.mediaUrls.includes("/media/private/ac-test/pay-receipt.jpg"), "preview lists the payment receipt");

  try {
    await executeConsultationCascade({ ids: [booking.id], actor: actor("ADMIN") });
    throw new Error("ADMIN must not delete a paid consultation");
  } catch (e) {
    assert(e instanceof ProductCascadeError && e.status === 403, "ADMIN gets 403 on a paid consultation");
  }
  assert(await prisma.consultationBooking.findUnique({ where: { id: booking.id } }), "ADMIN refusal left the booking");

  try {
    await executeConsultationCascade({ ids: [booking.id], actor: actor("SUPER_ADMIN") });
    throw new Error("loud consultation must require DELETE");
  } catch (e) {
    assert(e instanceof ProductCascadeError && e.code === "CONFIRM", "paid consultation requires typed DELETE");
  }

  const result = await executeConsultationCascade({
    ids: [booking.id],
    actor: actor("SUPER_ADMIN"),
    confirmation: "DELETE",
  });
  assert(result.loud === true, "loud consultation execute ran");
  assert(result.mediaUrls.includes("/media/private/ac-test/ref.jpg"), "result returns private media for after-commit destroy");
  assert(!(await prisma.consultationBooking.findUnique({ where: { id: booking.id } })), "paid booking is gone");
  assert((await prisma.payment.count({ where: { consultationId: booking.id } })) === 0, "consultation payments are gone");

  const log = await prisma.activityLog.findUnique({ where: { id: result.logId } });
  assert(log, "consultation ActivityLog row exists");
  const snap = log!.snapshot as {
    bookings?: { bookingNumber: string; clientName: string; clientEmail: string; feeNGN: number; feePaidNGN: number }[];
    receivedNGN?: number;
    actor?: { email: string | null };
  };
  assert(snap.bookings?.some((b) => b.bookingNumber === booking.bookingNumber), "snapshot contains the booking number");
  assert(snap.bookings?.some((b) => b.clientName === booking.clientName && b.clientEmail === booking.clientEmail), "snapshot contains the client");
  assert(snap.bookings?.some((b) => b.feePaidNGN === 50_000), "snapshot contains the fee paid");
  assert(snap.receivedNGN === 50_000, "snapshot stores received money");
  assert(snap.actor?.email?.includes("super_admin"), "snapshot records who deleted it");
}

async function quotedConsultationIsLoud() {
  const booking = await makeBooking("quoted-consult", { status: ConsultationStatus.COMPLETED });
  await prisma.quotation.create({
    data: {
      quoteRef: `QT-AC-${stamp}`,
      baseQuoteRef: `QT-AC-${stamp}`,
      clientName: booking.clientName,
      clientEmail: booking.clientEmail,
      lineItems: [],
      subtotal: 200_000,
      total: 200_000,
      status: QuoteStatus.SENT,
      consultationId: booking.id,
    },
  });

  const preview = await previewConsultationCascade([booking.id]);
  assert(preview.loud === true, "a quotation without a commission is loud");
  assert(preview.blocked === false, "an unconverted quotation is not blocked");
  assert(preview.quotationRefs.includes(`QT-AC-${stamp}`), "preview names the quotation");

  try {
    await executeConsultationCascade({ ids: [booking.id], actor: actor("SUPER_ADMIN") });
    throw new Error("quoted consultation must require DELETE");
  } catch (e) {
    assert(e instanceof ProductCascadeError && e.code === "CONFIRM", "quoted consultation requires typed DELETE");
  }

  await executeConsultationCascade({
    ids: [booking.id],
    actor: actor("SUPER_ADMIN"),
    confirmation: "DELETE",
  });
  assert(!(await prisma.consultationBooking.findUnique({ where: { id: booking.id } })), "quoted booking is gone");
  assert((await prisma.quotation.count({ where: { quoteRef: `QT-AC-${stamp}` } })) === 0, "quotation is gone");
}

async function commissionBlocksConsultationDelete() {
  const booking = await makeBooking("commission-consult", { status: ConsultationStatus.COMPLETED });
  const quote = await prisma.quotation.create({
    data: {
      quoteRef: `QT-AC-BO-${stamp}`,
      baseQuoteRef: `QT-AC-BO-${stamp}`,
      clientName: booking.clientName,
      clientEmail: booking.clientEmail,
      lineItems: [],
      subtotal: 400_000,
      total: 400_000,
      status: QuoteStatus.CONVERTED,
      consultationId: booking.id,
    },
  });
  const order = await prisma.bespokeOrder.create({
    data: {
      orderRef: `BO-AC-${stamp}`,
      clientName: booking.clientName,
      clientEmail: booking.clientEmail,
      consultationId: booking.id,
      quotationId: quote.id,
      totalAmount: 400_000,
    },
  });

  const preview = await previewConsultationCascade([booking.id]);
  assert(preview.blocked === true, "a live commission is blocked");
  assert(preview.loud === false, "blocked path is not the typed-DELETE path");
  assert(preview.commissionRefs.includes(order.orderRef), "preview names the commission");
  const copy = consultationDialogCopy(preview);
  assert(copy.blocked === true, "dialog copy has no Delete button");

  try {
    await executeConsultationCascade({
      ids: [booking.id],
      actor: actor("SUPER_ADMIN"),
      confirmation: "DELETE",
    });
    throw new Error("a commission must not be deletable from consultations");
  } catch (e) {
    assert(e instanceof ProductCascadeError && e.code === "BLOCKED" && e.status === 409, "commission delete is 409 BLOCKED");
  }
  assert(await prisma.consultationBooking.findUnique({ where: { id: booking.id } }), "blocked delete left the booking");
  assert(await prisma.bespokeOrder.findUnique({ where: { id: order.id } }), "blocked delete left the commission");
}

async function consultationFailureRollsBack() {
  const booking = await makeBooking("fail-consult", {
    status: ConsultationStatus.CANCELLED_BY_ADMIN,
    referenceImages: ["/media/private/ac-test/fail.jpg"],
  });
  const preview = await previewConsultationCascade([booking.id]);
  assert(preview.mediaUrls.includes("/media/private/ac-test/fail.jpg"), "failed path still reports media for after-commit destroy");

  try {
    await executeConsultationCascade({
      ids: [booking.id],
      actor: actor("ADMIN"),
      injectFailure: "after-graph",
    });
    throw new Error("injected consultation failure should throw");
  } catch (e) {
    assert(e instanceof Error && e.message === "injected cascade failure", "injected consultation failure escaped");
  }
  assert(await prisma.consultationBooking.findUnique({ where: { id: booking.id } }), "failed txn left the booking");
}

async function main() {
  runCopy();
  try {
    await quietDeletesCleanly();
    await loudNeedsTypedDeleteAndRemovesDependents();
    await failureRollsBack();
    await siblingPiecesNamedInWarning();
    await quietConsultationDeletesAndKeepsClient();
    await paidConsultationNeedsTypedDelete();
    await quotedConsultationIsLoud();
    await commissionBlocksConsultationDelete();
    await consultationFailureRollsBack();
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
  console.log("test-slice-ac: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
