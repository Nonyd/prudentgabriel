# CURSOR AI — PRUDENTGABRIEL.COM
## Phase 4.7: Admin CMS + Legal Pages + GDPR Cookie Consent
### Prepared by SonsHub Media Ltd (Nony — Okafor Chinonso Daniel)

---

## CRITICAL INSTRUCTIONS

1. Read the entire prompt before writing any code.
2. All CMS content is stored in `SiteSetting` model — no new database models needed.
3. Legal page content is stored in `SiteSetting` with keys like `legal_privacy_policy`, `legal_terms` etc.
4. GDPR consent preferences stored in browser `localStorage` — no database needed.
5. Run `pnpm exec tsc --noEmit` after each section.

---

## SECTION 1 — ADMIN CMS: PAGE-BY-PAGE CONTENT MANAGEMENT

### Route: `/admin/content/pages`

This page already exists. Expand it to cover every public page systematically.

### Layout of the Pages CMS:

Left sidebar (within the page):
- List of all pages as clickable items
- Active page highlighted
- Each shows the page name and a "Last edited" timestamp

Right content area:
- Page-specific fields
- Save button per section
- Live preview link

---

### PAGE: Homepage

**Section: Announcement Bar**
```
Enabled: [toggle On/Off]
Messages: [dynamic list — add/remove/reorder]
  Each message: text input + delete button
  Example: "WORLDWIDE SHIPPING · ₦ · $ · £"
  Example: "COMPLIMENTARY STYLING CONSULTATION WITH EVERY ATELIER COMMISSION"
Speed: [select: Slow / Medium / Fast]
```
Saves to: `announcement_bar_enabled`, `announcement_bar_messages` (JSON array), `announcement_bar_speed`

**Section: Hero**
```
Eyebrow text: [input] e.g. "PRUDENTIAL ATELIER · LAGOS"
Headline line 1: [input] e.g. "Crafted for the"
Headline line 2: [input] e.g. "Woman Who"
Headline line 3: [input] e.g. "Commands the Room"
Subtext: [textarea]
Button 1 label: [input] e.g. "SHOP COLLECTION"
Button 1 link: [input] e.g. "/shop"
Button 2 label: [input] e.g. "BOOK CONSULTATION"
Button 2 link: [input] e.g. "/consultation"
Hero image: [Cloudinary upload]
Hero stat number: [input] e.g. "15+"
Hero stat label: [input] e.g. "YEARS OF COUTURE"
```
Saves to: `home_hero_*` keys

**Section: Brand Quote**
```
Quote text: [textarea]
Attribution: [input] e.g. "MRS. PRUDENT GABRIEL-OKOPI · FOUNDER & CREATIVE DIRECTOR"
Section label: [input] e.g. "SINCE THE FIRST STITCH"
```
Saves to: `home_quote_*` keys

**Section: PFA Banner**
```
Enabled: [toggle]
Eyebrow: [input] e.g. "PRUDENTIAL FASHION ACADEMY"
Headline: [input] e.g. "Learn the craft from the house"
Body text: [textarea]
Button label: [input] e.g. "DISCOVER PFA →"
Button link: [input] e.g. "/about#academy"
```
Saves to: `home_pfa_*` keys

**Section: Bespoke Journey Section**
```
Enabled: [toggle]
Eyebrow: [input]
Headline: [input]
Body text: [textarea]
Button label: [input]
Button link: [input]
```
Saves to: `home_journey_*` keys

---

### PAGE: Atelier (/atelier)

```
Hero headline: [input]
Hero subtext: [textarea]
Hero CTA label: [input]
Process section headline: [input]
Process section subtext: [textarea]
Gallery section label: [input]
Gallery section headline: [input]
Final CTA headline: [input]
Final CTA button label: [input]
```
Saves to: `atelier_*` keys

---

### PAGE: Bridal (/bridal)

```
Hero headline: [input]
Hero subtext: [textarea]
Page description: [textarea — shown below hero]
Gallery section label: [input]
```
Saves to: `bridal_*` keys

---

### PAGE: Kids (/kids)

```
Hero headline: [input] default: "Dressed for little royals"
Hero subtext: [textarea]
Hero CTA label: [input]
Page description: [textarea]
```
Saves to: `kids_*` keys

---

### PAGE: Consultation (/consultation)

```
Page eyebrow: [input] default: "BOOK A CONSULTATION"
Page title: [input] default: "Sit with us"
Page subtitle: [textarea]

Consultation Type 1 — Signature (In-Person with Mrs. Prudent):
  Badge label: [input] default: "SIGNATURE"
  Title: [input]
  Description: [textarea]
  Feature 1: [input]
  Feature 2: [input]
  Feature 3: [input]
  Price (NGN): [number input]
  Price (USD): [number input]
  Price (GBP): [number input]
  Duration: [input] e.g. "Up to 90 minutes"

Consultation Type 2 — In-Person with Design Team:
  [same fields]

Consultation Type 3 — Virtual:
  [same fields]
```
Saves to: `consultation_page_*` and updates `SiteSetting` consultation prices

---

### PAGE: About (/about)

```
Hero headline: [input] default: "The House of Prudent Gabriel"
Hero subtext: [input] default: "Founded in Lagos. Worn around the world."

Brand story (rich text — TipTap):
  [Full rich text editor]
  Default content provided below

Founder quote: [textarea]
Founder name: [input]
Founder title: [input]

Academy section (PFA):
  Enabled: [toggle]
  Headline: [input]
  Body: [textarea]
  CTA label: [input]
  CTA link: [input]

Team section:
  Enabled: [toggle]
  Section headline: [input]
  Team members: [dynamic list]
    Each: Name, Title, Photo (Cloudinary), Bio (textarea)
```
Saves to: `about_*` keys

---

### PAGE: Journal (/journal)

```
Page eyebrow: [input] default: "THE JOURNAL"
Page title: [input] default: "Style & Stories"
Page subtitle: [input] default: "Stories from the atelier, styling notes, and behind-the-scenes craft."
```
Saves to: `journal_*` keys

---

### PAGE: Shop (/shop)

```
Page eyebrow: [input] default: "THE COLLECTION"
Page title: [input] default: "Prudent Gabriel"
Page subtitle: [input] default: "Ready-to-wear, bridal, and atelier couture."
```
Saves to: `shop_page_*` keys

---

### PAGE: Ready-to-Wear (/rtw)

```
Page eyebrow: [input] default: "THE COLLECTION"
Page title: [input] default: "Ready-to-Wear"
Page subtitle: [input]
```
Saves to: `rtw_page_*` keys

---

### PAGE: Track Order (/track)

```
Page eyebrow: [input] default: "ORDER TRACKING"
Page title: [input] default: "Follow your commission"
Page subtitle: [input] default: "No login required — just your order reference."
```
Saves to: `track_page_*` keys

---

### PAGE: Footer

```
Brand tagline: [textarea] default: "International luxury couture. Bespoke, ready-to-wear and bridal, made with love in Lagos for the world."

THE HOUSE column links: [dynamic list — label + URL]
CLIENT CARE column links: [dynamic list — label + URL]

Newsletter section:
  Headline: [input] default: "Collections, ateliers and invitations — first."
  Placeholder: [input] default: "Your email"

Copyright text: [input] default: "© 2026 Prudential Atelier. All rights reserved."
```
Saves to: `footer_*` keys

---

### How CMS feeds into pages:

Each public page must read its content from `SiteSetting` via a helper:

```typescript
// src/lib/cms.ts
export async function getCMSContent(keys: string[]): Promise<Record<string, string>> {
  const settings = await prisma.siteSetting.findMany({
    where: { key: { in: keys } }
  })
  const result: Record<string, string> = {}
  for (const s of settings) {
    result[s.key] = s.value
  }
  return result
}
```

Each page calls this at the top:
```typescript
// In homepage page.tsx (server component):
const cms = await getCMSContent([
  'home_hero_headline_1', 'home_hero_headline_2', 'home_hero_subtext',
  'home_quote_text', 'home_quote_attribution',
  'home_pfa_enabled', 'home_pfa_headline', 'home_pfa_body',
  // etc.
])
```

If a CMS key has no value, fall back to the hardcoded default. Pages never break if CMS is empty.

---

## SECTION 2 — LEGAL PAGES

### Routes:
- `/privacy-policy`
- `/terms-and-conditions`  
- `/cookie-policy`
- `/returns-policy`
- `/shipping-policy`

### Page design (all legal pages share the same template):

```
[Navbar]

┌─────────────────────────────────────────┐
│  LEGAL                                  │  ← eyebrow, var(--lightbr)
│  Privacy Policy                         │  ← Cormorant 48px, var(--choc)
│  Last updated: June 2026                │  ← Jost 11px, var(--text-light)
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  [Rich text content]                    │
│  Lora 15px, line-height 1.9             │
│  Max-width 760px, centered              │
│                                         │
│  h2: Cormorant 28px, var(--choc)        │
│  h3: Jost 14px, weight 600, var(--choc) │
│  p: Lora 15px, var(--text-mid)          │
│  ul/ol: indented, Lora 15px             │
│  a: var(--nut), underline on hover      │
└─────────────────────────────────────────┘

[Footer]
```

Content is stored in `SiteSetting` and editable from admin:
- Key `legal_privacy_policy` → `/privacy-policy`
- Key `legal_terms` → `/terms-and-conditions`
- Key `legal_cookie_policy` → `/cookie-policy`
- Key `legal_returns_policy` → `/returns-policy`
- Key `legal_shipping_policy` → `/shipping-policy`

### Admin CMS for legal pages

In `/admin/content/pages`, add a "Legal Pages" section with a TipTap rich text editor for each legal page.

### Legal page content — seed with professionally written content:

Seed all five pages via a new seed file `scripts/seed-legal.ts`:
```
pnpm exec tsx scripts/seed-legal.ts
```

Add to `package.json`: `"seed:legal": "tsx scripts/seed-legal.ts"`

---

### PRIVACY POLICY content to seed:

```
Title: Privacy Policy
Last Updated: June 2026

## 1. Introduction

Prudential Atelier ("we", "our", "us") is a luxury fashion house operated by Prudent Gabriel-Okopi, registered in Nigeria. We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, and protect your information when you use our website at prudentgabriel.com and our services.

We comply with the Nigeria Data Protection Act 2023 (NDPA) and, where applicable to our international customers, the UK General Data Protection Regulation (UK GDPR) and the EU General Data Protection Regulation (EU GDPR).

## 2. Information We Collect

We collect the following categories of personal information:

**Account Information:** Name, email address, phone number, and password when you create an account.

**Order Information:** Billing address, shipping address, payment method details (processed securely by our payment providers — we do not store card numbers), and order history.

**Measurements:** Body measurements you provide for atelier and bespoke commissions. This information is stored securely and used exclusively for the purpose of creating your garments.

**Consultation Information:** Details shared during consultation bookings, including design preferences, occasion details, and any reference images you upload.

**Device & Usage Data:** IP address, browser type, pages visited, and cookies (see our Cookie Policy for details).

## 3. How We Use Your Information

We use your personal information to:
- Process and fulfil your orders and consultations
- Communicate with you about your orders, including the 13-stage commission tracking system
- Send you appointment reminders and meeting links for consultations
- Manage your loyalty points and rewards
- Send you marketing communications if you have consented
- Improve our website and services
- Comply with our legal obligations

## 4. Legal Basis for Processing (UK/EU Customers)

For customers in the UK and European Union, we process your data on the following legal bases:
- **Contract:** Processing necessary to fulfil your orders and consultations
- **Legitimate interests:** Improving our services, preventing fraud
- **Consent:** Marketing communications, non-essential cookies
- **Legal obligation:** Compliance with applicable laws

## 5. How We Share Your Information

We do not sell your personal information. We share your information only with:

**Payment Processors:** Paystack, Flutterwave, Stripe, and Monnify process payments on our behalf. Each has their own privacy policy and security standards.

**Delivery Partners:** Where we arrange delivery of your order, we share your name and address with our logistics partners.

**Service Providers:** Cloudinary (image storage), Vercel (hosting), and Neon (database hosting). All are bound by data processing agreements.

We do not transfer your data outside of Nigeria, the UK, or the EU without appropriate safeguards in place.

## 6. Your Rights

**Nigerian Customers (NDPA 2023):**
You have the right to access, correct, and delete your personal information. You may also withdraw consent for marketing at any time.

**UK/EU Customers (UK GDPR / EU GDPR):**
You have the right to: access your data, rectify inaccurate data, erase your data ("right to be forgotten"), restrict processing, data portability, object to processing, and withdraw consent at any time.

To exercise any of these rights, please contact us at: hello@prudentgabriel.com

## 7. Data Retention

We retain your personal information for as long as necessary to fulfil the purposes for which it was collected, including:
- Order records: 7 years (Nigerian tax compliance)
- Account information: Until account deletion request
- Measurement data: Until you request deletion
- Marketing preferences: Until you withdraw consent

## 8. Security

We implement industry-standard security measures including encrypted data transmission (SSL/TLS), encrypted storage of sensitive settings, and access controls. However, no method of transmission over the internet is 100% secure.

## 9. Children's Privacy

Our services are not directed at children under 16. We do not knowingly collect personal information from children.

## 10. Contact Us

For any privacy-related queries or to exercise your rights:

Prudential Atelier
Email: hello@prudentgabriel.com
Website: prudentgabriel.com

For UK/EU customers, if you are not satisfied with our response, you have the right to lodge a complaint with your local data protection authority (ICO in the UK, or your national DPA in the EU).
```

---

### TERMS AND CONDITIONS content to seed:

```
Title: Terms & Conditions
Last Updated: June 2026

## 1. Agreement to Terms

By accessing prudentgabriel.com and using our services, you agree to these Terms and Conditions. Please read them carefully before making a purchase or booking a consultation.

## 2. About Us

Prudential Atelier is a luxury fashion house operated by Prudent Gabriel-Okopi, Lagos, Nigeria. We offer ready-to-wear garments, atelier (bespoke) commissions, bridal wear, and children's clothing.

## 3. Products and Services

**Ready-to-Wear:** Products are as described on our website. Colours may vary slightly due to screen display settings. Sizes follow our size guide available on each product page.

**Atelier Commissions:** Bespoke and custom garments are made to your specifications following our 13-stage production process. Once production begins, commissions cannot be cancelled. All measurements provided are your responsibility.

**Consultations:** Consultation fees are non-refundable. If you need to reschedule, please contact us at least 48 hours in advance.

## 4. Pricing

All prices are displayed in Nigerian Naira (₦) by default. Prices in USD and GBP are indicative and based on current exchange rates. The final charge will be in NGN unless otherwise agreed.

Prices include VAT where applicable. Shipping costs are calculated at checkout.

## 5. Payment

We accept payment via Paystack, Flutterwave, Stripe, Monnify, and direct bank transfer. For bank transfers, orders are confirmed only after payment verification by our finance team (within 2-4 business hours).

Atelier commissions require a 50% deposit before production begins, with the balance due before delivery.

## 6. Returns and Refunds

Please see our Returns Policy for full details. In summary:
- Ready-to-wear: eligible for exchange within 7 days of delivery
- Custom/atelier garments: not eligible for return once production has begun
- Consultations: non-refundable

## 7. Intellectual Property

All content on prudentgabriel.com — including designs, photographs, text, and logos — is the intellectual property of Prudential Atelier and may not be reproduced without written permission.

## 8. Limitation of Liability

To the fullest extent permitted by Nigerian law, Prudential Atelier shall not be liable for any indirect, incidental, or consequential damages arising from your use of our services.

## 9. Governing Law

These Terms are governed by the laws of the Federal Republic of Nigeria. Any disputes shall be resolved in the courts of Lagos State, Nigeria.

## 10. Contact

For any questions regarding these Terms:
Email: hello@prudentgabriel.com
```

---

### RETURNS POLICY content to seed:

```
Title: Returns & Refunds Policy
Last Updated: June 2026

## Our Commitment

At Prudential Atelier, every piece is crafted with exceptional care. We want you to love what you receive. Please read this policy carefully before making a purchase.

## Ready-to-Wear Returns

**Eligibility:** Ready-to-wear items may be returned for exchange within 7 days of delivery, provided the item is:
- Unworn, unwashed, and unaltered
- In its original packaging with all tags attached
- Not a final sale or discounted item

**Process:** Email hello@prudentgabriel.com with your order number and reason for return. We will provide return instructions within 24 hours.

**Exchanges:** We offer exchanges for a different size or colour where available. If the desired item is unavailable, we will issue store credit.

**Refunds:** We do not offer cash refunds on ready-to-wear. Store credit is valid for 12 months.

## Atelier & Custom Commissions

Custom and atelier garments are made exclusively for you and cannot be returned or exchanged once production has begun (after Stage 4: Payment Confirmation).

If there is a fault with the garment due to our craftsmanship, we will make the necessary alterations or repairs at no cost to you.

## Bridal Wear

Bridal garments are custom-made and follow the same policy as atelier commissions. We strongly recommend attending all scheduled fittings to ensure a perfect result.

## Faulty Items

If you receive a faulty or damaged item, please contact us within 48 hours of delivery with photographs. We will arrange a replacement or refund at our discretion.

## Contact

Email: hello@prudentgabriel.com
Response time: Within 24 business hours
```

---

### SHIPPING POLICY content to seed:

```
Title: Shipping Policy
Last Updated: June 2026

## Delivery within Nigeria

**Lagos:** 1-3 business days
**Other states:** 3-7 business days
**Delivery partners:** DHL, GIG Logistics, and premium courier services

## International Shipping

We ship worldwide. Delivery times:
- **UK:** 5-7 business days
- **USA/Canada:** 7-10 business days
- **Europe:** 5-8 business days
- **Rest of World:** 7-14 business days

## Shipping Costs

Shipping costs are calculated at checkout based on your location and order weight. Free shipping is available for orders above ₦500,000 within Nigeria.

International customers are responsible for any customs duties or import taxes applicable in their country.

## Atelier Commissions

Delivery timelines for atelier commissions are agreed during the consultation process and confirmed on your order. We track all 13 stages of production and will contact you when your commission is ready.

## Order Tracking

Once your order is dispatched, you will receive a tracking number via email. You can also track your atelier commission at any time at prudentgabriel.com/track.

## Contact

For shipping queries: hello@prudentgabriel.com
```

---

### COOKIE POLICY content to seed:

```
Title: Cookie Policy
Last Updated: June 2026

## What Are Cookies

Cookies are small text files placed on your device when you visit our website. They help us provide you with a better experience by remembering your preferences and understanding how you use our site.

## Cookies We Use

**Strictly Necessary Cookies**
These cookies are essential for the website to function. They include:
- Session cookies (keeping you logged in)
- Shopping bag cookies (remembering your selected items)
- Security cookies (protecting against fraud)
These cannot be disabled.

**Functional Cookies**
These cookies remember your preferences, such as:
- Your preferred currency (₦/$/£)
- Your theme preference (light/dark mode)
- Your recently viewed products

**Analytics Cookies**
We use analytics cookies to understand how visitors use our website. This helps us improve your experience. All data is anonymised.

**Marketing Cookies**
With your consent, we use marketing cookies to show you relevant content about Prudential Atelier on other websites.

## Managing Your Cookies

You can manage your cookie preferences at any time by clicking the "Cookie Settings" link in the footer, or through your browser settings. Note that disabling certain cookies may affect website functionality.

## Contact

For cookie-related questions: hello@prudentgabriel.com
```

---

## SECTION 3 — GDPR COOKIE CONSENT BANNER

### Behaviour:
- First visit: cookie consent banner appears at bottom of screen
- If user has already consented (localStorage has `pg_cookie_consent`): banner does not appear
- Banner persists across page navigation until user makes a choice
- Clicking "Accept All", "Reject Non-Essential", or saving preferences closes the banner permanently

### Banner design:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│  🍪  We use cookies to enhance your experience.                  │
│  Read our Cookie Policy to learn more.                           │
│                                                                   │
│  [Cookie Settings]  [Reject Non-Essential]  [Accept All]        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

Position: fixed bottom, full width
Background: `var(--choc)` (dark chocolate)
Text: `var(--cream)`, Lora 13px
Buttons:
- "Cookie Settings" → ghost, opens preferences modal
- "Reject Non-Essential" → ghost, saves minimal consent
- "Accept All" → filled `var(--lightbr)`, saves full consent

### Cookie Preferences Modal:

Opens when "Cookie Settings" is clicked:

```
┌────────────────────────────────────────┐
│  Cookie Preferences                    │
│                                        │
│  Strictly Necessary    [Always On]     │
│  Required for the site to work.        │
│                                        │
│  Functional Cookies    [toggle]        │
│  Remember your preferences.            │
│                                        │
│  Analytics Cookies     [toggle]        │
│  Help us improve the site.             │
│                                        │
│  Marketing Cookies     [toggle]        │
│  Personalised content.                 │
│                                        │
│  [Save Preferences]                    │
│                                        │
│  Privacy Policy | Cookie Policy        │
└────────────────────────────────────────┘
```

### Consent storage (localStorage):

```typescript
interface CookieConsent {
  version: '1.0'
  timestamp: string
  necessary: true      // always true
  functional: boolean
  analytics: boolean
  marketing: boolean
}

const CONSENT_KEY = 'pg_cookie_consent'

// Save:
localStorage.setItem(CONSENT_KEY, JSON.stringify(consent))

// Read:
const consent = JSON.parse(localStorage.getItem(CONSENT_KEY) ?? 'null')

// "Accept All":
{ version: '1.0', timestamp: new Date().toISOString(), 
  necessary: true, functional: true, analytics: true, marketing: true }

// "Reject Non-Essential":
{ version: '1.0', timestamp: new Date().toISOString(),
  necessary: true, functional: false, analytics: false, marketing: false }
```

### Implementation:

Create `src/components/gdpr/CookieConsent.tsx` — client component.

Add to the root layout `src/app/layout.tsx`:
```tsx
<CookieConsent />
```

It renders nothing if consent is already stored.

### "Cookie Settings" link in footer:

Add to footer: "Cookie Settings" link that opens the preferences modal programmatically.
Store a global state (Zustand or React context) for `isCookieModalOpen`.

### Re-consent trigger:

If the cookie policy is updated (new version), the consent banner reappears.
Check version in localStorage — if `consent.version !== CURRENT_VERSION`, show banner again.

---

## SECTION 4 — LEGAL PAGES IN FOOTER

Update `Footer.tsx` to include legal links:

Under the bottom bar, add a legal links row:
```
Privacy Policy · Terms & Conditions · Cookie Policy · Returns Policy · Shipping Policy · Cookie Settings
```

All link to their respective routes:
- `/privacy-policy`
- `/terms-and-conditions`
- `/cookie-policy`
- `/returns-policy`
- `/shipping-policy`
- "Cookie Settings" → opens the GDPR preferences modal

Style: Jost 10px, `var(--text-light)`, hover `var(--cream)`, separated by `·`

---

## EXECUTION ORDER

1. Build `src/lib/cms.ts` helper function
2. Build `/admin/content/pages` expanded CMS (all pages)
3. Update each public page to read from CMS with fallbacks
4. Create legal page template component
5. Create all 5 legal page routes
6. Create `scripts/seed-legal.ts` with all 5 legal texts → run it
7. Add legal pages to admin CMS editor
8. Build `CookieConsent` component with banner + modal
9. Add `CookieConsent` to root layout
10. Add "Cookie Settings" to footer
11. Add legal links to footer bottom bar
12. `pnpm exec tsc --noEmit` — must pass
13. `pnpm run seed:legal` — seed all legal content
14. Push to GitHub → deploy to Vercel

---

## COMPLETION CHECKLIST

- [ ] Admin CMS covers all 10 public pages
- [ ] Each public page reads from CMS with hardcoded fallbacks
- [ ] All 5 legal pages exist and are accessible
- [ ] Legal pages have professional branded design
- [ ] Legal content is seeded and readable
- [ ] Cookie consent banner appears on first visit
- [ ] "Accept All" stores consent and hides banner
- [ ] "Reject Non-Essential" stores minimal consent
- [ ] Cookie Settings modal shows toggles per category
- [ ] "Cookie Settings" link in footer opens modal
- [ ] All legal links in footer bottom bar
- [ ] `pnpm build` passes with zero TypeScript errors

---

*Prepared by SonsHub Media Ltd for Prudential Atelier — prudentgabriel.com*
*₦7,500,000 engagement · Phase 4.7 of 5*
