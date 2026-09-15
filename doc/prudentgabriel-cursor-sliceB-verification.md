# Slice B — Verification Before Push

The route→permission mapping reads correctly and `isAdminRole` being deleted
rather than deprecated is the right call. Five checks before this ships.

---

## 1. The tests only prove denial. Prove access too.

`test:authz` asserts that `CONTENT_MANAGER` gets 403 on payments, orders and
users. Every one of those assertions would still pass if the refactor denied
*everyone* everything. A permission change across ~66 admin routes with only
negative tests is how a client gets locked out of her own dashboard on a Monday
morning.

Add the positive half:

- For **every role that exists on production** — enumerate them from the database,
  do not assume the list — assert a 200 on the routes that role is supposed to
  reach. Mrs. Prudent's account is the one that matters most: whatever role string
  she actually holds, she must still reach consultations, bespoke, quotations,
  invoices, payments, clients, reports and CMS.
- Assert `SUPER_ADMIN` reaches everything.
- Report a matrix: role × route-group × expected × actual.

Then check it against reality rather than against the schema: list the distinct
`role` values present in the **production** `User` table with a count of each. If
a role exists on real accounts that `ROLE_PERMISSIONS` does not grant anything to,
those users are now locked out and nobody will know until they log in.

## 2. Parent-key inheritance — confirm it does not over-grant

`shop` ⇒ `shop.orders` is convenient, but it means any role holding `shop` now
reads orders, including customer names, addresses, phones and totals. That was the
question I was asked about `CONTENT_MANAGER`; the same question applies to
anything else holding a parent key.

List every role holding a parent key and every dotted child that key now unlocks.
If any role gains something through inheritance that it would not have been
granted explicitly, that is an over-grant and the mapping needs an explicit entry
instead.

## 3. The sanitizer may silently break existing CMS content

`sanitize-html` runs on render with an allowlist. Existing journal posts, product
detail HTML, careers copy and legal pages were all authored with no sanitizer, so
whatever they contain has never been constrained.

- Run the sanitizer across every existing row in those tables and report any where
  the output differs from the input, with the tags or attributes that were
  stripped.
- Embedded video, tables, inline styles and `class` attributes are the usual
  casualties. Legal pages in particular tend to carry structural markup.
- If real content would be damaged, widen the allowlist for those specific
  elements rather than shipping and finding out from the client.

## 4. Registration UX must match the new response

Register no longer returns 409, which is right. But the client component was
written against the old behaviour.

- Confirm the UI now shows the same neutral outcome ("check your email") for both
  a new and an existing address, and does **not** claim an account was created.
- Confirm the "you already have an account" email actually renders and dispatches
  — it is new, and the `E2E_CAPTURE_EMAIL` hook from Sprint D exists precisely for
  this.

## 5. `passwordChangedAt` comparison units

JWT `iat` is seconds since epoch; `passwordChangedAt` is a millisecond `Date`.
Confirm the comparison normalises, and confirm the null case (a user who has never
reset) does not reject valid tokens. A sign error here logs out every user on the
next deploy — silently, and looking exactly like a session bug.

---

## Not in this slice, but do not lose it

`POST /api/invoice/[token]/email-copy` is still unauthenticated (audit P2). The
token has decent entropy so it is not an exposure, but it is an unmetered mail
sender pointed at a client's address, and it now sits alongside a rate limiter you
have already built. One line to add it.

---

## Then

Push Slice A and B together to `staging` and watch the container come up — the
encryption fail-closed from A and the `passwordChangedAt` migration from B both
run at boot. Confirm `prisma migrate deploy` applied `20260819_password_changed_at`
before assuming the app is healthy.

Report items 1–5, then `tsc --noEmit`.
