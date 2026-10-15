import type { Prisma } from "@prisma/client";
import { provenEmail } from "@/lib/email-verification";

/**
 * The review-request email goes to the booking's clientEmail, and many bookings
 * are made before the client has an account (userId is null). Such a booking is
 * hers when her account email matches and she has proven it; one already tied
 * to another account is not.
 */
export async function reviewableConsultationWhere(
  userId: string,
  consultationId: string,
): Promise<Prisma.ConsultationBookingWhereInput> {
  const email = await provenEmail(userId);
  const owners: Prisma.ConsultationBookingWhereInput[] = [{ userId }];
  if (email) {
    owners.push({ userId: null, clientEmail: { equals: email, mode: "insensitive" } });
  }
  return { id: consultationId, status: "COMPLETED", OR: owners };
}
