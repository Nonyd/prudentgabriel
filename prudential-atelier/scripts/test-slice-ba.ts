/**
 * Slice BA2 — consultation is an invitation, not a purchase.
 *
 *   pnpm test:slice-ba                                         # unit (CI)
 *   ALLOW_FIXTURES=true BASE_URL=http://localhost:3000 pnpm test:slice-ba
 *
 * Live checks drive the real routes and assert status codes:
 * - an enquiry close to its event is accepted (201) and flagged, never refused;
 * - an unapproved enquiry's link opens nothing (page 404, create 404);
 * - decline needs a reason (400), records it, and cannot be re-decided (409);
 * - approval issues a working link; booking snapshots the acknowledged terms
 *   and the fee; the link cannot be used twice; no token is a 403;
 * - the queue is for the consultations desk only; the one-day clock fires once.
 */
import "./preload-test-env";
import bcrypt from "bcryptjs";
import { BankAccountCurrency, BusinessLine, ConsultationDeliveryMode, ConsultationSessionType, Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { assertFixturesAllowed } from "./fixture-guard";
import {
  consultationTermsText,
  daysUntil,
  isShortNotice,
  INVITATION_ONLY_MESSAGE,
} from "../src/lib/consultation-enquiry-shared";
import { CAPABILITY_TTL_MS, generateCapabilityToken, revealCapabilityToken } from "../src/lib/capability-token";
import { consultationEnquirySchema } from "../src/validations/consultation";
import { getOfferingTypeConfig } from "../src/lib/consultation-types";
import { getCMSContent } from "../src/lib/cms";
import { getPageFieldKeys } from "../src/lib/cms-config";
import { addDaysToWatYmd, getWatYmd } from "../src/lib/consultation";
import { ATELIER_BOOKINGS_SETTING_KEY, ATELIER_CLOSED_MESSAGE } from "../src/lib/atelier-bookings";
import { clearSettingCacheKey } from "../src/lib/settings";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

function unit() {
  assert(daysUntil("2026-10-02", "2026-09-22") === 10, "days until the event");
  assert(isShortNotice("2026-10-02", "2026-09-22", 30), "ten days out is short notice at 30");
  assert(!isShortNotice("2026-12-22", "2026-09-22", 30), "three months out is not");
  const terms = consultationTermsText(250_000);
  assert(terms.includes("₦250,000") && /non-refundable/.test(terms), "terms name the fee and say non-refundable");
  assert(/not credited towards/.test(terms), "terms say the fee does not credit the commission");
  assert(CAPABILITY_TTL_MS.consultationBooking === 14 * 24 * 60 * 60 * 1000, "booking link lasts a fortnight");
  const base = {
    clientName: "Ada Obi",
    clientEmail: "ada@example.test",
    clientPhone: "08030000000",
    eventDate: "2026-12-05",
    eventType: "White Wedding",
    wearer: "BRIDE",
    outfitType: "Wedding gown",
  };
  assert(consultationEnquirySchema.safeParse(base).success, "a complete enquiry validates");
  assert(!consultationEnquirySchema.safeParse({ ...base, clientEmail: "" }).success, "email is required");
  assert(!consultationEnquirySchema.safeParse({ ...base, wearer: undefined }).success, "the screening question is required");
  console.log("ok unit");
}

class Jar {
  m = new Map<string, string>();
  take(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const kv = c.split(";")[0];
      const i = kv.indexOf("=");
      this.m.set(kv.slice(0, i), kv.slice(i + 1));
    }
  }
  header() {
    return Array.from(this.m).map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function signIn(base: string, email: string, password: string, ip: string): Promise<Jar> {
  const jar = new Jar();
  const c = await fetch(`${base}/api/auth/csrf`, { headers: { "x-forwarded-for": ip } });
  jar.take(c);
  const { csrfToken } = (await c.json()) as { csrfToken: string };
  const r = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-auth-return-redirect": "1",
      "x-forwarded-for": ip,
      cookie: jar.header(),
    },
    body: new URLSearchParams({ csrfToken, email, password }),
  });
  jar.take(r);
  assert(r.status === 200 && jar.m.has("authjs.session-token"), `fixture sign-in works (${r.status})`);
  return jar;
}

async function live(base: string) {
  const host = new URL(base).hostname;
  assert(host === "localhost" || host === "127.0.0.1", "local server only");
  assertFixturesAllowed("test-slice-ba");
  const stamp = Date.now();
  const ip = `198.51.100.${(stamp % 200) + 20}`;
  const json = (body: unknown, jar?: Jar) => ({
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip, ...(jar ? { cookie: jar.header() } : {}) },
    body: JSON.stringify(body),
  });
  const patch = (body: unknown, jar: Jar) => ({ ...json(body, jar), method: "PATCH" });

  const hash = await bcrypt.hash("Correct-Horse-9", 12);
  const desk = await prisma.user.create({
    data: { email: `ba-desk-${stamp}@example.test`, name: "BA Desk", role: Role.CONSULTATION_MANAGER, password: hash },
  });
  const customer = await prisma.user.create({
    data: { email: `ba-cust-${stamp}@example.test`, name: "BA Customer", role: Role.CUSTOMER, password: hash },
  });
  const consultant = await prisma.consultant.create({
    data: {
      name: `BA Team ${stamp}`,
      title: "Fixture",
      bio: "Fixture consultant for test-slice-ba.",
      offerings: {
        create: {
          sessionType: ConsultationSessionType.BESPOKE_DESIGN,
          deliveryMode: ConsultationDeliveryMode.INPERSON_ATELIER,
          durationMinutes: 60,
          feeNGN: 1,
        },
      },
    },
    include: { offerings: true },
  });
  const hadBank = await prisma.bankAccount.findFirst({
    where: { currency: BankAccountCurrency.NGN, businessLine: BusinessLine.ATELIER, isActive: true },
  });
  const bank = hadBank
    ? null
    : await prisma.bankAccount.create({
        data: {
          currency: BankAccountCurrency.NGN,
          businessLine: BusinessLine.ATELIER,
          accountName: "BA Fixture",
          accountNumber: `9${String(stamp).slice(-9)}`,
          bankName: "Fixture Bank",
        },
      });
  const enquiryIds: string[] = [];
  const bookingIds: string[] = [];
  // The atelier must be open for enquiries; missing means closed (fail-closed). Restored after.
  const flagBefore = await prisma.siteSetting.findUnique({ where: { key: ATELIER_BOOKINGS_SETTING_KEY } });
  await prisma.siteSetting.upsert({
    where: { key: ATELIER_BOOKINGS_SETTING_KEY },
    create: { key: ATELIER_BOOKINGS_SETTING_KEY, value: "true", group: "STORE", label: "Accept new commission enquiries", type: "BOOLEAN" },
    update: { value: "true" },
  });

  try {
    const soon = addDaysToWatYmd(getWatYmd(), 5);
    const later = addDaysToWatYmd(getWatYmd(), 120);
    const enquiry = (email: string, eventDate: string) => ({
      clientName: "Ada Obi",
      clientEmail: email,
      clientPhone: "08030000000",
      eventDate,
      eventType: "White Wedding",
      wearer: "BRIDE",
      outfitType: "Wedding gown",
      notes: "Fixture enquiry",
    });

    // Short notice: accepted and flagged, never refused.
    const shortRes = await fetch(`${base}/api/consultations/enquiries`, json(enquiry(`ba-short-${stamp}@example.test`, soon)));
    assert(shortRes.status === 201, `a five-day event is accepted (${shortRes.status})`);
    const short = (await shortRes.json()) as { enquiryNumber: string; shortNotice: boolean };
    assert(short.shortNotice === true, "and flagged short notice");
    const shortRow = await prisma.consultationEnquiry.findUniqueOrThrow({ where: { enquiryNumber: short.enquiryNumber } });
    enquiryIds.push(shortRow.id);
    assert(shortRow.shortNotice && shortRow.status === "PENDING", "stored flagged and pending");
    const shortNote = await prisma.adminNotification.findFirst({ where: { entityId: shortRow.id } });
    assert(shortNote?.type === "NEW_CONSULTATION" && /short notice/i.test(shortNote.title), "the desk is told to call");
    assert(shortNote.targetPermissions.includes("consultations"), "routed to the consultations desk (Slice W)");

    const past = await fetch(`${base}/api/consultations/enquiries`, json(enquiry(`ba-past-${stamp}@example.test`, "2020-01-01")));
    assert(past.status === 400, `an event already past is a 400 (${past.status})`);

    // An unapproved enquiry's link opens nothing, even with a real token on the row.
    const pendingRaw = generateCapabilityToken();
    await prisma.consultationEnquiry.update({
      where: { id: shortRow.id },
      data: {
        publicToken: pendingRaw.hash,
        publicTokenEnc: pendingRaw.enc,
        publicTokenExpiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const pendingPage = await fetch(`${base}/consultation/book/${pendingRaw.raw}`, { headers: { "x-forwarded-for": ip } });
    assert(pendingPage.status === 404, `unapproved link page is 404 (${pendingPage.status})`);
    const pendingCreate = await fetch(`${base}/api/consultations/create`, json({ enquiryToken: pendingRaw.raw }));
    assert(pendingCreate.status === 404, `unapproved link cannot book (${pendingCreate.status})`);
    const noToken = await fetch(`${base}/api/consultations/create`, json({}));
    assert(noToken.status === 403, `no invitation is a 403 (${noToken.status})`);
    assert(((await noToken.json()) as { error?: string }).error === INVITATION_ONLY_MESSAGE, "and says why");

    // The queue belongs to the consultations desk.
    const deskJar = await signIn(base, desk.email!, "Correct-Horse-9", ip);
    const custJar = await signIn(base, customer.email!, "Correct-Horse-9", ip);
    const queueCust = await fetch(`${base}/api/admin/consultations/enquiries`, { headers: { cookie: custJar.header() } });
    assert(queueCust.status === 403, `a customer cannot read the queue (${queueCust.status})`);
    const queue = await fetch(`${base}/api/admin/consultations/enquiries`, { headers: { cookie: deskJar.header() } });
    assert(queue.status === 200, `the desk reads the queue (${queue.status})`);

    // Decline: a reason is required, recorded, and final.
    const noReason = await fetch(`${base}/api/admin/consultations/enquiries/${shortRow.id}`, patch({ action: "decline" }, deskJar));
    assert(noReason.status === 400, `decline without a reason is a 400 (${noReason.status})`);
    const declined = await fetch(
      `${base}/api/admin/consultations/enquiries/${shortRow.id}`,
      patch({ action: "decline", reason: "Outside what the house makes", notifyClient: false }, deskJar),
    );
    assert(declined.status === 200, `decline with a reason (${declined.status})`);
    const declinedRow = await prisma.consultationEnquiry.findUniqueOrThrow({ where: { id: shortRow.id } });
    assert(
      declinedRow.status === "DECLINED" && declinedRow.decisionReason === "Outside what the house makes" && declinedRow.decidedBy,
      "the decline and its reason are recorded with who decided",
    );
    const again = await fetch(
      `${base}/api/admin/consultations/enquiries/${shortRow.id}`,
      patch({ action: "approve", reason: "Changed my mind" }, deskJar),
    );
    assert(again.status === 409, `a decided enquiry cannot be re-decided (${again.status})`);
    const declinedPage = await fetch(`${base}/consultation/book/${pendingRaw.raw}`, { headers: { "x-forwarded-for": ip } });
    assert(declinedPage.status === 404, `a declined enquiry's link is 404 (${declinedPage.status})`);

    // Approve: a working link, a booking that snapshots terms and fee, used once.
    const okRes = await fetch(`${base}/api/consultations/enquiries`, json(enquiry(`ba-ok-${stamp}@example.test`, later)));
    assert(okRes.status === 201, "a normal enquiry is accepted");
    const ok = (await okRes.json()) as { enquiryNumber: string; shortNotice: boolean };
    assert(ok.shortNotice === false, "an event four months out is not short notice");
    const okRow = await prisma.consultationEnquiry.findUniqueOrThrow({ where: { enquiryNumber: ok.enquiryNumber } });
    enquiryIds.push(okRow.id);
    const approved = await fetch(
      `${base}/api/admin/consultations/enquiries/${okRow.id}`,
      patch({ action: "approve", reason: "Bride, gown, good lead time" }, deskJar),
    );
    assert(approved.status === 200, `approve (${approved.status})`);
    const approvedRow = await prisma.consultationEnquiry.findUniqueOrThrow({ where: { id: okRow.id } });
    const raw = revealCapabilityToken({ token: approvedRow.publicToken, enc: approvedRow.publicTokenEnc });
    assert(raw && approvedRow.publicToken !== raw, "only the hash is stored; the raw is recoverable for the email");
    const ttl = approvedRow.publicTokenExpiresAt!.getTime() - Date.now();
    assert(ttl > 13.9 * 86_400_000 && ttl <= 14 * 86_400_000, "the link expires in a fortnight");
    const page = await fetch(`${base}/consultation/book/${raw}`, { headers: { "x-forwarded-for": ip } });
    assert(page.status === 200, `the approved link opens (${page.status})`);

    const cms = await getCMSContent(getPageFieldKeys("consultation"));
    const fee = getOfferingTypeConfig("PHYSICAL_TEAM_ONLY", cms).priceNgn;
    const d = (n: number) => `${addDaysToWatYmd(getWatYmd(), n)}T12:00:00+01:00`;
    const booking = {
      enquiryToken: raw,
      termsAccepted: true,
      termsText: consultationTermsText(fee),
      offeringId: consultant.offerings[0].id,
      consultantId: consultant.id,
      offeringType: "PHYSICAL_TEAM_ONLY",
      currency: "NGN",
      gateway: "BANK_TRANSFER",
      preferredDate1: d(10),
      preferredDate2: d(11),
      preferredDate3: d(12),
    };
    const stale = await fetch(`${base}/api/consultations/create`, json({ ...booking, termsText: consultationTermsText(fee + 1) }));
    assert(stale.status === 409, `terms that do not match the fee are refused (${stale.status})`);
    const unticked = await fetch(`${base}/api/consultations/create`, json({ ...booking, termsAccepted: false }));
    assert(unticked.status === 400, `booking without acknowledging the terms is a 400 (${unticked.status})`);
    const twoDates = await fetch(`${base}/api/consultations/create`, json({ ...booking, preferredDate3: d(10) }));
    assert(twoDates.status === 400, `three dates must be three different days (${twoDates.status})`);

    const created = await fetch(`${base}/api/consultations/create`, json(booking));
    assert(created.status === 200, `booking through the link (${created.status} ${await created.clone().text()})`);
    const { bookingId } = (await created.json()) as { bookingId: string };
    bookingIds.push(bookingId);
    const row = await prisma.consultationBooking.findUniqueOrThrow({ where: { id: bookingId }, include: { enquiry: true } });
    assert(row.termsText === consultationTermsText(fee) && row.termsAcknowledgedAt, "the exact wording is snapshotted");
    assert(row.legalTermsVersion && row.legalTermsSnapshot, "with the legal terms version, like an order");
    assert(row.feeNGN === fee, "the fee is frozen on the booking");
    assert(row.status === "PENDING_PAYMENT" && !row.confirmedDate, "unpaid, no date chosen yet");
    assert(row.preferredDate1 && row.preferredDate2 && row.preferredDate3, "three dates proposed");
    assert(row.enquiry?.id === okRow.id && row.enquiry.status === "BOOKED", "the enquiry is marked booked");
    assert(row.clientEmail === `ba-ok-${stamp}@example.test`, "name and email come from the enquiry");

    const reuse = await fetch(`${base}/api/consultations/create`, json(booking));
    assert(reuse.status === 404, `the link cannot book twice (${reuse.status})`);
    const reusePage = await fetch(`${base}/consultation/book/${raw}`, { headers: { "x-forwarded-for": ip } });
    assert(reusePage.status === 404, `a used link is 404 (${reusePage.status})`);

    // Downstream is the walked pipeline: paid → pending confirmation → the desk picks one of her dates.
    const { fulfillPaidConsultationBooking } = await import("../src/lib/consultation-payment");
    const paid = await fulfillPaidConsultationBooking({ bookingId, paymentRef: `BA-TEST-${stamp}`, gateway: "BANK_TRANSFER" });
    assert(paid, "payment fulfils the booking");
    const afterPay = await prisma.consultationBooking.findUniqueOrThrow({ where: { id: bookingId } });
    assert(afterPay.status === "PENDING_CONFIRMATION" && afterPay.paymentStatus === "PAID", "paid, waiting for a date");
    const confirm = await fetch(
      `${base}/api/admin/consultations/${bookingId}`,
      patch({ status: "CONFIRMED", confirmedDate: afterPay.preferredDate2!.toISOString(), confirmedTime: "11:00" }, deskJar),
    );
    assert(confirm.status === 200, `the desk confirms her second choice (${confirm.status})`);
    const confirmed = await prisma.consultationBooking.findUniqueOrThrow({ where: { id: bookingId } });
    assert(
      confirmed.status === "CONFIRMED" && confirmed.confirmedDate?.getTime() === afterPay.preferredDate2!.getTime(),
      "confirmed on the date she proposed",
    );
    assert(confirmed.feeNGN === fee && confirmed.termsText === row.termsText, "payment and confirmation leave the snapshot alone");

    // Reminders: the day before, once.
    const { run: runDayBefore } = await import("../src/lib/cron/jobs/consultation-day-before");
    const eve = new Date(confirmed.confirmedDate!.getTime() - 24 * 60 * 60 * 1000);
    const dayCtx = { now: eve, batchLimit: 200, isBudgetExhausted: () => false } as Parameters<typeof runDayBefore>[0];
    await runDayBefore(dayCtx);
    await runDayBefore(dayCtx);
    const reminders = await prisma.emailMessage.count({
      where: { template: "consultation-day-before", to: confirmed.clientEmail },
    });
    assert(reminders === 1, `one day-before reminder (${reminders})`);

    // The one-day clock: an enquiry waiting over a day is raised once.
    const waitingRes = await fetch(`${base}/api/consultations/enquiries`, json(enquiry(`ba-wait-${stamp}@example.test`, later)));
    const waiting = (await waitingRes.json()) as { enquiryNumber: string };
    const waitingRow = await prisma.consultationEnquiry.update({
      where: { enquiryNumber: waiting.enquiryNumber },
      data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });
    enquiryIds.push(waitingRow.id);
    const { run } = await import("../src/lib/cron/jobs/consultation-enquiry-alerts");
    const ctx = { now: new Date(), batchLimit: 50, isBudgetExhausted: () => false } as Parameters<typeof run>[0];
    await run(ctx);
    await run(ctx);
    const raised = await prisma.adminNotification.findMany({
      where: { entityId: waitingRow.id, title: "Enquiry waiting over a day" },
    });
    assert(raised.length === 1 && raised[0].type === "NEW_CONSULTATION", `raised once, as NEW_CONSULTATION (${raised.length})`);
    console.log("ok live: short notice flagged, unapproved link closed, decline recorded, terms and fee snapshotted, clock fires once");
  } finally {
    await prisma.consultationEnquiry.deleteMany({ where: { id: { in: enquiryIds } } });
    await prisma.adminNotification.deleteMany({ where: { entityId: { in: [...enquiryIds, ...bookingIds] } } });
    await prisma.emailMessage.deleteMany({ where: { to: { endsWith: "@example.test" }, template: { startsWith: "consultation-" } } });
    await prisma.consultationBooking.deleteMany({ where: { id: { in: bookingIds } } });
    // Payment auto-onboards the client in the background; give it a moment, then remove it.
    await new Promise((r) => setTimeout(r, 1500));
    const onboarded = await prisma.user.findMany({ where: { email: { startsWith: "ba-ok-" }, AND: { email: { endsWith: `${stamp}@example.test` } } } });
    for (const u of onboarded) {
      await prisma.clientProfile.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    }
    await prisma.consultant.delete({ where: { id: consultant.id } });
    if (bank) await prisma.bankAccount.delete({ where: { id: bank.id } });
    for (const u of [desk, customer]) {
      await prisma.errorLog.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
    await prisma.rateLimitBucket.deleteMany({ where: { key: { contains: ip } } });
    if (flagBefore) await prisma.siteSetting.update({ where: { key: flagBefore.key }, data: { value: flagBefore.value } });
    else await prisma.siteSetting.delete({ where: { key: ATELIER_BOOKINGS_SETTING_KEY } });
  }
}

/** The switch closes the atelier to new enquiries; the route answers 403. In-process so the settings cache is ours. */
async function closedAtelier() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    console.log("skip closed-atelier check: database unreachable");
    return;
  }
  const prev = await prisma.siteSetting.findUnique({ where: { key: ATELIER_BOOKINGS_SETTING_KEY } });
  await prisma.siteSetting.upsert({
    where: { key: ATELIER_BOOKINGS_SETTING_KEY },
    create: { key: ATELIER_BOOKINGS_SETTING_KEY, value: "false", group: "STORE", label: "Accept new commission enquiries", type: "BOOLEAN" },
    update: { value: "false" },
  });
  clearSettingCacheKey(ATELIER_BOOKINGS_SETTING_KEY);
  try {
    const { POST } = await import("../src/app/api/consultations/enquiries/route");
    const { NextRequest } = await import("next/server");
    const res = await POST(new NextRequest("http://localhost/api/consultations/enquiries", { method: "POST", body: "{}" }));
    assert(res.status === 403, `a closed atelier refuses new enquiries (${res.status})`);
    assert(((await res.json()) as { error?: string }).error === ATELIER_CLOSED_MESSAGE, "and says the house is not taking commissions");
    console.log("ok closed atelier: enquiries 403");
  } finally {
    if (prev) await prisma.siteSetting.update({ where: { key: prev.key }, data: { value: prev.value } });
    else await prisma.siteSetting.delete({ where: { key: ATELIER_BOOKINGS_SETTING_KEY } });
    clearSettingCacheKey(ATELIER_BOOKINGS_SETTING_KEY);
  }
}

async function main() {
  unit();
  if (process.env.ALLOW_FIXTURES === "true") await closedAtelier();
  const base = process.env.BASE_URL?.replace(/\/$/, "");
  if (base) await live(base);
  else console.log("skip live checks: set ALLOW_FIXTURES=true BASE_URL=http://localhost:…");
  console.log("OK test-slice-ba");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
