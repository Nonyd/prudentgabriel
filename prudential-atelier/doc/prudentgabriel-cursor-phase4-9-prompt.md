# CURSOR AI — PRUDENTGABRIEL.COM
## Phase 4.9: Admin Dashboard Polish + Notifications + Consultation Measurements + Deposit Payment
### Prepared by SonsHub Media Ltd (Nony — Okafor Chinonso Daniel)

---

## CRITICAL INSTRUCTIONS

1. Read the entire prompt before writing any code.
2. Do not change any working payment flows unless explicitly instructed.
3. Run `pnpm exec tsc --noEmit` after each section.

---

## SECTION 1 — ADMIN DASHBOARD REDESIGN + TYPOGRAPHY

### Typography scale increase across all admin pages:

In `src/app/(admin)/admin/layout.tsx` or the admin global CSS:

```css
/* Admin-specific font sizes */
.admin-shell {
  font-size: 13px;  /* was 11-12px — increase base */
}

/* Sidebar navigation */
.admin-nav-item {
  font-size: 13px;     /* was 11px */
  font-weight: 400;
}

.admin-nav-section-label {
  font-size: 10px;     /* was 9px */
  letter-spacing: 0.2em;
}

/* Admin topbar */
.admin-topbar-title {
  font-size: 22px;     /* was 18px — Cormorant */
}

.admin-topbar-subtitle {
  font-size: 13px;     /* was 12px */
}

/* KPI card values */
.kpi-value {
  font-size: 32px;     /* was 26px — Cormorant */
}

.kpi-label {
  font-size: 11px;     /* was 9-10px */
  letter-spacing: 0.12em;
}

.kpi-trend {
  font-size: 11px;     /* was 9px */
}

/* Table text */
.admin-table td {
  font-size: 13px;     /* was 11-12px */
}

.admin-table th {
  font-size: 11px;     /* was 9-10px */
}

/* Panel titles */
.panel-title {
  font-size: 12px;     /* was 11px */
  letter-spacing: 0.1em;
}
```

Apply these increases globally across all admin components.

### Executive Dashboard redesign:

**Daily report banner:**
```
Background: #6B1C2A (deep wine)
Border-radius: 8px
Padding: 32px 40px

Left side:
  "DAILY REPORT · [DAY, DATE]"
  Jost 11px, cream at 70% opacity, letter-spacing 0.2em
  
  "Good evening, Nony."
  Cormorant Garamond 40px (increase from 32px), cream
  
  Summary line:
  "4 orders advanced · 0 deliveries today · 
  ₦3.2M received · 1 confirmation pending"
  Jost 14px (increase from 13px), cream at 80%

Right side:
  "↓ DOWNLOAD REPORT" button
  Border: 1px solid rgba(201,168,76,0.6) (gold)
  Color: rgba(201,168,76,0.9) (gold)
  Jost 11px, weight 600, uppercase, padding 12px 24px
```

**KPI cards row:**
Make cards taller and more spacious:
```
Padding: 24px (was 16-18px)
Min-height: 120px

Label row (top):
  Left: label text (Jost 11px uppercase)
  Right: icon in a 32x32px square with subtle bg

Value:
  Cormorant Garamond 36px (was 26px)
  margin-top: 12px

Trend:
  Jost 11px, margin-top: 6px
  Green arrow: ↑  Red arrow: ↓
```

**Revenue chart:**
```
Chart container min-height: 320px (was 280px)
Chart labels: Jost 12px (was 10px)
Legend: Jost 12px with larger colour squares
Tooltip: Jost 12px with proper padding
```

**Attendance panel:**
```
Staff name: Jost 14px (was 11px)
Status badge text: Jost 11px (was 9px)
Time text: Jost 12px (was 10px)
```

### Add "View Site" button to admin topbar:

In `AdminTopbar.tsx`, add a button to the right side 
next to the notification bell:

```tsx
// After notification bell, before user avatar:
<a
  href="/"
  target="_blank"
  rel="noopener noreferrer"
  className="..."
  title="View live site"
>
  <ExternalLink size={18} />
  <span>View Site</span>
</a>
```

Style:
- Jost 11px, weight 500, var(--text-mid)
- ExternalLink icon (Lucide) 16px
- Hover: color var(--choc)
- Sits between notification bell and user avatar
- On mobile: icon only (hide text label)

---

## SECTION 2 — NOTIFICATION BELL (WORKING)

The notification bell in the admin topbar must show real notifications and work properly.

### Bell indicator:
- Shows a red dot when there are unread notifications
- Number badge if count > 0 (show count up to 9, then "9+")
- Pulses subtly when new notification arrives

### Dropdown panel (opens on click):

```
┌─────────────────────────────────────────┐
│  Notifications              Mark all ✓  │
├─────────────────────────────────────────┤
│  [●] New consultation booked            │
│      Kemi Adesanya · 2 mins ago         │
├─────────────────────────────────────────┤
│  [●] Bank transfer receipt uploaded     │
│      Chisom Eze · ORD-2848 · 1hr ago   │
├─────────────────────────────────────────┤
│  [✓] Stage completed                   │
│      ORD-2847 · Tailoring · 3hrs ago   │
├─────────────────────────────────────────┤
│  [✓] Quote approved                    │
│      Ngozi Peters · QUO-001 · 1d ago   │
├─────────────────────────────────────────┤
│         View all notifications →        │
└─────────────────────────────────────────┘
```

Design:
- Panel: 380px wide, max-height 480px, scrollable
- Background: var(--ivory) light / var(--bg-card) dark
- Border: 0.5px solid var(--sand)
- Border-radius: 8px
- Box-shadow: 0 8px 32px rgba(0,0,0,0.12)
- Appears below the bell, right-aligned

Each notification row:
- Unread: left border 3px solid var(--nut), 
  background rgba(92,52,34,0.04)
- Read: no border, normal background
- Icon: 32px circle — colour by type:
  - Consultation: var(--lightbr) bg, calendar icon
  - Payment: green bg, credit card icon
  - Stage complete: var(--choc) bg, check icon
  - Quote: amber bg, file icon
  - Low stock: red bg, alert icon
- Title: Jost 13px, weight 500, var(--choc)
- Meta: Jost 11px, weight 300, var(--text-light)
- Click: marks as read + navigates to relevant page
- Hover: background rgba(152,117,91,0.06)

"Mark all read" button: top right, Jost 11px, var(--nut)

"View all notifications" link: bottom, centered, 
Jost 11px, var(--nut)

### Notifications page: `/admin/notifications`

Full page list of all notifications:
- Filter: All / Unread / By type
- Bulk "Mark all as read" button
- Each row: same design as dropdown but full width
- Pagination: 20 per page

### API routes (already exist from Phase 4 — verify and wire):

```
GET    /api/admin/notifications          
  Returns unread count + latest 10 notifications
  
PATCH  /api/admin/notifications/[id]/read
  Marks single notification as read

PATCH  /api/admin/notifications/read-all
  Marks all as read
```

### Auto-fetch:
Poll every 60 seconds for new notifications:
```typescript
// In AdminTopbar or a notifications context:
useEffect(() => {
  fetchNotifications()
  const interval = setInterval(fetchNotifications, 60000)
  return () => clearInterval(interval)
}, [])
```

Close dropdown when clicking outside (useClickOutside hook).

---

## SECTION 3 — MEASUREMENTS DURING CONSULTATION

### Where this appears:

In the consultation detail page at 
`/admin/consultations/[id]`, add a 
"Client Measurements" section.

Also in Stage 2 (Consultation Session) completion 
panel on the Atelier order detail page.

### Consultation Detail Page additions:

In `/admin/consultations/[id]` (or the consultation 
detail component), add a collapsible section:

```
CLIENT MEASUREMENTS
─────────────────────────────────────

[If client already has measurements saved:]
  Last updated: June 4, 2026
  
  Bust: 38"    Waist: 30"    Hips: 42"
  Length: 62"  Shoulder: 15"  Sleeve: 24"
  
  [Edit Measurements] button

[If no measurements saved yet:]
  "No measurements saved for this client."
  [Add Measurements] button

[Measurements form — shown on Edit/Add click:]

  Unit: ○ Inches  ● Centimetres
  
  Bust:         [____] 
  Waist:        [____]
  Hips:         [____]
  Shoulder:     [____]
  Sleeve:       [____]
  Dress Length: [____]
  Thigh:        [____]
  Inseam:       [____]
  Neck:         [____]
  Armhole:      [____]
  Notes:        [textarea]
  
  [Save Measurements]  [Cancel]
```

On save: `PATCH /api/clients/[clientId]/measurements`
This updates the client's `Measurement` record 
(or creates one if first time).

Show a success toast: "Measurements saved to 
[ClientName]'s profile"

### Stage 2 — Consultation Session stage completion:

In the stage completion panel for Stage 2 
(CONSULTATION_SESSION), add a measurements 
capture field:

```
Stage 2: Consultation Session

SESSION NOTES
Notes: [textarea — required]

CLIENT MEASUREMENTS (optional)
[Same measurements form as above]
"Capture measurements now to save a trip later"

Images: [upload]
Videos: [upload]

[MARK STAGE COMPLETE]
```

When admin marks Stage 2 complete:
1. Save the stage update (notes, media) as normal
2. If measurements were entered: save to client's 
   Measurement record
3. Fire the stage 2 email as normal

### API:
The existing `PATCH /api/clients/[clientId]/measurements` 
route should handle this. Verify it exists and works.

---

## SECTION 4 — PARTIAL PAYMENT (70% DEPOSIT) FOR ATELIER ORDERS

This applies ONLY to Atelier (bespoke) commission payments — not consultations, not RTW orders.

### Where it appears:

**Client-facing:** On the bespoke balance payment page 
at `/account/orders/bespoke/[orderId]/pay`

**Admin invoice:** When the Finance Manager sends an 
invoice for an Atelier commission

### Client payment page changes:

In `BespokePayClient.tsx` (or the bespoke payment page), 
replace the current "amount to pay" input with a 
structured payment option selector:

```
HOW WOULD YOU LIKE TO PAY?

○  Pay deposit (70%)
   ₦455,000
   "Begin your commission with a 70% deposit. 
    The remaining 30% (₦195,000) is due before delivery."

○  Pay in full (100%)
   ₦650,000
   "Pay the full amount now."

[If custom amount option needed:]
○  Custom amount
   [input field] — minimum ₦10,000
```

Design:
- Radio-style option cards
- Selected: border 1.5px solid var(--choc), 
  background rgba(68,41,19,0.04)
- Unselected: border 0.5px solid var(--sand)
- Price: Cormorant 28px, var(--choc)
- Description: Lora 13px, var(--text-mid)

The 70% calculation:
```typescript
const depositAmount = Math.round(order.balance * 0.7)
const fullAmount = order.balance
```

### Payment initialization change:

When "Pay deposit (70%)" is selected:
- Initialize payment for `depositAmount`
- On success: update `BespokeOrder.amountPaid += depositAmount`
- Update `BespokeOrder.balance -= depositAmount`
- Send email: "70% deposit received — your commission begins"

When "Pay in full" is selected:
- Initialize payment for `fullAmount` (existing logic)

### Invoice payment terms:

In the Invoice detail page and the PDF, add payment 
terms section showing:

```
PAYMENT TERMS

Option A: 70% Deposit
Pay ₦[70% amount] now to begin production.
Remaining ₦[30% amount] due before delivery.

Option B: Full Payment
Pay ₦[total] in full.

[PAY NOW] button links to /account/orders/bespoke/[id]/pay
```

### Admin invoice creation:

In `/admin/invoices/new` and the invoice editor, 
add a "Payment terms" field:

```
Payment Terms:
○ 70/30 Split (70% deposit, 30% on delivery)
○ Full payment required
○ Custom (free text)
```

This updates `Invoice.paymentTerms` field and 
displays on the invoice PDF.

---

## SECTION 5 — ADMIN SIDEBAR FONT IMPROVEMENTS

In `AdminSidebar.tsx`:

```typescript
// Navigation items — increase font size
className="... text-[13px] ..."  // was text-[11px]

// Section labels — increase slightly
className="... text-[10px] ..."  // was text-[9px]

// User name at bottom
className="... text-[13px] ..."  // was text-[11px]

// Role badge
className="... text-[10px] ..."  // was text-[8px]
```

Also fix: ensure the sidebar never gets cut off on 
shorter screen heights — make it scrollable:
```css
.admin-sidebar-nav {
  overflow-y: auto;
  flex: 1;
  scrollbar-width: none;  /* hide scrollbar */
}
```

---

## EXECUTION ORDER

1. Admin typography scale — increase all font sizes
2. Executive dashboard banner + KPI card redesign
3. Add "View Site" button to admin topbar
4. Wire notification bell dropdown + API polling
5. Build notifications full page
6. Add measurements section to consultation detail page
7. Add measurements to Stage 2 completion panel
8. Replace bespoke payment amount input with 
   70%/100% option cards
9. Update invoice payment terms field
10. Increase admin sidebar font sizes
11. `pnpm exec tsc --noEmit` — must pass
12. Push to GitHub

---

## COMPLETION CHECKLIST

- [ ] Admin dashboard fonts visibly larger and readable
- [ ] KPI values: Cormorant 36px (was 26px)
- [ ] "View Site" button in admin topbar — opens live site
- [ ] Notification bell shows unread count badge
- [ ] Notification dropdown opens with real notifications
- [ ] "Mark all read" clears the badge
- [ ] Clicking a notification navigates to relevant page
- [ ] Measurements form in consultation detail page
- [ ] Saving measurements updates client profile
- [ ] Stage 2 completion has optional measurements capture
- [ ] Atelier payment page shows 70% / 100% options
- [ ] 70% amount calculated correctly from balance
- [ ] Invoice has payment terms field
- [ ] Sidebar nav text is 13px (larger and readable)
- [ ] `pnpm build` passes with zero TypeScript errors

---

*Prepared by SonsHub Media Ltd for Prudential Atelier — prudentgabriel.com*
*₦7,500,000 engagement · Phase 4.9 of 5*
