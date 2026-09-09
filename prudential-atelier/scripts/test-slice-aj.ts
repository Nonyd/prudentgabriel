/**
 * Slice AJ — success DTO, gateway payer email, meeting-link queue.
 *
 *   pnpm test:slice-aj
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ConsultationStatus, PaymentStatus } from "@prisma/client";
import { toPublicConsultationDto } from "../src/lib/public-pii-dtos";
import { consultationSuccessView } from "../src/lib/consultation-success-view";
import { consultationGatewayEmail, rtwGatewayEmail } from "../src/lib/payments/payer-email";
import {
  consultationSessionStart,
  isMeetingReminderWindow,
  meetingLinkIdempotencyKey,
  meetingReminderIdempotencyKey,
  shouldQueueMeetingLinkOnSave,
} from "../src/lib/consultation-meeting-link";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

function run() {
  const dto = toPublicConsultationDto({
    bookingNumber: "CB-26-02381",
    status: ConsultationStatus.CONFIRMED,
    paymentStatus: PaymentStatus.PAID,
    clientName: "Adaeze Walk",
    confirmedDate: new Date("2026-09-10T00:00:00.000Z"),
    confirmedTime: "10:00",
    offering: { sessionType: "STYLING_SESSION" },
    consultant: { name: "Creative Team" },
  });
  assert(!("consultant" in dto), "public DTO is flat — no nested consultant");
  assert(!("offering" in dto), "public DTO is flat — no nested offering");
  assert(dto.consultantName === "Creative Team", "consultantName is on the DTO");
  const view = consultationSuccessView(dto);
  assert(view.consultantName === "Creative Team", "success view reads consultantName");
  assert(view.bookingNumber === "CB-26-02381", "success view reads bookingNumber");
  assert(view.heading === "Consultation confirmed", "confirmed heading");

  const successSrc = readFileSync(resolve("src/app/(storefront)/consultation/success/page.tsx"), "utf8");
  assert(successSrc.includes("consultationSuccessView"), "success page renders from the public view helper");
  assert(successSrc.includes("PublicConsultationDto"), "success page types the public DTO");
  assert(!successSrc.includes("consultant.name"), "success page must not read nested consultant.name");
  assert(!successSrc.includes("offering.durationMinutes"), "success page must not read nested offering");
  assert(!successSrc.includes("clientEmail"), "success page must not show the email the DTO stripped");

  const publicBookingSrc = readFileSync(
    resolve("src/app/(storefront)/consultation/[bookingNumber]/page.tsx"),
    "utf8",
  );
  assert(publicBookingSrc.includes("consultantName"), "public booking page reads flattened consultantName");
  assert(!publicBookingSrc.includes("consultant.name"), "public booking page must not read nested consultant.name");

  const sessionEmail = "admin@prudentgabriel.com";
  const guest = "ai7.walk.sep9@mailinator.com";
  assert(
    consultationGatewayEmail({ clientEmail: guest }) === guest,
    "consultation Paystack gets the guest email",
  );
  assert(
    consultationGatewayEmail({ clientEmail: guest }) !== sessionEmail,
    "consultation Paystack ignores a staff session mailbox",
  );
  assert(
    rtwGatewayEmail({ guestEmail: guest, user: { email: sessionEmail } }) === guest,
    "RTW guest checkout prefers guestEmail over a logged-in mailbox",
  );
  assert(
    rtwGatewayEmail({ guestEmail: null, user: { email: "shopper@mail.test" } }) === "shopper@mail.test",
    "RTW signed-in shopper uses the order owner's email",
  );

  const paystackConsult = readFileSync(
    resolve("src/app/api/consultations/payment/paystack/initiate/route.ts"),
    "utf8",
  );
  assert(paystackConsult.includes("consultationGatewayEmail"), "consultation Paystack uses the guest helper");
  assert(
    !paystackConsult.includes("session?.user?.email ?? booking.clientEmail"),
    "consultation Paystack no longer prefers the session email",
  );
  const paystackRtw = readFileSync(resolve("src/app/api/payment/paystack/initiate/route.ts"), "utf8");
  assert(paystackRtw.includes("rtwGatewayEmail"), "RTW Paystack uses the order email helper");
  assert(
    !paystackRtw.includes("session?.user?.email ?? order.guestEmail"),
    "RTW Paystack no longer prefers the session email",
  );

  const link = "https://zoom.us/j/123";
  const key = meetingLinkIdempotencyKey("CB-26-02381", link);
  const queued = new Set<string>();
  const queueOnce = (k: string) => {
    if (queued.has(k)) return { created: false };
    queued.add(k);
    return { created: true };
  };
  assert(queueOnce(key).created, "first save queues the meeting-link email");
  assert(!queueOnce(key).created, "second save of the same link is a no-op");
  assert(queued.size === 1, "saving a meeting link queues exactly one email");
  assert(key === `consultation-meeting-link:CB-26-02381:${link}`, "idempotency key is per booking and link");
  assert(
    meetingReminderIdempotencyKey("CB-26-02381") === "consultation-meeting-reminder:CB-26-02381",
    "hour-before reminder has its own key",
  );

  const patchSrc = readFileSync(resolve("src/app/api/admin/consultations/[id]/route.ts"), "utf8");
  assert(patchSrc.includes("queueSavedMeetingLink"), "PATCH save of a meeting link queues mail");
  const sendLinkSrc = readFileSync(resolve("src/app/api/admin/consultations/[id]/send-link/route.ts"), "utf8");
  assert(sendLinkSrc.includes("queueConsultationMeetingLink"), "Send-link uses the same queue helper");
  const emailSrc = readFileSync(resolve("src/lib/email.tsx"), "utf8");
  assert(emailSrc.includes("queueEmail"), "meeting-link mail goes through queueEmail");
  assert(emailSrc.includes("consultation-meeting-link:${params.bookingNumber}"), "idempotency includes booking number");

  assert(
    shouldQueueMeetingLinkOnSave({
      previousLink: null,
      nextLink: link,
      status: ConsultationStatus.CONFIRMED,
      confirmedDate: new Date("2026-09-10"),
      confirmedTime: "10:00",
      isVirtual: true,
      confirmEmailAlreadyCarriesLink: false,
    }),
    "a newly pasted link on a confirmed Zoom booking is sent",
  );
  assert(
    !shouldQueueMeetingLinkOnSave({
      previousLink: link,
      nextLink: link,
      status: ConsultationStatus.CONFIRMED,
      confirmedDate: new Date("2026-09-10"),
      confirmedTime: "10:00",
      isVirtual: true,
      confirmEmailAlreadyCarriesLink: false,
    }),
    "saving the same link again does not queue a second mail",
  );

  const starts = consultationSessionStart(new Date("2026-09-10T12:00:00+01:00"), "10:00");
  assert(starts.toISOString() === new Date("2026-09-10T10:00:00+01:00").toISOString(), "session start is WAT");
  const hourBefore = new Date(starts.getTime() - 60 * 60 * 1000);
  assert(isMeetingReminderWindow(starts, hourBefore), "T-60 minutes is in the reminder window");
  assert(!isMeetingReminderWindow(starts, new Date(starts.getTime() - 2 * 60 * 60 * 1000)), "T-2h is too early");

  const wizard = readFileSync(resolve("src/components/consultation/ConsultationBookingFlow.tsx"), "utf8");
  assert(wizard.includes("about an hour before"), "wizard still promises the hour-before reminder");
  const confirmEmail = readFileSync(resolve("src/emails/ConsultationConfirmedEmail.tsx"), "utf8");
  assert(confirmEmail.includes("does not include a meeting link"), "confirmation says the link follows");

  console.log("slice-aj: ok");
}

run();
