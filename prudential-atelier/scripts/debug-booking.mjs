import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const id = process.argv[2] ?? "cmq564ygs0002121vvr7rzyy2";

function toIso(value) {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function assertPlain(obj, path = "root") {
  if (obj === null || obj === undefined) return;
  if (typeof obj === "function") throw new Error(`${path} is a function`);
  if (obj instanceof Date) throw new Error(`${path} is a Date`);
  if (typeof obj === "bigint") throw new Error(`${path} is bigint`);
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) assertPlain(obj[i], `${path}[${i}]`);
    return;
  }
  if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) assertPlain(v, `${path}.${k}`);
  }
}

try {
  const booking = await prisma.consultationBooking.findUnique({
    where: { id },
    include: { consultant: true, offering: true },
  });
  if (!booking) {
    console.log("NOT FOUND");
    process.exit(1);
  }
  console.log("bookingNumber", booking.bookingNumber);
  console.log("consultant", booking.consultant?.name ?? "MISSING");
  console.log("offering", booking.offering?.deliveryMode ?? "MISSING");
  console.log("moodboardImages", booking.moodboardImages);
  console.log("referenceImages", booking.referenceImages);
  console.log("offeringType", booking.offeringType);
  console.log("status", booking.status);

  const clientProfile = booking.userId
    ? await prisma.clientProfile.findUnique({
        where: { userId: booking.userId },
        include: { measurements: true },
      })
    : null;

  const payload = {
    moodboardImages: booking.moodboardImages ?? [],
    consultant: booking.consultant
      ? { id: booking.consultant.id, name: booking.consultant.name }
      : { id: booking.consultantId, name: "Unknown" },
    offering: booking.offering
      ? {
          sessionType: booking.offering.sessionType,
          deliveryMode: booking.offering.deliveryMode,
          durationMinutes: booking.offering.durationMinutes,
        }
      : { sessionType: "DISCOVERY_CALL", deliveryMode: "VIRTUAL_STANDARD", durationMinutes: 45 },
    paidAt: toIso(booking.paidAt),
  };

  assertPlain(payload);
  console.log("payload plain OK");

  if (clientProfile?.measurements) {
    const m = clientProfile.measurements;
    console.log("measurements updatedAt type", typeof m.updatedAt, m.updatedAt);
  }
} catch (e) {
  console.error("FAIL", e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
