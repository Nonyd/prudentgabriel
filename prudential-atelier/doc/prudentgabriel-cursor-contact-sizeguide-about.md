# CURSOR AI — PRUDENTGABRIEL.COM
## Feature: Contact Page + Size Guide + About Page
### Prepared by SonsHub Media Ltd (Nony — Okafor Chinonso Daniel)

---

## CRITICAL INSTRUCTIONS

1. Read the entire prompt before writing any code.
2. All content is stored in SiteSetting and editable from the admin CMS.
3. Every piece of text, contact detail, and image must be manageable from `/admin/content/pages`.
4. Generate demo content for all three pages — Mrs. Prudent will replace with real details.
5. Run `pnpm exec tsc --noEmit` after completing all changes.

---

## PAGE 1 — CONTACT PAGE (`/contact`)

### Design layout:

```
[Navbar]

┌─────────────────────────────────────────────────────────┐
│  CONTACT                                                 │
│  Get in touch                                           │  Cormorant 56px
│  We'd love to hear from you.                           │  Lora 16px
└─────────────────────────────────────────────────────────┘

┌──────────────────────────┬──────────────────────────────┐
│  CONTACT FORM (left 55%) │  CONTACT DETAILS (right 45%) │
└──────────────────────────┴──────────────────────────────┘

[Footer]
```

---

### Left column — Contact Form:

```
SEND US A MESSAGE
─────────────────

Full Name        [________________________]
Email Address    [________________________]
Phone Number     [________________________]  (optional)
Subject          [dropdown]
  ○ General Enquiry
  ○ Book a Consultation
  ○ Ready-to-Wear Order
  ○ Atelier Commission
  ○ Bridal Enquiry
  ○ Press & Media
  ○ Collaboration

Message          [________________________]
                 [________________________]
                 [________________________]
                 (min 20 characters)

[SEND MESSAGE →] button
```

**Button style:**
- Full width, `var(--choc)` background, `var(--cream)` text
- Jost 11px, weight 600, uppercase, letter-spacing 0.18em
- Height: 52px, border-radius: 3px

**On submit:**
1. `POST /api/contact`
2. Send email to `hello@prudentgabriel.com` via Nodemailer with the form details
3. Send auto-reply email to the client:
   Subject: "We received your message — Prudential Atelier"
   Body: "Thank you for reaching out, [Name]. We'll be in touch within 24 hours."
4. Create `AdminNotification`:
   type: CONTACT_FORM
   title: "New contact message"
   message: "[Name] — [Subject]"
   link: /admin/clients
5. Show success state:
   Replace form with:
   "✓ Message sent"
   "Thank you, [Name]. We'll be in touch within 24 hours."
   Cormorant 28px, var(--choc), centered

**Validation:**
- Name: required
- Email: required, valid format
- Subject: required
- Message: required, min 20 chars
- Show inline errors in Jost 11px, var(--error)

---

### Right column — Contact Details:

```
FIND US
────────────────────────────────

📍 Lagos Atelier
   14 Bode Thomas Street,
   Surulere, Lagos, Nigeria

📍 Abuja Studio
   Plot 1234, Wuse Zone 5,
   Abuja, FCT, Nigeria

────────────────────────────────

GET IN TOUCH
────────────────────────────────

📱 WhatsApp
   +234 801 234 5678
   [Chat on WhatsApp →]

📞 Phone
   +234 801 234 5678

✉ Email
   hello@prudentgabriel.com

⏰ Hours
   Monday – Friday: 9:00 AM – 6:00 PM
   Saturday: 10:00 AM – 4:00 PM
   Sunday: Closed

────────────────────────────────

FOLLOW US
────────────────────────────────

[Instagram icon] @prudentgabriel
[TikTok icon]    @prudentgabriel
[Facebook icon]  Prudential Atelier
```

**Design for contact detail items:**
- Label: Jost 10px, uppercase, letter-spacing 0.16em, `var(--lightbr)`
- Value: Lora 14px, `var(--text-mid)`
- WhatsApp CTA: `var(--nut)` color, opens `https://wa.me/[number]`
- Dividers: `0.5px solid var(--sand)`

---

### Google Maps embed (below both columns):

Full-width Google Maps embed showing Lagos Atelier location.
Use an iframe embed — address: "Surulere, Lagos, Nigeria"

```html
<iframe
  src="https://maps.google.com/maps?q=Surulere,Lagos,Nigeria&output=embed"
  width="100%"
  height="400"
  style="border:0; border-radius: 8px;"
  loading="lazy"
/>
```

---

### Admin CMS — Contact Page section:

In `/admin/content/pages` → add **"Contact"** page:

```
CONTACT DETAILS
  Lagos address (line 1): [input]
  Lagos address (line 2): [input]
  Abuja address (line 1): [input]
  Abuja address (line 2): [input]
  WhatsApp number: [input] e.g. +2348012345678
  Phone number: [input]
  Email: [input]
  Hours (Mon-Fri): [input]
  Hours (Saturday): [input]
  Instagram handle: [input]
  TikTok handle: [input]

CONTACT FORM
  Auto-reply message: [textarea]
  Notification email: [input] (where form submissions go)

[SAVE CONTACT PAGE]
```

Saves to SiteSetting keys:
- `contact_lagos_address_1`
- `contact_lagos_address_2`
- `contact_abuja_address_1`
- `contact_abuja_address_2`
- `contact_whatsapp`
- `contact_phone`
- `contact_email`
- `contact_hours_weekday`
- `contact_hours_saturday`
- `contact_auto_reply_message`
- `contact_notification_email`

---

### API route:

```typescript
// POST /api/contact
// Body: { name, email, phone, subject, message }

// 1. Send to admin email
await sendEmail({
  to: contactEmail, // from SiteSetting contact_notification_email
  subject: `New contact: ${subject} — ${name}`,
  html: `
    <h2>New Contact Form Submission</h2>
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
    <p><strong>Subject:</strong> ${subject}</p>
    <p><strong>Message:</strong></p>
    <p>${message}</p>
  `
})

// 2. Send auto-reply to client
await sendEmail({
  to: email,
  subject: 'We received your message — Prudential Atelier',
  html: autoReplyTemplate(name, autoReplyMessage)
})

// 3. Create admin notification
await createAdminNotification({
  type: 'CONTACT_FORM',
  title: 'New contact message',
  message: `${name} — ${subject}`,
  link: '/admin/clients',
})

return NextResponse.json({ success: true })
```

---

## PAGE 2 — SIZE GUIDE (`/size-guide`)

### Design layout:

```
[Navbar]

┌─────────────────────────────────────────────────────────┐
│  SIZE GUIDE                                              │
│  Find your perfect fit                                  │  Cormorant 52px
│  All measurements in centimetres unless stated.        │  Lora 15px
└─────────────────────────────────────────────────────────┘

Tab navigation:
[WOMEN]  [BRIDAL]  [KIDS]  [HOW TO MEASURE]

[Content changes per tab]

[Footer]
```

---

### Tab 1 — WOMEN (Ready-to-Wear):

**Size chart table:**

| UK SIZE | BUST (cm) | WAIST (cm) | HIPS (cm) | DRESS LENGTH (cm) |
|---------|-----------|------------|-----------|-------------------|
| 6       | 80        | 61         | 86        | 100               |
| 8       | 83        | 64         | 89        | 101               |
| 10      | 86        | 67         | 92        | 102               |
| 12      | 90        | 71         | 96        | 103               |
| 14      | 94        | 75         | 100       | 104               |
| 16      | 98        | 79         | 104       | 105               |
| 18      | 103       | 84         | 109       | 106               |
| 20      | 108       | 89         | 114       | 107               |
| 22      | 114       | 95         | 120       | 108               |

**Table design:**
- Header row: `var(--choc)` background, `var(--cream)` text, Jost 11px uppercase
- Data rows: alternating `var(--ivory)` and white
- Selected row (hover): `rgba(152,117,91,0.08)`
- Border: `0.5px solid var(--sand)`
- Text: Jost 13px, `var(--text-mid)`
- UK SIZE column: weight 600, `var(--choc)`

**Below the table:**
```
💡 Between sizes? We recommend sizing up for 
   a more comfortable fit, or booking a consultation 
   for a made-to-measure piece.
```
Lora 13px italic, `var(--text-light)`, 
background `rgba(152,117,91,0.06)`, border-radius 6px, padding 16px

---

### Tab 2 — BRIDAL:

Intro note:
```
"All Prudential Atelier bridal pieces are made-to-measure. 
We take your exact measurements during your consultation 
to ensure a perfect fit on your special day."
```
Cormorant italic 20px, var(--choc), centered, max-width 600px

Then the same women's size chart for reference.

Plus a note:
```
BRIDAL SIZING NOTES

• Bridal gowns are structured differently from RTW pieces.
  We recommend ordering 1–2 sizes up for bridal.
• All bridal pieces include 2 scheduled fittings.
• Final alterations are completed in the last fitting 
  before your event.
• We recommend beginning your bridal journey at least 
  4–6 months before your event date.
```

---

### Tab 3 — KIDS:

| AGE    | HEIGHT (cm) | CHEST (cm) | WAIST (cm) |
|--------|-------------|------------|------------|
| 2–4    | 92–104      | 53–56      | 50–52      |
| 4–6    | 104–116     | 56–60      | 52–54      |
| 6–8    | 116–128     | 60–64      | 54–57      |
| 8–10   | 128–138     | 64–69      | 57–60      |
| 10–12  | 138–149     | 69–74      | 60–63      |

Same table design as women's chart.

---

### Tab 4 — HOW TO MEASURE:

Step-by-step measurement guide with illustrations.

Each measurement step:
```
01. BUST
    Measure around the fullest part of your chest,
    keeping the tape parallel to the ground.
    [Illustration placeholder — woman outline]

02. WAIST
    Measure around your natural waistline — the 
    narrowest part of your torso.

03. HIPS
    Stand with feet together. Measure around the 
    fullest part of your hips, about 20cm below 
    your waist.

04. DRESS LENGTH
    Measure from your shoulder down to where you 
    want the hem to fall.

05. SHOULDER WIDTH
    Measure from the edge of one shoulder to the 
    other across your back.
```

**Layout:** 2-column grid of measurement steps
Each step: number in Cormorant 48px `var(--sand)`,
title in Jost 13px uppercase `var(--lightbr)`,
description in Lora 14px `var(--text-mid)`

**Bottom CTA:**
```
Not sure about your measurements?

Book a consultation and our team will take 
your measurements professionally.

[BOOK A CONSULTATION →]
```

---

### Admin CMS — Size Guide section:

In `/admin/content/pages` → add **"Size Guide"** page:

```
WOMEN'S SIZE CHART
  [Editable table — 9 rows × 5 columns]
  Each cell: number input

KIDS SIZE CHART
  [Editable table — 5 rows × 4 columns]

BRIDAL NOTES
  [textarea — rich text]

HOW TO MEASURE
  [Each step: title input + description textarea]

[SAVE SIZE GUIDE]
```

All size data stored as JSON in SiteSetting:
- `size_guide_women` (JSON array of rows)
- `size_guide_kids` (JSON array of rows)
- `size_guide_bridal_notes`
- `size_guide_measure_steps` (JSON array of steps)

---

## PAGE 3 — ABOUT PAGE (`/about`)

### Design layout:

```
[Navbar — no announcement bar on this page]

1. Hero section (full width, dark)
2. Brand story section
3. Founder section
4. By the numbers section
5. Our values section
6. Locations section
7. PFA crosslink banner
8. CTA section

[Footer]
```

---

### Section 1 — Hero:

Full-width, dark chocolate background `#442913`
Height: 70vh

```
THE HOUSE OF PRUDENT GABRIEL         ← Cormorant 64px, cream
Founded in Lagos. Worn around the world.  ← Lora 18px, var(--sand)
```

Centered, with a subtle background texture or 
gradient overlay.

Below the text, a horizontal strip of 4 editorial 
images (fashion photography placeholders from 
Unsplash fashion photos).

---

### Section 2 — Brand Story:

Two column layout:
- Left: large editorial image (portrait)
- Right: brand story text

```
OUR STORY                            ← eyebrow
From a dream to a dynasty.          ← Cormorant 42px, var(--choc)

[Brand story body — 3 paragraphs, Lora 15px, line-height 1.9]

Paragraph 1 (from CMS):
"Prudential Atelier was born from a single, unwavering 
belief — that every woman deserves to be dressed with 
intention. Founded in Lagos by Mrs. Prudent Gabriel-Okopi, 
the house began as a quiet vision in a small studio and 
grew, through dedication and extraordinary craft, into 
one of Nigeria's most celebrated luxury fashion houses."

Paragraph 2:
"Today, Prudential Atelier serves clients across Nigeria, 
the United Kingdom, the United States, and beyond — 
crafting bespoke commissions, ready-to-wear collections, 
and bridal wear that speak to the modern African woman 
in all her power and grace."

Paragraph 3:
"Each piece is conceived in our Lagos atelier, 
hand-finished by our team of master tailors and beaders, 
and delivered to clients who understand that true luxury 
is not purchased — it is commissioned."
```

---

### Section 3 — Founder:

Dark chocolate background section.

```
┌─────────────────────┬──────────────────────────────────┐
│  [Founder photo]    │  THE CREATIVE DIRECTOR           │
│  Portrait, 3:4      │                                  │
│                     │  Mrs. Prudent                    │  Cormorant 48px
│                     │  Gabriel-Okopi                   │  cream
│                     │                                  │
│                     │  Founder & Creative Director     │  Jost 12px
│                     │  Prudential Atelier              │  var(--lightbr)
│                     │                                  │
│                     │  [Bio text — Lora 15px, cream    │
│                     │   at 80% opacity, 3 paragraphs]  │
│                     │                                  │
│                     │  "We don't make clothes.         │  Cormorant italic
│                     │   We make the way you'll be      │  24px, var(--cream)
│                     │   remembered."                   │
└─────────────────────┴──────────────────────────────────┘
```

**Founder bio (demo content):**
```
Mrs. Prudent Gabriel-Okopi is the founder and creative 
director of Prudential Atelier, Nigeria's premier luxury 
fashion house. With over 15 years of experience in 
fashion design and garment construction, she has built 
a house synonymous with exceptional craftsmanship, 
cultural pride, and international elegance.

A visionary who trained under some of Nigeria's finest 
designers, Mrs. Prudent founded the atelier with a clear 
mandate: to create pieces that celebrate the African woman 
in all her dimensions — her power, her femininity, her 
ambition, and her grace.

Under her creative direction, Prudential Atelier has 
dressed women for state dinners, royal ceremonies, 
international galas, and intimate celebrations — each 
commission a reflection of her unwavering commitment 
to excellence.
```

---

### Section 4 — By the Numbers:

Light ivory background. Four stats in a row:

```
15+              500+             100M+            4
Years of         Commissions      Global           Atelier
Couture          Delivered        Streams*         Locations
```

*Note: references Yadah's streams — remove if not appropriate

Each stat:
- Number: Cormorant Garamond 64px, `var(--choc)`
- Label: Jost 11px, uppercase, letter-spacing 0.2em, `var(--text-light)`
- Thin gold divider `#C9A84C` above each number

All 4 stats editable from admin CMS.

---

### Section 5 — Our Values:

```
WHAT WE STAND FOR               ← eyebrow
The principles behind every piece  ← Cormorant 42px
```

6 value cards in a 3×2 grid:

| Value | Description |
|-------|-------------|
| Craftsmanship | Every stitch is placed with intention. We hold ourselves to the highest standard of garment construction. |
| Individuality | No two women are the same. We design around your story, not the other way around. |
| Excellence | From the first consultation to the final delivery, excellence is not optional — it is expected. |
| Heritage | Proudly rooted in Lagos, we celebrate African fabric, technique, and identity in everything we create. |
| Integrity | We keep our promises. Delivery dates, quality standards, and commitments are sacred to us. |
| Relationships | Our clients are not transactions. They are relationships we nurture across years and milestones. |

Each value card:
- Border: `0.5px solid var(--sand)`
- Padding: 28px
- Value name: Cormorant 22px, `var(--choc)`
- Gold divider line: 24px wide, 1px, `#C9A84C`
- Description: Lora 13px, `var(--text-mid)`, line-height 1.8

---

### Section 6 — Locations:

```
OUR ATELIERS                    ← eyebrow
Where to find us                ← Cormorant 42px
```

Two location cards side by side:

```
┌─────────────────────────┐  ┌─────────────────────────┐
│  [Map/image placeholder]│  │  [Map/image placeholder]│
│                         │  │                         │
│  LAGOS                  │  │  ABUJA                  │
│  14 Bode Thomas Street  │  │  Plot 1234, Wuse Zone 5 │
│  Surulere, Lagos        │  │  Abuja, FCT             │
│                         │  │                         │
│  Mon–Fri: 9am–6pm       │  │  Mon–Fri: 9am–6pm       │
│  Sat: 10am–4pm          │  │  Sat: 10am–4pm          │
│                         │  │                         │
│  [Get Directions →]     │  │  [Get Directions →]     │
└─────────────────────────┘  └─────────────────────────┘
```

"Get Directions" links to Google Maps.

---

### Section 7 — PFA Crosslink Banner:

Same PFA banner component used on homepage.
"Learn the craft from the house" → /about#academy

---

### Section 8 — CTA:

Dark chocolate background.

```
Ready to begin your commission?

"Every great piece begins with a conversation."

[BOOK A CONSULTATION →]    [BROWSE THE COLLECTION →]
```

---

### Admin CMS — About Page section:

In `/admin/content/pages` → **"About"** page:

```
HERO
  Headline: [input]
  Subheadline: [input]

BRAND STORY
  Eyebrow: [input]
  Headline: [input]
  Paragraph 1: [textarea]
  Paragraph 2: [textarea]
  Paragraph 3: [textarea]
  Story image: [Cloudinary upload]

FOUNDER
  Name: [input]
  Title: [input]
  Photo: [Cloudinary upload]
  Bio paragraph 1: [textarea]
  Bio paragraph 2: [textarea]
  Bio paragraph 3: [textarea]
  Founder quote: [textarea]

BY THE NUMBERS (4 stats)
  Stat 1 number: [input]  Stat 1 label: [input]
  Stat 2 number: [input]  Stat 2 label: [input]
  Stat 3 number: [input]  Stat 3 label: [input]
  Stat 4 number: [input]  Stat 4 label: [input]

OUR VALUES (6 values)
  Each: Name [input] + Description [textarea]

LOCATIONS
  Lagos name: [input]
  Lagos address: [textarea]
  Lagos hours: [input]
  Lagos maps link: [input]
  Abuja name: [input]
  Abuja address: [textarea]
  Abuja hours: [input]
  Abuja maps link: [input]

FINAL CTA
  Headline: [input]
  Quote: [textarea]
  Button 1 label: [input]
  Button 2 label: [input]

[SAVE ABOUT PAGE]
```

Saves to SiteSetting keys with prefix `about_*`.

---

## SEED ALL DEMO CONTENT

Create `scripts/seed-pages.ts`:

```typescript
// Seeds all demo content for Contact, Size Guide, 
// and About pages into SiteSetting

const pageSettings = [
  // Contact
  { key: 'contact_lagos_address_1', value: '14 Bode Thomas Street' },
  { key: 'contact_lagos_address_2', value: 'Surulere, Lagos, Nigeria' },
  { key: 'contact_abuja_address_1', value: 'Plot 1234, Wuse Zone 5' },
  { key: 'contact_abuja_address_2', value: 'Abuja, FCT, Nigeria' },
  { key: 'contact_whatsapp', value: '+2348012345678' },
  { key: 'contact_phone', value: '+2348012345678' },
  { key: 'contact_email', value: 'hello@prudentgabriel.com' },
  { key: 'contact_hours_weekday', value: 'Monday – Friday: 9:00 AM – 6:00 PM' },
  { key: 'contact_hours_saturday', value: 'Saturday: 10:00 AM – 4:00 PM' },
  { key: 'contact_notification_email', value: 'hello@prudentgabriel.com' },
  
  // About
  { key: 'about_hero_headline', value: 'The House of Prudent Gabriel' },
  { key: 'about_hero_subheadline', value: 'Founded in Lagos. Worn around the world.' },
  { key: 'about_story_paragraph_1', value: 'Prudential Atelier was born from a single, unwavering belief...' },
  { key: 'about_founder_name', value: 'Mrs. Prudent Gabriel-Okopi' },
  { key: 'about_founder_title', value: 'Founder & Creative Director' },
  { key: 'about_founder_quote', value: 'We don\'t make clothes. We make the way you\'ll be remembered.' },
  { key: 'about_stat_1_number', value: '15+' },
  { key: 'about_stat_1_label', value: 'Years of Couture' },
  { key: 'about_stat_2_number', value: '500+' },
  { key: 'about_stat_2_label', value: 'Commissions Delivered' },
  { key: 'about_stat_3_number', value: '10,000+' },
  { key: 'about_stat_3_label', value: 'Happy Clients' },
  { key: 'about_stat_4_number', value: '4' },
  { key: 'about_stat_4_label', value: 'Atelier Locations' },
  
  // Size guide
  { key: 'size_guide_women', value: JSON.stringify([
    { size: '6', bust: '80', waist: '61', hips: '86', length: '100' },
    { size: '8', bust: '83', waist: '64', hips: '89', length: '101' },
    { size: '10', bust: '86', waist: '67', hips: '92', length: '102' },
    { size: '12', bust: '90', waist: '71', hips: '96', length: '103' },
    { size: '14', bust: '94', waist: '75', hips: '100', length: '104' },
    { size: '16', bust: '98', waist: '79', hips: '104', length: '105' },
    { size: '18', bust: '103', waist: '84', hips: '109', length: '106' },
    { size: '20', bust: '108', waist: '89', hips: '114', length: '107' },
    { size: '22', bust: '114', waist: '95', hips: '120', length: '108' },
  ])},
]

// Upsert all settings
for (const setting of pageSettings) {
  await prisma.siteSetting.upsert({
    where: { key: setting.key },
    update: { value: setting.value },
    create: { 
      key: setting.key, 
      value: setting.value,
      group: 'CONTENT',
      isPublic: true,
    }
  })
}
```

Add to `package.json`:
```json
"seed:pages": "tsx scripts/seed-pages.ts"
```

Run: `pnpm run seed:pages`

---

## EXECUTION ORDER

1. Create `/contact` page + contact form component
2. Build `POST /api/contact` route with email + notification
3. Add Contact page to admin CMS
4. Seed contact demo content
5. Create `/size-guide` page with 4 tabs
6. Add Size Guide to admin CMS with editable tables
7. Seed size guide data
8. Create `/about` page with all 8 sections
9. Add About page to admin CMS with all fields
10. Seed about page demo content (`pnpm run seed:pages`)
11. Add all three pages to navbar/footer links where missing
12. `pnpm exec tsc --noEmit` — must pass with zero errors
13. Commit and push

---

## COMPLETION CHECKLIST

- [ ] `/contact` page loads with form + contact details
- [ ] Contact form submits and sends email to admin
- [ ] Auto-reply email sends to client
- [ ] Admin gets notification bell alert for contact submissions
- [ ] Admin can edit all contact details from CMS
- [ ] `/size-guide` loads with 4 tabs (Women, Bridal, Kids, How to Measure)
- [ ] Size tables display correctly
- [ ] Admin can edit size charts from CMS
- [ ] `/about` loads with all 8 sections
- [ ] Founder section, brand story, stats, values, locations all show
- [ ] Admin can edit all about page content from CMS
- [ ] All three pages link correctly from navbar and footer
- [ ] `pnpm build` passes with zero TypeScript errors

---

*Prepared by SonsHub Media Ltd for Prudential Atelier — prudentgabriel.com*
*₦7,500,000 engagement · Contact + Size Guide + About Pages*
