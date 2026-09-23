# Handover — Prudent Gabriel

The state of the project, so it lives in the repository and not in chat logs.
Read in one sitting; follow the links for depth.

**Repo:** `github.com/Nonyd/prudentgabriel`, app in `prudential-atelier/`.
**Branches:** `staging` deploys https://staging.prudentgabriel.com. `main` deploys production. Nothing reaches `main` without being asked.
**Last updated:** 23 September 2026.

Depth lives elsewhere:

| For | Read |
|---|---|
| The atelier pipeline (consultation → 13 stages → receipt → alterations) | [`ATELIER_HANDOVER.md`](ATELIER_HANDOVER.md) |
| Security: what was found, fixed, still open | [`prudential-atelier/docs/SECURITY_AUDIT.md`](../prudential-atelier/docs/SECURITY_AUDIT.md) |
| Questions only the house or its lawyer can answer | [`prudential-atelier/docs/LEGAL_OPEN_QUESTIONS.md`](../prudential-atelier/docs/LEGAL_OPEN_QUESTIONS.md) |
| Cron jobs, email outbox, payment ledger, rate limits | `prudential-atelier/docs/CRON.md`, `EMAIL.md`, `PAYMENT_LEDGER.md`, `RATE_LIMIT.md` |
| Deploying | [`DEPLOY.md`](../DEPLOY.md) |

---

## What is done

- **Shop (ready-to-wear).** Catalogue, bag, checkout in NGN/USD/GBP with the rate locked at checkout, Paystack / Flutterwave / Monnify / bank transfer, abandoned-checkout reminders, order tracking by number and email. Product grid is ~369 KB on a phone (Slice S).
- **Atelier.** Consultation is by invitation: enquiry → the house approves or declines with a reason → an expiring booking link → she proposes three dates → the house picks one → payment → reminders (BA2). Four consultation fees, frozen on the booking (BA3). Quotation → commission → 13 gated stages → delivery → receipt → 30-day alteration window. Price guides beside atelier photographs, never a price (BA4). The /atelier page is dressed (BB): a full-bleed hero on glass, the nine craft stages (the administrative four stay in the pipeline), and the gallery as pieces with their words and guide beside them.
- **Money.** Append-only payment ledger; the bind between what is shown and what is charged is checked server-side (Slice A). FX totals kept in kobo.
- **Accounts and staff.** Customer, staff and admin sign-in with per-account and per-address limits (BA1). Roles and permissions (Slice T). SUPER_ADMIN can sign everyone out.
- **Live chat.** First-party, no third-party script; name and email required; kept indefinitely by decision, erased on request by SUPER_ADMIN (BA5).
- **Legal pages.** Privacy, cookies, terms, returns, shipping, published from `src/lib/legal-copy.ts` by revision. Hosting in Germany (Contabo) is stated.
- **Security (Slice AZ and the token sweep).** Headers and report-only CSP, Postgres-backed rate limits, upload limits, SSRF guard, staff data access, session revocation. Every secret that opens something from a link is random, hashed and expiring (see the rule below). No emailed passwords.
- **Hero videos (/rtw and the homepage).** Poster first, a 720-wide encode the server makes itself, tap to play on a phone, `preload="none"`.
- **Secrets at rest.** Saved-card authorisation codes and gateway keys encrypted; the key can be rotated.

## What is left

### Needs a developer

| Item | Why it matters |
|---|---|
| **Next.js ≥ 15.5.24** | The image optimiser advisory (AZ1) is mitigated by AVIF being off, not fixed. Required security work. |
| Drop `SavedPaymentMethod.paystackAuthCode` | Always empty since the encryption change; drop the column in a migration once production has run the upgrade. |
| CSP is report-only | Enforce once the violation reports are reviewed. |
| Off-host backups (AZ10) | Backups sit on the same VPS. Needs an rclone remote, a schedule and one timed restore. |
| Atelier leftovers | Listed with their cost in `ATELIER_HANDOVER.md` → *What still needs a developer*. |

### Needs the house

| Item | Who |
|---|---|
| **Merge `staging` → `main`**, then reinstall production cron (26 jobs; see below). | Nony, when asked |
| Staging sign-in walk, **including one deliberately mistyped password**, on the modal, `/auth/login` and the staff and admin portals. | Kemi |
| Terms → Consultations paragraph (non-refundable fee, new refund commitment) and record retention. | Mrs. Prudent; `LEGAL_OPEN_QUESTIONS.md` |
| Contabo data-processing agreement (hosting in Germany). | Nony |
| Hero posters: optional. The server now takes a still; a chosen one looks better. | Glory, Admin → Content |
| **/atelier: price floors, titles and descriptions for the five gowns; group their frames and delete two duplicates; a hero photograph (landscape, 2400 px+) or film.** Exact screens and a tick list in [`prudential-atelier/docs/ATELIER_PAGE_CHECKLIST.md`](../prudential-atelier/docs/ATELIER_PAGE_CHECKLIST.md). | Mrs. Prudent (floors, words), Glory (entry, hero) |
| Accounts opened before the sweep with a temporary password never changed now need *Forgot password*. Tell anyone who asks. | Front of house |

---

## Operational facts

Learned the hard way, in no particular order.

- **Consultation enquiries on/off:** Admin → Settings → General → `atelier_bookings_enabled`. Anything but `"true"` is off (fails closed). It opens and closes the enquiry form; bookings come only from an approved enquiry's link.
- **Consultation fees:** Admin → Settings → Payments, the four `consultation_fee_*` keys (₦250,000 / 200,000 / 200,000 / 180,000). A booking freezes the fee it was quoted.
- **Terms and validity on quotes and invoices:** Admin → Settings → Invoice (`invoice_term_*`, `invoice_default_validity_days`).
- **Deposit percentage is set on the quotation.** `bespoke_deposit_percent` is only the default; the quotation's own figure is what the invoice uses.
- **Chat stays off until retention is set.** Admin → Chat → settings. Retention is "keep" today; switching chat on without a retention answer is refused.
- **Legal copy** is edited in `src/lib/legal-copy.ts` and republished by bumping that page's `revision`. Editing the CMS directly is overwritten on the next bump.
- **Paystack test cards decline large sums.** On staging, pay bridal/FX totals by bank transfer (or Bank Authentication). Never round a locked total to make Paystack pass.
- **Production cron must be reinstalled whenever jobs change.** Jobs live in `src/lib/cron/catalog.ts`; `pnpm render:cron` writes `deploy/cron.d/prudentgabriel`; `deploy/install-host-cron.sh` installs it. `pnpm test:cron` fails if they disagree. There are 26 jobs.
- **`main` deploys production and owns the shared Traefik routes and backup scripts.** A push to `staging` once rewrote production's live routes (fixed in `c084881`). Shared host files change only from `main`.
- **Deploy:** push → GHCR image → the VPS recreates the container; the entrypoint runs `prisma migrate deploy`, then `scripts/upgrade-capability-tokens.ts` (idempotent). Check the log for `[capability-tokens] done` and no ERROR line.
- **Rotating the encryption key:** set the new `ENCRYPTION_KEY`, put the old one in `ENCRYPTION_KEY_PREVIOUS`, deploy. The entrypoint re-encrypts every column on `src/lib/encrypted-columns.ts`; remove the previous key only after its log says `unreadable 0`. Changing the key without this makes gateway keys, saved cards and re-sendable links unreadable.
- **Databases:** staging is Postgres on the VPS; local `.env` points at a Neon scratch database. Tests refuse to run fixtures against staging or production.
- **Testing locally:** `SKIP_DB_BUILD=1 pnpm build:next` (the Windows standalone symlink error at the end is harmless), then `next start -p 3100`, then `ALLOW_FIXTURES=true BASE_URL=http://localhost:3100 npx tsx --tsconfig tsconfig.scripts.json scripts/test-*.ts`. `pnpm test:ci` runs the database-free subset, as CI does.

---

## Rules

Each one was paid for.

1. **Assert status codes and behaviour, not source text.** Two guards that grepped for `isPublished` passed while the filter was gone for four weeks. A test calls the code, or the server, and checks what comes back.
2. **`isPublished` is an invariant, not a display filter.** Every customer-facing read (list, search, sitemap, bag, wishlist, restore link, campaign email) leaves unpublished pieces out on the server. `test:product-visibility` proves it by behaviour.
3. **A secret in a URL or an email is random, hashed and expiring.** 32 random bytes; only the SHA-256 stored; an encrypted copy only where the same link must be re-sent; expired and unknown answer alike with a 404. Every such column is on `src/lib/capability-registry.ts`, and `test:token-defaults` fails on one that is not, or on any plaintext row. No email carries a password.
4. **No number a customer sees is typed twice.** A price, fee, deposit or total has one source (a setting, the quotation, the locked rate), and every page, PDF and email reads it from there. The server charges what it showed (Slice A's bind).
5. **Do not weaken, in passing:** Slice A's bind, Slice B's public DTOs, Slice T's permissions, the append-only ledgers.
