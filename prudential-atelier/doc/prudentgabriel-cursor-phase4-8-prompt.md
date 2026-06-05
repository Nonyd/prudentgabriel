# CURSOR AI — PRUDENTGABRIEL.COM
## Phase 4.8: Client Dashboard Redesign
### Prepared by SonsHub Media Ltd (Nony — Okafor Chinonso Daniel)

---

## CRITICAL INSTRUCTIONS

1. This is a FULL REDESIGN of the client dashboard at `/account`.
2. Do not change any data fetching logic, API routes, or authentication.
3. Only change the visual layout, components, and styling.
4. The dashboard must work beautifully in BOTH light and dark mode.
5. This is a luxury platform — every element must feel premium, warm, and personal.
6. Run `pnpm exec tsc --noEmit` after completing the redesign.

---

## DESIGN PHILOSOPHY

This is not an e-commerce account page. It is a **personal atelier portal** — like having a private account at a luxury fashion house. The client should feel recognised, celebrated, and valued every time they log in.

**Tone:** Warm, personal, exclusive
**Feel:** Like receiving a handwritten note from Mrs. Prudent herself
**NOT:** A cold e-commerce dashboard with order numbers and tracking codes

---

## DESIGN SYSTEM REMINDER

```css
--choc:    #442913;   /* Primary dark */
--nut:     #5C3422;   /* CTAs, active states */
--lightbr: #98755B;   /* Accents, labels */
--cream:   #E2D1C2;   /* Text on dark */
--sand:    #D4BBAC;   /* Borders, dividers */
--ivory:   #F7F2EC;   /* Light background */
--bg:      #F0E8DD;   /* Dashboard background */
```

Fonts: Cormorant Garamond (display) + Lora (body) + Jost (UI)

---

## SIDEBAR REDESIGN

File: `src/components/account/AccountSidebar.tsx`

### Structure:

**Top section — Client identity:**
```
┌─────────────────────┐
│  [PRUDENTIAL logo]  │
│  / ATELIER          │
├─────────────────────┤
│  [Avatar circle]    │
│  Amaka Nwosu        │
│  ✦ GOLD MEMBER      │  ← loyalty tier badge
│  6,240 points       │  ← points in lightbr colour
└─────────────────────┘
```

Avatar circle: 48px, background var(--lightbr), 
white initials, Cormorant 20px
Tier badge: small pill — Bronze/Silver/Gold/Platinum
with matching colours (Bronze: #CD7F32, Silver: #A8A9AD,
Gold: var(--lightbr), Platinum: var(--choc))

**Navigation sections — ALL items must show text labels:**

```
MY ATELIER
  ○ Dashboard
  ○ My Commissions     ← (bespoke orders)
  ○ Ready-to-Wear      ← (RTW orders)
  ○ Consultations
  ○ Measurements
  ○ Moodboards

MY PERKS
  ○ Loyalty & Rewards
  ○ Wishlist          [badge: count]
  ○ Refer a Friend

MY PROFILE
  ○ Style Profile
  ○ Settings
```

**Every nav item must have:**
- Icon (Lucide, 16px)
- Text label (Jost 12px, weight 400)
- Active state: background `rgba(152,117,91,0.18)`, 
  border-right `2px solid var(--lightbr)`, 
  text `var(--cream)` (on dark sidebar)

**Section labels:**
- Jost 9px, weight 600, letter-spacing 0.2em, uppercase
- Color: `rgba(152,117,91,0.5)` on dark background
- `var(--text-light)` on light background

**Light mode sidebar:**
- Background: `var(--ivory)` (NOT dark chocolate)
- Section labels: `var(--text-light)`
- Nav items: `var(--text-mid)`
- Active: background `rgba(68,41,19,0.08)`, 
  border-right `2px solid var(--choc)`,
  text `var(--choc)`
- Border-right: `0.5px solid var(--sand)`

**Dark mode sidebar:**
- Background: `var(--sidebar-bg)` → `#442913`
- All existing dark styling (already works)

**Bottom of sidebar:**
```
─────────────────
[Back to shop arrow]  ← links to /shop
[Logout]
```

---

## DASHBOARD HOME REDESIGN

File: `src/app/(public)/account/page.tsx`
Client component: `src/components/account/AccountDashboardClient.tsx`

### ADAPTIVE LAYOUT:

The dashboard detects what state the client is in and adapts:

```typescript
type DashboardState = 
  | 'new_client'        // No orders, no consultations
  | 'has_consultation'  // Booked consultation, no order yet
  | 'has_active_order'  // Active bespoke order in progress
  | 'returning_client'  // Past orders, no active order currently
```

---

### ALL STATES: TOP WELCOME SECTION

This section appears regardless of state:

```
┌────────────────────────────────────────────────────┐
│                                                    │
│  YOUR ATELIER PORTAL          [BOOK CONSULTATION] │
│                                                    │
│  Good morning, Amaka.                             │  ← Cormorant 42px
│  Friday, 5 June 2026                              │  ← Jost 12px light
│                                                    │
│  ✦ Gold Member · 6,240 points                     │  ← tier + points
│                                                    │
└────────────────────────────────────────────────────┘
```

- "YOUR ATELIER PORTAL": Jost 10px, uppercase, 
  letter-spacing 0.2em, var(--lightbr)
- Name greeting: Cormorant Garamond 42px, weight 400, var(--choc)
  Time-based: "Good morning" / "Good afternoon" / "Good evening"
- Date: Jost 12px, weight 300, var(--text-light)
- Tier + points line: Jost 12px, var(--text-mid)
  ✦ symbol in var(--lightbr)
- "BOOK CONSULTATION" button: top right, 
  var(--choc) background, var(--cream) text,
  Jost 10px, weight 600, uppercase

---

### STATS ROW — 4 CARDS (all states):

Remove "Total Spent" entirely.

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ ACTIVE       │ │ NEXT REWARD  │ │ OUTSTANDING  │ │ MEMBER       │
│ COMMISSIONS  │ │              │ │ BALANCE      │ │ SINCE        │
│              │ │              │ │              │ │              │
│     2        │ │  3,760 pts   │ │  ₦325,000   │ │   2 years    │
│              │ │  to Gold     │ │  Pay now →  │ │  April 2024  │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

**Card design:**
- Background: `var(--ivory)` light / `var(--bg-card)` dark
- Border: `0.5px solid var(--sand)`
- Border-radius: 6px
- Padding: 20px
- Label: Jost 10px, uppercase, letter-spacing 0.12em, var(--text-light)
- Value: Cormorant Garamond 32px, weight 400, var(--choc)
- Sub-value: Jost 11px, weight 300, var(--text-light)

**Active Commissions card:**
- Count of BespokeOrders not in DELIVERED status
- If 0: show "—" with sub-text "Begin a commission →" linking to /consultation

**Next Reward card:**
- Calculate: points needed to reach next tier
- Bronze → Silver: 2,000 points
- Silver → Gold: 5,000 points
- Gold → Platinum: 10,000 points
- If already Platinum: show "Maximum tier achieved ✦"
- Value: "[X] points" in Cormorant
- Sub: "to [NextTier]" in Jost

**Outstanding Balance card:**
- Sum of balance across all active BespokeOrders
- If 0: show "—" (no outstanding) 
- If > 0: show amount in var(--nut), "Pay now →" link in var(--nut)
- Do NOT show this as alarming — keep it informational

**Member Since card:**
- Calculate years/months from User.createdAt
- Format: "2 years" or "8 months"
- Sub: formatted date "April 2024"
- If < 1 month: "New member" with a ✦ welcome note

---

### STATE: NEW CLIENT (no orders, no consultations)

Show a warm, welcoming layout below the stats:

```
┌────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Welcome to your Atelier Portal, Amaka.                      │
│                                                                 │
│   "Every great piece begins with a conversation.               │
│    We design entirely around you."                             │
│                                                                 │
│   [BEGIN YOUR COMMISSION →]    [BROWSE THE COLLECTION →]      │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```
Background: var(--choc), text: var(--cream)
Quote in Cormorant italic 22px
Buttons: side by side — primary (cream bg) and ghost

Below this, two columns:

Left:
- "YOUR STYLE PROFILE" card
  - If style quiz not completed: 
    "Tell us about your style and we'll curate picks for you"
    "Complete your style profile →" CTA
  - If completed: show 3-4 preference chips
    (silhouettes, colours, occasions)

Right:
- "YOUR MEASUREMENT VAULT" card
  - If no measurements: 
    "Save your measurements and we'll always have them ready"
    "Add measurements →" CTA
  - If has measurements: show 4 key measurements in a grid

---

### STATE: HAS CONSULTATION (no order yet)

Show upcoming consultation prominently:

```
┌─────────────────────────────────────────────────────────────┐
│  YOUR UPCOMING CONSULTATION                                  │
│                                                             │
│  In-Person with Mrs. Prudent                               │
│  Tomorrow · 2:00 PM                                        │
│                                                             │
│  "Bridal consultation for December wedding"                │
│                                                             │
│  [Add to Calendar]  [View Details]                         │
└─────────────────────────────────────────────────────────────┘
```
Dark chocolate background, cream text
Date/time prominent in Cormorant 28px

Below: Style Profile + Measurement Vault cards (same as new client)

---

### STATE: HAS ACTIVE ORDER (main state for most clients)

This is the primary state. Two-column layout:

**Left column (wider — 60%):**

*Active Commission card:*
```
┌──────────────────────────────────────────────────────────┐
│  ACTIVE COMMISSION                    [Track Publicly →] │
│                                                          │
│  Custom Asoebi Gown                                     │
│  ORD-2847                                               │
│                                                          │
│  Delivery: July 19th, 2026 · Lagos Wedding             │
│                                                          │
│  ──── Stage 8 of 13 ──────────────────────────         │
│                                                          │
│  ✓ 01 Consultation Booking                              │
│  ✓ 02 Consultation Session                              │
│  ✓ 03 Invoice Issuance                                  │
│  ✓ 04 Payment Confirmation                              │
│  ✓ 05 Sketching & Concept                               │
│  ✓ 06 Fabric Sourcing                                   │
│  ✓ 07 Design Approval                                   │
│  ● 08 Tailoring / Construction  [IN PROGRESS]          │
│  ○ 09 First Fitting                                     │
│  ○ 10 Alterations                                       │
│  ○ 11 Beading & Finishing                               │
│  ○ 12 Final Fitting                                     │
│  ○ 13 Delivery / Collection                             │
│                                                          │
│  Last update: "Initial sketches approved..."            │
│                                                          │
│  [View all commissions]                                 │
└──────────────────────────────────────────────────────────┘
```

Stage tracker design:
- Completed (✓): var(--lightbr) filled circle, white checkmark
- Active (●): var(--nut) filled circle, subtle pulse animation
- Pending (○): empty circle, var(--sand) border
- Vertical line connecting circles: var(--lightbr) for done, var(--sand) for pending
- Stage names: Cormorant 16px for active/done, Jost 12px for pending
- "IN PROGRESS" badge: small pill, sand bg, nut text

If outstanding balance on this order:
- Show a subtle banner below the tracker:
  ```
  ₦325,000 remaining balance · [Pay now →]
  ```
  Amber/warm tone, not alarming

*Recent RTW Orders (if any):*
- 2-3 most recent RTW orders in a clean list
- Product name, date, status pill
- "View all orders" link

**Right column (40%):**

*Loyalty card:*
```
┌─────────────────────────────────┐
│  ✦ GOLD MEMBER                  │
│                                 │
│  6,240                          │  ← Cormorant 48px
│  loyalty points                 │
│                                 │
│  [████████████░░░░░░] 62%       │
│  3,760 points to Platinum       │
│                                 │
│  YOUR PERKS                     │
│  ✓ Priority booking             │
│  ✓ Early collection access      │
│  ✓ Free consultation / year     │
│  🔒 Complimentary alterations   │
│     (Platinum)                  │
│                                 │
│  [View rewards →]               │
└─────────────────────────────────┘
```
Background: var(--choc)
Tier badge: in var(--lightbr)
Points: Cormorant 48px, var(--cream)
Progress bar: var(--lightbr) fill on rgba(255,255,255,0.1) track
Perks: Jost 12px, var(--sand)
Lock icon: var(--text-light)

*Measurement Vault (compact):*
```
┌─────────────────────────────────┐
│  MEASUREMENT VAULT   View full  │
│                                 │
│  38"    30"    42"    62"       │
│  Bust   Waist  Hips   Length   │
│                                 │
│  Updated June 4, 2026           │
└─────────────────────────────────┘
```
If no measurements: friendly empty state with CTA

*Upcoming Events (compact):*
```
┌─────────────────────────────────┐
│  UPCOMING EVENTS      Add event │
│                                 │
│  11 AUG  Wedding Anniversary   │
│          68 days away           │
│                                 │
│  5 JAN   Birthday              │
│          [Book consultation →]  │
└─────────────────────────────────┘
```
Event date in a small date badge (Cormorant numbers)
If within 60 days: amber "Book consultation" CTA
Empty state: "Save important dates and we'll remind you to dress for them"

---

### STATE: RETURNING CLIENT (past orders, no active order)

Show a personalised "welcome back" with:

```
┌──────────────────────────────────────────────────────────────┐
│                                                               │
│  Welcome back, Amaka.                                        │
│  It's been a while since your last commission.              │
│  Ready for something new?                                    │
│                                                               │
│  [BEGIN A NEW COMMISSION →]    [BROWSE THE COLLECTION →]    │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

Then below: past orders summary, loyalty card, style picks

---

## TOPBAR (client dashboard header)

Replace the current topbar with a cleaner version:

```
[theme toggle]  [cart icon]  [Back to shop]  [Logout]
```

Right-aligned, Jost 11px, var(--text-light)
No page title in the topbar — the welcome greeting serves that purpose
Height: 48px, background: var(--bg) or var(--ivory)
Border-bottom: 0.5px solid var(--sand)

---

## PERSONALISED PICKS SECTION

At the bottom of the dashboard (all states except new client with no style profile):

```
PICKED FOR YOU

Based on your style preferences and order history,
we think you'll love these.

[ProductCard] [ProductCard] [ProductCard] [ProductCard]
```

Server-side: fetch 4 products filtered by:
1. Client's style profile preferences (if set)
2. Products they haven't already purchased
3. Ordered by isFeatured first, then orderCount

If no style profile: show 4 best sellers instead
"Complete your style profile for more personalised picks" link below

---

## MOBILE LAYOUT

All pages must be fully responsive at 375px.

**Mobile sidebar:** becomes a bottom tab bar (fixed):
```
[🏠 Home] [📦 Orders] [👑 Loyalty] [❤ Wishlist] [👤 Profile]
```
Height: 60px, background: var(--choc) dark / var(--ivory) light
Active tab: var(--lightbr) icon + label

**Mobile dashboard:**
- Welcome section: full width, smaller greeting (Cormorant 32px)
- Stats: 2x2 grid instead of 4-column
- Active commission: full width, collapsed stage tracker 
  (shows current stage prominently, other stages collapsed)
- Right column panels stack below left column

---

## DARK MODE SPECIFICS

Ensure these work correctly in dark mode:

- Sidebar: var(--sidebar-bg) → dark chocolate
- Page background: var(--bg-page) → dark
- Cards: var(--bg-card) → dark surface
- Welcome section: var(--text-primary) → near white
- Stats card values: var(--choc) in light = var(--cream) in dark
- Loyalty card: stays dark chocolate in both modes (hardcoded #442913)
- Stage tracker circles: same colours in both modes (hardcoded)
- Progress bar: same in both modes

The loyalty card background MUST be hardcoded to #442913 —
do NOT use var(--choc) which inverts in dark mode.

---

## EMPTY STATES

Every section that can be empty must have a warm, branded empty state:

**No active commissions:**
```
[Small atelier icon]
"No active commissions"
"Begin a new commission to bring your vision to life."
[BEGIN A COMMISSION →] button
```

**No measurements:**
```
[Ruler icon]
"Your measurements are safe with us forever"
"Add them once — we'll always have them ready for your next piece."
[ADD MEASUREMENTS] button
```

**No upcoming events:**
```
[Calendar icon]  
"Save your important dates"
"We'll remind you 8 weeks before — so you're always dressed for the moment."
[ADD EVENT] button
```

**No wishlisted items:**
```
[Heart icon]
"Your wishlist is empty"
"Save pieces you love and we'll notify you of any changes."
[BROWSE COLLECTION] button
```

All empty states: centered, icon 40px in var(--sand), 
text in var(--text-light), CTA in var(--nut)

---

## WHAT TO KEEP (DO NOT CHANGE)

- All data fetching logic (API calls, Prisma queries)
- Authentication and session handling
- Route structure (/account, /account/orders etc.)
- The AccountSidebar navigation items and links
- Measurement vault data display logic
- Loyalty points calculation
- All sub-pages (/account/orders, /account/measurements etc.)

Only change: visual layout, styling, component structure

---

## EXECUTION ORDER

1. Redesign `AccountSidebar.tsx` — fix light mode labels, new identity section
2. Redesign `AccountDashboardClient.tsx` — adaptive layout
3. Build the 4 dashboard states (new, consultation, active order, returning)
4. Redesign stats row — remove Total Spent, add Next Reward + Member Since
5. Redesign loyalty card (right column)
6. Redesign measurement vault (compact right column)
7. Redesign upcoming events (compact right column)
8. Add personalised picks section
9. Build mobile bottom tab bar
10. Fix dark mode for all new components
11. `pnpm exec tsc --noEmit` — must pass with zero errors

---

## COMPLETION CHECKLIST

- [ ] Sidebar shows text labels in BOTH light and dark mode
- [ ] Sidebar light mode uses ivory background (not dark)
- [ ] "Total Spent" card is completely removed
- [ ] "Next Reward" card shows correct points to next tier
- [ ] "Member Since" card shows join date
- [ ] "Outstanding Balance" shows 0 as "—" not "₦0"
- [ ] Dashboard adapts based on client state
- [ ] New client sees warm welcome CTA
- [ ] Active order shows stage tracker prominently
- [ ] Loyalty card stays dark chocolate in both light/dark mode
- [ ] Stage tracker pulse animation on active stage
- [ ] All empty states are warm and branded
- [ ] Personalised picks shows 4 products
- [ ] Mobile bottom tab bar works at 375px
- [ ] Dark mode looks correct on every element
- [ ] `pnpm build` passes with zero TypeScript errors

---

*Prepared by SonsHub Media Ltd for Prudential Atelier — prudentgabriel.com*
*₦7,500,000 engagement · Phase 4.8 of 5*
