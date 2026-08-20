# Email (outbox, providers, DNS)

Outbound mail is queued in `EmailMessage` and drained by the `email-outbox` cron
job (`* * * * *`). Call sites use `queueEmail` / `sendEmail` — never Resend or
SMTP directly. Immediate delivery is attempted after enqueue so password reset
does not wait for the minute job; if that attempt fails the row stays `QUEUED`
or `FAILED` for the drain.

## Providers

Order is CMS setting `email_provider_order`, default `resend,brevo,smtp`. A
provider is skipped when `isConfigured()` is false.

| Provider | Config |
| --- | --- |
| Resend | `RESEND_API_KEY` or CMS `resend_api_key` |
| Brevo | `BREVO_API_KEY` (or `SIB_API_KEY`) or CMS `brevo_api_key`. If Brevo returns 401 about an unrecognised IP, allowlist the sender IP (and the VPS) under Brevo → Security → Authorised IPs. Domain must also be verified in Brevo. |
| SMTP | `SMTP_PASSWORD` (and optional `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER`) |

With no credentials, messages go `DEAD` with `no provider configured`. That is
expected until keys exist.

Terminal 4xx (bad recipient, unverified domain, rejected content) mark `DEAD`
immediately and **do not fail over**. Retryable errors (timeout, 5xx, 429)
try the next configured provider, then back off: 1m, 5m, 30m, 2h, 12h.

A circuit breaker skips a provider after 3 consecutive failures for 5 minutes,
then allows one probe. Auth failures (bad API key) may fail over but raise an
admin `EMAIL_PROVIDER_AUTH` notification on first occurrence.

## DNS (when you add a second or third sender)

Each provider that sends as `@prudentgabriel.com` needs:

- Domain verification at that provider
- Its own DKIM selector (CNAME)
- An SPF include

SPF has a hard **10 DNS-lookup** limit. Three includes is usually fine; a fourth
or nested includes (Google Workspace + three ESPs) can exceed it. Over-limit SPF
fails quietly and looks like a spam problem, not a bounce.

Example (adjust selectors to what each dashboard shows):

```
prudentgabriel.com.  TXT  "v=spf1 include:_spf.google.com include:amazonses.com include:spf.resend.com ~all"
resend._domainkey    CNAME  …
smtp._domainkey      CNAME  …
```

Failover changes transport, not inbox placement. Reputation and content still
decide spam.

## Admin

`/admin/system/emails` lists the outbox. Resend creates a **new** row with a
fresh idempotency key. The DEAD badge is the number of messages a client did
not receive.

Idempotency keys are derived from the event, not the clock, e.g.
`stage-complete:<orderRef>:<stage>`, `quote-sent:<quotationId>:v<n>`,
`password-reset:<tokenHash>`.
