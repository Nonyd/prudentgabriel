# Email (outbox, providers, DNS)

Outbound mail is queued in `EmailMessage` and drained by the `email-outbox` cron
job (`* * * * *`). Call sites use `queueEmail` / `sendEmail` — never Resend,
Brevo, or SMTP directly. Immediate delivery is attempted after enqueue so
password reset does not wait for the minute job; if that attempt fails the row
stays `QUEUED` or `FAILED` for the drain.

## Providers

Order is CMS setting `email_provider_order`, default `resend,brevo,smtp`. A
provider is skipped when `isConfigured()` is false.

| Provider | Config |
| --- | --- |
| Resend | `RESEND_API_KEY` or CMS `resend_api_key` |
| Brevo | `BREVO_API_KEY` (or `SIB_API_KEY`) or CMS `brevo_api_key`. Allowlist sender IPs under Brevo → Security → Authorised IPs (local + VPS). Domain **and** sender address must be verified in Brevo. |
| SMTP | `SMTP_PASSWORD` (and optional `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER`) |

**Do not** put Brevo’s SMTP relay credentials into `SMTP_*`. That would make two
chain entries point at the same Brevo account: the circuit breaker would think
it has a second fallback when it does not, and a Brevo quota/outage would take
out both. Leave SMTP empty unless you have a **different** MTA (e.g. Contabo
mail or Namecheap/cPanel). Unconfigured SMTP is skipped; the live chain is
Resend → Brevo.

### Failover (automatic)

Order default: `resend,brevo,smtp` (CMS `email_provider_order`).

1. Try **Resend**. If it fails with retryable/auth errors (including free-tier
   rate limit / quota), try the next provider.
2. Try **Brevo** the same way (its own quota → fail over, not `DEAD`).
3. Try **SMTP** only if host credentials are configured (env or admin Email
   settings: `smtp_host`, `smtp_port`, `smtp_username`, `smtp_password`).

Terminal errors (bad recipient, etc.) still mark `DEAD` and do **not** fail
over — that would spam other ESPs with the same bad address.

Admin UI: **Admin → Settings → Email & SMS**. SMTP fields are already there;
fill password (and host/user if not using env defaults) to enable the third
fallback. Prefer env keys on the VPS for API secrets; CMS password fields work
as a backup when env is empty.

With no credentials, messages go `DEAD` with `no provider configured`. That is
expected until keys exist.

### Error / failover rules

| Kind | Behaviour |
| --- | --- |
| `terminal` (bad recipient, rejected content, unverified Brevo sender) | Mark `DEAD` immediately. **No failover.** Unverified-sender also raises an admin `EMAIL_PROVIDER_AUTH` config alert. |
| `auth` (401/403) | Fail over to the next provider. Raise `EMAIL_PROVIDER_AUTH` on first occurrence per process. |
| `retryable` (5xx, 429, network, Brevo `402` / `not_enough_credits`) | Try the next provider, then back off: 1m, 5m, 30m, 2h, 12h. Brevo quota exhaustion must **not** mark `DEAD` — another ESP can send, and the quota resets. Failures still feed the circuit breaker so Brevo is not hammered. |

A circuit breaker skips a provider after 3 consecutive failures for 5 minutes.

Attachments are stored as JSON on `EmailMessage` (`filename`/`name`, base64
`content`) and passed through to Resend, Brevo, and SMTP. Quote send today uses
a PDF **link** in HTML rather than an attachment; when a PDF is queued as an
attachment, the same base64 bytes are what Brevo receives.

## From / Reply-To

| Setting | Default | Role |
| --- | --- | --- |
| `email_from_name` | `Prudential Atelier` | Display name clients see |
| `email_from_address` | `noreply@prudentgabriel.com` | Envelope / From (must be verified on **both** Resend and Brevo) |
| `email_reply_to` | `hello@prudentgabriel.com` | Human inbox for replies (contact form still uses hello@ as recipient) |

Do not use `hello@` as the From if it is also the public contact address — keep
transactional From on `noreply@` and Reply-To on `hello@`.

## DNS (Cloudflare) — current for `prudentgabriel.com`

| Record | Type | Value / notes |
| --- | --- | --- |
| `@` | TXT | `brevo-code:3fd38860523365d02da40fefe91d5079` (Brevo domain ownership) |
| `brevo1._domainkey` | CNAME | `b1.prudentgabriel-com.dkim.brevo.com` |
| `brevo2._domainkey` | CNAME | `b2.prudentgabriel-com.dkim.brevo.com` |
| `resend._domainkey` | TXT | Resend DKIM (`p=MIGf…`) — verified |
| `send` | MX / TXT | Resend sending (Amazon SES feedback + SPF `include:amazonses.com`) |
| `_dmarc` | TXT | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` |

**Root SPF:** as of Slice F there is **no** apex `v=spf1` TXT — only the Brevo ownership code. Resend authenticates via the `send` subdomain. For Brevo From addresses on the apex (`noreply@…`), publish:

```
prudentgabriel.com.  TXT  "v=spf1 include:spf.brevo.com ~all"
```

(or merge with any future Google Workspace include). Keep the lookup count under 10.

### Inbound mailboxes (PFA-style — Brevo, not Contabo)

PFA (`pfacademy.ng`) uses Cloudflare DNS + Brevo auth + `MX → mail.…`. Atelier matches that for `prudentgabriel.com` (`mail` → `*.brand.brevosend.com`). Contabo VPS mail is **not** used.

To stop `550 mailbox does not exist` on `hello@` / `admin@`:

1. Brevo → Security → Authorised IPs: allowlist VPS `5.189.168.55` and your PC IP (API is blocked until this is done).
2. Brevo → Senders: verify `noreply@prudentgabriel.com` and `hello@prudentgabriel.com`.
3. Brevo inbound / domain mail for the branded `mail` host: create inbox or forwarder for `hello@` (and optionally `admin@`) — or forward both to a Gmail you read.
4. Resend → Suppressions: remove bounce entries for those addresses after mailboxes exist (staging go-live already cleared them once).
5. Do **not** change `pfacademy.ng` DNS or `/opt/pfa` when fixing atelier mail.

Current DMARC is `p=none`. Unaligned Brevo mail can still deliver today. Moving DMARC to `quarantine` / `reject` **without** Brevo’s DKIM (already published) and a coherent SPF would send every failover email to spam exactly when Resend is already down.

## Anti-impersonation / anti-clone

Spoofers can put `From: Prudential Atelier <hello@prudentgabriel.com>` in any
client. Only **DNS authentication** makes Gmail/Outlook reject or quarantine
that mail.

| Control | Status | Action |
| --- | --- | --- |
| DKIM (Resend + Brevo) | Published | Keep; never delete selectors |
| Apex SPF | **Missing** | Add TXT per `deploy/dns-email-anti-spoof.md` |
| DMARC | `p=none` (monitor only) | Move to `p=quarantine` then `p=reject` |
| App From lock | Enforced | Outbox only sends as `@prudentgabriel.com` (`sanitizeFromAddress`) |
| Contact form | Rate-limited | 5 POSTs / 15 min / IP |

Exact Cloudflare rows (this zone only): see
[`deploy/dns-email-anti-spoof.md`](../../deploy/dns-email-anti-spoof.md).

App-side: `EMAIL_ALLOWED_FROM_DOMAINS` (default `prudentgabriel.com`) rejects
From addresses on Gmail or lookalike hosts such as `prudentgabriel.com.evil.com`.

## Admin

`/admin/system/emails` lists the outbox. The **Resend** button creates a **new**
row with a fresh idempotency key (`resend:<id>:<uuid>`). `DEAD` rows are never
auto-retried.

Idempotency keys are derived from the event, not the clock, e.g.
`stage-complete:<orderRef>:<stage>`, `quote-sent:<quotationId>:v<n>`,
`password-reset:<tokenHash>`.
