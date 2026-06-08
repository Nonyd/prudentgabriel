import {
  BespokeStage,
  ConsultationStatus,
  LoyaltyTier,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SendEmailRecipientType =
  | "specific"
  | "all"
  | "gold_platinum"
  | "active_orders"
  | "upcoming_consultations"
  | "custom";

export type RecipientPreview = {
  count: number;
  sample: { id: string; name: string; email: string }[];
};

export async function resolveRecipientEmails(params: {
  recipientType: SendEmailRecipientType;
  specificUserId?: string;
  customEmail?: string;
}): Promise<{ emails: string[]; namesByEmail: Record<string, string> }> {
  const namesByEmail: Record<string, string> = {};

  if (params.recipientType === "custom") {
    const email = params.customEmail?.trim().toLowerCase();
    if (!email) return { emails: [], namesByEmail };
    return { emails: [email], namesByEmail: { [email]: email } };
  }

  if (params.recipientType === "specific") {
    if (!params.specificUserId) return { emails: [], namesByEmail };
    const user = await prisma.user.findUnique({
      where: { id: params.specificUserId },
      select: { email: true, name: true },
    });
    if (!user?.email) return { emails: [], namesByEmail };
    const name = user.name?.trim() || user.email;
    namesByEmail[user.email] = name;
    return { emails: [user.email], namesByEmail };
  }

  type CustomerUser = { id: string; email: string; name: string | null };
  let users: CustomerUser[] = [];

  if (params.recipientType === "all") {
    users = await prisma.user.findMany({
      where: { role: Role.CUSTOMER, email: { not: "" } },
      select: { id: true, email: true, name: true },
    });
  } else if (params.recipientType === "gold_platinum") {
    users = await prisma.user.findMany({
      where: {
        role: Role.CUSTOMER,
        clientProfile: {
          loyaltyTier: { in: [LoyaltyTier.GOLD, LoyaltyTier.PLATINUM] },
        },
      },
      select: { id: true, email: true, name: true },
    });
  } else if (params.recipientType === "active_orders") {
    const active = await prisma.bespokeOrder.findMany({
      where: { currentStage: { not: BespokeStage.DELIVERY } },
      select: {
        clientEmail: true,
        clientName: true,
        clientProfile: {
          select: { user: { select: { id: true, email: true, name: true } } },
        },
      },
    });
    const map = new Map<string, CustomerUser>();
    for (const row of active) {
      const u = row.clientProfile?.user;
      if (u?.email) {
        map.set(u.id, u);
        continue;
      }
      const email = row.clientEmail?.trim();
      if (!email) continue;
      map.set(email, { id: email, email, name: row.clientName || email });
    }
    users = Array.from(map.values());
  } else if (params.recipientType === "upcoming_consultations") {
    const now = new Date();
    const bookings = await prisma.consultationBooking.findMany({
      where: {
        status: { in: [ConsultationStatus.CONFIRMED, ConsultationStatus.SCHEDULED, ConsultationStatus.PENDING_CONFIRMATION] },
        OR: [{ confirmedDate: { gte: now } }, { preferredDate1: { gte: now } }],
      },
      select: { clientEmail: true, clientName: true, userId: true },
    });
    const emails: string[] = [];
    for (const b of bookings) {
      const email = b.clientEmail?.trim();
      if (!email) continue;
      if (!emails.includes(email)) {
        emails.push(email);
        namesByEmail[email] = b.clientName || email;
      }
    }
    return { emails, namesByEmail };
  }

  const emails: string[] = [];
  for (const u of users) {
    if (!u.email) continue;
    if (!emails.includes(u.email)) {
      emails.push(u.email);
      namesByEmail[u.email] = u.name?.trim() || u.email;
    }
  }

  return { emails, namesByEmail };
}

export async function previewRecipients(
  recipientType: SendEmailRecipientType,
  specificUserId?: string,
): Promise<RecipientPreview> {
  const { emails, namesByEmail } = await resolveRecipientEmails({
    recipientType,
    specificUserId,
  });

  const sample = emails.slice(0, 5).map((email, i) => ({
    id: `sample-${i}`,
    name: namesByEmail[email] ?? email,
    email,
  }));

  return { count: emails.length, sample };
}
