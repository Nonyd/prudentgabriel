# CURSOR AI — PRUDENTGABRIEL.COM
## Feature: Manual Testimonial Creation from Admin Dashboard
### Prepared by SonsHub Media Ltd (Nony — Okafor Chinonso Daniel)

---

## CRITICAL INSTRUCTIONS

1. Read the entire prompt before writing any code.
2. Do not modify the existing testimonial submission flow from the client dashboard.
3. This adds admin-side manual creation only.
4. Run `pnpm exec tsc --noEmit` after all changes.

---

## SCHEMA UPDATE

Update the `Testimonial` model in `prisma/schema.prisma` to support anonymous testimonials:

```prisma
model Testimonial {
  id          String   @id @default(cuid())

  // Make userId optional — anonymous testimonials have no userId
  userId      String?
  user        User?    @relation(fields: [userId], references: [id])

  // For anonymous / manually added testimonials
  displayName String?  // e.g. "Chidinma E." — shown when no userId
  location    String?  // e.g. "Lagos, Nigeria" — shown instead of tier badge

  body        String
  rating      Int      // 1–5

  clientImage String?  // uploaded by client
  adminImage  String?  // uploaded/replaced by admin

  isApproved      Boolean @default(false)
  showOnHomepage  Boolean @default(false)

  productContext  String?  // e.g. "Custom Asoebi Gown"
  orderContext    String?  // e.g. "Atelier Commission"

  // Source tracking
  source      String @default("CLIENT")  // "CLIENT" or "ADMIN"

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([isApproved, showOnHomepage])
}
```

Run `prisma db push` after updating.

---

## ADMIN UI — "+ Add Testimonial" BUTTON

In `/admin/reviews` → **Testimonials tab**, add a
**"+ Add Testimonial"** button in the top-right corner
(same position as other "New" buttons across the admin).

Style:
- Background: `var(--choc)`, color: `var(--cream)`
- Jost 11px, weight 600, uppercase
- Padding: 10px 20px, border-radius: 3px

---

## MODAL: CREATE / EDIT TESTIMONIAL

Opens as a modal overlay (not a new page).
Modal width: 560px, max-height: 90vh, scrollable.

```
┌─────────────────────────────────────────────────────┐
│  ADD TESTIMONIAL                              [×]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  CLIENT                                             │
│  ○ Existing client   ○ Anonymous / manual entry    │
│                                                     │
│  [If "Existing client" selected:]                  │
│  Search client: [________________________]          │
│  Type name or email — shows dropdown with          │
│  avatar + name + loyalty tier badge                │
│                                                     │
│  [If "Anonymous" selected:]                        │
│  Display name: [________________________]           │
│  e.g. "Chidinma E."                                │
│  Location (optional): [________________________]    │
│  e.g. "Lagos, Nigeria"                             │
│                                                     │
│  RATING                                             │
│  [★ ★ ★ ★ ★]  ← clickable gold stars              │
│                                                     │
│  TESTIMONIAL                                        │
│  [______________________________________________]   │
│  [______________________________________________]   │
│  [______________________________________________]   │
│  [______________________________________________]   │
│  min 30 / max 600 chars    Character counter        │
│                                                     │
│  CONTEXT (optional)                                 │
│  Product / piece:  [________________________]       │
│  e.g. "Custom Asoebi Gown"                         │
│  Order type:       [________________________]       │
│  e.g. "Atelier Commission"                         │
│                                                     │
│  PHOTO (optional)                                   │
│  [Upload photo]  ← Cloudinary upload               │
│  Accepted: JPG, PNG · Max 5MB                      │
│  [Preview thumbnail if uploaded]                   │
│                                                     │
│  STATUS                                             │
│  Approved:         [toggle — default ON]            │
│  Show on homepage: [toggle — default OFF]           │
│                                                     │
│  ─────────────────────────────────────────────     │
│  [SAVE TESTIMONIAL]              [Cancel]           │
└─────────────────────────────────────────────────────┘
```

### Client search dropdown:

When typing in the client search field, call:
`GET /api/admin/clients/search?q=[query]`

Returns: `{ id, name, email, image, clientProfile: { loyaltyTier } }`

Dropdown item:
```
[Avatar initials circle]  Name
                          email · GOLD tier
```

On select: store `userId`, clear `displayName` and `location`.

### Star rating selector:

Same interactive gold star component used elsewhere.
All 5 stars clickable. Selected stars fill `#C9A84C`.
Minimum 1 star required.

### Validation:

- Rating: required
- Body: required, 30–600 chars
- If "Existing client": userId required (must select from search)
- If "Anonymous": displayName required (min 2 chars)
- Photo: optional

---

## API ROUTE: CREATE TESTIMONIAL (Admin)

```
POST /api/admin/testimonials
```

Access: `SUPER_ADMIN` and `ADMIN` roles only.

```typescript
// Body:
{
  userId?: string
  displayName?: string
  location?: string
  body: string
  rating: number
  adminImage?: string
  productContext?: string
  orderContext?: string
  isApproved: boolean
  showOnHomepage: boolean
}

// Logic:
// 1. Validate role (ADMIN or SUPER_ADMIN only)
// 2. Validate required fields
// 3. Create Testimonial with source: "ADMIN"
// 4. Return created testimonial

const testimonial = await prisma.testimonial.create({
  data: {
    userId: userId || null,
    displayName: displayName || null,
    location: location || null,
    body,
    rating,
    adminImage: adminImage || null,
    productContext: productContext || null,
    orderContext: orderContext || null,
    isApproved,
    showOnHomepage,
    source: 'ADMIN',
  }
})

return NextResponse.json({ success: true, testimonial })
```

---

## API ROUTE: UPDATE TESTIMONIAL (Admin)

```
PATCH /api/admin/testimonials/[id]
```

Same body as create — updates all fields.
Used by the Edit action on each row.

---

## ADMIN TABLE UPDATE

In the Testimonials tab, update the table:

### New "Source" column:

Between "Client" and "Rating" columns:

- If `testimonial.source === 'CLIENT'`:
  Show green pill: "CLIENT"
  
- If `testimonial.source === 'ADMIN'`:
  Show amber pill: "MANUAL"

Pill style:
- CLIENT: `background: rgba(34,197,94,0.1)`, `color: #166534`, Jost 9px uppercase
- MANUAL: `background: rgba(245,158,11,0.1)`, `color: #92400e`, Jost 9px uppercase

### New "Edit" action:

Add "Edit" button to the Actions column (alongside existing approve/delete).

On click: opens the same modal pre-filled with existing testimonial data.
When editing: show "UPDATE TESTIMONIAL" as the modal title and button label.

---

## DISPLAY LOGIC UPDATE — Homepage Testimonials

When rendering testimonials on the homepage carousel,
handle both linked and anonymous testimonials:

```typescript
// In HomeTestimonialsCarousel or the server fetch:

function getDisplayName(testimonial: Testimonial & { user?: User }): string {
  if (testimonial.user?.name) {
    // Show first name + last initial for privacy
    const parts = testimonial.user.name.split(' ')
    return parts.length > 1 
      ? `${parts[0]} ${parts[parts.length - 1][0]}.`
      : parts[0]
  }
  return testimonial.displayName || 'Valued Client'
}

function getSubLabel(testimonial: Testimonial & { 
  user?: { clientProfile?: { loyaltyTier?: string } } 
}): string {
  if (testimonial.user?.clientProfile?.loyaltyTier) {
    const tier = testimonial.user.clientProfile.loyaltyTier
    const context = testimonial.productContext || testimonial.orderContext
    return context 
      ? `${tier} member · ${context}`
      : `${tier} member`
  }
  if (testimonial.location) {
    const context = testimonial.productContext || testimonial.orderContext
    return context 
      ? `${testimonial.location} · ${context}`
      : testimonial.location
  }
  return testimonial.productContext || testimonial.orderContext || ''
}

function getDisplayImage(testimonial: Testimonial & { user?: User }): string | null {
  return testimonial.adminImage 
    || testimonial.clientImage 
    || testimonial.user?.image 
    || null  // null → show initials avatar
}
```

For anonymous testimonials (no userId):
- Avatar: show a "P" monogram (for Prudential) on `var(--lightbr)` background
  instead of client initials
- Sub-label: show `location · productContext` 
  instead of tier badge

---

## COMPLETION CHECKLIST

- [ ] `Testimonial.userId` is now optional (nullable)
- [ ] `Testimonial.displayName` and `Testimonial.location` fields added
- [ ] `Testimonial.source` field added (`CLIENT` or `ADMIN`)
- [ ] `prisma db push` succeeds
- [ ] "+ Add Testimonial" button appears in admin Testimonials tab
- [ ] Modal opens on button click
- [ ] Client search works (existing clients searchable by name/email)
- [ ] Anonymous mode works (displayName required)
- [ ] Star rating selector works
- [ ] Photo upload saves to Cloudinary → sets adminImage
- [ ] Approved and Show on Homepage toggles work
- [ ] Testimonial saved via `POST /api/admin/testimonials`
- [ ] "Source" column shows CLIENT or MANUAL pill
- [ ] "Edit" button opens modal pre-filled with existing data
- [ ] `PATCH /api/admin/testimonials/[id]` updates correctly
- [ ] Homepage carousel shows anonymous testimonials correctly
- [ ] Anonymous: "P" monogram avatar + location as sub-label
- [ ] Linked client: initials avatar + tier badge + product context
- [ ] `pnpm exec tsc --noEmit` passes with zero errors
- [ ] Committed and pushed

---

*Prepared by SonsHub Media Ltd for Prudential Atelier — prudentgabriel.com*
*₦7,500,000 engagement · Admin Manual Testimonial Creation*
