import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { restockEmailHtml } from "@/lib/email-templates/reports";
import { getPublicAppUrl } from "@/lib/app-url";
import { CUSTOMER_HOUSE_NAME } from "@/lib/customer-email";
import { getNotificationPrefs } from "@/lib/account-helpers";

/** Notify StockAlert subscribers and wishlist owners who opted into restock mail. */
export async function processRestockAlerts(variantIds: string[]): Promise<number> {
  if (!variantIds.length) return 0;

  const alerts = await prisma.stockAlert.findMany({
    where: { variantId: { in: variantIds } },
    include: {
      variant: {
        include: { product: { select: { name: true, slug: true } } },
      },
    },
  });

  const appUrl = getPublicAppUrl();
  let sent = 0;
  const emailed = new Set<string>();

  for (const alert of alerts) {
    if (alert.variant.stock <= 0) continue;

    const shopUrl = `${appUrl}/shop/${alert.variant.product.slug}`;
    await sendEmail({
      to: alert.email,
      subject: `Back in stock — ${alert.variant.product.name} | ${CUSTOMER_HOUSE_NAME}`,
      html: restockEmailHtml(alert.variant.product.name, alert.variant.size, shopUrl),
      template: "stock-alert",
      idempotencyKey: `stock-alert:${alert.id}`,
      relatedType: "StockAlert",
      relatedId: alert.id,
    });

    await prisma.stockAlert.delete({ where: { id: alert.id } });
    emailed.add(alert.email.toLowerCase());
    sent += 1;
  }

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds }, stock: { gt: 0 } },
    select: {
      id: true,
      size: true,
      productId: true,
      product: { select: { name: true, slug: true } },
    },
  });

  for (const variant of variants) {
    const wish = await prisma.wishlistItem.findMany({
      where: { productId: variant.productId },
      include: { user: { select: { id: true, email: true } } },
    });
    for (const row of wish) {
      const email = row.user.email?.toLowerCase();
      if (!email || emailed.has(email)) continue;
      const prefs = await getNotificationPrefs(row.userId);
      if (prefs.wishlistRestock === false) continue;

      const shopUrl = `${appUrl}/shop/${variant.product.slug}`;
      await sendEmail({
        to: email,
        subject: `Back in stock — ${variant.product.name} | ${CUSTOMER_HOUSE_NAME}`,
        html: restockEmailHtml(variant.product.name, variant.size, shopUrl),
        template: "stock-alert",
        idempotencyKey: `wishlist-restock:${row.userId}:${variant.id}`,
        relatedType: "WishlistItem",
        relatedId: row.id,
      });
      emailed.add(email);
      sent += 1;
    }
  }

  return sent;
}
