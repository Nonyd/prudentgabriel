import type {
  AdminNotificationType,
  BespokeRequest,
  ConsultationBooking,
  Order,
  Product,
  ProductVariant,
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
