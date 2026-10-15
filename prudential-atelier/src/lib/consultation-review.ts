import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * The review-request email goes to the booking's clientEmail, and many bookings
 * are made before the client has an account (userId is null). Such a booking is
 * hers when her account email matches; one already tied to another account is not.
 */
export async function reviewableConsultationWhere(
  userId: string,
  consultationId: string,
): Promise<Prisma.ConsultationBookingWhereInput> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  const owners: Prisma.ConsultationBookingWhereInput[] = [{ userId }];
  if (user?.email) {
    owners.push({ userId: null, clientEmail: { equals: user.email, mode: "insensitive" } });
  }
  return { id: consultationId, status: "COMPLETED", OR: owners };
}
