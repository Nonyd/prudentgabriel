# Email design system

Prudential Atelier mail is a quiet house letter, not a website in an inbox. One shared shell (`src/emails/components/EmailLayout.tsx`). Three families. No storefront redesign.

## Layout rules

- Tables for structure. No flex, no grid, no `position: absolute`.
- Inline styles on elements. Do not put layout in a body `<style>` block: many clients strip it.
- A small `<style>` in `<Head>` is allowed only for webfonts and dark-mode logo swap. If that block is stripped, the gold wordmark and serif fallback still hold the layout.
- Max width 600px, single column. Nested tables for a line item (image | copy) are fine; never two competing columns of body copy.
- Images always have `alt`. The letter must make sense with images blocked. Do not put the order number, price, or CTA label only in an image.
- No Outlook `VML` background images. No SVG.
- CTAs are bulletproof table buttons (`EmailButton`): a `td` with `bgcolor` plus an `<a>` inside. Do not style a bare `<a>` as the button.
- Palette: choc `#442913`, cream `#F7F2EC`, sand `#E2D1C2`, gold `#C9A84C`. Buttons are choc on cream (`#F7F2EC` type).

## Type

House webfonts: Cormorant Garamond (display), Lora (body), Jost (labels and buttons).

Most inboxes will not load them. Declare the webfont, then a real fallback:

- Cormorant / Lora → Georgia, Times New Roman, Times, serif
- Jost → Helvetica Neue, Helvetica, Arial, sans-serif

Fallback must look intended: letter-spacing on the wordmark, a gold hairline, cream field, one CTA. Do not rely on the webfont for hierarchy.

## Dark mode

Set:

```
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
```

That asks the client not to invert our colours. The header stays choc. The logo on that header is the light (white) mark.

If a client inverts anyway, a white mark on a now-light header vanishes. The shell therefore:

1. Keeps a gold text wordmark (`PRUDENTIAL ATELIER`) under the logo, always. That line does not depend on pixels.
2. Includes a dark-coloured logo variant (`logo_dark`) hidden in light mode, shown under `prefers-color-scheme: dark` and Outlook.com `[data-ogsc]` when the head style survives.

We cannot honestly screenshot every inbox. See the verification note at the end of Slice I.

## Shell and footers

One shell. Footer copy splits:

- **Transactional / relationship:** house address and `hello@`. No unsubscribe. These are about an order or account.
- **Marketing:** the same, plus an unsubscribe link. Outbox replaces `__UNSUBSCRIBE_URL__` per recipient and sets `List-Unsubscribe` / `List-Unsubscribe-Post`. Marketing must not send without that.

H1 (`EmailPreference`, token, suppress at queue) is the only unsubscribe system. Do not add a second one.

## Families

Do not make every template look the same. Family changes padding, page ground, and the header rule. Copy stays specific to the event.

### Transactional

Calm, facts first. Cream page, gold bar under the header, tight padding. Order numbers and money in the body, not in a banner graphic.

| Template key | File / origin |
|---|---|
| `order-confirmation` | `OrderConfirmationEmail.tsx` |
| `order-shipped` | `OrderShippedEmail.tsx` |
| `rtw-delivered` | `RtwOrderDeliveredEmail.tsx` |
| `payment-confirmed` | `email.tsx` wrapHtml |
| `payment-rejected` | `email.tsx` wrapHtml |
| `bank-transfer-receipt` | `email.tsx` wrapHtml |
| `password-reset` | `PasswordResetEmail.tsx` |
| `account-exists` | `AccountExistsEmail.tsx` |
| `invoice` | `InvoiceEmail.tsx` |
| `welcome-credentials` | `WelcomeCredentialsEmail.tsx` |
| `rtw-fulfilment-refused` | `email.tsx` wrapHtml |
| `bespoke-balance-link` | `email.tsx` wrapHtml |
| `job-application-confirmation` | `JobApplicationConfirmationEmail.tsx` |

### Relationship

Warmer house voice. Same choc header, extra gold hairline, more padding. Stage notes, quotations, thanks.

| Template key | File / origin |
|---|---|
| `welcome` | `WelcomeEmail.tsx` |
| `bespoke-confirmation` | `BespokeConfirmationEmail.tsx` |
| `bespoke-delivered` | `BespokeDeliveredEmail.tsx` |
| `receipt-reminder` | `ReceiptReminderEmail.tsx` |
| `quote-sent` | quotations send route |
| `stage-assignment` | `StageAssignmentEmail.tsx` |
| `stage-complete` | `bespoke-email.ts` |
| `stage-approval-request` | `email.tsx` wrapHtml |
| `stage-approval-reminder` | `email.tsx` wrapHtml |
| `stage-changes-requested` | `email.tsx` wrapHtml |
| `product-review-request` | `ReviewRequestEmail.tsx` |
| `consultation-review-request` | `ReviewRequestEmail.tsx` |
| `bespoke-review-request` | `ReviewRequestEmail.tsx` |
| `consultation-pending` | `ConsultationPendingEmail.tsx` |
| `consultation-confirmed` | `ConsultationConfirmedEmail.tsx` |
| `consultation-cancelled` | `ConsultationCancelledEmail.tsx` |
| `consultation-reschedule` | `ConsultationRescheduleEmail.tsx` |
| `consultation-meeting-link` | `ConsultationMeetingLinkEmail.tsx` |
| `consultation-session-summary` | `ConsultationSessionSummaryEmail.tsx` |
| `loyalty-tier-upgrade` | `LoyaltyTierUpgradeEmail.tsx` |
| `referral-success` | `ReferralSuccessEmail.tsx` |
| `referral-reward` | `ReferralRewardEmail.tsx` |
| `job-application-status` | `JobApplicationStatusEmail.tsx` |
| `bespoke-request-status` | admin bespoke route |
| `contact-receipt` | contact route |
| `contact-reply` | admin messages reply |
| `career-application-email` | admin careers |

### Marketing

Image-led, one strong CTA, unsubscribe required. Sand page, cream card.

| Template key | File / origin |
|---|---|
| `collection-campaign` | `CollectionCampaignEmail.tsx` |
| `abandoned-checkout` | `AbandonedCheckoutEmail.tsx` |
| `abandoned-cart` | `email.tsx` wrapHtml (logged-in cart, 24h job) |
| `back-in-stock` | `BackInStockEmail.tsx` |
| `admin-broadcast` | `BrandedHtmlEmail.tsx` |
| `admin-single` | `BrandedHtmlEmail.tsx` |

### Operational (staff / systems)

Same transactional shell when they go through `wrapHtml`. Not customer marketing.

`bank-transfer-admin`, `rtw-fulfilment-refused-admin`, `admin-notification`, `admin-settings-test`, `weekly-report`, `daily-report`, `late-alert`, `event-reminder`, `unsent-quote-alert`, `stock-alert`, `balance-reminder`, `critical-error`, `client-communication`, `team-invite`, `user-invite`, `quote-approved-admin`, `contact-admin`.

Composable CMS templates (`ComposableTemplateEmail`) sit in relationship unless the catalog marks them as a campaign.

## Capture hook

`E2E_CAPTURE_EMAIL=1` still records `{ to, subject, html }` in `src/lib/email-capture.ts` from `queueEmail`, after marketing unsubscribe URLs are written in. Tests assert on that HTML.

## What this file is not

It is not a website style guide. Do not restyle the storefront from this document.

## Slice I verification (local)

Rendered HTML for one of each family (password-reset, review-request, abandoned-checkout) was captured with `E2E_CAPTURE_EMAIL` and previewed in Chromium. Light and emulated dark (`prefers-color-scheme: dark`) were checked: `color-scheme` meta kept the cream/choc field; the gold wordmark stayed visible. Logo pixels were empty in local preview when branding was not primed.

**Not verified:** a real Gmail or Apple Mail inbox. Do not treat the Chromium previews as inbox proof.
