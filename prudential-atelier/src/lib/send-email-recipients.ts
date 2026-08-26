import {
  BespokeStage,
  ConsultationStatus,
  LoyaltyTier,
  PaymentStatus,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeEmail, suppressedEmailSet } from "@/lib/email-consent";

export type SendEmailSource =
  | "newsletter"
  | "customers"
  | "rtw_purchasers"
  | "collection_buyers"
  | "gold_platinum"
  | "active_orders"
  | "upcoming_consultations"
  | "specific"
  | "custom"
  | "all";

export type SendEmailRecipientType = SendEmailSource;

export type RecipientPreview = {
  count: number;
  suppressed: number;
  sample: { id: string; name: string; email: string }[];
};

function addNamed(map: Map<string, string>, email: string | null | undefined, name?: string | null) {
  if (!email) return;
  const e = normalizeEmail(email);
  if (!e.includes("@")) return;
  if (!map.has(e)) map.set(e, name?.trim() || e);
}

async function collectFromSources(params: {
  sources: SendEmailSource[];
  collectionId?: string;
  specificUserId?: string;
  customEmail?: string;
}): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const sources = params.sources.map((s) => (s === "all" ? "customers" : s));

  for (const source of sources) {
    if (source === "custom") {
      addNamed(names, params.customEmail);
      continue;
    }
    if (source === "specific") {
      if (!params.specificUserId) continue;
      const user = await prisma.user.findUnique({
        where: { id: params.specificUserId },
        select: { email: true, name: true },
      });
      addNamed(names, user?.email, user?.name);
      continue;
    }
    if (source === "newsletter") {
      const rows = await prisma.newsletterSubscriber.findMany({
        where: { unsubscribedAt: null },
        select: { email: true },
      });
      for (const r of rows) addNamed(names, r.email);
      continue;
    }
    if (source === "customers") {
      const users = await prisma.user.findMany({
        where: { role: Role.CUSTOMER, email: { not: "" } },
        select: { email: true, name: true },
      });
      for (const u of users) addNamed(names, u.email, u.name);
      continue;
    }
    if (source === "gold_platinum") {
      const users = await prisma.user.findMany({
        where: {
          role: Role.CUSTOMER,
          clientProfile: { loyaltyTier: { in: [LoyaltyTier.GOLD, LoyaltyTier.PLATINUM] } },
        },
        select: { email: true, name: true },
      });
      for (const u of users) addNamed(names, u.email, u.name);
      continue;
    }
    if (source === "rtw_purchasers") {
      const orders = await prisma.order.findMany({
        where: { paymentStatus: PaymentStatus.PAID, isBespoke: false },
        select: { guestEmail: true, user: { select: { email: true, name: true } } },
      });
      for (const o of orders) {
        addNamed(names, o.user?.email ?? o.guestEmail, o.user?.name);
      }
      continue;
    }
    if (source === "collection_buyers") {
      if (!params.collectionId) continue;
      const collection = await prisma.collection.findUnique({
        where: { id: params.collectionId },
        select: { autoTag: true },
      });
      if (!collection) continue;
      const manuals = await prisma.collectionProduct.findMany({
        where: { collectionId: params.collectionId },
        select: { productId: true },
      });
      const productIds = new Set(manuals.map((m) => m.productId));
      const tag = collection.autoTag?.trim();
      if (tag) {
        const tagged = await prisma.product.findMany({
          where: { tags: { has: tag } },
          select: { id: true },
        });
        for (const p of tagged) productIds.add(p.id);
      }
      if (productIds.size === 0) continue;
      const items = await prisma.orderItem.findMany({
        where: {
          productId: { in: Array.from(productIds) },
          order: { paymentStatus: PaymentStatus.PAID },
        },
        select: {
          order: { select: { guestEmail: true, user: { select: { email: true, name: true } } } },
        },
      });
      for (const it of items) {
        addNamed(names, it.order.user?.email ?? it.order.guestEmail, it.order.user?.name);
      }
      continue;
    }
    if (source === "active_orders") {
      const active = await prisma.bespokeOrder.findMany({
        where: { currentStage: { not: BespokeStage.DELIVERY } },
        select: {
          clientEmail: true,
          clientName: true,
          clientProfile: { select: { user: { select: { email: true, name: true } } } },
        },
      });
      for (const row of active) {
        addNamed(names, row.clientProfile?.user?.email ?? row.clientEmail, row.clientProfile?.user?.name ?? row.clientName);
      }
      continue;
    }
    if (source === "upcoming_consultations") {
      const now = new Date();
      const bookings = await prisma.consultationBooking.findMany({
        where: {
          status: {
            in: [
              ConsultationStatus.CONFIRMED,
              ConsultationStatus.SCHEDULED,
              ConsultationStatus.PENDING_CONFIRMATION,
            ],
          },
          OR: [{ confirmedDate: { gte: now } }, { preferredDate1: { gte: now } }],
        },
        select: { clientEmail: true, clientName: true },
      });
      for (const b of bookings) addNamed(names, b.clientEmail, b.clientName);
    }
  }

  return names;
}

export async function resolveCampaignRecipients(params: {
  sources: SendEmailSource[];
  collectionId?: string;
  specificUserId?: string;
  customEmail?: string;
}): Promise<{ emails: string[]; namesByEmail: Record<string, string>; suppressed: number }> {
  const names = await collectFromSources(params);
  const raw = Array.from(names.keys());
  const blocked = await suppressedEmailSet(raw);
  const emails = raw.filter((e) => !blocked.has(e));
  const namesByEmail: Record<string, string> = {};
  for (const e of emails) namesByEmail[e] = names.get(e) ?? e;
  return { emails, namesByEmail, suppressed: blocked.size };
}

export async function resolveRecipientEmails(params: {
  recipientType: SendEmailRecipientType;
  specificUserId?: string;
  customEmail?: string;
  collectionId?: string;
}): Promise<{ emails: string[]; namesByEmail: Record<string, string> }> {
  const resolved = await resolveCampaignRecipients({
    sources: [params.recipientType],
    specificUserId: params.specificUserId,
    customEmail: params.customEmail,
    collectionId: params.collectionId,
  });
  return { emails: resolved.emails, namesByEmail: resolved.namesByEmail };
}

export async function previewRecipients(
  sources: SendEmailSource[],
  opts?: { specificUserId?: string; customEmail?: string; collectionId?: string },
): Promise<RecipientPreview> {
  const { emails, namesByEmail, suppressed } = await resolveCampaignRecipients({
    sources,
    specificUserId: opts?.specificUserId,
    customEmail: opts?.customEmail,
    collectionId: opts?.collectionId,
  });

  const sample = emails.slice(0, 5).map((email, i) => ({
    id: `sample-${i}`,
    name: namesByEmail[email] ?? email,
    email,
  }));

  return { count: emails.length, suppressed, sample };
}
