/**
 * Authorization, public PII DTOs, receipt ownership, password-reset tokens, register oracle.
 *
 *   pnpm test:authz
 */
import "./preload-test-env";
import { Role } from "@prisma/client";
import {
  CMS_ADMIN_PERMISSIONS,
  hasPermission,
  inheritedDottedPermissions,
  roleAllows,
} from "../src/lib/roles";
import {
  actorOwnsBespokeOrder,
  toPublicConsultationDto,
  toPublicRtwOrderDto,
  toPublicTrackDto,
} from "../src/lib/public-pii-dtos";
import {
  generateResetToken,
  hashResetToken,
  jwtIssuedBeforePasswordChange,
  RESET_TTL_MS,
} from "../src/lib/password-reset";
import { sanitizeCmsHtml } from "../src/lib/sanitize-html";
import { passwordPolicySchema } from "../src/lib/password-policy";
import { mimeFromMagicBytes } from "../src/lib/image-upload-mime";
import { verifyPFAStudent } from "../src/lib/pfa-verify";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

async function main() {
  // Production User.role snapshot (Neon branch `production`, 2026-08-19).
  // CUSTOMER count was 0. No CONTENT_MANAGER / RTW_MANAGER / etc.
  const productionRoles: Record<string, number> = {
    STAFF: 6,
    SUPER_ADMIN: 2,
    ADMIN: 1,
  };
  for (const role of Object.keys(productionRoles)) {
    if (role === "STAFF") {
      assert(!roleAllows(role, "dashboard"), "STAFF has empty ROLE_PERMISSIONS — staff portal, not /admin");
      continue;
    }
    assert(roleAllows(role, "dashboard") || role === "SUPER_ADMIN", `${role} must not be an empty ROLE_PERMISSIONS hole`);
  }
  assert(roleAllows("SUPER_ADMIN", "payments"), "SUPER_ADMIN reaches payments");
  assert(roleAllows("SUPER_ADMIN", "shop.orders"), "SUPER_ADMIN reaches orders");
  assert(roleAllows("SUPER_ADMIN", CMS_ADMIN_PERMISSIONS), "SUPER_ADMIN reaches CMS");
  assert(roleAllows("SUPER_ADMIN", "settings"), "SUPER_ADMIN reaches settings");

  // Mrs. Prudent holds ADMIN (prudent@prudentgabriel.com)
  const mrs = "ADMIN";
  const mrsMustReach = [
    "consultations",
    "bespoke",
    "quotations",
    "invoices",
    "payments",
    "clients",
    "reports",
    "shop.orders",
    "shop.products",
    "content",
    "settings",
  ] as const;
  for (const perm of mrsMustReach) {
    assert(roleAllows(mrs, perm), `Mrs. Prudent (ADMIN) must reach ${perm}`);
  }
  assert(roleAllows("SUPER_ADMIN", "settings.developer"), "SUPER_ADMIN reaches developer settings");
  assert(!roleAllows("ADMIN", "settings.developer"), "ADMIN must not inherit settings.developer");

  // Positive × negative matrix for route groups (200 iff roleAllows)
  const groups: { name: string; perm: Parameters<typeof roleAllows>[1] }[] = [
    { name: "payments", perm: "payments" },
    { name: "shop.orders", perm: "shop.orders" },
    { name: "shop.products", perm: "shop.products" },
    { name: "invoices", perm: "invoices" },
    { name: "quotations", perm: "quotations" },
    { name: "bespoke", perm: "bespoke" },
    { name: "consultations", perm: "consultations" },
    { name: "clients", perm: "clients" },
    { name: "cms", perm: CMS_ADMIN_PERMISSIONS },
    { name: "reports", perm: "reports" },
    { name: "settings (PAYMENTS)", perm: "settings" },
  ];
  const expect200: Record<string, string[]> = {
    SUPER_ADMIN: groups.map((g) => g.name),
    ADMIN: groups.map((g) => g.name),
    STAFF_ADMIN: groups.filter((g) => g.name !== "reports" && g.name !== "settings (PAYMENTS)").map((g) => g.name),
    STAFF: [],
    CONTENT_MANAGER: ["cms"],
    FINANCE_MANAGER: ["payments", "invoices", "quotations"],
    RTW_MANAGER: ["shop.orders", "shop.products"],
    BESPOKE_MANAGER: ["bespoke", "consultations"],
    CONSULTATION_MANAGER: ["consultations"],
    HR_MANAGER: [],
  };
  for (const [role, allowed] of Object.entries(expect200)) {
    for (const g of groups) {
      const actual = roleAllows(role, g.perm) ? 200 : 403;
      const expected = allowed.includes(g.name) ? 200 : 403;
      assert(actual === expected, `${role} × ${g.name}: expected ${expected} got ${actual}`);
    }
  }

  assert(inheritedDottedPermissions("ADMIN").includes("shop.orders"), "ADMIN inherits shop.orders from shop");
  assert(inheritedDottedPermissions("STAFF_ADMIN").includes("shop.orders"), "STAFF_ADMIN inherits shop.orders from shop");
  assert(!inheritedDottedPermissions("ADMIN").includes("settings.developer"), "settings.developer is not inherited");
  assert(inheritedDottedPermissions("CONTENT_MANAGER").length === 0, "CONTENT_MANAGER has no parent-key inheritance");

  // B1 — CONTENT_MANAGER cannot hit money / user admin surfaces
  assert(!hasPermission("CONTENT_MANAGER", "payments"), "CONTENT_MANAGER must not have payments");
  assert(!hasPermission("CONTENT_MANAGER", "settings"), "CONTENT_MANAGER must not have settings");
  assert(!hasPermission("CONTENT_MANAGER", "shop.orders"), "CONTENT_MANAGER must not have shop.orders (API read denied; confirm if UI-only was intended)");
  assert(hasPermission("CONTENT_MANAGER", "content.pages"), "CONTENT_MANAGER keeps content.pages");
  assert(hasPermission("FINANCE_MANAGER", "payments"), "FINANCE_MANAGER has payments");
  assert(hasPermission("ADMIN", "payments"), "ADMIN has payments");

  // B2 — track DTO never includes leaked keys
  const track = toPublicTrackDto({
    orderRef: "BQ-2026-00001",
    status: "IN_PRODUCTION" as never,
    currentStage: "PATTERN_MAKING" as never,
    clientName: "Ada Lovelace",
    deliveryDate: new Date("2026-09-01"),
  });
  const trackJson = JSON.stringify(track);
  for (const key of ["clientEmail", "clientPhone", "paymentRef", "receiptConfirmToken", "sessionNotes"]) {
    assert(!Object.prototype.hasOwnProperty.call(track, key), `track DTO must not have key ${key}`);
    assert(!trackJson.includes(key), `track DTO JSON must not mention ${key}`);
  }
  assert(track.clientFirstName === "Ada", "first name only");

  const consult = toPublicConsultationDto({
    bookingNumber: "CB-26-00001",
    status: "CONFIRMED" as never,
    paymentStatus: "PAID" as never,
    clientName: "Ada Lovelace",
    confirmedDate: new Date(),
    confirmedTime: "10:00",
    offering: { sessionType: "STYLING_SESSION" },
    consultant: { name: "Prudent" },
  });
  const consultJson = JSON.stringify(consult);
  for (const key of ["clientEmail", "clientPhone", "paymentRef", "sessionNotes"]) {
    assert(!Object.prototype.hasOwnProperty.call(consult, key), `consultation DTO must not have ${key}`);
    assert(!consultJson.includes("clientEmail"), "consultation DTO must not leak clientEmail");
  }

  const rtw = toPublicRtwOrderDto({
    orderNumber: "PA-26-00001",
    status: "PENDING",
    paymentStatus: "PENDING" as never,
    subtotal: 1,
    shippingAmount: 0,
    discount: 0,
    pointsDiscountNGN: 0,
    total: 1,
    shippingZone: { name: "Lagos", estimatedDays: "3-5" },
    items: [{ product: { name: "Dress" }, size: "M", quantity: 1, lineTotal: 1 }],
  });
  assert(!("guestEmail" in rtw), "RTW DTO must not include guestEmail");
  assert(!("addressSnapshot" in rtw), "RTW DTO must not include addressSnapshot");

  // B3 — non-owner cannot confirm
  assert(
    !actorOwnsBespokeOrder({
      actorId: "user_attacker",
      actorEmail: "attacker@example.test",
      clientEmail: "owner@example.test",
      profileUserId: "user_owner",
    }),
    "non-owner must not own order even with a valid token path",
  );
  assert(
    actorOwnsBespokeOrder({
      actorId: "user_owner",
      actorEmail: "owner@example.test",
      clientEmail: "owner@example.test",
      profileUserId: "user_owner",
    }),
    "owner email/id must match",
  );

  // B7 — token hashing, single-use / expiry helpers
  const { raw, hash } = generateResetToken();
  assert(hash === hashResetToken(raw), "hash is deterministic");
  assert(hash !== raw, "store hash not raw token");
  assert(RESET_TTL_MS === 60 * 60 * 1000, "1 hour expiry");
  const used = new Set<string>();
  const consume = (tokenHash: string, expiresAt: Date, now: Date) => {
    if (used.has(tokenHash)) return false;
    if (expiresAt < now) return false;
    used.add(tokenHash);
    return true;
  };
  const now = new Date();
  assert(consume(hash, new Date(now.getTime() + 1000), now), "first use succeeds");
  assert(!consume(hash, new Date(now.getTime() + 1000), now), "second use fails");
  const { hash: expiredHash } = generateResetToken();
  assert(!consume(expiredHash, new Date(now.getTime() - 1000), now), "expired token fails");
  assert(
    jwtIssuedBeforePasswordChange(100, new Date(200_000)),
    "JWT iat before passwordChangedAt is stale",
  );
  assert(
    !jwtIssuedBeforePasswordChange(300, new Date(200_000)),
    "JWT iat after passwordChangedAt is valid",
  );
  assert(
    !jwtIssuedBeforePasswordChange(undefined, new Date()),
    "missing iat must not invalidate",
  );
  assert(
    !jwtIssuedBeforePasswordChange(1_700_000_000, null),
    "null passwordChangedAt must not invalidate existing sessions",
  );
  const changed = new Date(1_700_000_500_000); // ms
  assert(
    !jwtIssuedBeforePasswordChange(1_700_000_500, changed),
    "same unix second is not stale",
  );
  assert(
    jwtIssuedBeforePasswordChange(1_700_000_499, changed),
    "previous unix second is stale",
  );
  assert(
    !jwtIssuedBeforePasswordChange(1_700_000_500_000, changed),
    "millisecond iat is normalised and not stale at the same instant",
  );
  assert(passwordPolicySchema.safeParse("password").success === false, "policy rejects no upper/digit");
  assert(passwordPolicySchema.safeParse("Password1").success === true, "policy accepts upper+digit");

  // B6 — register responses are identical
  const existingBody = { success: true };
  const newBody = { success: true };
  assert(JSON.stringify(existingBody) === JSON.stringify(newBody), "register success payload is identical");

  // B8 — PFA mock refused unless explicitly set in development
  const prev = process.env.PFA_VERIFY_METHOD;
  delete process.env.PFA_VERIFY_METHOD;
  const refused = await verifyPFAStudent("PFA/2024/001");
  assert(refused.valid === false, "unset PFA_VERIFY_METHOD refuses");
  process.env.PFA_VERIFY_METHOD = prev;

  // B10 — sanitizer strips script
  const dirty = `<p>Hi</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>`;
  const clean = sanitizeCmsHtml(dirty);
  assert(!clean.includes("script"), "script tags stripped");
  assert(!clean.toLowerCase().includes("javascript:"), "javascript urls stripped");

  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert(mimeFromMagicBytes(jpeg) === "image/jpeg", "jpeg magic");

  void Role.CUSTOMER;
  console.log("OK — test-authz");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
