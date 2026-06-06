# CURSOR AI — PRUDENTGABRIEL.COM
## Feature: Testimonials + Product Reviews + Consultation Reviews
### Prepared by SonsHub Media Ltd (Nony — Okafor Chinonso Daniel)

---

## CRITICAL INSTRUCTIONS

1. Read the entire prompt before writing any code.
2. These are THREE separate but related systems. Build them in order.
3. Do not modify existing payment flows or auth logic.
4. Run `pnpm exec tsc --noEmit` after each section.

---

## OVERVIEW OF THE THREE SYSTEMS

| System | Who can submit | Trigger | Shows on |
|--------|---------------|---------|----------|
| Testimonials | Clients with at least 1 completed purchase/consultation | Client-initiated from dashboard | Homepage |
| Product Reviews | Clients who purchased specific product | Auto-notification after delivery | Product detail page |
| Consultation Reviews | Clients who completed a consultation session | Auto-notification after session complete | /consultation page |

---

## SECTION 1 — TESTIMONIAL SYSTEM

### Schema — new model:

Add to `prisma/schema.prisma`:

```prisma
model Testimonial {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  
  body        String   // The testimonial text
  rating      Int      // 1-5 stars
  clientImage String?  // Cloudinary URL — uploaded by client
  adminImage  String?  // Cloudinary URL — uploaded/replaced by admin
  
  // Computed display image: adminImage first, then clientImage
  
  isApproved      Boolean @default(false)
  showOnHomepage  Boolean @default(false)
  
  // Admin can add context
  productContext  String? // e.g. "Custom Asoebi Gown"
  orderContext    String? // e.g. "Atelier Commission"
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([isApproved, showOnHomepage])
}
```

Add `testimonials Testimonial[]` relation to User model.

Run `prisma db push` after.

---

### Eligibility check:

```typescript
// src/lib/testimonial-eligibility.ts

export async function canSubmitTestimonial(userId: string): Promise<{
  eligible: boolean
  reason?: string
  completedPurchases: number
}> {
  const [deliveredOrders, completedConsultations, deliveredBespoke] = 
    await Promise.all([
      // RTW orders delivered
      prisma.order.count({
        where: { userId, status: 'DELIVERED' }
      }),
      // Consultations completed
      prisma.consultationBooking.count({
        where: { userId, status: 'COMPLETED' }
      }),
      // Bespoke orders at stage 13 (delivery)
      prisma.bespokeOrder.count({
        where: { 
          userId,
          currentStage: 'DELIVERY',
          status: 'DELIVERED'
        }
      }),
    ])

  const total = deliveredOrders + completedConsultations + deliveredBespoke

  return {
    eligible: total > 0,
    completedPurchases: total,
    reason: total === 0 
      ? 'Complete a purchase or consultation first'
      : undefined
  }
}
```

---

### Client dashboard — "Share your story" card:

Show this card in the client dashboard ONLY if `canSubmitTestimonial` returns `eligible: true`.

**Card design:**
```
┌─────────────────────────────────────────┐
│  ✦  SHARE YOUR STORY                    │
│                                         │
│  "Your experience matters. Share it     │
│   and inspire other women to begin      │
│   their Prudential journey."            │
│                                         │
│  [WRITE A TESTIMONIAL →]               │
└─────────────────────────────────────────┘
```
Background: `var(--choc)`
Text: `var(--cream)`
CTA button: ghost, `var(--cream)` border

If client has already submitted a pending testimonial:
```
┌─────────────────────────────────────────┐
│  ✓  Testimonial submitted               │
│  Your testimonial is awaiting approval. │
└─────────────────────────────────────────┘
```

---

### Testimonial submission page: `/account/testimonial/new`

**Page design:**
- Same account shell (sidebar + topbar)
- Ivory background, max-width 640px, centered

```
YOUR STORY
──────────────────────────────────────

Your rating:
[★ ★ ★ ★ ★]  ← clickable gold stars, 36px each

Your testimonial:
[________________________________________]
[________________________________________]
[________________________________________]
[________________________________________]
min 30 chars / max 600 chars
Character counter: "0 / 600"

Add a photo (optional):
[Upload photo]
Accepted: JPG, PNG · Max 5MB
"Your photo helps other women connect with your story."
[Preview of uploaded photo — 120px square, rounded]

[SUBMIT TESTIMONIAL →]
```

**Validation:**
- Rating: required (must select at least 1 star)
- Body: required, 30–600 chars
- Photo: optional, Cloudinary upload

**On submit:**
- `POST /api/account/testimonials`
- Creates `Testimonial` with `isApproved: false`
- Sends admin notification:
  ```
  type: TESTIMONIAL_SUBMITTED
  title: "New testimonial submitted"
  message: "[Name] submitted a [X]-star testimonial"
  link: /admin/reviews/testimonials
  ```
- Shows success state:
  "✓ Thank you, [Name]!"
  "Your testimonial has been submitted and will appear after approval."

---

### Admin — Testimonials management: `/admin/reviews/testimonials`

Add "Testimonials" tab to the `/admin/reviews` page.

**Table columns:**
- Client name + avatar
- Rating (stars)
- Excerpt (first 80 chars)
- Client photo (thumbnail if uploaded)
- Admin photo (thumbnail if set)
- Approved toggle
- Show on Homepage toggle
- Product/Order context (editable inline)
- Date submitted

**Per-row actions:**
- "Replace image" → Cloudinary upload (sets `adminImage`)
- "Edit context" → inline edit of `productContext` and `orderContext`
- Approve toggle
- Show on Homepage toggle (requires approved first)
- Delete

---

### Homepage testimonials redesign:

Replace the current testimonials section with the new editorial card design.

**Section layout:**
- Background: `var(--ivory)`
- Padding: `80px 0`
- Eyebrow: "CLIENT WORDS" — Jost 10px, uppercase, `var(--lightbr)`, centered
- Heading: "What our clients say" — Cormorant 42px, `var(--choc)`, centered
- Margin-bottom: 48px

**Horizontal slider — shows 2 cards at a time on desktop, 1 on mobile:**

Each testimonial card:
```
┌──────────────────────────────────────────────────────────────┐
│  [IMAGE]          │  ★★★★★                                   │
│  Portrait 40%     │                                          │
│  object-fit:cover │  "Quote text in Cormorant italic 19px    │
│  object-position: │   var(--choc) line-height 1.75           │
│  center top       │   Opening " in var(--sand) 36px"         │
│                   │                                          │
│                   │  ──────────────────────────              │
│                   │  Client Name    Jost 13px weight 600     │
│                   │  Gold member · Bespoke Commission        │
│                   │  Lora 12px italic var(--text-light)      │
└──────────────────────────────────────────────────────────────┘
```

Card specs:
- Width: 580px
- Height: 300px
- Border-radius: 8px
- Border: `0.5px solid var(--sand)`
- Overflow: hidden
- Background: white

Image column (40%):
- Full height, `object-fit: cover`, `object-position: center top`
- Display image: `adminImage` first, then `clientImage`, then initials avatar

Content column (60%):
- Padding: `28px 24px`
- Display: flex, flex-direction: column, justify-content: space-between

**Navigation arrows:**
Thin SVG chevron — same style as hero carousel:
```tsx
// Left: lines from center-left to center, forming a < shape
// Right: mirror image >
// Color: rgba(68,41,19,0.4) default, rgba(68,41,19,0.9) on hover
// No background, no border, no circle
// Size: 24x48px SVG
```

**Dot indicators:**
- Active: 20px wide, 4px tall, `var(--lightbr)`, border-radius 2px
- Inactive: 6px wide, 4px tall, `var(--sand)`
- Transition: width 0.3s ease
- Gap: 6px

**Fetch logic:**
```typescript
const testimonials = await prisma.testimonial.findMany({
  where: { isApproved: true, showOnHomepage: true },
  include: { user: { include: { clientProfile: true } } },
  orderBy: { createdAt: 'desc' },
  take: 6  // show up to 6, slide through them
})
```

If fewer than 2 `showOnHomepage` testimonials exist,
fill with most recent approved testimonials.

**Mobile:**
- Single card per view
- Image: full width at top, 180px tall, landscape crop
- Content below
- Touch swipe support (same pattern as hero carousel)

---

## SECTION 2 — PRODUCT REVIEWS (update existing system)

The product review system already exists. Add the automated notification trigger.

### Auto-notification after RTW delivery:

When an RTW order status changes to `DELIVERED`:
1. Wait 24 hours (use a cron job)
2. Send email to client:

```
Subject: "How was your [Product Name]? — Prudential Atelier"

Hi [firstName],

Your [Product Name] has been delivered — we hope 
you love it as much as we loved creating it.

We'd be honoured to hear about your experience.

[SHARE YOUR REVIEW →]
→ links to /account/reviews/new?product=[productId]&order=[orderId]

This takes less than 2 minutes.

— The Prudential Atelier Team
```

### Review request cron: `/api/cron/review-requests`

Schedule: runs every hour (or daily at 9am)

```typescript
// Find orders delivered 24+ hours ago with no review request sent
const eligibleOrders = await prisma.order.findMany({
  where: {
    status: 'DELIVERED',
    reviewRequestSent: false,
    updatedAt: { lte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  },
  include: { 
    user: true,
    items: { include: { product: true } }
  }
})

// For each order, send review request email
// Set reviewRequestSent: true after sending
```

Add `reviewRequestSent Boolean @default(false)` to Order model.

### Review submission page: `/account/reviews/new`

Query params: `?product=[id]&order=[id]`

Pre-fills product name. Same star rating + text form as before.
Shows product image on the left for context.

---

## SECTION 3 — CONSULTATION REVIEWS

### Schema — extend Review model:

Add `consultationId` field to Review if not already present:
```prisma
// In Review model:
consultationId String?
consultation   ConsultationBooking? @relation(fields: [consultationId], references: [id])
```

Run `prisma db push`.

### Auto-notification after consultation completed:

When admin marks a consultation as `COMPLETED` 
(in `/admin/consultations/[id]`):

1. Immediately send review request email to client:

```
Subject: "How was your consultation? — Prudential Atelier"

Hi [firstName],

Thank you for sitting with us. It was a pleasure 
getting to know your vision.

We'd love to hear how your experience was —
it helps us serve you and every client better.

[SHARE YOUR EXPERIENCE →]
→ links to /account/reviews/new?consultation=[bookingId]

— The Prudential Atelier Team
```

2. Set `ConsultationBooking.reviewRequestSent = true`

Add `reviewRequestSent Boolean @default(false)` to ConsultationBooking model.

### Consultation review submission: `/account/reviews/new?consultation=[id]`

Simple form — just star rating and text, no title:

```
HOW WAS YOUR CONSULTATION?
──────────────────────────────────

Your consultation:
In-Person with Mrs. Prudent · June 5, 2026

Your rating:
[★ ★ ★ ★ ★]

Your experience:
[________________________________________]
[________________________________________]
min 20 chars / max 400 chars

[SUBMIT →]
```

On submit:
- Creates `Review` with `consultationId`, `isApproved: false`
- Admin notification: "New consultation review from [Name]"

### Consultation reviews on `/consultation` page:

**Position:** Below the three consultation type cards,
before the "CONTINUE TO SCHEDULE" button.

**Layout — carousel/slider:**

```
WHAT OUR CLIENTS SAY
──────────────────────────────────────────────

[←]  "Working with Mrs. Prudent was life-changing.     [→]
      She understood my vision before I could even 
      articulate it fully."
      
      — Chisom E.  ·  In-Person with Mrs. Prudent

      ● ○ ○ ○
```

Design:
- Background: `var(--ivory)`, subtle section
- Padding: 48px 0
- Eyebrow: "WHAT OUR CLIENTS SAY" — Jost 10px, uppercase, `var(--lightbr)`, centered
- Quote: Cormorant italic 22px, `var(--choc)`, max-width 600px, centered
- Opening `"` in `var(--sand)`, 48px
- Attribution: "— [First name] [Last initial]  ·  [Consultation type]"
  Jost 12px, `var(--text-light)`, centered
- One quote visible at a time
- Auto-advances every 5 seconds
- Arrow navigation: thin chevron style
- Dots below

**Fetch logic:**
```typescript
const consultationReviews = await prisma.review.findMany({
  where: {
    isApproved: true,
    consultationId: { not: null },
    showOnConsultationPage: true  // add this field
  },
  include: {
    user: { select: { name: true } },
    consultation: { select: { offeringType: true } }
  },
  orderBy: { createdAt: 'desc' },
  take: 8
})
```

Add `showOnConsultationPage Boolean @default(false)` to Review model.

**Admin control:**
In `/admin/reviews`, add a new filter tab: "Consultation Reviews"
Each consultation review row has a "Show on Consultation Page" toggle.

---

## SECTION 4 — ADMIN REVIEWS PAGE UPDATE

Expand `/admin/reviews` to handle all three types:

**Tab navigation:**
```
[Product Reviews]  [Consultation Reviews]  [Testimonials]
```

**Product Reviews tab:** existing functionality

**Consultation Reviews tab:**
- Same table structure
- Extra column: "Consultation Type" (In-Person/Virtual)
- Toggle: "Show on Consultation Page"

**Testimonials tab:**
- Client name, rating, excerpt, client photo, admin photo
- Toggle: Approved
- Toggle: Show on Homepage
- "Replace image" button → Cloudinary upload
- "Edit context" → productContext + orderContext inline edit

---

## EXECUTION ORDER

1. Add `Testimonial` model to schema → `prisma db push`
2. Add `showOnConsultationPage` to Review model → `prisma db push`
3. Add `reviewRequestSent` to Order + ConsultationBooking → `prisma db push`
4. Add `consultationId` to Review if not present → `prisma db push`
5. Build `src/lib/testimonial-eligibility.ts`
6. Build "Share your story" card on client dashboard
7. Build `/account/testimonial/new` submission page
8. Build `POST /api/account/testimonials` route
9. Build review request cron `/api/cron/review-requests`
10. Build `/account/reviews/new` unified review page 
    (handles ?product= and ?consultation= params)
11. Build consultation auto-notification on COMPLETED status
12. Redesign homepage testimonials section (editorial cards + slider)
13. Build consultation reviews slider on `/consultation` page
14. Expand `/admin/reviews` with 3 tabs
15. Seed demo testimonials (2-3 entries with showOnHomepage: true)
16. `pnpm exec tsc --noEmit` — must pass
17. Commit and push

---

## SEED DEMO TESTIMONIALS

Add to `scripts/seed-demo.ts`:

```typescript
const testimonials = [
  {
    userId: // Chisom Eze's userId
    body: "Prudential Atelier didn't just make me a dress — they made me feel like the woman I always knew I was. From the first consultation to the final fitting, every detail was handled with such grace and precision. I wore my piece to my husband's chieftaincy ceremony and I have never felt more powerful.",
    rating: 5,
    clientImage: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400',
    isApproved: true,
    showOnHomepage: true,
    productContext: 'Chieftaincy Ceremony Wrapper Set',
    orderContext: 'Atelier Commission',
  },
  {
    userId: // Sandra Dike's userId
    body: "I have bought luxury fashion from London, Paris, and Dubai. Nothing compares to the experience of walking into the Prudential atelier and having something made entirely for you. The quality, the attention to detail, the relationship — this is what luxury truly means.",
    rating: 5,
    clientImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
    isApproved: true,
    showOnHomepage: true,
    productContext: 'Custom Evening Gown',
    orderContext: 'Atelier Commission',
  },
  {
    userId: // Amaka Nwosu's userId
    body: "My consultation with Mrs. Prudent was unlike anything I expected. She listened to everything — not just what I said, but what I meant. My Asoebi gown is being made right now and I cannot wait to see the final piece.",
    rating: 5,
    isApproved: true,
    showOnHomepage: true,
    productContext: 'Custom Asoebi Gown',
    orderContext: 'In-Person Consultation',
  },
]
```

---

## COMPLETION CHECKLIST

- [ ] `Testimonial` model created in schema
- [ ] "Share your story" card hidden if no completed purchases
- [ ] "Share your story" card shows correctly for eligible clients
- [ ] `/account/testimonial/new` loads and submits correctly
- [ ] Star rating selector works (clickable gold stars)
- [ ] Photo upload works via Cloudinary
- [ ] Admin sees new testimonial notification
- [ ] `/admin/reviews/testimonials` tab shows all testimonials
- [ ] Admin can approve, toggle homepage, replace image, edit context
- [ ] Homepage testimonials redesigned with editorial cards + slider
- [ ] 2 cards visible on desktop, 1 on mobile
- [ ] Slider navigation (arrows + dots) works
- [ ] Review request email fires 24h after RTW delivery
- [ ] Consultation review request fires when consultation marked COMPLETE
- [ ] `/account/reviews/new` works for both product and consultation reviews
- [ ] Consultation reviews appear on `/consultation` page as slider
- [ ] Admin can toggle "Show on Consultation Page" per review
- [ ] `/admin/reviews` has 3 tabs (Product / Consultation / Testimonials)
- [ ] Demo testimonials seeded and showing on homepage
- [ ] `pnpm build` passes with zero TypeScript errors

---

*Prepared by SonsHub Media Ltd for Prudential Atelier — prudentgabriel.com*
*₦7,500,000 engagement · Testimonials + Reviews System*
