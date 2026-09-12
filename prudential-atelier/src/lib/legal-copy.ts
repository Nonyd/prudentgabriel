/** Canonical legal drafts. CMS can amend without a deploy. Bump LEGAL_COPY_REVISION to republish. */

export const LEGAL_COPY_REVISION = "ar-5";
export const DEFAULT_LEGAL_UPDATED = "12 September 2026";

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inlineMd(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

/** Converts the house markdown-style legal text to HTML for TipTap / legal pages. */
export function legalMdToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").trim().split("\n");
  const parts: string[] = [];
  let i = 0;

  const flushList = (kind: "ul" | "ol", items: string[]) => {
    if (!items.length) return;
    const tag = kind;
    parts.push(`<${tag}>${items.map((item) => `<li>${inlineMd(item)}</li>`).join("")}</${tag}>`);
  };

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      const text = trimmed.slice(3).trim();
      const id = slugifyHeading(text);
      parts.push(`<h2 id="${id}">${escapeHtml(text)}</h2>`);
      i += 1;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      const text = trimmed.slice(4).trim();
      const id = slugifyHeading(text);
      parts.push(`<h3 id="${id}">${escapeHtml(text)}</h3>`);
      i += 1;
      continue;
    }

    if (trimmed.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("- ")) {
        items.push(lines[i]!.trim().replace(/^- /, ""));
        i += 1;
      }
      flushList("ul", items);
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i]!.trim())) {
        items.push(lines[i]!.trim().replace(/^\d+\.\s/, ""));
        i += 1;
      }
      flushList("ol", items);
      continue;
    }

    const para: string[] = [trimmed];
    i += 1;
    while (i < lines.length) {
      const next = lines[i]!.trim();
      if (!next || next.startsWith("## ") || next.startsWith("### ") || next.startsWith("- ") || /^\d+\.\s/.test(next)) {
        break;
      }
      para.push(next);
      i += 1;
    }
    parts.push(`<p>${inlineMd(para.join(" "))}</p>`);
  }

  return parts.join("\n");
}

export type LegalTocItem = { id: string; text: string };

export function extractLegalToc(html: string): LegalTocItem[] {
  const items: LegalTocItem[] = [];
  const re = /<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const attrs = m[1] ?? "";
    const text = (m[2] ?? "")
      .replace(/<[^>]+>/g, "")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .trim();
    if (!text) continue;
    const idMatch = /\bid\s*=\s*"([^"]+)"/i.exec(attrs);
    items.push({ id: idMatch?.[1] || slugifyHeading(text), text });
  }
  return items;
}

export const PRIVACY_POLICY_MD = `## Who we are

Prudential Atelier is the trading name of the fashion house of Prudent Gabriel-Okopi. The house is in Lagos, Nigeria. We decide why personal data is collected on this website and how it is used. In the language of the Nigeria Data Protection Act 2023 (NDPA), we are the data controller.

{{#contact_address}}Write to us at:

{{contact_address}}{{/contact_address}}

{{#contact_email}}Email: [{{contact_email}}](mailto:{{contact_email}}){{/contact_email}}

{{#contact_phone}}Telephone: {{contact_phone}}{{/contact_phone}}

The NDPA 2023 is the law that governs our processing. The Federal Competition and Consumer Protection Act 2018 (FCCPA) governs how we sell to you. If you live outside Nigeria, your local law may give you extra rights. Write to us and we will treat the request seriously.

## What we collect, and why

We collect only what the work needs. Here it is grouped by that need.

**To make the garment.** Your name, the measurements you type (bust, waist, hip, and any other fields the piece asks for), the size you pick from the house chart, colour, and any notes or reference pictures from a consultation. On a commission we also keep the occasion, the brief, moodboard pictures, and the photographs and notes the workroom takes at each stage.

**To take payment.** The amount, currency, the payment method you chose, and a reference from the gateway. We do not store your full card number. If you pay by bank transfer you upload a screenshot of your banking app. If you ask us to remember a card, the gateway gives us a token, the last four digits, the brand and the expiry. Not the pan.

**To deliver it.** Your delivery name, phone, street, city, state, country and postcode. If you collect, a collection code. If you mark the order as a gift, the gift message sits on the order so the workroom can pack it. If the rate has to be agreed after the order, the wording you consented to and how you asked us to reach you.

**To email you.** Your email address. Order mail, invoice mail, stage updates, and (only if you asked) collection notes and marketing. You can unsubscribe from marketing. Transactional mail about a live order still has to be sent.

**To run your account.** Login email, a hashed password, and, if you sign in with Google, the name, email and picture Google sends us. Your Prudent Points balance and the history of those points. A date of birth if you add one, used once a year to award birthday points. Style preferences if you fill in a profile.

**When you apply for work.** Name, email, phone, cover letter, CV, portfolio, and, for industrial-training applications, school letter, student ID, supervisor contacts and course details.

**When you write to us.** The contact form stores your name, email, phone if given, the message, and the IP address it arrived from.

**When you leave a review.** Rating, words, and any picture you attach. It is not public until the house approves it.

We also keep technical records the site needs to work: the cart in your browser (which can include measurements you typed), your currency choice, a session cookie when you are logged in, and, for the house, activity logs and error logs.

## Body measurements

If you choose made to measure, you type your measurements. The fields depend on the piece. Typical ones are bust, waist, hip, shoulder, sleeve, dress length, thigh, inseam, neck and armhole. You can type in centimetres or inches. The system stores a centimetre copy for the workroom.

Those numbers live in three places:

- On your client profile, so the next piece can be cut without asking again.
- Frozen onto the bag line and then onto the order line, so the workroom cuts what you ordered even if you later change the profile.
- In your browser bag, if you are not logged in, until you pay or clear it.

They are used to cut your garment. They are not used for marketing, not shown on the public site, and not printed on a product page. Public order summaries say "Made to your measurements" without the numbers.

Who can see them: you, in your account (including a PDF of your profile measurements); staff assigned to the commission; and house roles that manage clients and the workroom (atelier staff and managers, not the whole company). A Super Admin who is viewing the site as you can see what you would see. That visit is logged against both identities.

We do not encrypt the numbers in a separate vault. They sit in the database with the rest of the order, on a server the house controls, and travel over HTTPS. There is no automatic deletion date in the system. They stay with the order and the profile until you ask us to remove them and the law lets us, or until the house deletes the record by hand.

## Bank transfer receipts

If you pay by transfer you upload a picture of your banking app. That picture often shows your account name, account number, and sometimes a balance. Treat it as a bank document, not a fashion photo.

The file is stored as private media on the house's own disk, in a receipts folder. The public website will not serve it. Staff who handle payments (finance and the admins who confirm transfers) can open it in the admin. When we email a copy around inside the house, the link is signed and dies after {{receipt_link_days}} days. The file itself is not deleted on a timer. There is no coded retention period.

Do not upload a receipt to a public gallery or a product image field. The careers and consultation folders are also private. Product and lookbook images are not.

## Careers applications

A CV, portfolio, school letter or student ID is stored as private media. Only general admins can open applications. Applicants cannot download the file again from the site after they submit. There is no automatic deletion after the role is filled. If you want a file removed, write to us.

## Commission notes and photographs

Consultation notes, moodboards, sketches and stage photographs of a commission are part of making the piece. The workroom and atelier managers see them. When we ask you to approve a stage (design approval, and the final fitting), the public approval link shows the notes and pictures for that stage, not your address or measurements. Meeting links for Zoom or Google Meet are stored on the booking and emailed to you. The call itself happens on that company's system.

## Prudent Points

We keep your points balance and a ledger of every credit and debit: what it was for, how many points, the naira rate locked on a redemption, and when unspent credit will lapse ({{#points_expiry_months}}{{points_expiry_months}} months from the credit{{/points_expiry_months}}). You can see your own wallet. Admin can see it when they look at your client file. Changing the naira-per-point rate revalues every outstanding balance. Past redemptions stay at the rate locked on that order.

## Who else receives your data

We do not sell your information. These companies receive what they need to do their job.

**Paystack, Flutterwave, Stripe and Monnify.** Email, amount, currency, and a payment reference, so they can take the card or transfer. Saved-card tokens stay with them. Paystack and Monnify are Nigerian companies. Stripe is American. Flutterwave operates from Nigeria and abroad. Card data they process leaves our servers and sits on theirs.

**Resend, Brevo, or the SMTP host we have configured.** The To address, subject and the email body (which can include your name, order number, tracking link, and, for a welcome mail, a temporary password). Resend is American. Brevo is European. Mail about your order has to leave Nigeria to be delivered.

**DHL and GIG.** For an automatic rate we send destination city, country, postcode if we have it, package weight and size, and a declared value. We do not send your name on that quote call. When the house actually books the parcel, your name, phone and address go to the carrier so they can deliver. DHL's rate API is outside Nigeria. GIG is Nigerian.

**Google.** If you sign in with Google, Google knows you use this site and sends us your Google name, email and picture. If a consultation uses Google Meet, Google hosts the call.

**Zoom.** If the consultation meeting link is a Zoom URL, Zoom hosts the call. We store the link.

**Open Exchange Rates.** We fetch naira and pound rates so the site can show dollar and sterling prices. That call does not include your name or email.

**WhatsApp.** If you tap a WhatsApp link, the conversation is on Meta's system. We do not send your message through a WhatsApp business API from this website.

Pictures you upload for a consultation or a receipt are stored on the house's own disk, not on Cloudinary, for new uploads. Older images may still live on Cloudinary (a US company) until they are migrated.

The customer database is PostgreSQL. The application runs on the house's server. Both are reached over encrypted connections. Exact hosting regions can change; assume the application is in the house's control and that mail and payments leave Nigeria.

## How long we keep it

The code does not delete personal data on a calendar, except as follows.

- {{#points_expiry_months}}Prudent Points credits lapse after {{points_expiry_months}} months. Lapsed points are a ledger event, not a wipe of your account.{{/points_expiry_months}}
- {{#receipt_link_days}}A signed receipt link in an email dies after {{receipt_link_days}} days. The receipt file remains.{{/receipt_link_days}}
- {{#impersonation_minutes}}An impersonation cookie lasts {{impersonation_minutes}} minutes.{{/impersonation_minutes}}
- Password-reset tokens are deleted when used.
- Closing your account from the account page is a soft delete: we rename the login, clear the password, phone and picture, and end sessions. Orders, payments, measurements and commissions are not erased by that button, because the workroom and the money records still need them.

Financial records (orders, invoices, the payment ledger, gateway references) are kept for the statutory period Nigerian companies must keep them.

Measurements, receipts, CVs, consultation notes and stage photographs stay until you ask us to delete them and the law lets us, or until the house deletes the record by hand.

Server error logs and activity logs (including impersonation) are kept until an admin clears or the house decides otherwise. There is no coded purge.

## Guest accounts

You can check out as a guest. When payment succeeds on a shop order, a consultation, or a commission (including paying an invoice that belongs to a commission), the house opens an account for that email if one does not already exist. You receive a welcome email with a temporary password. That is the same account you would have created yourself. You should change the password on first login.

If you already have an account, the order is attached to it. Older guest payments stay filed under the email they were made with. They still show in your payment history.

## Cookies and the browser

See the [Cookie Policy](/cookie-policy). The short version: a session cookie keeps you logged in. The bag, currency, wishlist, theme and recent searches live in your browser's local storage, not as cookies. The banner lets you refuse non-essential cookies. We do not currently load analytics or advertising pixels, even if you press Accept All.

## Security

Passwords are hashed (bcrypt). Payment gateway keys in settings are encrypted at rest. Traffic to the site is HTTPS. Private media (receipts, CVs, consultation uploads) is refused on the public media URL. Super Admin impersonation is time-limited and logged. No website is perfectly secure.

## Your rights under the NDPA

You may ask to:

- see the personal data we hold
- correct it
- erase it, where the law allows
- restrict or object to some processing
- receive a copy in a usable form
- withdraw consent for marketing

You can correct much of this yourself in your account (name, phone, addresses, measurements, style profile). You can close the login as described above. For erasure of orders, receipts, CVs or measurements, write to us. We will say if a legal duty to keep financial records blocks a full wipe.

If we cannot resolve it, you may complain to the Nigeria Data Protection Commission.

## How to write to us

This address is read.

{{#contact_address}}{{contact_address}}{{/contact_address}}

{{#contact_email}}[{{contact_email}}](mailto:{{contact_email}}){{/contact_email}}

Put "Privacy" in the subject. Name the email you used, and what you want us to do.

## Children

This site sells adult and children's clothing to the adult who pays. It is not aimed at children placing their own orders. We do not knowingly keep an account for a child. If you believe we have a child's data, write to us.

## Changes

When this policy changes, the date at the bottom changes. Material changes will be reflected here. The live wording is the CMS text on this page.`;

export const TERMS_MD = `## Agreement

By using prudentgabriel.com, placing an order, booking a consultation, or paying an invoice, you agree to these terms. The four house terms printed on your quotation and invoice are part of the agreement. This page must not contradict them.

## The house

Prudential Atelier is the fashion house of Prudent Gabriel-Okopi, Lagos, Nigeria. We make ready-to-wear, made-to-measure pieces from the shop, atelier commissions, bridal, and children's clothes.

These terms are governed by the laws of the Federal Republic of Nigeria, including the Federal Competition and Consumer Protection Act 2018.

## Made to order

Nothing is held in stock. Every piece is cut when you order it. A size on the product page is a size we will make, not a garment hanging on a rail.

## Production time

{{#production_time}}Ready-to-wear is made in {{production_time}}, then shipped. Shipping time is separate and additional. A product can carry its own lead time; if it does, that figure is the one that applies to that piece.{{/production_time}}

{{#custom_lead_time_days}}A made-to-measure shop piece follows a house lead time of {{custom_lead_time_days}} days unless the product shows its own.{{/custom_lead_time_days}}

## The four house terms

These are the terms already agreed and printed on the quotation and the invoice. They apply to commissions and, where they speak to delivery, changes, shipping and refunds, they are the house's position on shop orders too.

{{#house_term_delivery}}**Delivery.** {{house_term_delivery}}{{/house_term_delivery}}

{{#house_term_changes}}**Changes.** {{house_term_changes}}{{/house_term_changes}}

{{#house_term_shipping}}**Shipping.** {{house_term_shipping}}{{/house_term_shipping}}

{{#house_term_refunds}}**Refunds.** {{house_term_refunds}}{{/house_term_refunds}}

## Standard size and made to measure

**Standard size**

Cut to the house chart in your size. Returnable because another woman can wear a standard size.

**Made to measure**

Cut to the measurements you entered. It cannot be returned for a change of mind, because a piece made to your body cannot be worn by someone else.

A cash refund of what you paid is still only given where the house failed, as the refunds term says. A standard-size return for a change of mind is an exchange or a credit to your account, not cash, unless the house failed.

## Fabric

{{#fabric_promise_hours}}If the fabric for your piece is unavailable, we will offer an alternative or a refund within {{fabric_promise_hours}} hours.{{/fabric_promise_hours}}

## Price and currency

Prices are set in Nigerian naira. Dollar and sterling figures are conversions at a rate locked when you check out (from the house's rate settings, or from Open Exchange Rates, or a fallback the software keeps). The naira amount on the order is the amount that matters. International card charges from your bank are yours.

VAT appears only when an invoice turns it on. Shop prices are as shown.

## Payment

We accept Paystack, Flutterwave, Stripe, Monnify, and bank transfer to the house accounts shown at checkout. A transfer is not paid until the house confirms the receipt.

{{#currencies_offered}}Bank transfer is offered in {{currencies_offered}} for the accounts the house currently publishes.{{/currencies_offered}}

An atelier commission needs the deposit agreed on that quotation before production starts. The percentage is set on the quotation itself, and is stated there. It is not a single house-wide figure on this page. Production does not start until that deposit is recorded. The balance must be clear before delivery.

{{#invoice_validity_days}}A quotation or invoice is valid for {{invoice_validity_days}} days unless the document itself states another date.{{/invoice_validity_days}}

Paying a shop order, a consultation, or a commission invoice without an account creates one. You will receive a welcome email. See the [Privacy Policy](/privacy-policy).

## Shipping

See the [Shipping Policy](/shipping-policy). International orders are delivered DDU: duties and taxes on arrival are payable by the recipient. Carrier charges may be quoted after the order, once the piece is packed, and are paid before dispatch, as the shipping house term says.

{{#shipping_ddu}}{{shipping_ddu}}{{/shipping_ddu}}

## Prudent Points

{{#points_per_ten}}Earn {{points_per_ten}} points for every ₦{{points_spend_unit}} you spend in cash (the part not paid with points).{{/points_per_ten}} {{#points_rate}}Every point is worth ₦{{points_rate}} towards a future piece at the current rate.{{/points_rate}} {{#points_referral}}Introduce a friend and receive {{points_referral}} points once she makes her first purchase.{{/points_referral}} Completing a style profile, a review, or a newsletter signup may add further points as the programme then stands. Birthday points are awarded if you have given a date of birth.

{{#points_expiry_months}}Points are valid for {{points_expiry_months}} months from the credit.{{/points_expiry_months}} {{#points_min_redemption}}The minimum redemption is {{points_min_redemption}} points.{{/points_min_redemption}}

The house may change the naira-per-point rate. Changing the rate revalues every outstanding balance at the new rate. Points already spent on an order keep the rate locked on that order. We will not rewrite that history.

A piece paid with points is not returned for cash. If the house accepts a return or cancels the order, the points go back to your balance. They are not paid out as money.

Points cannot be used for shipping.

## Atelier commissions

A commission follows thirteen stages:

1. Consultation booking
2. Consultation session
3. Invoice issuance
4. Consultation fee (the sitting fee; the commission deposit is billed on the invoice)
5. Sketching and concept
6. Fabric sourcing
7. Design approval
8. Tailoring
9. First fitting
10. Alterations
11. Beading and finishing
12. Final fitting
13. Delivery or collection

Production (sketching onward) does not start until the deposit on that commission is recorded. You must approve the design, and the final fitting, before those stages can close. The balance must be paid before delivery.

{{#alteration_warranty_days}}After you confirm receipt, an alteration window of {{alteration_warranty_days}} days opens. Inside that window, fit and workmanship are complimentary unless the house records a reason to charge. A change you request, or damage, is chargeable. Complimentary work is still an alteration of the agreed piece, not a new commission.{{/alteration_warranty_days}}

## Consultations

A consultation is booked and paid through the site. The fee, duration and whether it is virtual or in the atelier are as shown on the offering you chose. Meeting links are sent by email. The refunds house term applies: a refund only where the house fails and cannot offer a reasonable solution, not because you changed your mind after the sitting was reserved.

## Intellectual property

Sketches, patterns, photographs, text and marks on this site belong to the house. You may not copy them to make garments elsewhere. Photographs of your own commission in your client area are for you; they are not a licence to reproduce the design commercially.

## If something goes wrong

To the extent Nigerian law allows, the house is not liable for indirect loss (for example a missed event after a delay you were told about, or a duty you did not budget for). Nothing here limits liability for death, personal injury, or fraud, or any duty the FCCPA does not allow us to exclude.

## Disputes

{{#contact_email}}Write first to [{{contact_email}}](mailto:{{contact_email}}).{{/contact_email}} If we cannot settle it, the courts of Lagos State, Nigeria have jurisdiction.

## Contact

{{#contact_email}}[{{contact_email}}](mailto:{{contact_email}}){{/contact_email}}`;

export const COOKIE_MD = `## What this page covers

This is the list of what the site actually sets, not a generic cookie brochure. It matches the banner you see: Accept All, Reject Non-Essential, and Cookie Settings.

## Strictly necessary

These are needed for the site to work. The banner cannot turn them off.

- **Signed-in session.** When you log in, Auth.js sets a session cookie (the name is the Auth.js default, typically \`authjs.session-token\`, or a secure variant on HTTPS). It holds a login token, not your password. It is required to stay logged in.
- {{#impersonation_minutes}}**Admin only.** If a Super Admin views the site as you, a cookie named \`pg_admin_impersonate\` lasts {{impersonation_minutes}} minutes. A role-preview cookie named \`pg_admin_preview_role\` lasts one hour. Ordinary customers never receive these.{{/impersonation_minutes}}

## What "non-essential" means here

The banner's Reject Non-Essential button records that you refused functional, analytics and marketing cookies. Cookie Settings lets you toggle those three groups. Strictly necessary stays on.

**Functional**, as the banner describes it, means remembering preferences.

**Analytics**, as the banner describes it, means helping us improve the site.

**Marketing**, as the banner describes it, means personalised content.

## What we store in your browser (not cookies)

These live in local storage. The software writes them whether or not you pressed Reject Non-Essential. That is how the bag and the currency picker work today.

- \`pa-cart\`: your bag, including any measurements you typed for a made-to-measure line
- \`pa-currency\`: naira, dollar or sterling, and a cached rate
- \`pa-wishlist\`: pieces you saved
- \`pa-recently-viewed\`: recent products
- \`pa-recent-searches\`: recent search words
- \`pg-theme\`: light or dark
- \`pg_cookie_consent\`: the choice you made on this banner (version 1.0)

Admin screens may also remember whether the sidebar is collapsed.

## Analytics and marketing

The banner offers analytics and marketing choices. The site does not currently load Google Analytics, advertising pixels, or any other marketing tracker when you press Accept All. Your choice is stored so that if those tools are added later, the banner already knows. Until then, Reject Non-Essential does not change any tracking, because there is none to refuse.

## How to change your choice

Open Cookie Settings from the banner, or from the Cookie Settings control in the footer. Clearing your browser storage forgets the bag, the currency and the consent itself. The banner will ask again if we change the consent version.

## Contact

{{#contact_email}}[{{contact_email}}](mailto:{{contact_email}}){{/contact_email}}`;

export const RETURNS_MD = `## How returns work in this house

Every piece is cut when you order it. What you can send back depends on whether it was cut to a house size or to your body, and on whether the house met the agreement. This page, the [Terms](/terms-and-conditions), the four terms on your invoice, and the words on the product page are meant to say the same thing.

## Standard size

Cut to the house chart in your size. Returnable because another woman can wear a standard size.

{{#contact_email}}Write to [{{contact_email}}](mailto:{{contact_email}}) with the order number.{{/contact_email}} The piece should be unworn, unwashed, unaltered, with tags. A change-of-mind return of a standard size is an exchange or a credit to your account. A cash refund of the payment is only given where the house failed, as the invoice says.

## Made to measure

Cut to the measurements you entered. It cannot be returned for a change of mind, because a piece made to your body cannot be worn by someone else.

That includes shop made-to-measure and atelier commissions. Another woman cannot wear a piece cut to your bust, waist and hip.

## Fabric

{{#fabric_promise_hours}}If the fabric for your piece is unavailable, we will offer an alternative or a refund within {{fabric_promise_hours}} hours.{{/fabric_promise_hours}}

## When the house fails

{{#house_term_refunds}}{{house_term_refunds}}{{/house_term_refunds}}

That is the fourth house term on your invoice. It covers a piece not produced, not delivered in good and useable condition, or not delivered by the agreed date, where we cannot put it right. It does not cover a change of mind after a made-to-measure piece has been cut.

If you receive a faulty or damaged item, write within 48 hours of delivery with photographs. That is how we meet the agreement when the piece is not in good and useable condition. We will repair, remake, or refund where we cannot offer a reasonable solution.

## Atelier after delivery

{{#alteration_warranty_days}}After you confirm receipt, you have {{alteration_warranty_days}} days to ask for a fit or workmanship alteration. That is complimentary unless the house records a reason to charge. A change you request later is a new, chargeable instruction, not a return.{{/alteration_warranty_days}}

## Prudent Points

A piece paid with points is not returned for cash. If we accept a return or cancel, the points go back to your balance.

## Bridal

Bridal commissions follow the atelier rules. A gown cut to your body is not returnable for a change of mind.

## Contact

{{#contact_email}}[{{contact_email}}](mailto:{{contact_email}}){{/contact_email}}`;

export const SHIPPING_MD = `## Made, then shipped

Nothing is held in stock. {{#production_time}}A ready-to-wear piece is made in {{production_time}}, then shipped.{{/production_time}} Shipping time is extra. If a product shows its own production days, those days apply to that piece.

Atelier delivery dates are the dates agreed on the commission, tracked through the thirteen stages. You can follow a commission on its tracking link.

## How the charge is set

{{#house_term_shipping}}{{house_term_shipping}}{{/house_term_shipping}}

That is the shipping term on your invoice. Sometimes a rate is available at checkout. Sometimes the house confirms the courier and the cost after the piece is packed, especially when the destination cannot be quoted automatically. You will have agreed the wording shown at checkout. We do not dispatch until that charge is paid.

Partners we quote with are DHL (international and some domestic) and GIG Logistics (Nigeria). Collection from the Ajah factory is also offered when that method is on.

{{#shipping_methods}}Methods currently offered: {{shipping_methods}}.{{/shipping_methods}}

{{#shipping_lagos}}Lagos courier locations currently offered: {{shipping_lagos}}.{{/shipping_lagos}}

## Duties

{{#shipping_ddu}}{{shipping_ddu}}{{/shipping_ddu}}

That is DDU: delivered duty unpaid. Budget for it. The house does not collect those duties at checkout.

## Collection

If you collect, we give you a collection code when the piece is ready. {{#shipping_uncollected_days}}If it sits uncollected, we send a reminder after {{shipping_uncollected_days}} days.{{/shipping_uncollected_days}} Write to us if you need a different arrangement. The software reminds. It does not throw the piece away.

## Tracking

Shop orders receive a carrier tracking number by email when we have one. Commissions are tracked on the house's own stage page.

## Contact

{{#contact_email}}For shipping: [{{contact_email}}](mailto:{{contact_email}}){{/contact_email}}`;

export type LegalPageKey = "privacy" | "terms" | "cookie" | "returns" | "shipping";

export const LEGAL_MARKDOWN: Record<LegalPageKey, string> = {
  privacy: PRIVACY_POLICY_MD,
  terms: TERMS_MD,
  cookie: COOKIE_MD,
  returns: RETURNS_MD,
  shipping: SHIPPING_MD,
};

export const LEGAL_HTML: Record<LegalPageKey, string> = {
  privacy: legalMdToHtml(PRIVACY_POLICY_MD),
  terms: legalMdToHtml(TERMS_MD),
  cookie: legalMdToHtml(COOKIE_MD),
  returns: legalMdToHtml(RETURNS_MD),
  shipping: legalMdToHtml(SHIPPING_MD),
};

export const LEGAL_SEED_ENTRIES: { key: string; label: string; updatedKey: string; md: string }[] = [
  { key: "legal_privacy_policy", label: "Privacy Policy", updatedKey: "legal_privacy_updated", md: PRIVACY_POLICY_MD },
  { key: "legal_terms", label: "Terms & Conditions", updatedKey: "legal_terms_updated", md: TERMS_MD },
  { key: "legal_cookie_policy", label: "Cookie Policy", updatedKey: "legal_cookie_updated", md: COOKIE_MD },
  { key: "legal_returns_policy", label: "Returns Policy", updatedKey: "legal_returns_updated", md: RETURNS_MD },
  { key: "legal_shipping_policy", label: "Shipping Policy", updatedKey: "legal_shipping_updated", md: SHIPPING_MD },
];
