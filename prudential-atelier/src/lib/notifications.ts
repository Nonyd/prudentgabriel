import type {
  AdminNotificationType,
  BespokeRequest,
  ConsultationBooking,
  Order,
  Product,
  ProductVariant,
  Quotation,
  Review,
  User,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

function formatNGN(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

export async function createNotification(params: {
  type: AdminNotificationType;
  title: string;
  message: string;
  link?: string;
  entityId?: string;
}): Promise<void> {
  await prisma.adminNotification.create({
    data: {
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link ?? null,
      entityId: params.entityId ?? null,
    },
  });
}

export function notifyNewOrder(order: Pick<Order, "id" | "orderNumber" | "total" | "paymentGateway">): void {
  const gw = order.paymentGateway ?? "—";
  void createNotification({
    type: "NEW_ORDER",
    title: "New order",
    message: `#${order.orderNumber} — ${formatNGN(order.total)} via ${gw}`,
    link: `/admin/orders/${order.id}`,
    entityId: order.id,
  }).catch(() => {});
}

export function notifyNewBespoke(request: Pick<BespokeRequest, "id" | "requestNumber" | "name">): void {
  void createNotification({
    type: "NEW_BESPOKE",
    title: "New bespoke request",
    message: `${request.requestNumber} — ${request.name}`,
    link: `/admin/bespoke/${request.id}`,
    entityId: request.id,
  }).catch(() => {});
}

export function notifyNewConsultation(booking: Pick<ConsultationBooking, "id" | "bookingNumber" | "clientName">): void {
  void createNotification({
    type: "NEW_CONSULTATION",
    title: "New consultation",
    message: `${booking.bookingNumber} — ${booking.clientName}`,
    link: `/admin/consultations`,
    entityId: booking.id,
  }).catch(() => {});
}

export function notifyReviewPending(review: Pick<Review, "id" | "productId">, productName: string): void {
  void createNotification({
    type: "REVIEW_PENDING",
    title: "Review pending approval",
    message: `${productName} — review ${review.id.slice(0, 8)}…`,
    link: `/admin/reviews`,
    entityId: review.id,
  }).catch(() => {});
}

export function notifyReviewSubmitted(params: {
  reviewId: string;
  productName: string;
  userName: string;
  rating: number;
}): void {
  void createNotification({
    type: "REVIEW_PENDING",
    title: "New review submitted",
    message: `${params.userName} left a ${params.rating}-star review on ${params.productName}`,
    link: "/admin/reviews",
    entityId: params.reviewId,
  }).catch(() => {});
}

export function notifyConsultationReviewSubmitted(params: {
  reviewId: string;
  userName: string;
  rating: number;
}): void {
  void createNotification({
    type: "REVIEW_PENDING",
    title: "New consultation review",
    message: `${params.userName} left a ${params.rating}-star consultation review`,
    link: "/admin/reviews?tab=consultation",
    entityId: params.reviewId,
  }).catch(() => {});
}

export function notifyTestimonialSubmitted(params: {
  testimonialId: string;
  userName: string;
  rating: number;
}): void {
  void createNotification({
    type: "TESTIMONIAL_SUBMITTED",
    title: "New testimonial submitted",
    message: `${params.userName} submitted a ${params.rating}-star testimonial`,
    link: "/admin/reviews?tab=testimonials",
    entityId: params.testimonialId,
  }).catch(() => {});
}

export function notifyLowStock(product: Pick<Product, "name">, variant: Pick<ProductVariant, "id" | "size" | "stock">): void {
  void createNotification({
    type: "LOW_STOCK",
    title: "Low stock",
    message: `${product.name} — size ${variant.size} (${variant.stock} left)`,
    link: `/admin/products`,
    entityId: variant.id,
  }).catch(() => {});
}

export function notifyPaymentFailed(order: Pick<Order, "id" | "orderNumber">): void {
  void createNotification({
    type: "PAYMENT_FAILED",
    title: "Payment failed",
    message: `Order #${order.orderNumber}`,
    link: `/admin/orders/${order.id}`,
    entityId: order.id,
  }).catch(() => {});
}

export function notifyNewCustomer(user: Pick<User, "id" | "name" | "email">): void {
  void createNotification({
    type: "NEW_CUSTOMER",
    title: "New customer",
    message: `${user.name ?? "—"} — ${user.email}`,
    link: `/admin/customers`,
    entityId: user.id,
  }).catch(() => {});
}

export function notifyBankTransferReceipt(params: {
  ref: string;
  clientName: string;
  amountNGN: number;
  link: string;
  entityId: string;
}): void {
  void createNotification({
    type: "NEW_ORDER",
    title: "Bank transfer receipt",
    message: `${params.clientName} — ${params.ref} · ${formatNGN(params.amountNGN)}`,
    link: params.link,
    entityId: params.entityId,
  }).catch(() => {});
}

export function notifyQuoteApproved(quote: Pick<Quotation, "id" | "quoteRef" | "clientName" | "total">): void {
  void createNotification({
    type: "NEW_BESPOKE",
    title: "Quote approved",
    message: `${quote.quoteRef} — ${quote.clientName} · ${formatNGN(quote.total)}`,
    link: `/admin/quotations`,
    entityId: quote.id,
  }).catch(() => {});
}

export function notifyStageAdvanced(params: {
  orderId: string;
  orderRef: string;
  stage: string;
}): void {
  void createNotification({
    type: "NEW_BESPOKE",
    title: "Production stage completed",
    message: `${params.orderRef} — ${params.stage}`,
    link: `/admin/bespoke/${params.orderId}`,
    entityId: params.orderId,
  }).catch(() => {});
}

export function notifyJobApplication(params: {
  applicationId: string;
  name: string;
  jobTitle: string;
}): void {
  void createNotification({
    type: "JOB_APPLICATION",
    title: "New job application",
    message: `${params.name} applied for ${params.jobTitle}`,
    link: `/admin/careers/applications/${params.applicationId}`,
    entityId: params.applicationId,
  }).catch(() => {});
}
