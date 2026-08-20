# Anti-spoof DNS — `prudentgabriel.com` only

Do **not** apply these to `pfacademy.ng` or any other zone.

Publish in **Cloudflare → prudentgabriel.com → DNS**. Keep existing Brevo/Resend
DKIM and the `brevo-code` TXT. Add/replace only what is listed.

## 1. Apex SPF (required)

Add a **second** TXT on `@` (Cloudflare allows multiple TXT). Do not overwrite
`brevo-code:…`.

| Type | Name | Content |
| --- | --- | --- |
| TXT | `@` | `v=spf1 include:spf.brevo.com ~all` |

Notes:

- Resend already has SPF on the `send` subdomain (`include:amazonses.com`). Apex
  SPF covers Brevo From addresses on `@prudentgabriel.com`.
- DKIM from Resend (`resend._domainkey`) still aligns for Resend sends.
- After a week of clean DMARC reports, tighten to `-all` instead of `~all`.

## 2. DMARC — stop impersonation

Replace the current `_dmarc` TXT (`p=none`) with:

| Type | Name | Content |
| --- | --- | --- |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; pct=100; adkim=s; aspf=s; rua=mailto:rua@dmarc.brevo.com; fo=1` |

What this does:

- `p=quarantine` — receivers put **unauthenticated** `@prudentgabriel.com` mail
  in spam (spoofs / clones without your DKIM).
- `adkim=s` / `aspf=s` — **strict** alignment (domain must match exactly).
- Keep Brevo rua for aggregate reports.

After 1–2 weeks of reviewing reports and confirming legitimate mail still
arrives, harden further:

```
v=DMARC1; p=reject; pct=100; adkim=s; aspf=s; rua=mailto:rua@dmarc.brevo.com; fo=1
```

`p=reject` is the strongest anti-impersonation setting. Do not jump to it before
SPF exists and both Resend + Brevo DKIM are verified.

## 3. Leave alone

| Record | Why |
| --- | --- |
| `resend._domainkey` | Resend DKIM |
| `brevo1._domainkey` / `brevo2._domainkey` | Brevo DKIM |
| `send` MX/TXT | Resend sending |
| `mail` → Brevo inbound | Receiving (create mailboxes in Brevo separately) |
| Anything on `pfacademy.ng` | Out of scope |

## 4. Verify after publish

```bash
dig +short TXT prudentgabriel.com
dig +short TXT _dmarc.prudentgabriel.com
```

Use https://mxtoolbox.com/dmarc.aspx and https://www.mail-tester.com with a
message From `noreply@prudentgabriel.com` sent by the app.
