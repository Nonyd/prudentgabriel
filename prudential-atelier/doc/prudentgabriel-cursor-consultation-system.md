# CURSOR AI — PRUDENTGABRIEL.COM
## Feature: Consultation System Redesign
### Prepared by SonsHub Media Ltd (Nony — Okafor Chinonso Daniel)

---

## CRITICAL INSTRUCTIONS

1. Read the entire prompt before writing any code.
2. Do not change any existing payment infrastructure.
3. All consultation prices are managed from the admin CMS — never hardcoded.
4. Run `pnpm exec tsc --noEmit` after each section.

---

## THE 4 CONSULTATION TYPES

Replace the current 3 consultation types with these 4:

| Key | Label | Format | Who |
|-----|-------|--------|-----|
| `PHYSICAL_PRUDENT_TEAM` | Physical — Mrs. Prudent Gabriel-Okopi & The Creative Team | In-person, Lagos Atelier | Mrs. Prudent leads, team present |
| `PHYSICAL_TEAM_ONLY` | Physical — The Creative Team | In-person, Lagos Atelier | Creative team only |
| `VIRTUAL_PRUDENT_TEAM` | Virtual — Mrs. Prudent Gabriel-Okopi & The Creative Team | Zoom / Google Meet / WhatsApp Video | Mrs. Prudent leads virtually |
| `VIRTUAL_TEAM_ONLY` | Virtual — The Creative Team | Zoom / Google Meet / WhatsApp Video | Creative team only |

For virtual types, client chooses platform at booking:
- Zoom
- Google Meet
- WhatsApp Video Call

---

## SECTION 1 — SCHEMA UPDATE

Update `ConsultationOffering` model (or equivalent) 
and `ConsultationBooking` model:

```prisma
// Update ConsultationOffering or SiteSetting-based offerings:
// The 4 types are stored as SiteSetting keys (see Section 3)
// No schema change needed for offerings

// Update ConsultationBooking:
model ConsultationBooking {
  // existing fields...
  
  // Update offeringType to support 4 types:
  offeringType  String  // PHYSICAL_PRUDENT_TEAM | PHYSICAL_TEAM_ONLY | 
                        // VIRTUAL_PRUDENT_TEAM | VIRTUAL_TEAM_ONLY
  
  // Virtual consultation fields:
  virtualPlatform  String?  // 'zoom' | 'google_meet' | 'whatsapp_video'
  meetingLink      String?  // pasted by Creative Manager in admin
  meetingLinkSentAt DateTime?  // when the link email was sent
  
  // Session management:
  sessionNotes     String?  @db.Text
  moodboardImages  String[] // Cloudinary URLs uploaded after session
  moodboardNotes   String?  @db.Text
  
  // Confirmation flow:
  confirmedAt      DateTime?
  confirmedBy      String?  // admin userId who confirmed
  
  // Status should include these values:
  // PENDING_PAYMENT → CONFIRMED → SCHEDULED → 
  // IN_SESSION → COMPLETED → CANCELLED
}
```

Run `prisma db push` after.

---

## SECTION 2 — PUBLIC CONSULTATION PAGE (`/consultation`)

### Update the 3-step wizard to 4 consultation types:

**Step 1 — Choose consultation type:**

Replace the 3 cards with 4 cards in a 2×2 grid:

```
┌──────────────────────────┐  ┌──────────────────────────┐
│  PHYSICAL                │  │  PHYSICAL                │
│                          │  │                          │
│  Mrs. Prudent            │  │  The Creative Team       │
│  Gabriel-Okopi &         │  │                          │
│  The Creative Team       │  │  Work with our senior    │
│                          │  │  designers in our Lagos  │
│  A private session led   │  │  atelier.                │
│  by Mrs. Prudent         │  │                          │
│  herself.                │  │  ✓ Senior design team    │
│                          │  │  ✓ In-atelier fabric     │
│  ✓ Led by Mrs. Prudent   │  │    viewing               │
│  ✓ Full creative team    │  │  ✓ Up to 60 minutes      │
│  ✓ Premium fabric access │  │                          │
│  ✓ Up to 90 minutes      │  │  ₦[CMS price]            │
│                          │  │  SELECT                  │
│  ₦[CMS price]            │  └──────────────────────────┘
│  SELECT                  │
└──────────────────────────┘

┌──────────────────────────┐  ┌──────────────────────────┐
│  VIRTUAL                 │  │  VIRTUAL                 │
│                          │  │                          │
│  Mrs. Prudent            │  │  The Creative Team       │
│  Gabriel-Okopi &         │  │                          │
│  The Creative Team       │  │  Connect with our        │
│                          │  │  designers from anywhere.│
│  Meet virtually with     │  │                          │
│  Mrs. Prudent from       │  │  ✓ Senior design team    │
│  anywhere.               │  │  ✓ Screen-shared         │
│                          │  │    lookbook              │
│  ✓ Led by Mrs. Prudent   │  │  ✓ Up to 45 minutes      │
│  ✓ Full creative team    │  │                          │
│  ✓ Screen-shared         │  │  ₦[CMS price]            │
│    lookbook              │  │  SELECT                  │
│  ✓ Up to 60 minutes      │  └──────────────────────────┘
│                          │
│  ₦[CMS price]            │
│  SELECT                  │
└──────────────────────────┘
```

**Physical types** (PHYSICAL_PRUDENT_TEAM, PHYSICAL_TEAM_ONLY):
- No platform selector needed
- Location: "Lagos Atelier" shown on card

**Virtual types** (VIRTUAL_PRUDENT_TEAM, VIRTUAL_TEAM_ONLY):
- After selecting, show platform selector:
```
CHOOSE YOUR PLATFORM

○ [Zoom icon]         Zoom
○ [Meet icon]         Google Meet  
○ [WhatsApp icon]     WhatsApp Video Call

"A link will be sent to you 1 hour before your session."
```

**Step 2 — Schedule:**
Same calendar/time slot picker as before.
No changes needed here.

**Step 3 — Confirm & Pay:**
Show summary:
- Consultation type (with icon: 🏛 Physical / 💻 Virtual)
- Platform (if virtual): "Via [Zoom/Meet/WhatsApp]"
- Date and time
- Price in selected currency
- Payment method selector

---

## SECTION 3 — CMS PRICING (Admin)

All 4 consultation prices managed from admin CMS.

In `/admin/content/pages` → **Consultation** page,
update the consultation fields:

```
CONSULTATION TYPES
──────────────────────────────────────────

Physical — Mrs. Prudent + Creative Team
  Title: [input]
  Description: [textarea]
  Features: [dynamic list — add/remove]
  Duration: [input] e.g. "Up to 90 minutes"
  Price (NGN): [number input]
  Price (USD): [number input]
  Price (GBP): [number input]
  Enabled: [toggle]

Physical — Creative Team Only
  [same fields]

Virtual — Mrs. Prudent + Creative Team
  [same fields]

Virtual — Creative Team Only
  [same fields]

[SAVE CONSULTATION TYPES]
```

Saves to SiteSetting keys:
```
consultation_type_physical_prudent_title
consultation_type_physical_prudent_description
consultation_type_physical_prudent_features  (JSON array)
consultation_type_physical_prudent_duration
consultation_type_physical_prudent_price_ngn
consultation_type_physical_prudent_price_usd
consultation_type_physical_prudent_price_gbp
consultation_type_physical_prudent_enabled

consultation_type_physical_team_title
consultation_type_physical_team_*  (same pattern)

consultation_type_virtual_prudent_*  (same pattern)
consultation_type_virtual_team_*  (same pattern)
```

Default prices (overridable from CMS):
- Physical + Mrs. Prudent: ₦150,000
- Physical + Team Only: ₦75,000
- Virtual + Mrs. Prudent: ₦60,000
- Virtual + Team Only: ₦40,000

---

## SECTION 4 — CONSULTATION BOOKING FLOW

### On successful payment:

1. Create `ConsultationBooking` with status `CONFIRMED`
2. Set `offeringType`, `virtualPlatform` (if virtual)
3. Auto-onboard client (existing logic)
4. Send booking confirmation email to client
5. Send notification to admin:
   - If type includes Mrs. Prudent: send special notification
     ```
     type: CONSULTATION_BOOKED_PRUDENT
     title: "New consultation — Mrs. Prudent requested"
     message: "[Name] booked a [type] consultation"
     ```
   - All types: send general notification to Creative Manager

### Consultation confirmation email to client:

```
Subject: "Consultation confirmed — Prudential Atelier"

Hi [Name],

Your consultation has been confirmed.

TYPE: [Physical/Virtual] with [Mrs. Prudent + Creative Team / 
      The Creative Team]
[If virtual]: PLATFORM: [Zoom / Google Meet / WhatsApp Video]
DATE: [Date]
TIME: [Time]
[If virtual]: "Your meeting link will be sent 1 hour before 
               your session."
[If physical]: "Our Lagos Atelier is located at:
               14 Bode Thomas Street, Surulere, Lagos."

Your reference: [bookingRef]

We look forward to meeting you.

— Prudential Atelier
```

---

## SECTION 5 — ADMIN CONSULTATION DETAIL PAGE

Fix the current page error (TypeError: d is not a function)
AND redesign the page to support the new flow.

**Route:** `/admin/consultations/[id]`

### Fix the date error first:

In the consultation detail page and all child components,
wrap ALL date fields with `new Date()` before using 
any Date methods:

```typescript
// WRONG — causes "d is not a function":
booking.scheduledAt.toLocaleDateString()
booking.createdAt.toLocaleTimeString()
format(booking.scheduledAt, 'PPP')

// CORRECT:
new Date(booking.scheduledAt).toLocaleDateString()
new Date(booking.createdAt).toLocaleTimeString()
format(new Date(booking.scheduledAt), 'PPP')
```

Search these files:
- `src/app/(admin)/admin/consultations/[id]/page.tsx`
- Any `ConsultationDetail*.tsx` component
- Any component receiving `ConsultationBooking` as props

### Redesigned consultation detail page:

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Consultations                                    │
│                                                             │
│  CONSULTATION                                               │
│  CB-2026-0042                    [CONFIRMED ▾] status pill  │
├──────────────────────────┬──────────────────────────────────┤
│  CLIENT                  │  SESSION DETAILS                 │
│  Kemi Adesanya           │  Type: Virtual — Creative Team   │
│  kemi@gmail.com          │  Platform: Zoom                  │
│  +234 803 456 7890       │  Date: Friday, June 13, 2026     │
│                          │  Time: 10:00 AM                  │
│  [View client profile →] │  Duration: Up to 45 minutes      │
│                          │                                  │
│  OCCASION                │  PAYMENT                        │
│  "30th birthday          │  Amount: ₦40,000                │
│   celebration outfit"    │  Status: PAID ✓                 │
│                          │  Method: Paystack               │
│                          │  Paid: June 5, 2026             │
├──────────────────────────┴──────────────────────────────────┤
│                                                             │
│  VIRTUAL MEETING LINK                                       │
│  (only shown for virtual consultations)                     │
│                                                             │
│  [If no link sent yet:]                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Paste meeting link:                                 │   │
│  │  [https://zoom.us/j/____________]                   │   │
│  │                                                     │   │
│  │  [SEND LINK TO CLIENT →]                           │   │
│  │  This will email the link to [email]               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [If link already sent:]                                    │
│  ✓ Link sent on June 13, 2026 at 9:00 AM                  │
│  https://zoom.us/j/1234567890                              │
│  [Resend link] [Change link]                               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  SESSION NOTES & MOODBOARD                                 │
│                                                             │
│  [If session not yet completed:]                            │
│  "Complete after the consultation session."                 │
│                                                             │
│  [If session completed or in progress:]                     │
│  Session notes:                                             │
│  [textarea — saved on blur or with Save button]            │
│                                                             │
│  Moodboard / Reference images:                             │
│  [Upload images] — Cloudinary, multiple files              │
│  [Grid of uploaded images with × to remove]               │
│                                                             │
│  Moodboard notes:                                           │
│  [textarea]                                                 │
│                                                             │
│  [SAVE SESSION NOTES]                                      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ACTIONS                                                    │
│                                                             │
│  Status: [CONFIRMED ▾]                                     │
│  Options: Confirmed → Scheduled → In Session →             │
│           Completed → Cancelled                            │
│                                                             │
│  [When status → COMPLETED:]                                │
│  "Mark as complete" triggers:                               │
│  1. Saves session notes and moodboard                      │
│  2. Fires review request email to client                   │
│  3. Creates stage update if linked to bespoke order        │
│                                                             │
│  [MARK AS COMPLETED]  [CANCEL BOOKING]                     │
│                                                             │
│  Internal notes (admin only):                              │
│  [textarea]  [Save notes]                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## SECTION 6 — SEND MEETING LINK API

```
POST /api/admin/consultations/[id]/send-link
Body: { meetingLink: string }

1. Validate: meetingLink is a valid URL
2. Save to ConsultationBooking.meetingLink
3. Set ConsultationBooking.meetingLinkSentAt = now()
4. Send email to client:
```

**Meeting link email:**
```
Subject: "Your consultation link — Prudential Atelier"

Hi [Name],

Your [Zoom / Google Meet / WhatsApp Video] consultation 
is coming up soon.

DATE: [Date]
TIME: [Time]

JOIN HERE:
[large button] → [meeting link]

[If WhatsApp]: 
"Click the button above to start the WhatsApp video call 
at your scheduled time."

[If Zoom/Meet]:
"Click the button above to join your consultation at 
the scheduled time."

See you soon,
— Prudential Atelier
```

---

## SECTION 7 — SAVE SESSION NOTES API

```
PATCH /api/admin/consultations/[id]/session
Body: { 
  sessionNotes?: string
  moodboardImages?: string[]  // Cloudinary URLs
  moodboardNotes?: string
  status?: string
}

Updates ConsultationBooking with the provided fields.
If status === 'COMPLETED':
  - Fire review request email to client
  - Create AdminNotification for General Admin
```

---

## SECTION 8 — CLIENT DASHBOARD UPDATE

When a client has a consultation booking, their 
dashboard should show the moodboard uploaded by 
the creative team after the session:

In `/account` → Moodboards section:

```
YOUR MOODBOARD
──────────────────────────────────────

Consultation: June 13, 2026
With: The Creative Team

[Image grid — 2×3, shows moodboard images]

Moodboard notes:
"[notes from creative team]"

[Download moodboard]
```

Show immediately after Creative Manager saves — 
no approval step needed.

---

## SECTION 9 — CONSULTATION LIST PAGE UPDATE

In `/admin/consultations`, update the table to 
show the new consultation types:

**Type column:**
- Physical + Mrs. P: 🏛 "Physical · Mrs. Prudent + Team"
- Physical + Team: 🏛 "Physical · Creative Team"
- Virtual + Mrs. P: 💻 "Virtual · Mrs. Prudent + Team"
- Virtual + Team: 💻 "Virtual · Creative Team"

**Platform column (virtual only):**
- Show Zoom / Meet / WhatsApp icon

**Alert banner at top:**
If any virtual consultation is within 2 hours 
and meeting link has not been sent:
```
⚠ 1 virtual consultation in 2 hours — meeting link not sent
[Send link →]
```

---

## EXECUTION ORDER

1. Fix date serialization error on `/admin/consultations/[id]`
2. Update schema (virtualPlatform, meetingLink, moodboardImages etc.) → `prisma db push`
3. Update public `/consultation` page to show 4 types in 2×2 grid
4. Add platform selector for virtual types
5. Update CMS consultation pricing section
6. Redesign admin consultation detail page
7. Build `POST /api/admin/consultations/[id]/send-link`
8. Build `PATCH /api/admin/consultations/[id]/session`
9. Update client dashboard moodboard section
10. Update consultation list page with new type display
11. Add alert banner for unsent virtual links
12. Update seed data to use new consultation types
13. `pnpm exec tsc --noEmit` — must pass
14. Commit and push

---

## COMPLETION CHECKLIST

- [ ] Date error on consultation detail page fixed
- [ ] 4 consultation types show on public /consultation page
- [ ] 2×2 grid layout on desktop
- [ ] Platform selector shows for virtual types
- [ ] Prices load from CMS (not hardcoded)
- [ ] Admin can update all 4 consultation prices from CMS
- [ ] Consultation booking confirmation email mentions platform
- [ ] Mrs. Prudent gets special notification for her bookings
- [ ] Admin consultation detail page loads without error
- [ ] "Send meeting link" form works for virtual consultations
- [ ] Meeting link email sends to client
- [ ] Session notes save correctly
- [ ] Moodboard images upload via Cloudinary
- [ ] Client sees moodboard in their dashboard after upload
- [ ] Status can be updated through full flow
- [ ] "Mark as completed" triggers review request email
- [ ] Consultation list shows correct type labels
- [ ] Alert for unsent virtual links within 2 hours
- [ ] `pnpm build` passes with zero TypeScript errors

---

*Prepared by SonsHub Media Ltd for Prudential Atelier — prudentgabriel.com*
*₦7,500,000 engagement · Consultation System Redesign*
