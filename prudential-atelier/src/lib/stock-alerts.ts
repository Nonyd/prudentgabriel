import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { restockEmailHtml } from "@/lib/email-templates/reports";
import { getPublicAppUrl } from "@/lib/app-url";

/** Notify subscribers when a variant is back in stock, then remove alerts. */
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

  for (const alert of alerts) {
    if (alert.variant.stock <= 0) continue;

    const shopUrl = `${appUrl}/shop/${alert.variant.product.slug}`;
    await sendEmail({
      to: alert.email,
      subject: `Back in stock — ${alert.variant.product.name} | Prudential Atelier`,
      html: restockEmailHtml(alert.variant.product.name, alert.variant.size, shopUrl),
      template: "stock-alert",
      idempotencyKey: `stock-alert:${alert.id}`,
      relatedType: "StockAlert",
      relatedId: alert.id,
    });

    await prisma.stockAlert.delete({ where: { id: alert.id } });
    sent += 1;
  }

  return sent;
}
