# CURSOR AI — PRUDENTGABRIEL.COM
## Feature: Homepage Testimonials + Product Page Reviews
### Prepared by SonsHub Media Ltd (Nony — Okafor Chinonso Daniel)

---

## CRITICAL INSTRUCTIONS

1. Read the entire prompt before writing any code.
2. Do not change any existing payment flows or auth logic.
3. Run `pnpm exec tsc --noEmit` after completing all changes.

---

## FEATURE 1 — HOMEPAGE TESTIMONIALS SECTION

### Schema addition

Add `showOnHomepage` field to the `Review` model in `prisma/schema.prisma`:

```prisma
showOnHomepage Boolean @default(false)
```

Run `prisma db push` after adding.

---

### Where it appears on the homepage

Between the "Bespoke Journey" section and the PFA banner.

---

### Design

**Section layout:**
- Background: `var(--ivory)`
- Padding: `80px 0`
- Eyebrow: "CLIENT WORDS" — Jost 10px, uppercase, letter-spacing 0.2em, `var(--lightbr)`, centered
- Heading: "What our clients say" — Cormorant Garamond 42px, `var(--choc)`, centered
- Optional subtitle from CMS: Lora 14px, `var(--text-light)`, centered

**Three testimonial cards in a row (desktop), single column (mobile):**

Each card:
- Background: white
- Border: `0.5px solid var(--sand)`
- Border-radius: 6px
- Padding: 32px
- No box shadow

Card content (top to bottom):

1. Star rating — 5 gold stars ★★★★★
   - Color: `#C9A84C`
   - Size: 14px, gap 2px

2. Quote text — the review body
   - Cormorant Garamond italic 20px
   - `var(--choc)`, line-height 1.7
   - Large opening quote mark `"` before the text
     — `var(--sand)`, 48px, Cormorant

3. Client info row (bottom):
   - Avatar circle: 40px, `var(--lightbr)` bg, white initials, Cormorant 16px
   - Name: Jost 13px, weight 500, `var(--choc)`
   - Below name: tier badge (Bronze/Silver/Gold/Platinum) + product name
     — Lora 12px italic, `var(--text-light)`
     — e.g. "Gold member · Custom Asoebi Gown"

---

### Fetch logic (server component)

```typescript
const testimonials = await prisma.review.findMany({
  where: {
    isApproved: true,
    showOnHomepage: true
  },
  include: {
    user: {
      include: { clientProfile: true }
    },
    bespokeOrder: {
      select: { outfitName: true }
    },
    product: {
      select: { name: true }
    }
  },
  orderBy: { createdAt: 'desc' },
  take: 3
})
```

If fewer than 3 `showOnHomepage` reviews exist, fill with the most recent approved reviews.

---

### Seed update

In `scripts/seed-demo.ts`, update the two existing reviews (Sandra Dike + Chisom Eze) to set `showOnHomepage: true`.

Re-run: `pnpm run seed:demo`

---

### Admin — Reviews management page

Add "Reviews" link to the admin sidebar under the **Content** section:

```
CONTENT
  Blog / Journal
  Pages
  Reviews  ← new
```

**Route:** `/admin/reviews`

**Page layout:**
- Table columns: Client, Product/Order, Rating (stars), Excerpt, Approved, Show on Homepage, Date
- Toggle per row: **Approved** (On/Off)
- Toggle per row: **Show on Homepage** (On/Off)
- Filter tabs: All · Approved · Pending · Homepage
- Search by client name or product

**API route:**
```
PATCH /api/admin/reviews/[id]
Body: { isApproved?: boolean, showOnHomepage?: boolean }
```

---

### Admin CMS addition

In `/admin/content/pages` → Homepage, add a **"Testimonials Section"** block:

```
Enabled: [toggle On/Off]
Section heading: [input] default: "What our clients say"
Section subtitle: [textarea, optional]

[SAVE TESTIMONIALS SECTION]
```

Saves to SiteSetting keys:
- `home_testimonials_enabled`
- `home_testimonials_heading`
- `home_testimonials_subtitle`

---

## FEATURE 2 — PRODUCT PAGE REVIEWS

The product detail page at `/shop/[slug]` already has a reviews section shell. Wire it to real data and add the ability for clients to submit reviews.

---

### Fetch reviews (server component)

```typescript
const reviews = await prisma.review.findMany({
  where: {
    productId: product.id,
    isApproved: true
  },
  include: {
    user: { select: { name: true } }
  },
  orderBy: { createdAt: 'desc' }
})

const avgRating = reviews.length > 0
  ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
  : 0
```

---

### Reviews section design

**Header row:**
- "Client Reviews" — Cormorant 32px, `var(--choc)`
- Right: "X REVIEWS" — Jost 11px, `var(--text-light)`

**Rating summary (only if reviews exist):**
- Large average: Cormorant 48px, `var(--choc)` — e.g. "4.8"
- 5 stars filled proportionally — color `#C9A84C`
- "Based on X reviews" — Jost 11px, `var(--text-light)`
- Sort options: Newest · Most helpful

**Each review row:**
- No card border — bottom divider only: `0.5px solid var(--sand)`
- Padding: `20px 0`
- Top row: star rating + date right-aligned (Jost 11px)
- Client name: Jost 13px, weight 500, `var(--choc)`
  — Show first name + last initial only: "Amaka N."
- "Verified purchase" badge if linked to an order:
  Small pill, green tint background, Jost 10px
- Review title: Jost 14px, weight 600, `var(--choc)`
- Review body: Lora 14px, `var(--text-mid)`, line-height 1.8

**Empty state:**
```
"Be the first to review this piece"
Lora 14px italic, var(--text-light), centered

[Write a Review] button below
```

---

### Write a review form

**Who can see the form:**

| State | What shows |
|-------|-----------|
| Not logged in | "Log in to write a review" link |
| Logged in, no purchase | "Purchase this piece to leave a review" |
| Logged in + purchased | Full review form |

Check purchase: query `Order` or `BespokeOrder` linked to `session.user.id` and this product.

**Form design:**

```
WRITE YOUR REVIEW
─────────────────────────────────────────

Your rating:
[★ ★ ★ ★ ★]  ← clickable stars, gold fill on select

Review title:    [________________________]  max 80 chars

Your review:     [________________________]
                 [________________________]
                 [________________________]  min 20 / max 500 chars
                                            Character counter: "120 / 500"

[SUBMIT REVIEW →]
```

**Star selector:**
- 5 stars, 32px each
- Empty: `var(--sand)`
- Filled: `#C9A84C`
- Hover: fills stars up to hovered position

**On submit:**
- `POST /api/products/[slug]/reviews`
- Creates `Review` with `isApproved: false`
- Shows toast: "Thank you! Your review will appear after approval."
- Form hides after submission (replaced with "Review submitted" message)

---

### API routes

```
GET  /api/products/[slug]/reviews
  Returns all approved reviews for this product
  Public — no auth required

POST /api/products/[slug]/reviews
  Requires auth (CUSTOMER role)
  Validates: user has an order containing this product
  Body: { rating: number, title: string, body: string }
  Creates Review with isApproved: false
  Creates AdminNotification for review team
  Returns: { success: true }
```

---

### Admin notification on new review

When a new review is submitted, create an `AdminNotification`:

```typescript
await createAdminNotification({
  type: 'REVIEW_SUBMITTED',
  title: 'New review submitted',
  message: `${user.name} left a ${rating}-star review on ${product.name}`,
  link: '/admin/reviews',
  targetRoles: ['ADMIN', 'SUPER_ADMIN', 'CONTENT_MANAGER'],
})
```

---

## EXECUTION ORDER

1. Add `showOnHomepage` to Review schema → `prisma db push`
2. Build `/admin/reviews` page with toggles
3. Update seed to set `showOnHomepage: true` for demo reviews → `pnpm run seed:demo`
4. Build homepage testimonials section component
5. Wire testimonials to CMS (enabled/heading/subtitle)
6. Add testimonials section to homepage between Journey and PFA banner
7. Wire product page reviews display to real data
8. Build interactive star rating component
9. Build write-a-review form with purchase verification
10. Build `GET /api/products/[slug]/reviews` route
11. Build `POST /api/products/[slug]/reviews` route
12. Add admin notification on review submission
13. Add Reviews link to admin sidebar under Content
14. `pnpm exec tsc --noEmit` — must pass with zero errors
15. `pnpm run seed:demo` — reseed demo reviews
16. Commit and push

---

## COMPLETION CHECKLIST

- [ ] `showOnHomepage` field added to Review schema
- [ ] `/admin/reviews` page shows all reviews with toggles
- [ ] "Show on Homepage" toggle works and saves
- [ ] "Approved" toggle works and saves
- [ ] Homepage testimonials section shows 3 reviews
- [ ] Demo reviews (Sandra + Chisom) show on homepage
- [ ] Testimonials section hideable from admin CMS
- [ ] Product page shows approved reviews with ratings
- [ ] Average rating displayed correctly
- [ ] Review form shows only to clients who purchased
- [ ] Star selector works interactively
- [ ] Submitting a review creates pending review
- [ ] Toast confirmation shows after submission
- [ ] Admin gets notification of new review
- [ ] `pnpm build` passes with zero TypeScript errors

---

*Prepared by SonsHub Media Ltd for Prudential Atelier — prudentgabriel.com*
*₦7,500,000 engagement · Testimonials + Reviews Feature*
