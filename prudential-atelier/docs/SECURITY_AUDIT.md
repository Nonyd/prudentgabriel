# Security audit — Prudential Atelier

**Date:** 2026-09-21  
**Scope:** `prudential-atelier/` + `deploy/` on branch `staging`  
**Mode:** Read-only. No fixes. No exploit attempts against production.  
**Staging probed:** `https://staging.prudentgabriel.com` (headers, public surfaces).  
**Verdict vocabulary:** `SECURE` | `WEAK` | `EXPOSED` | `UNCLEAR`

Nothing is unhackable. This document records the remaining attack surface after
Slices A, B, T, U, X and related work: small where possible, named where not.

No secret, key, password or token value appears below.

---

## 1. The front door

### 1.1 Rate limiting

Implementation: process-local `Map` in `src/lib/rate-limit.ts:5–22`. Documented
ceiling: resets on deploy/restart; does not share across containers
(`docs/RATE_LIMIT.md:1–7`).

| Surface | Bucket / key | Limit | Citation | Verdict |
|---------|--------------|-------|----------|---------|
| Credentials login | `auth-credentials` | 10 / 15m | `src/app/api/auth/[...nextauth]/route.ts:14` | **WEAK** (in-memory only) |
| Register | `register` | 5 / 15m | `src/app/api/auth/register/route.ts:14` | **WEAK** |
| Forgot password | `forgot-password` | 5 / 15m | `src/app/api/auth/forgot-password/route.ts:10` | **WEAK** |
| Reset password | `reset-password` | 8 / 15m | `src/app/api/auth/reset-password/route.ts:24` | **WEAK** |
| Contact | `contact-form` | 5 / 15m | `src/app/api/contact/route.ts:14` | **WEAK** |
| Careers apply | `careers-apply:{ip}` | 3 / 1h | `src/app/api/careers/[slug]/apply/route.ts:44` | **WEAK** |
| Careers upload | `careers-upload` | 8 / 15m | `src/app/api/careers/upload/route.ts:15` | **WEAK** |
| Consultations upload | `consultations-upload` | 8 / 15m | `src/app/api/consultations/upload/route.ts:19` | **WEAK** |
| Receipt ticket | `receipt-ticket` | 8 / 15m | `src/app/api/upload/receipt/ticket/route.ts:9` | **WEAK** |
| Receipt upload | `receipt-upload` | 12 / 15m | `src/app/api/upload/receipt/route.ts:18` | **WEAK** |
| Track token API | `track-token` | 30 / 15m | `src/app/api/track/[token]/route.ts:9` | **WEAK** |
| Track by order ref | `track-ref:{ip}` | 20 / 15m | `src/app/(storefront)/track/page.tsx:33` | **WEAK** |
| Newsletter | — | **none** | `src/app/api/newsletter/route.ts:11–37` | **EXPOSED** |
| Coupon validate | — | **none** | `src/app/api/coupons/validate/route.ts` | **WEAK** |
| Approve POST | — | **none** | `src/app/api/approve/[token]/route.ts` | **WEAK** |
| Invoice pay / bank-transfer | — | **none** | `src/app/api/invoice/[token]/pay`, `.../bank-transfer` | **WEAK** |
| Client logs | — | **none** | `src/app/api/logs/client/route.ts` | **WEAK** |
| Analytics event | — | **none** | `src/app/api/analytics/event/route.ts` | **WEAK** |

On burst against a limited route the client receives HTTP 429 and `Retry-After`
(`src/lib/rate-limit.ts:39–42`). Unlisted writers have no such response.

### 1.2 Authentication and sessions

| Claim | Evidence | Verdict |
|-------|----------|---------|
| Session strategy is JWT | `src/lib/auth.config.ts:12` | **SECURE** (explicit) |
| No app-set `maxAge` / `updateAge` | Absent from `auth.config.ts` and `auth.ts` — Auth.js defaults apply | **WEAK** |
| Password change invalidates JWT | `passwordChangedAt` set in `applyPasswordHash` (`src/lib/password-reset.ts:20–29`); jwt callback returns `null` when `jwtIssuedBeforePasswordChange` (`src/lib/auth.ts:182–189`, `password-reset.ts:54–64`) | **SECURE** |
| Force sign-out per user | `forceSignOutUser` bumps `passwordChangedAt` and deletes DB sessions (`password-reset.ts:33–38`); admin route `POST /api/admin/users/[id]/force-signout` | **SECURE** |
| Global revoke-all-sessions | No `session.deleteMany({})` or AUTH_SECRET rotate helper in app code | **EXPOSED** (ops-only) |
| Reset tokens | `randomBytes(32)` hex, 1h TTL (`password-reset.ts:3–12`, `41–50`) | **SECURE** |
| Shared admin + storefront cookie | Same Auth.js session; middleware gates `/admin` via `userHasAdminAccess`, `/account` via any session (`src/middleware.ts` account/admin branches; `auth.config.ts:77–78`) | **WEAK** — one compromised browser session is both identities when the user has admin access |

### 1.3 Public token routes

| Route | Token field | Generation | Expiry | What it returns / writes | Verdict |
|-------|-------------|------------|--------|--------------------------|---------|
| `/approve/[token]` | `StageApproval.publicToken` | `@default(cuid())` `prisma/schema.prisma:2211` | none | Stage media, notes, approve/reject | **WEAK** |
| `/receipt/[token]` | `receiptConfirmToken` | `@default(cuid())` `:2027` | none (alteration window is business rule) | Confirm delivery; alterations POST | **WEAK** |
| `/invoice/[token]` | `Invoice.publicToken` | `@default(cuid())` `:890` | document `expiresAt` warns; payment path may still run | Full invoice, bank details, pay options, PII addressee | **EXPOSED** if token leaks |
| `/track/[token]` | `trackingToken` | `@default(cuid())` `:2016` | none | API: first name + stage. **Page** also loads stage history/images | **WEAK** |
| Quote approve | `approvalToken` | `@default(cuid())` `:2421` | quote `expiresAt` checked in route | Approve quotation | **WEAK** |

cuid tokens are time-ordered identifiers, not `crypto.randomBytes`. Guessing a
fresh token by brute force is hard; leaking one email or chat link is enough.
Order-ref → track token is available at `/track?ref=` with rate limit
(`src/app/(storefront)/track/page.tsx:29–41`).

### 1.4 Public write endpoints (summary)

Middleware skips auth for essentially all `/api/*` (`src/middleware.ts:70–80`);
each route must gate itself.

Unauthenticated writers with validation: register, forgot-password, contact,
careers apply, newsletter, shipping calculate, coupon validate, receipt ticket,
token-gated invoice/approve/receipt/track APIs, guest checkout/order/payment
initiate, consultations create/upload, webhooks (signature), cron (secret).

Highest residual risk among them: **capability-token writers with no rate limit**
and **unauthenticated uploads** (section 2).

---

## 2. Input and output

### 2.1 File uploads

All app uploads land in local MediaStore (`MEDIA_ROOT` / `.data/media`). Keys are
`public|private/<folder>/<content-hash><ext>`; original filename is metadata only
(not the filesystem path).

| Path | Magic bytes | Size | Auth | Verdict |
|------|-------------|------|------|---------|
| `POST /api/admin/upload` | yes | 5MB image / 50MB video | admin + folder gate; blocked while impersonating | **SECURE** |
| `POST /api/account/upload` | yes | 5MB | session; **no** rate limit; `private: false` avatars | **WEAK** |
| `POST /api/careers/upload` | yes (PDF allowed) | 5MB | **none**; 8/15m IP | **EXPOSED** (guest disk fill) |
| `POST /api/consultations/upload` | yes | 5MB | **none**; 8/15m IP | **EXPOSED** |
| `POST /api/upload/receipt` | yes (+ HEIC) | 5MB | session **or** HMAC ticket from public ticket mint | **WEAK** |
| `POST /api/upload/receipt/ticket` | n/a | n/a | email only → ticket (`ticket/route.ts:19–20`) | **WEAK** |

Private media is refused on public `/media/[...key]` (`allowPrivate: false`).
Signed access goes through `/api/media/signed`.

**Free storage abuse:** careers and consultations uploads are the clearest public
write-to-disk paths. Receipt flow requires only a valid email to mint a ticket,
then 12 uploads / 15 minutes per IP.

### 2.2 SQL injection

| Site | Interpolation | Verdict |
|------|---------------|---------|
| `src/lib/document-numbers.ts:24–34` | Prisma tagged `$executeRaw` / `$queryRaw` | **SECURE** |
| `src/lib/product-cascade-delete.ts:294` | `$executeRawUnsafe(\`SET LOCAL app.ledger_bypass = 'on'\`)` fixed string | **SECURE** |
| Same file order/product id lists | `Prisma.join(...)` parameterized | **SECURE** |

No `$queryRawUnsafe` with request-derived strings under `src/`.

### 2.3 XSS (CMS HTML)

Storefront CMS HTML runs through custom allowlist `sanitizeCmsHtml`
(`src/lib/sanitize-html.ts:100–116`) on render (journal, product details, legal,
careers copy). Writers are admin-gated (`CMS_ADMIN_PERMISSIONS` /
`requireGeneralAdminApi`).

| Claim | Verdict |
|-------|---------|
| Unauthenticated cannot write CMS HTML | **SECURE** |
| Sanitizer is a hand-rolled regex allowlist, not DOMPurify | **WEAK** |
| Email template HTML uses `dangerouslySetInnerHTML` without `sanitizeCmsHtml` | **UNCLEAR** (admin-authored; not storefront) |

### 2.4 SSRF

`uploadProductImageFromUrl` fetches any URL that is not already local
(`src/lib/product-image-migrate.ts:8–12`). Caller
`POST /api/admin/products/[id]/images/reupload` (`reupload/route.ts:15–39`):
requires `shop.products`; for non–WordPress DB URLs it fetches client `sourceUrl`
(`z.string().url()`). No localhost / link-local / metadata IP blocklist.

| Claim | Verdict |
|-------|---------|
| Admin-authenticated SSRF via product image re-host | **EXPOSED** |
| Unauthenticated SSRF via this path | **SECURE** (gated) |

---

## 3. Secrets and credentials

### 3.1 Repository

| Check | Result | Verdict |
|-------|--------|---------|
| Tracked env files | Only `prudential-atelier/.env.example` (`git ls-files`) | **SECURE** |
| History of `.env` with real values | `git log -S "AUTH_SECRET="` on `*.env*` shows only `.env.example` placeholder lines | **SECURE** (for that pattern) |
| Local untracked `.env` / `.env.local` | Present on developer machine; not in git | Expected; keep out of commits |

Hardcoded walk/demo passwords remain in **scripts and docs** (values not quoted
here): `prisma/seed-fixtures.ts`, `scripts/seed-demo.ts`, `DEPLOYMENT.md`,
`doc/DEMO-GUIDE.md`, `DEMO-SCRIPT.md`, `CHECKLIST.md`. Fixture seed refuses
staging/prod hosts via `fixture-guard.ts`. Whether any walk password is **still
live on staging Postgres** was not verified from this workstation → **UNCLEAR**
(see §9).

### 3.2 Runtime env files (VPS)

Documented locations:

- Staging compose: `env_file: .env.staging` next to compose
  (`deploy/compose.staging.yaml:38–39`)
- Workspace rule: `/opt/prudentgabriel/deploy/.env.staging` on the VPS

File permissions, ACL, and which OS users can read those files were **not**
inspected from this audit session → **UNCLEAR**.

### 3.3 Settings encryption key

| Claim | Evidence | Verdict |
|-------|----------|---------|
| Key from `ENCRYPTION_KEY` or `SETTINGS_ENCRYPTION_KEY` | `src/lib/encryption.ts:16–27` | **SECURE** (fail-closed at runtime) |
| Algorithm AES-256-GCM (`gcm:`); legacy CBC readable | `encryption.ts:38–72` | **SECURE** / legacy accepted |
| Lost key = encrypted settings rows unreadable | Design of `encrypt`/`decrypt` + settings store | **WEAK** (no recovery path in code) |
| Non–SUPER_ADMIN gets decrypted gateway secrets in API responses | Developer GET redacts (`credential-catalog.ts` display helpers; `settings-developer.ts` redaction); commercial settings APIs strip developer keys | **SECURE** |
| Developer route gate is permission `settings.developer`, not hard `requireSuperAdminApi` | `roles.ts` — ADMIN list omits `settings.developer`; `NEVER_INHERIT_FROM_PARENT` includes it | **WEAK** if someone grants the permission |

### 3.4 Other credential stores

| Item | Where it lives | Notes |
|------|----------------|-------|
| Database URL / Postgres password | Compose env / `.env.staging` | Postgres service has **no** host port publish (`compose.staging.yaml:13–29`) |
| GHCR pull | Deploy host / Coolify / workflow secrets | Not in app repo |
| Deploy SSH | Ops; not in app tree | **UNCLEAR** who holds keys |
| Cloudinary | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` still build-arg (`Dockerfile:26`); runtime media is MediaStore | Legacy surface |
| Payment keys | Encrypted settings rows + optional env fallback (`credential-catalog.ts`) | Dashboard shows redacted |

---

## 4. The infrastructure

### 4.1 HTTP security headers

Command: `curl -sS -D - -o NUL https://staging.prudentgabriel.com/`

Observed: `HTTP/1.1 200`, `X-Powered-By: Next.js`.  
**Absent** in that response: `Content-Security-Policy`, `Strict-Transport-Security`,
`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`,
`X-Content-Type-Options`.

App `headers()` in `next.config.mjs:30–39` only sets Apple merchant association
Content-Type. Traefik file provider (`deploy/traefik/pg-compose-stacks.yaml`)
configures HTTPS redirect + gzip; no security-header middleware.

| Verdict | **EXPOSED** — CSP missing on a payments site is the highest-value header gap |

HTTPS redirect itself: present (`pg-redirect-to-https`, staging http router
`:76–83`).

### 4.2 VPS / SSH / firewall

Not probed with SSH from this session (no exploit; no interactive host audit).

| Claim from compose/config | Verdict |
|---------------------------|---------|
| App published as `127.0.0.1:3011→3000` | **SECURE** (loopback bind) `compose.staging.yaml:47–48` |
| Postgres not published to host ports | **SECURE** `compose.staging.yaml:13–29` |
| SSH password auth / key holders / ufw | **UNCLEAR** |
| Traefik dashboard exposure | Not declared in `pg-compose-stacks.yaml`; Coolify-managed proxy → **UNCLEAR** |
| TLS | Let's Encrypt via `certResolver: letsencrypt` on routers | **SECURE** for issuance path; TLS version floor not pinned in this file → **UNCLEAR** |

### 4.3 Backups

| Item | Evidence | Verdict |
|------|----------|---------|
| Script | `deploy/backup-media.sh` — tar media-staging + media; `pg_dump` staging + prod containers | Present |
| Schedule | Staging workflow installs crontab `15 2 * * * .../backup-media.sh` (`.github/workflows/docker-publish-ghcr-staging.yml:151`) | Present |
| Local destination | Default `/home/deploy/prudentgabriel-backups` (`backup-media.sh:7`) — **same host** as media | **EXPOSED** (disk failure / ransomware hits backup + live) |
| Off-box | Optional `BACKUP_RCLONE_REMOTE` + rclone (`backup-media.sh:36–38`) | **UNCLEAR** whether set on VPS |
| Retention | `BACKUP_KEEP` default 14 days (`:9`, `:41–42`) | Documented |
| Restore drill | Scripts exist (`restore-media.sh`, `restore-staging-from-prod.sh`); no coded “restore was tested on DATE” record in repo | **UNCLEAR** |

---

## 5. Dependencies

Command: `pnpm audit --json` (2026-09-21) in `prudential-atelier/`.

| Severity | Count (`metadata.vulnerabilities`) |
|----------|-------------------------------------|
| critical | 6 |
| high | 56 |
| moderate | 55 |
| low | 8 |

Pinned / declared versions of note (`package.json`):

- `next`: **14.2.35**
- `next-auth`: **^5.0.0-beta.31**
- `axios`: **^1.15.2**
- `nodemailer`: **^7.0.13**
- `sharp`: **^0.33.5**

### Critical advisories (reachable assessment)

| Module | Advisory theme | Reachable from running app? | Verdict |
|--------|----------------|------------------------------|---------|
| `next` | Unauthenticated RCE via Image Optimization when AVIF used (GHSA-2xp9-vwfh-vxw4); range includes &lt;15.5.24 | **Yes path exists:** `next.config.mjs:16` enables `image/avif` | **EXPOSED** |
| `next` | Windows-hosted RCE (GHSA-p293-qw3h-jr36) | Runtime image is Linux `node:20-bookworm-slim` (`Dockerfile:8`) | **WEAK** (not Windows; still unpatched line) |
| `next-auth` / `@auth/core` | Fail-open on config errors; email homoglyph `@` bypass (GHSA-8fpg-xm3f-6cx3, GHSA-7rqj-j65f-68wh); beta.31 in range | Credentials + Google providers live (`src/lib/auth.ts`) | **EXPOSED** |
| `form-data` | Unsafe boundary RNG / CRLF | Transitive (axios path in audit actions) | **WEAK** |

### High (selected, with reachability)

| Module | Theme | Reachability |
|--------|-------|--------------|
| `next` | Multiple RSC / Server Actions DoS + SSRF advisories for &lt;15.5.x | App Router is in use → treat as **reachable DoS/SSRF class** until upgrade |
| `axios` | Prototype pollution / proxy / NO_PROXY | Used in codebase; severity depends on attacker-controlled config |
| `nodemailer` | `raw` option SSRF/file read; ReDoS in addressparser | Used for outbound mail; **reachable if** `raw` or attacker-shaped address lists used |
| `sharp` | libvips / libheif CVEs | Image pipeline / HEIC convert path |
| `glob` CLI injection | Dev/tooling path | Likely **not** request-reachable |

Docker base: `node:20-bookworm-slim` (`Dockerfile:8`). Images rebuild on push to
`staging` / `main`, not on a CVE calendar (workflows have no `schedule:` for
rebuild). **WEAK**.

---

## 6. What an insider can do

Nine staff accounts exist in operations; permissions are editable in admin.

### 6.1 Role defaults (`src/lib/roles.ts:51+`)

| Role | Default admin permissions |
|------|---------------------------|
| SUPER_ADMIN | `*` |
| ADMIN | Broad ops including reports, logs, settings — **not** `settings.developer` |
| STAFF_ADMIN | Ops without reports/logs/settings/requisition.fund |
| STAFF | `[]` for `/admin` |

### 6.2 Sensitive data access

| Data | STAFF | STAFF_ADMIN | Citation |
|------|-------|-------------|----------|
| Customer measurements | **Yes** via bespoke/client APIs | Yes | `BESPOKE_STAFF_ROLES` includes STAFF (`bespoke-roles.ts:3–10`); `GET /api/bespoke/[orderId]` includes measurements; `GET /api/clients/[clientId]` |
| Payment / receipt URLs on order JSON | **Yes** on bespoke GET | Yes | same bespoke include |
| Payments admin queue | No | Yes (`payments`) | `requireAdminApi("payments")` |
| Career CVs (application API) | No | No (`requireGeneralAdminApi`) | careers applications routes |
| Career private media by key | No | **Yes** if folder maps to `staff` | `admin-upload-folder.ts` careers → `staff` |
| Finance ledger export | No | No | `requireAdminApi("reports")` |
| Shop orders CSV | No | Yes (`shop.orders`) | `GET /api/admin/orders?format=csv` |

**Verdict:** STAFF can read measurements (and receipt URLs embedded on orders)
without needing `/admin` catalogue permissions → **WEAK** relative to
least-privilege for “tailor only”.

### 6.3 Impersonation

| Control | Evidence | Verdict |
|---------|----------|---------|
| Super Admin only | `assertCanImpersonateTarget` `admin-impersonate.ts:65–67` | **SECURE** |
| Cannot target SUPER_ADMIN | `:68–69` | **SECURE** |
| 30-minute HMAC cookie | `IMPERSONATE_TTL_MS`, sign/parse `:5–45` | **SECURE** |
| Read-only `/api/admin` non-GET | `middleware.ts:63–65` | **SECURE** |
| Blocks server actions + developer settings | `middleware.ts:45–52`, `:57–61` | **SECURE** |
| Activity log on start/stop | `api/admin/impersonate/route.ts` | **SECURE** |

### 6.4 `app.ledger_bypass`

Set inside cascade transactions:
`product-cascade-delete.ts:294`, consultation cascade equivalent.
Migration comment historically said application must never set it; code does, for
loud deletes only. Snapshot written to `activityLog` in the same transaction
(`writeCascadeLog` / consultation equivalent). Loud product delete requires
SUPER_ADMIN + typed confirmation.

| Verdict | **WEAK** (escape hatch exists by design; gated and snapshotted) |

### 6.5 Cascade delete guard rails

Plan loaded before delete; snapshot persisted with activity log inside the
transaction after graph delete (`product-cascade-delete.ts` plan +
`writeCascadeLog`). **SECURE** for “snapshot exists when rows go”; restore of
that snapshot is a manual process, not an automated undo.

---

## 7. If it happens anyway

| Question | Answer | Verdict |
|----------|--------|---------|
| Would you know? | `logActivity` / `logError` write to Postgres (`src/lib/logger.ts`). Impersonation and cascade deletes are logged. | **WEAK** — no alerting pipeline cited in code |
| Retention? | Activity/error: **no coded purge** (stated in `legal-copy.ts` ~230). CronRun: 90 days. | **WEAK** (grows forever; also no forced expiry of evidence) |
| What was taken? | Activity snapshots for cascades; otherwise depends on whether the action hit a logged module. Media access is not fully audited per download. | **WEAK** |
| Restore? | Daily local dumps + media tars; optional rclone. Restore scripts exist. **No recorded restore drill in repo.** | **UNCLEAR** |
| Revoke every session at once? | Per-user `forceSignOutUser` only (`password-reset.ts:33–38`). Rotating `AUTH_SECRET` on the host would invalidate JWTs but is not an app button. | **EXPOSED** |

---

## 8. Gap register

Sorted by what an attacker reaches first.

### Exposed now

| # | Gap | Severity | What it exposes | Files | Est. |
|---|-----|----------|-----------------|-------|------|
| 1 | Missing CSP / HSTS / frame / referrer / permissions headers | High | XSS impact↑, clickjacking, MITM cookie risk on first visit | `next.config.mjs:30–39`; Traefik `pg-compose-stacks.yaml`; staging curl 2026-09-21 | 0.5–1d |
| 2 | Next 14.2.35 + AVIF enabled vs Image Optimization RCE advisory | Critical | Remote code execution class on image pipeline | `package.json` `next`; `next.config.mjs:16`; GHSA-2xp9-vwfh-vxw4 | 1–3d (upgrade/test) |
| 3 | `next-auth` 5 beta.31 critical Auth.js advisories | Critical | Auth fail-open / email homoglyph class | `package.json` `next-auth`; GHSA-8fpg-xm3f-6cx3, GHSA-7rqj-j65f-68wh | 1–2d |
| 4 | Unauthenticated careers / consultations uploads | High | Free private disk fill; malware parking | `api/careers/upload`, `api/consultations/upload` | 0.5d |
| 5 | Invoice/approve/receipt/track **cuid** tokens, no TTL | High | Full invoice+bank / stage approve / tracking if link leaks | `schema.prisma:890,2016,2027,2211` | 1–2d |
| 6 | Admin SSRF via product image `sourceUrl` fetch | High | Internal network / metadata from privileged session | `product-image-migrate.ts:12`; `reupload/route.ts:36–39` | 0.5d |
| 7 | Backups default to same host disk; off-box optional | High | Ransomware / disk loss takes live + backup | `deploy/backup-media.sh:7,36–38` | 0.5d + ops |
| 8 | No global session kill switch | Medium | Cannot clear all JWTs after mass compromise without secret rotate | `password-reset.ts` | 0.5d |

### Weak but not an emergency

| # | Gap | Severity | What it exposes | Files | Est. |
|---|-----|----------|-----------------|-------|------|
| 9 | In-memory rate limits; gaps on newsletter / approve / invoice pay | Medium | Brute / spam / token hammering across instances | `rate-limit.ts`; `newsletter/route.ts` | 1d |
| 10 | STAFF can read measurements + payment receipt URLs | Medium | Insider / stolen staff laptop | `bespoke-roles.ts`; bespoke/client GET | 1d |
| 11 | Shared admin+customer JWT cookie | Medium | Shared PC session reuse | `auth.config.ts`; middleware | design |
| 12 | Custom HTML sanitizer | Medium | CMS XSS if allowlist slips | `sanitize-html.ts` | 0.5d |
| 13 | Receipt guest ticket = easy uploads | Medium | Storage abuse | `upload/receipt/ticket` | 0.5d |
| 14 | `ledger_bypass` used despite migration wording | Low–Med | Financial delete path; mitigated by Super Admin + snapshot | `product-cascade-delete.ts:294` | docs/align |
| 15 | Dependency high pile (axios, sharp, nodemailer, Next DoS) | Medium | Patch lag | `pnpm audit` 2026-09-21 | ongoing |
| 16 | Docker base not rebuilt on a CVE schedule | Medium | Base image CVEs linger | `Dockerfile:8`; workflows | ops |
| 17 | No activity-log purge / retention policy in code | Low | Disk growth; also indefinite PII in logs | `logger.ts`; legal copy | 0.5d |
| 18 | Walk passwords still in scripts/docs | Medium until staging verified clean | Credential reuse | seed-demo, DEMO docs | verify+rotate |

---

## 9. Open questions

Cap 10. Each answerable in one sentence.

1. Is `BACKUP_RCLONE_REMOTE` set and succeeding on the VPS today?
2. Have any of the documented walk/demo passwords still matched a live staging user as of this week?
3. Who holds SSH keys to the staging and production hosts, and is password authentication disabled?
4. Is the Coolify/Traefik dashboard bound to localhost only?
5. What TLS minimum version does the Coolify proxy enforce?
6. Has a full Postgres + media restore been timed successfully in the last 90 days?
7. How many app containers run behind staging (rate-limit Map locality)?
8. Are activity/error logs monitored or alerted anywhere outside the admin UI?
9. Should STAFF retain measurement and receipt-URL visibility, or only assigned-order subsets?
10. Is Cloudinary still holding any production media that must stay reachable, or is MediaStore sole source of truth?

---

## Appendix A — Commands run (no secrets in output)

```text
git branch --show-current
# → staging

git ls-files "*.env*" ".env*"
# → .env.example only

git log -S "AUTH_SECRET=" --oneline -- "*.env*"
# → .env.example placeholder commits only

curl -sS -D - -o NUL https://staging.prudentgabriel.com/
# → 200; X-Powered-By: Next.js; no CSP/HSTS/X-Frame/Referrer/Permissions-Policy

pnpm audit --json
# → metadata: critical 6, high 56, moderate 55, low 8 (2026-09-21)
```

## Appendix B — Already in good shape (do not re-litigate)

- Payment bind to orders (Slice A) — out of scope to re-prove here; not reopened.
- PII DTOs on public track API vs older full dumps (Slice B direction).
- Permission model real (Slice T) with `settings.developer` non-inheriting.
- Credentials in DB encrypted (Slice U); dashboard redaction.
- Private receipts refused on public media URL (Slice X).
- Impersonation read-only with SUPER_ADMIN block and logging.
- Password-reset tokens are 256-bit random with TTL.
- Postgres not published on host network in staging compose.
- App bind on loopback in staging compose.

---

*End of audit. Fixes are a separate slice.*
