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
 *
 * Slice BA3 — four fee settings; the fee and (USD/GBP) the exact foreign amount
 * are frozen on the booking; a price change never alters a booking already
 * made; the figure shown is the figure charged and bound (Slice A).
 *
 * Slice BA4 — a display-only price guide on gallery photographs: the wording,
 * the admin validation (400), and that no chargeable code reads it.
 *
 * Slice BA5/BA6 — first-party chat: no retention, no chat (409); name and
 * email before a conversation (400); an atelier page is handed the form, not a
 * quote; the cookie is httpOnly; no browsing trail; replies emailed only when
 * she has left; the retention job deletes; the banner and privacy policy say so.
 * Retention answered (keep indefinitely): untouched setting 409, "keep" enables
 * and the job deletes nothing, closed conversations leave the list but stay
 * searchable, erasure is SUPER_ADMIN only, confirmed, gone and logged.
 */
import "./preload-test-env";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
import {
  CONSULTATION_FEE_KEYS,
  DEFAULT_CONSULTATION_FEES_NGN,
  consultationCharge,
  consultationChargeAt,
  expectedConsultationBind,
  getConsultationFeeNGN,
  quoteConsultationFees,
} from "../src/lib/consultation-fees";
import { expectedPaystackConsultationBind } from "../src/lib/payments/paystack-amount";
import { priceGuideError, priceGuideText } from "../src/lib/price-guide";
import { ChatContextKind } from "@prisma/client";
import { openingLine, parseChatRetention } from "../src/lib/chat";
import { isAtelierPath } from "../src/lib/chat-shared";
import { COOKIE_BANNER_NOTICE } from "../src/lib/cookie-consent";
import { COOKIE_MD, PRIVACY_POLICY_MD } from "../src/lib/legal-copy";
import { readdirSync, statSync } from "node:fs";
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

  // BA3
  assert(
    DEFAULT_CONSULTATION_FEES_NGN.PHYSICAL_PRUDENT_TEAM === 250_000 &&
      DEFAULT_CONSULTATION_FEES_NGN.PHYSICAL_TEAM_ONLY === 200_000 &&
      DEFAULT_CONSULTATION_FEES_NGN.VIRTUAL_PRUDENT_TEAM === 200_000 &&
      DEFAULT_CONSULTATION_FEES_NGN.VIRTUAL_TEAM_ONLY === 180_000,
    "the four fees the meeting set",
  );
  assert(new Set(Object.values(CONSULTATION_FEE_KEYS)).size === 4, "four distinct settings, one per type");
  const fx = { rate: 0.00065, gbpRate: 0.00052, source: "test", fetchedAt: new Date(), stale: false };
  assert(consultationChargeAt(180_000, "USD", fx) === 117, "₦180,000 at 0.00065 is $117.00");
  assert(consultationChargeAt(180_000, "NGN", fx) === 180_000, "naira is the fee itself");
  const migration = readFileSync(resolve(__dirname, "../prisma/migrations/20260923_slice_ba3_consultation_fx_lock/migration.sql"), "utf8");
  for (const [key, fee] of Object.entries(CONSULTATION_FEE_KEYS).map(([k, v]) => [v, DEFAULT_CONSULTATION_FEES_NGN[k as keyof typeof DEFAULT_CONSULTATION_FEES_NGN]] as const)) {
    assert(migration.includes(`'${key}', '${fee}'`), `the migration seeds ${key} = ${fee}`);
  }

  // BA4
  assert(
    priceGuideText({ priceFloorNGN: 3_000_000, priceCeilingNGN: null }) === "Pieces like this begin around ₦3,000,000.",
    "a floor reads as a guide, not an offer",
  );
  assert(
    priceGuideText({ priceFloorNGN: 3_000_000, priceCeilingNGN: 8_000_000 }) ===
      "Pieces like this range from about ₦3,000,000 to ₦8,000,000.",
    "a range is supported",
  );
  assert(priceGuideText({ priceFloorNGN: null, priceCeilingNGN: 8_000_000 }) === null, "no floor, no guide");
  assert(priceGuideError({ priceFloorNGN: 5, priceCeilingNGN: 4 }) !== null, "a ceiling below the floor is refused");
  assert(priceGuideError({ priceFloorNGN: null, priceCeilingNGN: 4 }) !== null, "a ceiling needs a floor");
  assert(priceGuideError({ priceFloorNGN: 3, priceCeilingNGN: null }) === null, "a floor alone is fine");
  const schemaText = readFileSync(resolve(__dirname, "../prisma/schema.prisma"), "utf8");
  const productModel = schemaText.slice(schemaText.indexOf("model Product {"), schemaText.indexOf("}", schemaText.indexOf("model Product {")));
  assert(!/priceFloor|priceCeiling/.test(productModel), "the guide is not on Product, so no product price path can read it");
  // Every reader of the guide is display or admin. A chargeable path reading it fails here.
  const allowed = new Set([
    "src/lib/price-guide.ts",
    "src/components/gallery/PriceGuideLine.tsx",
    "src/components/admin/GalleryManager.tsx",
    "src/app/api/admin/gallery/[id]/route.ts",
    "src/app/(storefront)/atelier/page.tsx",
    "src/components/atelier/AtelierLandingPage.tsx",
  ]);
  const root = resolve(__dirname, "..");
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = resolve(dir, name);
      return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
    });
  const readers = walk(resolve(root, "src"))
    .filter((f) => /priceFloorNGN|priceCeilingNGN|price-guide/.test(readFileSync(f, "utf8")))
    .map((f) => f.slice(root.length + 1).replace(/\\/g, "/"));
  const stray = readers.filter((f) => !allowed.has(f));
  assert(stray.length === 0, `only display and admin code reads the price guide (${stray.join(", ")})`);

  // BA5 / BA6
  for (const p of ["/atelier", "/bridal/gowns", "/bespoke", "/consultation"]) assert(isAtelierPath(p), `${p} is the commission journey`);
  for (const p of ["/shop/avril", "/track", "/about"]) assert(!isAtelierPath(p), `${p} is general support`);
  const atelierLine = openingLine({ kind: ChatContextKind.ATELIER, path: "/atelier", label: null, productId: null, orderRef: null }, "https://x.test");
  assert(atelierLine.includes("https://x.test/consultation"), "chat on an atelier page hands her the enquiry form");
  assert(/can't quote or book/.test(atelierLine) && !/₦|\d{2,}/.test(atelierLine), "and never names a price");
  const pieceLine = openingLine({ kind: ChatContextKind.PIECE, path: "/shop/avril", label: "Avril Gown", productId: "p", orderRef: null }, "");
  assert(pieceLine.includes("Avril Gown"), "the opening line names the piece");
  const chatModel = schemaText.slice(schemaText.indexOf("model ChatMessage {"), schemaText.indexOf("}", schemaText.indexOf("model ChatMessage {")));
  assert(!/path|url|page/i.test(chatModel), "messages carry no page: context is the conversation's, never a trail");
  assert(/start a chat, keep that conversation open/.test(COOKIE_BANNER_NOTICE), "the banner says chat stores something");
  assert(COOKIE_MD.includes("pg_chat"), "the cookie policy lists the chat cookie");
  assert(/## Live chat/.test(PRIVACY_POLICY_MD) && PRIVACY_POLICY_MD.includes("{{chat_retention_days}}"), "the privacy policy covers chat and its retention");
  assert(/\{\{#chat_retention_keep\}\}[^{]*kept indefinitely/i.test(PRIVACY_POLICY_MD), "it says plainly when conversations are kept indefinitely");
  assert(/To have a conversation removed, write to us/.test(PRIVACY_POLICY_MD), "and how to ask for one to be removed");
  assert(parseChatRetention("keep").kind === "keep", "\"keep\" is a decision");
  assert(parseChatRetention("").kind === "unset" && parseChatRetention(null).kind === "unset", "an empty field is not");
  assert(parseChatRetention("90").kind === "days", "a day count is a period");
  assert(/## Consultation enquiries/.test(PRIVACY_POLICY_MD), "and the enquiry form");
  assert(/Contabo GmbH, in Germany/.test(PRIVACY_POLICY_MD), "and says the site and database are in Germany");
  assert(!/hosting regions can change/.test(PRIVACY_POLICY_MD), "the vague hosting line is gone");
  // CSP: chat is same-origin — no third-party script, socket or frame to allow.
  const widget = readFileSync(resolve(__dirname, "../src/components/chat/ChatWidget.tsx"), "utf8");
  const calls = Array.from(widget.matchAll(/fetch\(\s*"([^"]+)"/g)).map((m) => m[1]);
  assert(calls.length > 0 && calls.every((u) => u.startsWith("/api/chat")), `the widget only calls this site's chat API (${calls})`);
  assert(!/<script|src=\{?["']https?:/.test(widget), "and loads no external script");
  const headers = readFileSync(resolve(__dirname, "../security-headers.mjs"), "utf8");
  assert(!/tawk|crisp|intercom|zendesk|tidio|livechat/i.test(headers), "no chat vendor in the CSP");
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
  const hadUsdBank = await prisma.bankAccount.findFirst({
    where: { currency: BankAccountCurrency.USD, businessLine: BusinessLine.ATELIER, isActive: true },
  });
  const usdBank = hadUsdBank
    ? null
    : await prisma.bankAccount.create({
        data: {
          currency: BankAccountCurrency.USD,
          businessLine: BusinessLine.ATELIER,
          accountName: "BA Fixture USD",
          accountNumber: `8${String(stamp).slice(-9)}`,
          bankName: "Fixture Bank",
          swiftBic: "FIXTUS33",
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

    const fee = await getConsultationFeeNGN("PHYSICAL_TEAM_ONLY");
    const d = (n: number) => `${addDaysToWatYmd(getWatYmd(), n)}T12:00:00+01:00`;
    const booking = {
      enquiryToken: raw,
      termsAccepted: true,
      termsText: consultationTermsText(fee),
      quotedAmount: fee,
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

    // BA3: a price change never alters a booking already made — nor what its payment must bind to.
    const feeKey = CONSULTATION_FEE_KEYS.PHYSICAL_TEAM_ONLY;
    const feeRow = await prisma.siteSetting.findUnique({ where: { key: feeKey } });
    await prisma.siteSetting.upsert({
      where: { key: feeKey },
      create: { key: feeKey, value: String(fee + 50_000), group: "PAYMENTS", label: "fixture", type: "NUMBER" },
      update: { value: String(fee + 50_000) },
    });
    clearSettingCacheKey(feeKey);
    try {
      assert((await getConsultationFeeNGN("PHYSICAL_TEAM_ONLY")) === fee + 50_000, "the setting now reads the new price");
      assert((await quoteConsultationFees()).fees.PHYSICAL_TEAM_ONLY.NGN === fee + 50_000, "a new booking would be quoted it");
      const kept = await prisma.consultationBooking.findUniqueOrThrow({ where: { id: bookingId } });
      assert(kept.feeNGN === fee, "the existing booking keeps its fee");
      const bind = await expectedPaystackConsultationBind(kept);
      assert(bind.amount === fee * 100 && bind.currency === "NGN", "and its payment still binds to that fee");
    } finally {
      if (feeRow) await prisma.siteSetting.update({ where: { key: feeKey }, data: { value: feeRow.value } });
      else await prisma.siteSetting.delete({ where: { key: feeKey } });
      clearSettingCacheKey(feeKey);
    }

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

    // BA3 USD: the amount shown is the amount locked, charged and bound.
    const usdRes = await fetch(`${base}/api/consultations/enquiries`, json(enquiry(`ba-usd-${stamp}@example.test`, later)));
    const usdEnquiry = await prisma.consultationEnquiry.findUniqueOrThrow({
      where: { enquiryNumber: ((await usdRes.json()) as { enquiryNumber: string }).enquiryNumber },
    });
    enquiryIds.push(usdEnquiry.id);
    await fetch(`${base}/api/admin/consultations/enquiries/${usdEnquiry.id}`, patch({ action: "approve", reason: "Diaspora bride" }, deskJar));
    const usdRow = await prisma.consultationEnquiry.findUniqueOrThrow({ where: { id: usdEnquiry.id } });
    const usdRaw = revealCapabilityToken({ token: usdRow.publicToken, enc: usdRow.publicTokenEnc })!;
    const shownUsd = (await quoteConsultationFees()).fees.PHYSICAL_TEAM_ONLY.USD;
    const usdBooking = { ...booking, enquiryToken: usdRaw, currency: "USD", quotedAmount: shownUsd };
    const wrongUsd = await fetch(`${base}/api/consultations/create`, json({ ...usdBooking, quotedAmount: shownUsd + 1 }));
    assert(wrongUsd.status === 409, `a USD figure that is not the locked one is refused (${wrongUsd.status})`);
    const usdCreated = await fetch(`${base}/api/consultations/create`, json(usdBooking));
    assert(usdCreated.status === 200, `USD booking at the shown figure (${usdCreated.status} ${await usdCreated.clone().text()})`);
    const usdId = ((await usdCreated.json()) as { bookingId: string }).bookingId;
    bookingIds.push(usdId);
    const usd = await prisma.consultationBooking.findUniqueOrThrow({ where: { id: usdId } });
    assert(usd.currency === "USD" && usd.fxAmountLocked === shownUsd && usd.fxRateLocked, "the shown USD amount and its rate are locked");
    assert(usd.feeNGN === fee, "the naira fee is frozen too");
    const usdCharge = await consultationCharge(usd);
    assert(usdCharge.major === shownUsd && usdCharge.currency === "USD", "the charge is exactly the figure shown");
    const stripeBind = await expectedConsultationBind("STRIPE", usd, "usd");
    assert(stripeBind.amount === Math.round(shownUsd * 100) && stripeBind.currency === "USD", "Stripe must have charged that, in cents");
    const otherCurrency = await expectedConsultationBind("STRIPE", usd, "gbp");
    assert(otherCurrency.currency === "USD", "a GBP charge on a USD booking is expected in USD — so the bind refuses it");
    const rateRow = await prisma.siteSetting.findUnique({ where: { key: "exchange_rate_usd" } });
    if (rateRow) {
      await prisma.siteSetting.update({ where: { key: rateRow.key }, data: { value: String(Number(rateRow.value) * 2) } });
      clearSettingCacheKey("exchange_rate_usd");
      try {
        assert((await consultationCharge(usd)).major === shownUsd, "a new exchange rate does not move a locked booking");
      } finally {
        await prisma.siteSetting.update({ where: { key: rateRow.key }, data: { value: rateRow.value } });
        clearSettingCacheKey("exchange_rate_usd");
      }
    }

    // BA4: the admin sets a guide; nonsense is a 400; the pages still render.
    const cms = await prisma.user.create({
      data: { email: `ba-cms-${stamp}@example.test`, name: "BA CMS", role: Role.ADMIN, password: hash },
    });
    const photo = await prisma.galleryImage.create({
      data: { url: "/media/public/fixture/ba4.jpg", publicId: `ba4-${stamp}`, category: "ATELIER", isPublished: false },
    });
    try {
      const cmsJar = await signIn(base, cms.email!, "Correct-Horse-9", ip);
      const put = (body: unknown) => fetch(`${base}/api/admin/gallery/${photo.id}`, patch(body, cmsJar));
      const upside = await put({ priceFloorNGN: 8_000_000, priceCeilingNGN: 3_000_000 });
      assert(upside.status === 400, `a ceiling below the floor is a 400 (${upside.status})`);
      const ceilingOnly = await put({ priceCeilingNGN: 3_000_000 });
      assert(ceilingOnly.status === 400, `a ceiling without a floor is a 400 (${ceilingOnly.status})`);
      const floor = await put({ priceFloorNGN: 3_000_000 });
      assert(floor.status === 200, `a floor saves (${floor.status})`);
      const kept = await put({ caption: "Fixture" });
      assert(kept.status === 200, "an unrelated edit keeps the guide");
      const row = await prisma.galleryImage.findUniqueOrThrow({ where: { id: photo.id } });
      assert(row.priceFloorNGN === 3_000_000 && row.priceCeilingNGN === null, "stored as whole naira, floor only");
      const custPut = await fetch(`${base}/api/admin/gallery/${photo.id}`, patch({ priceFloorNGN: 1 }, custJar));
      assert(custPut.status === 403, `a customer cannot set it (${custPut.status})`);
      for (const path of ["/atelier", "/bridal", "/consultation?wearer=BRIDE&outfit=Wedding%20gown&date=2027-01-16"]) {
        const r = await fetch(`${base}${path}`, { headers: { "x-forwarded-for": ip } });
        assert(r.status === 200, `${path} renders (${r.status})`);
      }
    } finally {
      await prisma.galleryImage.delete({ where: { id: photo.id } });
      await prisma.errorLog.deleteMany({ where: { userId: cms.id } });
      await prisma.activityLog.deleteMany({ where: { userId: cms.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: cms.id } });
    }

    // BA5: chat.
    const chatAdmin = await prisma.user.create({
      data: { email: `ba-chat-${stamp}@example.test`, name: "BA Chat", role: Role.ADMIN, password: hash },
    });
    const chatSuper = await prisma.user.create({
      data: { email: `ba-chat-super-${stamp}@example.test`, name: "BA Super", role: Role.SUPER_ADMIN, password: hash },
    });
    const chatStaff = await prisma.user.create({
      data: { email: `ba-chat-staff-${stamp}@example.test`, name: "BA Staff", role: Role.STAFF, isStaff: true, password: hash },
    });
    const chatKeys = ["chat_enabled", "chat_retention_days", "chat_hours_text"];
    const chatBefore = await prisma.siteSetting.findMany({ where: { key: { in: chatKeys } } });
    await prisma.siteSetting.deleteMany({ where: { key: { in: chatKeys } } });
    const erasureLogs: string[] = [];
    try {
      const adminJar = await signIn(base, chatAdmin.email!, "Correct-Horse-9", ip);
      const superJar = await signIn(base, chatSuper.email!, "Correct-Horse-9", ip);
      const staffJar = await signIn(base, chatStaff.email!, "Correct-Horse-9", ip);
      const settings = (body: unknown) => fetch(`${base}/api/admin/chat/settings`, patch(body, adminJar));
      // Start from "nobody has decided", through the API so the server's settings cache agrees.
      const reset = await settings({ enabled: false, retention: null, hoursText: "" });
      assert(reset.status === 200, "settings reset");
      const { run: runRetention } = await import("../src/lib/cron/jobs/chat-retention");
      const retentionJob = () => {
        clearSettingCacheKey("chat_retention_days");
        return runRetention({ now: new Date(), batchLimit: 500, isBudgetExhausted: () => false } as Parameters<typeof runRetention>[0]);
      };

      // The retention setting untouched: chat cannot be switched on.
      const untouched = await settings({ enabled: true });
      assert(untouched.status === 409, `chat cannot be enabled with the retention setting untouched (${untouched.status})`);
      const cleared = await settings({ enabled: true, retention: null });
      assert(cleared.status === 409, `nor with it cleared (${cleared.status})`);
      const custSettings = await fetch(`${base}/api/admin/chat/settings`, patch({ enabled: true, retention: "keep" }, custJar));
      assert(custSettings.status === 403, `a customer cannot switch chat on (${custSettings.status})`);
      const offStart = await fetch(`${base}/api/chat`, json({ name: "Ada", email: "a@example.test", message: "hi", path: "/" }));
      assert(offStart.status === 403, `chat that is off refuses to start (${offStart.status})`);

      // "Keep indefinitely" is a decision: it enables chat, and is recorded as such.
      const keep = await settings({ enabled: true, retention: "keep", hoursText: "We answer 9-6 WAT." });
      assert(keep.status === 200, `"keep indefinitely" enables chat (${keep.status})`);
      const keepView = (await keep.json()) as { enabled: boolean; retention: { mode: string } };
      assert(keepView.enabled && keepView.retention.mode === "keep", "and the setting records the decision");
      const stored = await prisma.siteSetting.findUniqueOrThrow({ where: { key: "chat_retention_days" } });
      assert(stored.value === "keep", "stored as a decision, not an empty field");

      const chatEmail = `ba-chat-visitor-${stamp}@example.test`;
      const noName = await fetch(`${base}/api/chat`, json({ email: chatEmail, message: "hi", path: "/" }));
      assert(noName.status === 400, `chat refuses to start without a name (${noName.status})`);
      const noEmail = await fetch(`${base}/api/chat`, json({ name: "Ada Obi", message: "hi", path: "/" }));
      assert(noEmail.status === 400, `chat refuses to start without an email (${noEmail.status})`);

      const atelierChat = await fetch(`${base}/api/chat`, json({ name: "Ada Obi", email: chatEmail, message: "How much is a gown?", path: "/atelier?utm_source=ig" }));
      assert(atelierChat.status === 201, `a chat starts with name and email (${atelierChat.status})`);
      const cookie = atelierChat.headers.getSetCookie().find((c) => c.startsWith("pg_chat="));
      assert(cookie && /HttpOnly/i.test(cookie), "the conversation cookie is httpOnly");
      const started = (await atelierChat.json()) as { conversation: { contextKind: string }; messages: { author: string; body: string }[] };
      assert(started.conversation.contextKind === "ATELIER", "started on the atelier journey");
      const house = started.messages.find((m) => m.author === "SYSTEM");
      assert(house && house.body.includes("/consultation") && !/₦/.test(house.body), "chat on an atelier page offers the form, not a quote");
      const convo = await prisma.chatConversation.findFirstOrThrow({ where: { visitorEmail: chatEmail } });
      assert(convo.contextPath === "/atelier", "the page is kept without its query");

      const chatCookie = cookie!.split(";")[0];
      const thread = await fetch(`${base}/api/chat`, { headers: { cookie: chatCookie } });
      assert(thread.status === 200, `her cookie reopens the conversation (${thread.status})`);
      const add = await fetch(`${base}/api/chat/messages`, { ...json({ body: "Also: sizing?" }), headers: { "content-type": "application/json", cookie: chatCookie, "x-forwarded-for": ip } });
      assert(add.status === 201, `she can add a message (${add.status})`);
      const stranger = await fetch(`${base}/api/chat`, { headers: { cookie: "pg_chat=not-a-real-token-but-long-enough-to-try-000" } });
      assert(stranger.status === 404, `a made-up cookie opens nothing (${stranger.status})`);

      const reply = (body: string) => fetch(`${base}/api/admin/chat/${convo.id}`, { ...json({ body }, adminJar) });
      const present = await reply("Welcome — the form is linked above.");
      assert(present.status === 201 && !((await present.json()) as { emailed: boolean }).emailed, "she is here: no email");
      await prisma.chatConversation.update({ where: { id: convo.id }, data: { visitorSeenAt: new Date(Date.now() - 10 * 60 * 1000) } });
      const away = await reply("Following up by email too.");
      assert(away.status === 201 && ((await away.json()) as { emailed: boolean }).emailed, "she left: the reply is emailed");
      const custInbox = await fetch(`${base}/api/admin/chat`, { headers: { cookie: custJar.header() } });
      assert(custInbox.status === 403, `a customer cannot read the chat inbox (${custInbox.status})`);

      // Auto-close after 30 quiet days: reversible, nothing deleted.
      const { run: runAutoclose } = await import("../src/lib/cron/jobs/chat-autoclose");
      const quiet = await prisma.chatConversation.create({
        data: {
          visitorName: "Quiet", visitorEmail: `ba-chat-visitor-quiet-${stamp}@example.test`, contextKind: "GENERAL", contextPath: "/",
          publicTokenExpiresAt: new Date(), lastMessageAt: new Date(Date.now() - 31 * 86_400_000), messages: { create: { author: "VISITOR", body: "hello?" } },
        },
      });
      const recent = await prisma.chatConversation.create({
        data: {
          visitorName: "Recent", visitorEmail: `ba-chat-visitor-recent-${stamp}@example.test`, contextKind: "GENERAL", contextPath: "/",
          publicTokenExpiresAt: new Date(), lastMessageAt: new Date(Date.now() - 29 * 86_400_000),
        },
      });
      await runAutoclose({ now: new Date(), batchLimit: 500, isBudgetExhausted: () => false } as Parameters<typeof runAutoclose>[0]);
      const [quietAfter, recentAfter] = await Promise.all([
        prisma.chatConversation.findUniqueOrThrow({ where: { id: quiet.id } }),
        prisma.chatConversation.findUniqueOrThrow({ where: { id: recent.id } }),
      ]);
      assert(quietAfter.status === "CLOSED" && quietAfter.closedAt, "31 quiet days: closed");
      assert(recentAfter.status === "OPEN", "29 quiet days: still open");
      assert((await prisma.chatMessage.count({ where: { conversationId: quiet.id } })) === 1, "closing deletes nothing");

      // Kept indefinitely: even three years untouched, the job deletes nothing.
      await prisma.chatConversation.update({ where: { id: convo.id }, data: { lastMessageAt: new Date(Date.now() - 3 * 365 * 86_400_000) } });
      await retentionJob();
      assert((await prisma.chatConversation.count({ where: { id: convo.id } })) === 1, "with \"keep\", the retention job deletes nothing");

      // The inbox survives it: closed conversations leave the active list but stay findable.
      const close = await fetch(`${base}/api/admin/chat/${convo.id}`, { ...patch({ status: "CLOSED" }, adminJar) });
      assert(close.status === 200, "a conversation closes");
      const active = (await (await fetch(`${base}/api/admin/chat`, { headers: { cookie: adminJar.header() } })).json()) as { items: { id: string }[]; hasMore: boolean };
      assert(!active.items.some((c) => c.id === convo.id), "the active list shows open conversations only");
      for (const q of [chatEmail, "Ada Obi"]) {
        const found = (await (await fetch(`${base}/api/admin/chat?q=${encodeURIComponent(q)}`, { headers: { cookie: adminJar.header() } })).json()) as { items: { id: string }[] };
        assert(found.items.some((c) => c.id === convo.id), `a closed conversation is found by "${q}"`);
      }

      // A period, if the house sets one later, is enforced by the same job.
      await prisma.chatConversation.update({ where: { id: convo.id }, data: { lastMessageAt: new Date() } });
      const ninety = await settings({ retention: 90 });
      assert(ninety.status === 200, "a day count can replace \"keep\"");
      const second = await prisma.chatConversation.create({
        data: {
          visitorName: "Ada Obi", visitorEmail: chatEmail, contextKind: "GENERAL", contextPath: "/", publicTokenExpiresAt: new Date(),
          lastMessageAt: new Date(Date.now() - 91 * 86_400_000), messages: { create: { author: "VISITOR", body: "old" } },
        },
      });
      await retentionJob();
      assert((await prisma.chatConversation.count({ where: { id: second.id } })) === 0, "with 90 days, the job deletes a conversation past it");
      await settings({ retention: "keep" });

      // Erasure on request: SUPER_ADMIN only, typed confirmation, logged.
      const other = await prisma.chatConversation.create({
        data: { visitorName: "Ada Obi", visitorEmail: chatEmail, contextKind: "SHOP", contextPath: "/shop", publicTokenExpiresAt: new Date(), messages: { create: { author: "VISITOR", body: "second chat" } } },
      });
      const erase = (jar: Jar, body: unknown) => fetch(`${base}/api/admin/chat/${convo.id}/erase`, { ...json(body, jar) });
      const good = { confirmation: "DELETE", allForVisitor: true, reason: "Erasure request under the NDPA" };
      const byStaff = await erase(staffJar, good);
      assert(byStaff.status === 403, `a STAFF actor cannot delete a conversation (${byStaff.status})`);
      const byAdmin = await erase(adminJar, good);
      assert(byAdmin.status === 403, `nor can a general admin (${byAdmin.status})`);
      const unconfirmed = await erase(superJar, { ...good, confirmation: "delete" });
      assert(unconfirmed.status === 400, `without the typed confirmation it is refused (${unconfirmed.status})`);
      assert((await prisma.chatConversation.count({ where: { visitorEmail: chatEmail } })) === 2, "nothing was deleted by the refusals");
      const erased = await erase(superJar, good);
      assert(erased.status === 200, `SUPER_ADMIN erases (${erased.status})`);
      const { logId, deleted } = (await erased.json()) as { logId: string; deleted: number };
      erasureLogs.push(logId);
      assert(deleted === 2, "every conversation for her email");
      assert((await prisma.chatConversation.count({ where: { visitorEmail: chatEmail } })) === 0, "the conversations are gone");
      assert((await prisma.chatMessage.count({ where: { conversationId: { in: [convo.id, other.id] } } })) === 0, "with their messages");
      const log = await prisma.activityLog.findUniqueOrThrow({ where: { id: logId } });
      const snap = log.snapshot as { visitor: { email: string }; conversations: { id: string; messages: number }[] };
      assert(log.action === "DELETE" && log.module === "chat" && log.userId === chatSuper.id, "logged as a delete by the super admin");
      assert(snap.visitor.email === chatEmail && snap.conversations.length === 2, "the log says what was deleted and for whom");
      assert(!JSON.stringify(log.snapshot).includes("How much is a gown") && !JSON.stringify(log.snapshot).includes("second chat"), "and keeps no words");

      const off = await settings({ enabled: false });
      assert(off.status === 200, "chat switches off");
      const afterOff = await fetch(`${base}/api/chat`, json({ name: "Ada Obi", email: chatEmail, message: "hi", path: "/" }));
      assert(afterOff.status === 403, `and then refuses new chats (${afterOff.status})`);
    } finally {
      // Leave the server's cache matching what is restored below.
      if (chatBefore.length === 0) {
        await fetch(`${base}/api/admin/chat/settings`, patch({ enabled: false, retention: null, hoursText: "" }, await signIn(base, chatAdmin.email!, "Correct-Horse-9", ip))).catch(() => {});
      }
      await prisma.chatConversation.deleteMany({ where: { visitorEmail: { startsWith: "ba-chat-visitor-" } } });
      await prisma.activityLog.deleteMany({ where: { id: { in: erasureLogs } } });
      await prisma.siteSetting.deleteMany({ where: { key: { in: chatKeys } } });
      for (const row of chatBefore) {
        const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = row as typeof row & { createdAt?: Date; updatedAt?: Date };
        await prisma.siteSetting.create({ data: rest });
      }
      for (const u of [chatAdmin, chatSuper, chatStaff]) {
        await prisma.errorLog.deleteMany({ where: { userId: u.id } });
        await prisma.activityLog.deleteMany({ where: { userId: u.id } }).catch(() => {});
        await prisma.user.delete({ where: { id: u.id } });
      }
    }

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
    console.log("ok live: BA2 invitation walk, BA3 fees (frozen; USD shown = locked = charged = bound), BA4 price guide, BA5 chat");
  } finally {
    await prisma.consultationEnquiry.deleteMany({ where: { id: { in: enquiryIds } } });
    await prisma.adminNotification.deleteMany({ where: { entityId: { in: [...enquiryIds, ...bookingIds] } } });
    await prisma.emailMessage.deleteMany({ where: { to: { endsWith: "@example.test" }, template: { startsWith: "consultation-" } } });
    await prisma.consultationBooking.deleteMany({ where: { id: { in: bookingIds } } });
    // Payment auto-onboards the client in the background; give it a moment, then remove it.
    await new Promise((r) => setTimeout(r, 1500));
    const onboarded = await prisma.user.findMany({
      where: { OR: ["ba-ok-", "ba-usd-"].map((prefix) => ({ email: { startsWith: prefix, endsWith: `${stamp}@example.test` } })) },
    });
    for (const u of onboarded) {
      await prisma.clientProfile.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    }
    await prisma.consultant.delete({ where: { id: consultant.id } });
    if (bank) await prisma.bankAccount.delete({ where: { id: bank.id } });
    if (usdBank) await prisma.bankAccount.delete({ where: { id: usdBank.id } });
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
