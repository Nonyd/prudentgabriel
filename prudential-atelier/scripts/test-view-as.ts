/**
 * "View as client": the ticket that starts it, the token swap back, what stays
 * hers, and what is written to the activity log. Unit only, no database.
 *
 *   pnpm test:view-as
 */
import "./preload-test-env";
import type { JWT } from "next-auth/jwt";

process.env.AUTH_SECRET ??= "test-view-as-secret";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

async function main() {
  const { signViewAsTicket, verifyViewAsTicket, endViewAs, readViewAsClaim, beginViewAs } = await import(
    "../src/lib/client-view-as"
  );
  const { viewAsBlockedApi, viewAsClosedPage, viewAsLoggable, describeViewAsRequest } = await import(
    "../src/lib/client-view-as-rules"
  );

  // ── The ticket: signed, short-lived, untouchable ──
  const now = Date.now();
  const ticket = signViewAsTicket({ actorId: "admin1", targetUserId: "client1", clientProfileId: "cp1" }, now);
  const t = verifyViewAsTicket(ticket, now);
  assert(t?.actorId === "admin1" && t.targetUserId === "client1" && t.clientProfileId === "cp1", "a fresh ticket verifies");
  assert(verifyViewAsTicket(ticket, now + 61_000) === null, "a ticket is dead after a minute");
  const [body, sig] = ticket.split(".");
  const forged = Buffer.from(JSON.stringify({ ...t, targetUserId: "someone-else" })).toString("base64url");
  assert(verifyViewAsTicket(`${forged}.${sig}`, now) === null, "a ticket edited to another client is refused");
  assert(verifyViewAsTicket(`${body}.x${sig!.slice(1)}`, now) === null, "a ticket with a bad signature is refused");
  assert(verifyViewAsTicket({ viewAs: ticket }, now) === null && verifyViewAsTicket(undefined, now) === null, "only a string is a ticket");

  // A ticket minted for one admin cannot start a session for another (checked before any database read).
  const other: JWT = { id: "admin2", email: "two@x.com" };
  assert((await beginViewAs(other, ticket, now)) === false && !readViewAsClaim(other), "another admin's ticket does nothing");

  // ── Exit puts the admin back exactly ──
  const token: JWT = {
    id: "client1",
    sub: "client1",
    email: "uche@x.com",
    name: "Uche",
    referralCode: "UCHE",
    pointsBalance: 40,
    viewAs: {
      actorId: "admin1",
      actorEmail: "prudent@x.com",
      actorName: "Mrs. Prudent",
      actorPicture: null,
      actorReferralCode: "PRU",
      actorPointsBalance: 0,
      targetUserId: "client1",
      clientProfileId: "cp1",
      clientName: "Uche",
      startedAt: now,
      exp: now + 3_600_000,
    },
  };
  const ended = endViewAs(token);
  assert(ended?.clientProfileId === "cp1", "exit reports whose file to return to");
  assert(token.id === "admin1" && token.sub === "admin1" && token.email === "prudent@x.com", "exit restores the admin");
  assert(token.name === "Mrs. Prudent" && token.referralCode === "PRU" && token.pointsBalance === 0, "and their name and points, not hers");
  assert(token.viewAs === undefined && endViewAs(token) === null, "and leaves no view-as behind");

  // ── What stays hers ──
  assert(viewAsBlockedApi("PATCH", "/api/account/password"), "her password");
  assert(viewAsBlockedApi("PATCH", "/api/account/profile/password"), "her password (profile form)");
  assert(viewAsBlockedApi("DELETE", "/api/account"), "closing her account");
  assert(viewAsBlockedApi("POST", "/api/account/payment-methods"), "saving a card to her account");
  assert(viewAsBlockedApi("DELETE", "/api/account/payment-methods/pm1"), "removing her card");
  assert(!viewAsBlockedApi("GET", "/api/account/payment-methods"), "seeing her cards is fine");
  assert(!viewAsBlockedApi("POST", "/api/account/addresses"), "adding an address for her is fine");
  assert(!viewAsBlockedApi("PATCH", "/api/account/profile"), "updating her phone is fine");
  for (const p of ["/admin", "/admin/clients/cp1", "/staff/orders", "/reset-password", "/auth/reset-password/abc"]) {
    assert(viewAsClosedPage(p), `${p} is closed while viewing as her`);
  }
  for (const p of ["/account", "/account/orders", "/shop", "/checkout"]) {
    assert(!viewAsClosedPage(p), `${p} is open while viewing as her`);
  }

  // ── What is logged ──
  const h = (o: Record<string, string> = {}) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });
  assert(viewAsLoggable("GET", "/account/orders", h()), "opening a page is logged");
  assert(viewAsLoggable("GET", "/account/orders", h({ rsc: "1" })), "a client-side navigation is logged");
  assert(!viewAsLoggable("GET", "/account/orders", h({ "next-router-prefetch": "1" })), "a link prefetch is not");
  assert(!viewAsLoggable("GET", "/account", h({ "sec-purpose": "prefetch" })), "nor a browser prefetch");
  assert(!viewAsLoggable("GET", "/api/account/notifications/count", h()), "reads behind the page are not");
  assert(viewAsLoggable("POST", "/api/account/addresses", h()), "a change is logged");
  assert(viewAsLoggable("POST", "/account/settings", h({ "next-action": "abc" })), "a server action is logged");
  assert(viewAsLoggable("POST", "/api/auth/signout", h()), "signing out is logged");
  for (const p of ["/api/auth/session", "/api/view-as", "/api/view-as/log", "/api/logs/client", "/api/analytics/event"]) {
    assert(!viewAsLoggable("POST", p, h()), `${p} is plumbing, not logged`);
  }
  assert(describeViewAsRequest("GET", "/account/orders", false) === "Opened /account/orders", "page line");
  assert(describeViewAsRequest("POST", "/api/account/addresses", false) === "POST /api/account/addresses", "change line");
  assert(describeViewAsRequest("POST", "/account/settings", true) === "Submitted a form on /account/settings", "form line");

  console.log("test-view-as: all assertions passed");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
