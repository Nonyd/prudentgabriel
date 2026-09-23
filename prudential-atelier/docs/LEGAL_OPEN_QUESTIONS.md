# Legal open questions

The questions the legal pages cannot answer on their own. Each one needs a
decision from Mrs. Prudent (or the house's lawyer), not a number chosen in code.
The live wording is in `src/lib/legal-copy.ts`, republished to the CMS by
bumping a page's revision.

Last reviewed: 23 September 2026 (Slice BA, and the chat follow-up).

## Open

### 1. How long invoices and the payment ledger are kept

The privacy policy says financial records are kept "for the statutory period
Nigerian companies must keep them" (Privacy → How long we keep it) without
naming it. Name the period, and whether the ledger (append-only by design) is
ever purged after it.

### 2. How long personal records are kept

Nothing below is deleted on a timer today; the policy says each stays "until
you ask us to delete them and the law lets us, or until the house deletes the
record by hand". Decide a period, or confirm "on request" is the policy, for:

- measurements (client profile, and frozen on order lines);
- bank-transfer receipts;
- CVs and careers applications;
- stage photographs and workroom notes;
- consultation enquiries, including declined ones and their recorded reason (BA2);
- moodboard and inspiration uploads (enquiries and consultations).

Error and activity logs have the same gap (SECURITY_AUDIT item 17).

### 3. A named DPO and the NDPC registration number

The privacy policy names the house as data controller but no Data Protection
Officer and no registration with the Nigeria Data Protection Commission. Name
the DPO (and how to reach them) and give the registration number, or confirm
the house's position on whether it must register.

### 4. The NDPA child age

The policy says the site sells children's clothing to the adult who pays and
"does not knowingly keep an account for a child", without saying what age a
child is under the NDPA. Confirm the age to state, and whether anything more
than that sentence is needed (for example, children's measurements on an
adult's account).

### 5. The uncollected-piece rule

The shipping policy says a reminder goes after
`shipping_uncollected_days` days and "the software reminds. It does not throw
the piece away." It says nothing about what the house will do with a piece that
is never collected (storage charges, a final date, disposal). Decide the rule.

### 6. The consultation change-of-mind notice

A client may cancel a confirmed consultation from her account at least 48 hours
before (`/api/account/consultations/[id]`), but the fee is non-refundable (BA2)
and no email or refund follows. State the notice period and what happens to the
fee and the date if she cancels or asks to move it. The BA2 booking terms also
promise a refund "if the house has to cancel and cannot offer you another date";
Mrs. Prudent should agree that sentence explicitly.

### 7. The legal basis for the transfer to Germany

The site and database run on Contabo GmbH servers in Germany (answered below),
so all personal data leaves Nigeria. The policy now says so but gives no legal
basis for the transfer under the NDPA. The same question applies to the
processors already named as outside Nigeria (Stripe, Resend, Brevo, DHL's rate
API, older images on Cloudinary). Keep Contabo's Data Processing Agreement on
file (Nony).

### 8. The Terms page's Consultations paragraph (for the lawyer)

Terms → Consultations still reads: "A consultation is booked and paid through
the site. The fee, duration and whether it is virtual or in the atelier are as
shown on the offering you chose." Since BA2 a consultation starts with an
enquiry; only an approved enquiry receives a booking link; the client proposes
three dates, acknowledges non-refundable terms and pays; the house confirms one
date. The fees are the four consultation fee settings (BA3). **Not edited** —
the Terms page carries the lawyer's revision (ar-5). Flagged for the lawyer to
redraft.

## Answered

| Question | Answer | When |
|---|---|---|
| Hosting | Contabo GmbH, Germany: application and database. The privacy policy says so for all data. | 23 Sep 2026 |
| Analytics and advertising | None. No analytics or advertising tracker, and none will be added; campaign tags stay in sessionStorage for the visit only. | Decided earlier; stands |
| The cookie question | Essential only. One acknowledgement banner (no accept/reject), which names exactly what is stored; version 2.1 added the chat cookie. | Slice AR/AV; BA5 |
| Chat retention | Kept indefinitely, by decision; erased on request (SUPER_ADMIN, logged). The retention job stays for a period set later. | 23 Sep 2026 |
| Who answers chat | Any admin: the same desk as contact messages. | 23 Sep 2026 |
