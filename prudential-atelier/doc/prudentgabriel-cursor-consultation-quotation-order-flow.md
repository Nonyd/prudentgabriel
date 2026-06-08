# CURSOR AI — PRUDENTGABRIEL.COM
## Feature: Consultation → Quotation → Atelier Order Flow
### Prepared by SonsHub Media Ltd (Nony — Okafor Chinonso Daniel)

---

## CRITICAL INSTRUCTIONS

1. Read the entire prompt before writing any code.
2. Do not change any existing payment flows.
3. Do not change the quotation or invoice models — only extend them.
4. Run `pnpm exec tsc --noEmit` after each section.

---

## THE COMPLETE FLOW

```
Consultation COMPLETED
        ↓
Admin clicks "Create Quotation" on consultation detail
  OR searches consultation ref on /admin/invoices/new
        ↓
Quotation pre-filled with consultation data
Admin adds line items + price → saves
        ↓
Admin sends quotation to client
Client gets quotation email with approval link
        ↓
Client approves online → admin notified
        ↓
Quote converts to Invoice (auto or manual)
        ↓
Invoice sent to client
        ↓
Client pays (70% deposit or full)
        ↓
Atelier Order created — linked to consultation + invoice
All consultation context visible throughout 13 stages
        ↓
13-stage production pipeline begins
```

---

## SECTION 1 — SCHEMA ADDITIONS

Add to existing models:

```prisma
// Add to Quotation model:
consultationId  String?
consultation    ConsultationBooking? @relation(fields: [consultationId], references: [id])

// Add to BespokeOrder model (if not already present):
consultationId  String?
consultation    ConsultationBooking? @relation(fields: [consultationId], references: [id])
sessionNotes    String?  @db.Text  // copied from consultation
moodboardImages String[]           // copied from consultation
occasionDetails String?            // copied from consultation
outfitBrief     String?  @db.Text  // outfit description from session
```

Add relations to `ConsultationBooking`:
```prisma
// Add to ConsultationBooking:
quotations   Quotation[]
bespokeOrders BespokeOrder[]
```

Run `prisma db push` after.

---

## SECTION 2 — "CREATE QUOTATION" BUTTON ON CONSULTATION DETAIL

In `AdminConsultationDetail.tsx` and 
`/admin/consultations/[id]` page:

Show a **"Create Quotation"** button when:
- `consultation.status === 'COMPLETED'`
- No existing quotation linked to this consultation yet
  (check `consultation.quotations.length === 0`)

If a quotation already exists:
Show: "Quotation [ref] created → [View Quotation]" 
with a link instead of the button.

### Button design:
```
[+ CREATE QUOTATION]
```
- var(--choc) background, var(--cream) text
- Jost 11px, weight 600, uppercase
- Positioned in the ACTIONS section of the detail page

### On click:
Navigate to:
```
/admin/invoices/quotations/new?consultationId=[id]
```

This opens the new quotation page pre-filled with 
consultation data (see Section 3).

---

## SECTION 3 — NEW QUOTATION PAGE WITH CONSULTATION LINK

### Route: `/admin/invoices/quotations/new`

Query params: `?consultationId=[id]` (optional)

### When `consultationId` is present:

On page load, fetch the consultation:
```typescript
const consultation = await prisma.consultationBooking.findUnique({
  where: { id: consultationId },
  include: {
    user: {
      include: { clientProfile: true }
    }
  }
})
```

Pre-fill the quotation form:

**Client section:**
- Client: auto-selected from `consultation.user`
- If no linked user: use `consultation.clientName` + `consultation.clientEmail`

**Quotation details:**
- Title: `"Atelier Commission — [occasion]"` 
  e.g. "Atelier Commission — December Wedding"
- Description: pulled from `consultation.sessionNotes`
- Occasion: from `consultation.occasion`
- Reference images: show moodboard thumbnails from 
  `consultation.moodboardImages` (read-only display)
- Linked consultation badge: 
  `"Linked to consultation [bookingRef]"` 
  — small pill in var(--lightbr) colour

**Line items:**
Admin types in the pricing. Suggested starting items:
- "Design & Construction" — price: 0 (admin fills)
- "Fabric & Materials" — price: 0 (admin fills)
- "Beading & Embellishment" — price: 0 (admin fills)

Admin can add/remove/edit line items as usual.

### Consultation search on quotation page:

In the quotation form, add a 
**"Link to consultation"** search field:

```
LINK CONSULTATION (optional)
──────────────────────────────
Consultation ref: [________________________]
                  e.g. DEMO-CB-004

[SEARCH]

[If found:]
✓ Found: Aisha Mohammed — Bridal Consultation
  Completed: June 5, 2026
  Session notes: "Client wants a full-length..."
  [Link this consultation]

[If not found:]
✗ No consultation found with that reference.
```

When admin links a consultation:
- Auto-fills client, occasion, description
- Shows moodboard images as reference
- Records `consultationId` on the quotation

This works for the manual flow (admin starts from 
`/admin/invoices/quotations/new` without the 
`?consultationId` param).

---

## SECTION 4 — QUOTATION TO ATELIER ORDER: CARRY CONSULTATION CONTEXT

When a quotation converts to an Atelier order
(whether auto-convert or manual "Convert to Order"):

Copy consultation context into the new `BespokeOrder`:

```typescript
// In the quote conversion function:
const consultation = await prisma.consultationBooking.findUnique({
  where: { id: quotation.consultationId },
})

const bespokeOrder = await prisma.bespokeOrder.create({
  data: {
    // ... existing fields ...
    consultationId: quotation.consultationId ?? null,
    sessionNotes: consultation?.sessionNotes ?? null,
    moodboardImages: consultation?.moodboardImages ?? [],
    occasionDetails: consultation?.occasion ?? null,
    outfitBrief: consultation?.sessionNotes ?? null,
    // Client details from consultation if no linked user:
    clientName: consultation?.clientName ?? user.name,
    clientEmail: consultation?.clientEmail ?? user.email,
  }
})
```

---

## SECTION 5 — CONSULTATION CONTEXT VISIBLE IN ATELIER PIPELINE

In the Atelier order detail page 
(`/admin/bespoke/[orderId]` or equivalent):

Add a **"Consultation Brief"** section at the top 
of the order detail, above the stage pipeline:

```
┌─────────────────────────────────────────────────────────┐
│  CONSULTATION BRIEF                                     │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Linked consultation: [bookingRef]  [View →]           │
│  Occasion: December Wedding, Lagos                      │
│                                                         │
│  OUTFIT BRIEF                                           │
│  "Client wants a full-length Asoebi gown in            │
│   burgundy Aso-Oke with corset bodice and              │
│   layered skirt. Beading on the neckline."             │
│                                                         │
│  MOODBOARD REFERENCE                                    │
│  [Image 1] [Image 2] [Image 3] [Image 4]              │
│  (click to enlarge)                                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Design:**
- Background: `rgba(152,117,91,0.06)` (subtle warm tint)
- Border: `0.5px solid var(--sand)`
- Border-radius: 6px
- Padding: 20px 24px
- Section heading: Jost 10px, uppercase, var(--lightbr)
- Outfit brief: Lora 14px italic, var(--text-mid)
- Moodboard images: 80px × 80px squares, 
  border-radius 4px, overflow hidden, cursor pointer
- Lightbox on image click

**Only shown if `bespokeOrder.consultationId` is set.**

Also make this visible to the **assigned staff** 
in their staff portal order detail page:

In `/staff/orders/[orderId]`:
- Show outfit brief (read-only)
- Show moodboard images (read-only)
- Show occasion details
- Do NOT show client contact details
- Do NOT show financial information

---

## SECTION 6 — CLIENT DASHBOARD: CONSULTATION CONTEXT IN ORDERS

In the client's `/account` → active commission view:

If the commission has a linked consultation,
show a "Your Brief" section above the stage tracker:

```
YOUR BRIEF
─────────────────────────────────────

Occasion: December Wedding, Lagos

What you shared with us:
"Full-length Asoebi gown in burgundy Aso-Oke 
 with corset bodice and layered skirt..."

YOUR MOODBOARD
[Image 1] [Image 2] [Image 3]
[View full moodboard →]
```

This reassures the client their vision was captured
and will be followed throughout production.

---

## SECTION 7 — QUOTATION EMAIL UPDATE

The existing quotation email should include 
the consultation context when linked:

In the quote-for-approval email 
(`QuotationEmail` or equivalent):

Add a section when `quotation.consultationId` exists:

```
BASED ON YOUR CONSULTATION

We've prepared this quotation based on your 
[consultation type] on [consultation date].

YOUR OUTFIT BRIEF:
"[sessionNotes excerpt — first 200 chars]"

[View your moodboard →]
```

---

## SECTION 8 — ADMIN CONSULTATION LIST: QUOTATION STATUS

In `/admin/consultations` table, add a 
**"Quotation"** column:

| Status | Display |
|--------|---------|
| No quotation created | "—" |
| Quotation created (draft) | "Draft [QUO-001]" amber |
| Quotation sent | "Sent [QUO-001]" blue |
| Quotation approved | "Approved ✓" green |
| Converted to order | "Order [ORD-XXXX]" dark |

This gives Mrs. Prudent a quick view of where 
each consultation is in the pipeline.

---

## EXECUTION ORDER

1. Schema additions → `prisma db push`
2. Add "Create Quotation" button to consultation detail
3. Build new quotation page with consultation pre-fill
4. Add consultation search field to quotation form
5. Update quote-to-order conversion to carry context
6. Add "Consultation Brief" section to atelier order detail
7. Add brief + moodboard to staff portal order view
8. Add "Your Brief" section to client dashboard order view
9. Update quotation email to include consultation context
10. Add quotation status column to consultations list
11. `pnpm exec tsc --noEmit` — must pass
12. Commit and push

---

## COMPLETION CHECKLIST

- [ ] Schema additions pushed to Neon
- [ ] "Create Quotation" button shows on completed consultations
- [ ] Clicking button opens pre-filled quotation form
- [ ] Client, occasion, notes auto-filled from consultation
- [ ] Moodboard images shown as reference on quotation form
- [ ] Consultation search works on quotation form
- [ ] Quote conversion copies consultation context to order
- [ ] "Consultation Brief" section shows on atelier order detail
- [ ] Moodboard images visible and clickable in order detail
- [ ] Staff portal shows outfit brief and moodboard (no financial data)
- [ ] Client dashboard shows "Your Brief" on active commission
- [ ] Quotation email includes consultation context when linked
- [ ] Consultations list shows quotation status column
- [ ] `pnpm build` passes with zero TypeScript errors

---

*Prepared by SonsHub Media Ltd for Prudential Atelier — prudentgabriel.com*
*₦7,500,000 engagement · Consultation → Quotation → Atelier Order Flow*
