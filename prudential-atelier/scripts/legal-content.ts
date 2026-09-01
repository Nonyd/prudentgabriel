/** Converts prompt markdown-style legal text to HTML for TipTap / legal pages. */
export function legalMdToHtml(md: string): string {
  const blocks = md.trim().split(/\n\n+/);
  const parts: string[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("## ")) {
      parts.push(`<h2>${escapeHtml(trimmed.slice(3))}</h2>`);
      continue;
    }

    if (trimmed.startsWith("- ")) {
      const items = trimmed.split("\n").map((line) => {
        const text = line.replace(/^- /, "");
        return `<li>${inlineMd(text)}</li>`;
      });
      parts.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    parts.push(`<p>${inlineMd(trimmed.replace(/\n/g, " "))}</p>`);
  }

  return parts.join("\n");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inlineMd(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

export const PRIVACY_POLICY_MD = `## 1. Introduction

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
- Manage your Prudent Points and rewards
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

For UK/EU customers, if you are not satisfied with our response, you have the right to lodge a complaint with your local data protection authority (ICO in the UK, or your national DPA in the EU).`;

export const TERMS_MD = `## 1. Agreement to Terms

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
Email: hello@prudentgabriel.com`;

export const RETURNS_MD = `## Our Commitment

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
Response time: Within 24 business hours`;

export const SHIPPING_MD = `## Delivery within Nigeria

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

For shipping queries: hello@prudentgabriel.com`;

export const COOKIE_MD = `## What Are Cookies

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

For cookie-related questions: hello@prudentgabriel.com`;

export const LEGAL_SEED_ENTRIES: { key: string; label: string; md: string }[] = [
  { key: "legal_privacy_policy", label: "Privacy Policy", md: PRIVACY_POLICY_MD },
  { key: "legal_terms", label: "Terms & Conditions", md: TERMS_MD },
  { key: "legal_returns_policy", label: "Returns Policy", md: RETURNS_MD },
  { key: "legal_shipping_policy", label: "Shipping Policy", md: SHIPPING_MD },
  { key: "legal_cookie_policy", label: "Cookie Policy", md: COOKIE_MD },
];
