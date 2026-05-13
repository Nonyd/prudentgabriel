# CURSOR SESSION PROMPT — SESSION 7
## Complete Design Redesign — Prudent Gabriel
### prudentgabriel.com · LV-inspired luxury editorial
### Prepared by Nony | SonsHub Media

---

> ## ⚠️ MANDATORY PRE-FLIGHT
>
> 1. **This session is a DESIGN overhaul** — not new features. You are replacing
>    visual styles, typography, colors, and layout. You are NOT touching API routes,
>    database logic, payment flows, or auth.
> 2. **Never break existing functionality.** Every component you modify must still
>    work exactly as before — only the visual presentation changes.
> 3. **Read the full design system below before touching a single file.**
> 4. Work through tasks in strict order. Complete each fully before moving on.
> 5. After all tasks: `npx tsc --noEmit` must pass. `npx next build` must succeed.

---

## THE BRIEF

**Brand:** Prudent Gabriel
**Domain:** prudentgabriel.com
**Owner:** Mrs. Prudent Gabriel-Okopi
**Sub-brand:** Prudential Bride (separate identity, lives within main brand)

**Design Reference:** Louis Vuitton (eu.louisvuitton.com) — the typography scale,
whitespace philosophy, editorial image treatment, and category storytelling approach.

**NOT:** Wine/burgundy. NOT cream/ivory. NOT the old Cormorant Garamond palette.
**YES:** Clean white. Precise black. `#37392d` (olive/army) as the single accent.

---

## NEW DESIGN SYSTEM

### Colors
```css
/* Replace ALL existing color variables in src/styles/tokens.css */

:root {
  /* Primary palette */
  --white:          #FFFFFF;
  --off-white:      #F8F8F6;      /* Warm white — page backgrounds */
  --light-grey:     #F2F2F0;      /* Section alternates */
  --mid-grey:       #E8E8E4;      /* Borders, dividers */
  --dark-grey:      #8A8A85;      /* Secondary text, captions */
  --charcoal:       #2A2A28;      /* Body text */
  --black:          #0A0A0A;      /* Headlines, navbar */

  /* Accent — Olive / Army Green */
  --olive:          #37392d;      /* Primary accent — CTAs, active states, highlights */
  --olive-hover:    #2c2e24;      /* Darker olive on hover */
  --olive-light:    #37392d18;    /* 10% tint — hover backgrounds */
  --olive-mid:      #5a5d4a;      /* Lighter olive for secondary use */

  /* Prudential Bride sub-brand */
  --bride-bg:       #FAF7F4;      /* Warm ivory — bride sections only */
  --bride-accent:   #C8A97A;      /* Antique gold — bride accent only */
  --bride-dark:     #2A1F1A;      /* Deep warm black — bride headings */

  /* Functional */
  --success:        #2D5016;
  --error:          #8B1A1A;
  --border:         #E8E8E4;
  --border-dark:    #C8C8C4;

  /* Typography */
  --font-display:   'Bodoni Moda', 'Didot', 'Times New Roman', serif;
  --font-body:      'Jost', 'Helvetica Neue', system-ui, sans-serif;
  --font-label:     'Jost', system-ui, sans-serif;  /* uppercase tracking for labels */
}
```

### Typography
```
/* Google Fonts to import (replace existing imports in globals.css): */
Bodoni Moda:  ital,opsz,wght@0,6..96,400;0,6..96,500;1,6..96,300;1,6..96,400
Jost:         wght@300;400;500;600

Display XL:   Bodoni Moda · 96px · italic · opsz 96 · weight 400 · line-height 0.95
Display L:    Bodoni Moda · 72px · italic · opsz 72 · weight 400 · line-height 1.0
Display M:    Bodoni Moda · 52px · weight 400 · line-height 1.05
Display S:    Bodoni Moda · 36px · weight 500 · line-height 1.1
Heading L:    Bodoni Moda · 28px · weight 500 · line-height 1.2
Heading M:    Bodoni Moda · 22px · weight 500 · line-height 1.25
Label:        Jost · 11px · weight 500 · letter-spacing 0.2em · uppercase
Body L:       Jost · 18px · weight 300 · line-height 1.8
Body M:       Jost · 15px · weight 300 · line-height 1.75
Body S:       Jost · 13px · weight 400 · line-height 1.6
Caption:      Jost · 11px · weight 400 · letter-spacing 0.05em
```

### LV-Inspired Design Principles
```
1. WHITESPACE IS LUXURY — sections breathe. Minimum 120px vertical padding.
2. TYPOGRAPHY LEADS — the typeface IS the brand. Headlines are large, confident.
3. IMAGES ARE FULL-BLEED — no rounded corners. No shadows on images. Ever.
4. BUTTONS ARE MINIMAL — text + thin underline, or thin outlined rectangle. No heavy fills.
5. GRID IS PRECISE — asymmetric layouts. Never symmetrical 3-equal-columns.
6. LABELS ARE CAPS — all category labels, section eyebrows in Jost uppercase tracking.
7. ONE ACCENT COLOR — olive #37392d used sparingly. It means something when it appears.
8. PRUDENTIAL BRIDE — different feel. Warmer. Softer. More romantic. Never the same as RTW.
```

### Button Styles (replace all existing button variants)
```css
/* Primary (olive) */
.btn-primary:
  background: var(--olive)
  color: white
  padding: 14px 40px
  font: Jost 12px weight-500 letter-spacing 0.15em uppercase
  border: none
  border-radius: 0  ← NO border radius anywhere on this site
  hover: background var(--olive-hover)
  transition: 200ms

/* Outlined */
.btn-outlined:
  background: transparent
  color: var(--black)
  border: 1px solid var(--black)
  padding: 13px 40px
  same font as primary
  hover: background var(--black), color white

/* Ghost / Text link */
.btn-ghost:
  background: transparent
  color: var(--black)
  border: none
  padding: 0
  font: Jost 12px weight-500 letter-spacing 0.12em uppercase
  border-bottom: 1px solid var(--black)
  padding-bottom: 2px
  hover: color var(--olive), border-color var(--olive)

/* Bride variant (used in Prudential Bride sections only) */
.btn-bride:
  background: var(--bride-dark)
  color: var(--bride-bg)
  same shape as primary
```

---

## TASK A — GLOBAL STYLES OVERHAUL

### A1 — Update `src/styles/tokens.css`
Replace the entire file with the new CSS variables above.
Keep the same variable names where they overlap (--white, --black, --charcoal, --border)
so existing components don't break. Map old wine/gold variables to new palette:
```css
/* Compatibility mappings so existing components don't break: */
--wine:        var(--olive);      /* old wine → olive */
--wine-hover:  var(--olive-hover);
--gold:        var(--bride-accent);
--ivory:       var(--off-white);
--cream:       var(--off-white);
```

### A2 — Update `src/styles/globals.css`
```css
/* Replace Google Fonts import: */
@import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;1,6..96,300;1,6..96,400&family=Jost:wght@300;400;500;600&display=swap');

/* Update base styles: */
html { font-size: 16px; scroll-behavior: smooth; }

body {
  font-family: var(--font-body);
  font-weight: 300;
  background: var(--white);
  color: var(--charcoal);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Selection */
::selection {
  background: var(--olive);
  color: white;
}

/* Scrollbar — minimal */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: var(--off-white); }
::-webkit-scrollbar-thumb { background: var(--olive); }

/* Remove ALL border-radius from inputs, buttons, cards */
/* This is handled per-component */
```

### A3 — Update `tailwind.config.ts`
```typescript
// Update color tokens:
colors: {
  white: '#FFFFFF',
  'off-white': '#F8F8F6',
  'light-grey': '#F2F2F0',
  'mid-grey': '#E8E8E4',
  'dark-grey': '#8A8A85',
  charcoal: '#2A2A28',
  black: '#0A0A0A',
  olive: {
    DEFAULT: '#37392d',
    hover: '#2c2e24',
    light: '#37392d18',
    mid: '#5a5d4a',
  },
  bride: {
    bg: '#FAF7F4',
    accent: '#C8A97A',
    dark: '#2A1F1A',
  },
  // Keep for compatibility:
  wine: '#37392d',
  gold: '#C8A97A',
  ivory: '#F8F8F6',
}

// Update font families:
fontFamily: {
  display: ['Bodoni Moda', 'Didot', 'Times New Roman', 'serif'],
  body: ['Jost', 'Helvetica Neue', 'system-ui', 'sans-serif'],
  label: ['Jost', 'system-ui', 'sans-serif'],
}

// Border radius — override to 0:
borderRadius: {
  DEFAULT: '0px',
  sm: '0px',
  md: '0px',
  lg: '0px',
  xl: '0px',
  full: '9999px',  // keep for avatars/circles only
}
```

---

## TASK B — NAVBAR REDESIGN

**Update `src/components/layout/Navbar.tsx`**

### Design Specification:
```
HEIGHT: 72px desktop / 60px mobile
BACKGROUND: white, border-bottom: 1px solid var(--mid-grey)
On scroll (scrollY > 0): background white/98 backdrop-blur-sm, same border

LAYOUT (3-column grid):

LEFT (1/3):
  Logo: next/image of /images/logo.png
  Size: 44px × 44px, object-contain
  The logo PNG has a black symbol on black background.
  Apply CSS filter to make it visible:
    Normal (white bg): filter: invert(0)  ← logo is already black, shows on white ✓
    If navbar ever dark: filter: invert(1)
  Link: href="/"

CENTER (1/3):
  Navigation links (desktop only, hidden on mobile):
    HOME · ATELIER · BRIDESALS · READY TO WEAR ▾ · BOOK A CONSULTATION
  
  Font: Jost 11px weight-500 letter-spacing 0.15em uppercase
  Color: var(--charcoal)
  Active: var(--olive), border-bottom 1px solid var(--olive)
  Hover: var(--olive) transition 200ms
  
  "READY TO WEAR" has a dropdown indicator (▾)
  "BRIDESALS" links to /shop?category=BRIDAL
  "READY TO WEAR" links to /shop
  "BOOK A CONSULTATION" links to /consultation
  "ATELIER" links to /our-story

RIGHT (1/3 — flex end):
  Currency switcher (compact: ₦ | $ | £)
  Search icon (Lucide Search, 18px)
  Account icon (Lucide User, 18px)  
  Wishlist icon (Lucide Heart, 18px) + count badge
  Cart icon (Lucide ShoppingBag, 18px) + count badge
  
  Icons: color var(--charcoal), hover var(--olive)
  Spacing: gap-5
  Badge: 14px circle, olive bg, white text, 9px font

MOBILE:
  LEFT: Hamburger (3 lines, 18px, olive)
  CENTER: Logo (centered)
  RIGHT: Cart icon + count

ANNOUNCEMENT BAR (above navbar):
  Height: 36px
  Background: var(--olive)
  Text: Jost 11px weight-400 letter-spacing 0.1em, white
  Rotating messages:
    "FREE SHIPPING ON ORDERS OVER ₦150,000 WITHIN LAGOS"
    "NEW COLLECTION — THE EDIT IS NOW LIVE"
    "BOOK YOUR BESPOKE CONSULTATION TODAY"
  Dismissable: X button right side
```

**Logo setup:**
```typescript
// Copy the uploaded logo file to public/images/logo.png
// The file is at: /mnt/user-data/uploads/rtw-logo-icon.png
// In Navbar, use:
<Image
  src="/images/logo.png"
  alt="Prudent Gabriel"
  width={44}
  height={44}
  className="object-contain"
  style={{ filter: 'brightness(0)' }}  // ensures black logo on white bg
/>
```

**Mobile Menu** — update `src/components/layout/MobileMenu.tsx`:
```
Full screen overlay, white background
Logo top-left (44px)
X close button top-right (olive)

Nav items (large, Bodoni Moda italic, 32px, stagger in):
  Home
  Atelier
  Bridals
  Ready to Wear
  Book a Consultation
  ——
  Account
  Wishlist
  Cart

Currency switcher at bottom: ₦ | $ | £ (olive bg on selected)
Footer: @prudent_gabriel — social icons row
```

---

## TASK C — HOMEPAGE COMPLETE REBUILD

**Replace `src/app/(storefront)/page.tsx`** and all components in `src/components/home/`

The homepage has these sections IN ORDER:
1. Hero (full viewport)
2. Brand Marquee
3. New Collections (RTW)
4. Prudential Bride (sub-brand feature)
5. Bespoke Couture
6. The Atelier Story
7. PFA Banner
8. Newsletter

NO testimonials section on homepage. NO stats section on homepage. Those move to /our-story.

---

### SECTION 1 — HERO

**`src/components/home/Hero.tsx`**

```
CONCEPT: Full-viewport. Editorial. One powerful image. Minimal text.
         Like LV homepage — the image IS the message.

Container: 100svh, position relative, overflow hidden

BACKGROUND IMAGE:
  next/image fill, object-cover, object-position: center top
  priority: true
  src: https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1600&q=90
  (Nigerian/Black woman in elegant editorial fashion)
  
  Overlay: NO full overlay. Instead:
    Bottom gradient only: linear-gradient(to top, rgba(10,10,10,0.6) 0%, transparent 50%)

CONTENT: Two layout options based on image composition:

  Option A (text bottom-left — use this):
    Position: absolute bottom-16 left-16 (desktop) / bottom-8 left-6 (mobile)
    
    Label (Jost 11px uppercase tracking-[0.2em], white/70):
      "SS 2025 COLLECTION"
    
    Headline (Bodoni Moda italic, 80px desktop/44px mobile, white, line-height 0.95):
      "The New
       Edit."
    
    Subtext (Jost 15px weight-300, white/75, mt-4, max-w-xs):
      "Designed for the woman who
       commands every room she enters."
    
    CTA row (mt-8, flex gap-6):
      [SHOP THE COLLECTION] → /shop
        Style: white text, 1px white border, padding 14px 32px
        Jost 11px uppercase tracking
        hover: white bg, black text
      
      [BOOK BESPOKE] → /bespoke
        Style: white/60 text, no border, text only with arrow →
        Jost 11px uppercase tracking

SCROLL INDICATOR (absolute bottom-8 right-8 desktop):
  Thin vertical line (40px, white/40)
  "SCROLL" text below (Jost 9px uppercase tracking, white/40, writing-mode: vertical-rl)

Framer Motion entrance (on mount):
  Label: opacity 0→1, y 20→0, delay 300ms, 600ms ease
  Headline: opacity 0→1, y 30→0, delay 500ms, 800ms ease
  Sub + CTAs: opacity 0→1, y 20→0, delay 700ms, 600ms ease
```

---

### SECTION 2 — BRAND MARQUEE

**`src/components/home/BrandMarquee.tsx`**

```
Height: 44px
Background: var(--olive)
Border: none (no border — clean transition from hero)

Text (Jost 10px weight-500 letter-spacing 0.25em uppercase, white/80):
  "PRUDENT GABRIEL · LAGOS, NIGERIA · BESPOKE COUTURE · READY TO WEAR · EST. 2019 · "

CSS infinite scroll animation, duplicate text for seamless loop
Speed: 35s linear infinite
```

---

### SECTION 3 — NEW COLLECTIONS (RTW)

**`src/components/home/NewCollections.tsx`**

```
CONCEPT: Clean product-forward grid. White background.
         Like LV's "The Latest" — let the clothes breathe.

Section: bg-white, padding: 100px 0

HEADER ROW (max-w-[1400px] mx-auto px-8):
  Left: Label (Jost 10px uppercase tracking, var(--olive)):
        "READY TO WEAR"
  Center: nothing
  Right: Ghost link "VIEW ALL COLLECTIONS →" → /shop

PRODUCT GRID (below header, mt-12):
  max-w-[1400px] mx-auto px-8
  
  LAYOUT — NOT a standard equal grid. LV-style editorial:
  
  Desktop: CSS Grid
    grid-template-columns: 2fr 1fr 1fr
    grid-template-rows: auto auto
    gap: 2px  ← tight gap like a magazine editorial
    
    Item 1 (col 1, rows 1-2): HERO PRODUCT
      Aspect ratio: 3/4 tall portrait
      Large — dominates the left
      Show product name + "From ₦X" at bottom on hover
    
    Item 2 (col 2, row 1): square-ish
    Item 3 (col 3, row 1): square-ish
    Item 4 (col 2, row 2): square-ish
    Item 5 (col 3, row 2): square-ish
  
  Mobile: 2-col grid, equal, gap-1
  
  Each product cell:
    overflow: hidden
    Image: next/image fill, object-cover, object-top
    Hover: image scale(1.03) transition 600ms ease
    
    PRODUCT INFO (slides up on hover):
      Position: absolute bottom-0, full width
      Background: white
      Padding: 16px
      Transform: translateY(100%) → translateY(0) on group-hover
      Transition: 350ms ease
      
      Product name (Jost 13px weight-400, charcoal)
      Price (Jost 12px weight-300, dark-grey) — formatted in selected currency
      [SELECT OPTIONS] text link (Jost 10px uppercase tracking, olive)
  
  Fetch: /api/products?isNewArrival=true&limit=5&isPublished=true
  Loading: skeleton cells matching grid shape
```

---

### SECTION 4 — PRUDENTIAL BRIDE

**`src/components/home/PrudentialBride.tsx`**

```
CONCEPT: This is a SUB-BRAND moment. Completely different feel from RTW.
         Warmer. Softer. Romantic. Film-like. Sacred.
         Use the bride palette: --bride-bg, --bride-accent, --bride-dark

Section: background: var(--bride-bg), padding: 0 (no top padding — flush with above)

FULL-BLEED IMAGE (top):
  Width: 100%, height: 80vh desktop / 60vh mobile
  next/image fill object-cover object-position: center
  src: https://images.unsplash.com/photo-1594463750939-ebb28c3f7f75?w=1600&q=90
  No overlay — let image breathe

CONTENT BLOCK (below image, bg-bride-bg, padding: 80px 48px desktop / 60px 24px mobile):
  max-w-[1400px] mx-auto
  
  Two-column layout (desktop): text left 50% / image right 50%
  
  LEFT:
    Label (Jost 10px uppercase tracking 0.25em, bride-accent):
      "PRUDENTIAL BRIDE"
    
    Headline (Bodoni Moda italic, 64px desktop/36px mobile, bride-dark, line-height 1.0):
      "For the Bride
       Who Dares to
       Be Remembered."
    
    Body (Jost 15px weight-300, charcoal, line-height 1.8, max-w-md, mt-6):
      "Prudential Bride is our most intimate offering.
       Each gown is a singular creation — hand-crafted
       in our Lagos atelier, built around your story."
    
    CTA row (mt-10, flex flex-col gap-4 items-start):
      [EXPLORE BRIDAL COLLECTION] → /shop?category=BRIDAL
        Style: bg-bride-dark, color bride-bg, Jost 11px uppercase tracking, padding 16px 40px
      
      [BOOK BRIDAL CONSULTATION] → /consultation
        Style: ghost — Jost 11px uppercase tracking, bride-dark, border-bottom 1px bride-dark
  
  RIGHT:
    Tall portrait image (aspect 3/4):
      src: https://images.unsplash.com/photo-1519741347686-c1e331ec5e96?w=800&q=90
      object-cover, object-top, no border-radius
    
    Small caption below (Jost 11px, dark-grey, italic):
      "Custom Bridal Gown · Prudential Bride 2024"

DIVIDER below section: 1px solid var(--mid-grey)
```

---

### SECTION 5 — BESPOKE COUTURE

**`src/components/home/BespokeCouture.tsx`**

```
CONCEPT: Dark, confident, powerful. The anti-RTW moment.
         Full-bleed dark section — only one on the homepage.

Section: background: var(--black), padding: 120px 0, overflow: hidden

LAYOUT: Two columns (50/50) desktop, stacked mobile

LEFT — IMAGE:
  Full-height, aspect 4/5
  src: https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800&q=90
  object-cover object-top
  
  Framer Motion parallax:
    useScroll + useTransform: y from "5%" to "-5%" as section scrolls

RIGHT — CONTENT:
  Vertically centered, padding: 0 80px desktop / 0 24px mobile
  
  Label (Jost 10px uppercase tracking 0.25em, var(--olive)):
    "BESPOKE COUTURE"
  
  Headline (Bodoni Moda italic, 56px desktop/32px mobile, white, line-height 1.0, mt-4):
    "One Piece.
     One Story.
     Yours."
  
  Body (Jost 15px weight-300, white/65, line-height 1.8, max-w-md, mt-6):
    "From the first sketch to the final stitch — every
     bespoke piece is conceived, designed, and hand-crafted
     exclusively for you. No two are alike."
  
  PROCESS (mt-10, flex flex-col gap-6):
    3 numbered steps:
    Each: flex items-start gap-4
      Number: Bodoni Moda, 48px, olive/40, italic, leading-none, w-10 shrink-0
      Content:
        Title: Jost 12px weight-500 uppercase tracking white
        Desc: Jost 13px weight-300 white/50 mt-1
    
    01 · Consultation — "A private session with our design team or Mrs. Gabriel-Okopi."
    02 · Creation — "Your piece is built by hand in our Lagos atelier."
    03 · Delivery — "Couriered to you, anywhere in the world."
  
  CTA (mt-12):
    [BEGIN YOUR BESPOKE JOURNEY] → /bespoke
    Style: 1px solid white, white text, padding 16px 40px
    Jost 11px uppercase tracking
    hover: bg white, color black
```

---

### SECTION 6 — THE ATELIER STORY

**`src/components/home/AtelierStory.tsx`**

```
CONCEPT: Clean, editorial, warm. Short and punchy. Links to /our-story.

Section: bg-off-white, padding: 120px 0

LAYOUT: Centered, max-w-3xl mx-auto, text-center

Label (Jost 10px uppercase tracking 0.25em, olive):
  "THE ATELIER"

Headline (Bodoni Moda italic, 52px desktop/32px mobile, black, line-height 1.05, mt-4):
  "Built in Lagos.
   Worn Worldwide."

Body (Jost 16px weight-300, dark-grey, line-height 1.85, mt-6, max-w-xl mx-auto):
  "Prudent Gabriel began as a single vision in Lagos, Nigeria.
   Today, our pieces are worn at weddings, galas, and boardrooms
   across four continents. Every creation carries the mark of
   our atelier — made by hand, made to last."

CTA (mt-10):
  [OUR STORY →] → /our-story
  Ghost button style

BELOW TEXT — full-width image strip (mt-16):
  Two images side by side (no gap, 2px gap):
  Left (60%):  landscape editorial — atelier/craft
    src: https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1200&q=90
    height: 400px, object-cover
  Right (40%): portrait — model/detail
    src: https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=90
    height: 400px, object-cover
  
  Both images: overflow hidden, hover scale(1.02) 600ms ease
```

---

### SECTION 7 — PFA BANNER

**Update `src/components/common/PFABanner.tsx`**

```
Section: bg-light-grey, padding: 48px
border-top: 1px solid var(--mid-grey)
border-bottom: 1px solid var(--mid-grey)

Layout: max-w-[1400px] mx-auto px-8, flex justify-between items-center

LEFT:
  Label (Jost 10px uppercase tracking, olive): "PRUDENTIAL FASHION ACADEMY"
  Text (Jost 15px weight-300, charcoal):
    "Over 5,000 designers trained. The school behind the brand."

RIGHT:
  [EXPLORE PFA →] button
  Style: outlined (1px solid black, black text)
  onClick: window.open('https://pfacademy.ng', '_blank')

Mobile: stack vertically, center-aligned
```

---

### SECTION 8 — NEWSLETTER

**Update `src/components/home/NewsletterSection.tsx`**

```
Section: bg-olive, padding: 80px 0

Content (text-center, max-w-lg mx-auto, px-8):
  Label (Jost 10px uppercase tracking 0.25em, white/50): "STAY CONNECTED"
  
  Headline (Bodoni Moda italic, 40px, white, line-height 1.1, mt-3):
    "Join the Inner Circle."
  
  Body (Jost 14px weight-300, white/65, mt-4):
    "New collections, exclusive access, and stories from the atelier."
  
  Form (mt-8, flex gap-0 — joined input + button):
    Email input:
      flex-1, height 48px, bg transparent, border-bottom 1px solid white/40
      border-top/left/right: none, padding 0 16px
      Jost 13px weight-300, white
      placeholder: "Your email address" (white/40)
      focus: border-bottom white, outline none
    
    [SUBSCRIBE] button:
      height 48px, bg white, color olive
      Jost 11px uppercase tracking, padding 0 28px
      border: none, hover bg off-white
  
  Privacy (Jost 11px, white/35, mt-4):
    "No spam. Unsubscribe at any time."
```

---

### SECTION 9 — FOOTER

**Update `src/components/layout/Footer.tsx`**

```
Background: var(--black)
Border-top: 2px solid var(--olive)

TOP SECTION (padding: 80px 0):
  max-w-[1400px] mx-auto px-8
  
  5-column grid (desktop) / 2-col (mobile):
  
  Col 1 — Brand (wider, 2fr):
    Logo: white version (filter: brightness(0) invert(1), 36px)
    Below logo:
      "PRUDENT GABRIEL" (Jost 11px uppercase tracking 0.2em, white/40, mt-4)
      "Lagos, Nigeria" (Jost 12px weight-300, white/30)
    
    Social row (mt-6, gap-4):
      Instagram · TikTok · Facebook · YouTube
      Use SocialIcons.tsx
      Icons: white/50, hover white, size 18px
  
  Col 2 — Shop:
    Heading: Jost 10px uppercase tracking 0.2em, white/40
    Links: Jost 13px weight-300, white/60, hover white, leading-loose
      New Arrivals · Ready to Wear · Prudential Bride · Bespoke · Sale
  
  Col 3 — Company:
    Heading: same style
    Links: Our Story · Press · Careers · Contact · PFA Academy ↗
  
  Col 4 — Consultations:
    Heading: same style
    Links: Book a Consultation · Style Session · Bridal Consult · Home Visit
  
  Col 5 — Newsletter:
    Heading: Jost 10px uppercase tracking, white/40
    "Subscribe for early access and atelier stories."
    Compact email form (same as homepage but smaller):
      Input + [→] button

BOTTOM BAR (border-top: 1px solid white/10, padding: 24px 0):
  max-w-[1400px] mx-auto px-8
  Flex justify-between
  
  Left: "© 2025 Prudent Gabriel. All Rights Reserved." (Jost 11px, white/25)
  Right: Privacy Policy · Terms · Returns (Jost 11px, white/25, hover white/60)
```

---

## TASK D — SHOP PAGE REDESIGN

**Update `src/app/(storefront)/shop/page.tsx`** and related components

### Hero:
```
Height: 320px (shorter, more editorial)
Background: var(--black)

Centered content:
  Label (Jost 10px uppercase tracking, white/50):
    "PRUDENT GABRIEL"
  
  h1 (Bodoni Moda italic, 72px desktop/40px mobile, white, line-height 0.95):
    "The Edit."
  
  Subtext (Jost 14px weight-300, white/55, mt-4):
    "Ready-to-Wear · Bespoke · Bridal"

FILTER CHIPS (below hero, bg-white, border-bottom: 1px solid mid-grey, padding: 16px 0):
  max-w-[1400px] mx-auto px-8
  Horizontal scroll on mobile
  
  Chips: Jost 11px uppercase tracking, no border-radius
  ALL · BRIDAL · EVENING WEAR · FORMAL · CASUAL · KIDDIES · ACCESSORIES
  
  Unselected: white bg, charcoal text, 1px solid mid-grey border
  Selected: olive bg, white text, no border
  Hover: olive-light bg
```

### Product Grid:
```
Background: white
Padding: 48px 0

GRID:
  4-column desktop (1400px+ → 4 col, 1024px → 3 col, 768px → 2 col, mobile → 2 col)
  gap: 1px (tight editorial grid — like a magazine spread)
  
  ProductCard: NO box-shadow, NO border-radius, NO card background
    Just the image and minimal info below
```

### ProductCard redesign:

**Update `src/components/common/ProductCard.tsx`**
```
Container: group, cursor-pointer, bg-white

IMAGE (aspect-[3/4], overflow-hidden, bg-light-grey):
  next/image fill object-cover object-top
  Primary + secondary crossfade on hover (same logic)
  Hover: primary opacity 0, secondary opacity 1, 500ms ease
  
  TOP LEFT badges:
    SALE: Jost 9px uppercase tracking, white text, olive bg, padding 4px 8px
    NEW: same style
    NO rounded corners
  
  TOP RIGHT: WishlistButton
    Heart icon, 16px, charcoal/50 → olive on active
    No background circle — just the icon

  BOTTOM — quickview:
    On group-hover: white strip slides up from bottom (40px)
    "QUICK VIEW" text centered (Jost 10px uppercase tracking, charcoal)
    bg-white/90

INFO (padding: 12px 0):
  Product name: Jost 13px weight-400, charcoal, line-clamp-1
  
  Price:
    On sale: <del> Jost 12px weight-300 dark-grey </del>  [sale price olive font-400]
    Normal: Jost 12px weight-300, charcoal
    "From ₦X" if multiple variants
  
  Color dots row (if colors): 10px circles, gap-1.5, mt-1
    NO hover label — minimal
```

---

## TASK E — PRODUCT DETAIL PAGE

**Update `src/app/(storefront)/shop/[slug]/page.tsx`** — visual overhaul only

```
BREADCRUMB: Jost 11px, dark-grey, uppercase tracking
  SHOP / CATEGORY / PRODUCT NAME

PAGE LAYOUT:
  2 columns (55% gallery / 45% info) on desktop
  Stacked on mobile (gallery first)

GALLERY:
  Main image: aspect 3/4, no border-radius, bg-light-grey
  Thumbnails: 4 per row, 1:1 aspect, gap-2, no border-radius
  Selected thumbnail: 1px solid olive border
  No zoom icon — just hover scale(1.03) on main

PRODUCT INFO:
  Category: Jost 10px uppercase tracking, olive
  Name: Bodoni Moda 40px, charcoal (NOT italic for product names)
  
  Price: Bodoni Moda 28px, charcoal
    Sale: del + new price in olive, "Save X%" in olive text (no badge)
  
  Review stars: olive color (not gold)
  
  Color selector:
    Swatches: 20px circles
    Selected: ring-1 ring-offset-2 ring-charcoal
  
  Size selector:
    Square chips: 44px × 32px, no border-radius
    Border: 1px solid mid-grey
    Selected: bg-olive, text-white, border-olive
    OOS: diagonal line-through via CSS
  
  [ADD TO BAG] button:
    Full width, bg-olive, white text, height 52px
    Jost 12px uppercase tracking 0.15em
    NO border-radius
  
  [ADD TO WISHLIST]:
    Full width, outlined (1px solid charcoal), charcoal text
    Same height and font as above
  
  Accordion (product details, size guide, delivery):
    Border-top: 1px solid mid-grey
    NO border-radius
    Header: Jost 12px uppercase tracking, charcoal, padding 18px 0
    chevron: right side, rotates on open
```

---

## TASK F — AUTH PAGES REDESIGN

**Update auth pages** — minimal, clean, brand-consistent

```
LAYOUT: Full screen, white background

Left panel (40% desktop — hidden mobile):
  bg-olive
  Logo (white, 48px, centered vertically)
  Below logo: Bodoni Moda italic 32px white:
    "Fashion is the
     armour to survive
     everyday life."
  Attribution: Jost 12px white/50: "— Bill Cunningham"
  
  Bottom: "© 2025 Prudent Gabriel" (Jost 11px white/30)

Right panel (60% desktop — full mobile):
  White bg, centered content, max-w-sm, mx-auto
  Padding: 80px 40px

  Logo (black, 36px, mobile only — hidden on desktop)
  
  Heading: Bodoni Moda 32px black
    Login: "Welcome Back."
    Register: "Create Account."
    Forgot: "Reset Password."
  
  Subtext: Jost 14px weight-300 dark-grey mt-2
  
  Form fields: use existing Input.tsx
    Override colors: bottom border 1px mid-grey → olive on focus
    NO box, NO border-radius — bottom border only
  
  Submit button: full-width, bg-olive, white, Jost 12px uppercase tracking
  
  Google OAuth button: 1px solid mid-grey, white bg, charcoal text, Google icon left
  
  Links: Jost 13px weight-300, olive on hover, no underline
```

---

## TASK G — CONSULTATION PAGE REDESIGN

**Update `src/app/(storefront)/consultation/page.tsx`** hero only

```
HERO (500px desktop, 300px mobile):
  Background: var(--black)
  
  Full-bleed editorial image behind:
    src: https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1600&q=90
  Overlay: charcoal/70
  
  Centered content:
    Label (Jost 10px uppercase tracking, white/50): "BOOK A CONSULTATION"
    h1 (Bodoni Moda italic, 64px desktop/36px mobile, white, line-height 0.95, mt-3):
      "Your Vision,
       Our Craft."
    p (Jost 14px weight-300, white/60, mt-4):
      "Choose your consultant. Select your session. Begin the journey."

CONSULTANT CARDS redesign:
  bg-white, border: 1px solid mid-grey, NO border-radius, padding 32px
  
  Photo: 80×80, rounded-full (exception — avatars keep radius)
  
  Consultant name: Bodoni Moda 22px, charcoal
  Title: Jost 11px uppercase tracking, olive
  
  If isFlagship: badge below title:
    Jost 9px uppercase tracking, olive text, 1px solid olive border, padding 3px 10px
    "FLAGSHIP · BY APPOINTMENT"
  
  Bio: Jost 13px weight-300, dark-grey, line-clamp-4
  
  Fee: Bodoni Moda 20px, charcoal — "From ₦X,XXX"
  
  Selected state: border-color olive (2px), bg-off-white
```

---

## TASK H — BESPOKE PAGE REDESIGN

**Update `src/app/(storefront)/bespoke/page.tsx`** — visual only

```
HERO (420px):
  Black background + editorial image
  src: https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1600
  overlay: black/65
  
  Content (bottom-left, padding 80px):
    Label (olive): "THE ATELIER"
    h1 (Bodoni Moda italic, 72px desktop, white, line-height 0.95):
      "Your Vision,
       Our Craft."

PROCESS SECTION (bg-off-white, padding 100px 0):
  4 steps in a horizontal row (desktop) / stacked (mobile)
  Each step:
    Number: Bodoni Moda 64px, olive/20, italic
    Title: Bodoni Moda 18px, charcoal
    Desc: Jost 13px weight-300, dark-grey, mt-2, max-w-[200px]
  
  Thin connector line between steps (1px solid mid-grey, desktop only)

FORM SECTION:
  bg-white, max-w-2xl mx-auto, padding 80px 0
  Multi-step form — same logic, just visual update
  Progress bar: thin (3px) olive line at top of form card
  Form heading: Bodoni Moda 28px, charcoal
```

---

## TASK I — OUR STORY PAGE REDESIGN

**Update `src/app/(storefront)/our-story/page.tsx`** — visual only

```
HERO:
  Same pattern: black bg + image + olive text overlay bottom-left
  h1 (Bodoni Moda italic 80px): "A Stitch in Time."

STATS SECTION (move here from homepage):
  bg-olive, 4-stat row
  Numbers: Bodoni Moda italic, 56px, white
  Labels: Jost 10px uppercase tracking, white/50

TESTIMONIALS SECTION (move here from homepage):
  bg-off-white
  Swiper — same content, just updated typography + olive accent
```

---

## TASK J — LOGO FILE SETUP

```bash
# Copy the uploaded logo to public folder
# The logo file is at: /mnt/user-data/uploads/rtw-logo-icon.png
# Copy it to: prudential-atelier/public/images/logo.png

# Also create a white version for dark backgrounds:
# In code, use CSS filter to invert:
#   On white bg: style={{ filter: 'brightness(0)' }}         → black logo ✓
#   On dark bg:  style={{ filter: 'brightness(0) invert(1)' }} → white logo ✓
# This means ONE logo file serves both uses
```

**In `next.config.ts`** — ensure public folder images are accessible:
```typescript
// No change needed — /public/ files are served automatically by Next.js
// Just ensure the file exists at public/images/logo.png
```

---

## TASK K — GLOBAL COMPONENT CLEANUPS

### K1 — AnnouncementBar
Already updated in Task B (olive bg, white text, Jost).

### K2 — CartDrawer
```
bg-white, no border-radius
Header: Jost 12px uppercase tracking "YOUR BAG (X)"
Divider: 1px solid mid-grey
Items: Jost 13px product name, Jost 11px size/color
Checkout button: bg-olive, white, full-width, Jost 12px uppercase
```

### K3 — SearchModal
```
bg-white/98 backdrop-blur (not charcoal)
Input: Bodoni Moda italic 32px, charcoal, bottom border 1px olive
Results: standard list, Jost 13px, olive accent on hover
```

### K4 — Badge component
```
All badges: NO border-radius
SALE: bg-olive, white, Jost 9px uppercase
NEW: bg-charcoal, white, Jost 9px uppercase
BESPOKE: 1px solid olive, olive text, Jost 9px uppercase
```

### K5 — SectionLabel component
```
Replace the ——  LABEL  —— style with:
Jost 10px weight-500 uppercase letter-spacing 0.25em, olive color
No lines/dashes on either side — just the clean label text
```

---

## TASK L — ACCOUNT + ADMIN PALETTE FIX

The account dashboard and admin use --wine/--gold tokens. Since we mapped:
`--wine → var(--olive)` and `--gold → var(--bride-accent)` in tokens.css,
these should update automatically.

**Verify these pages look correct after token update:**
- `/account` — olive sidebar active states (was wine)
- `/account/wallet` — olive wallet card gradient (was wine gradient)
  Update wallet card: bg: linear-gradient(135deg, var(--olive), var(--olive-hover))
- `/admin` — sidebar active items now olive (was wine bg/20)
  Update: active item = `bg-olive/15 text-olive border-l-2 border-olive`

---

## FINAL CHECKS

```bash
# 1. Copy logo file
cp /mnt/user-data/uploads/rtw-logo-icon.png prudential-atelier/public/images/logo.png

# 2. TypeScript check
npx tsc --noEmit

# 3. Build
npx next build

# 4. Verify visually:
#    / → new homepage: Bodoni Moda headlines, olive accents, white bg
#    /shop → editorial grid, no rounded corners
#    /shop/amore-bridal-gown → product detail clean typography
#    /consultation → black hero, olive accents
#    /auth/login → split panel, olive left, clean right
#    Logo visible in navbar (black symbol on white)
```

---

## SESSION END FORMAT

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION 7 COMPLETE — DESIGN OVERHAUL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Task A — Global styles (tokens, globals, tailwind)
✅ Task B — Navbar (logo, olive accent, LV-style links)
✅ Task C — Homepage (Hero, Marquee, RTW, Prudential Bride, Bespoke, Atelier, Newsletter)
✅ Task D — Shop page + ProductCard redesign
✅ Task E — Product detail page
✅ Task F — Auth pages
✅ Task G — Consultation page
✅ Task H — Bespoke page
✅ Task I — Our Story page
✅ Task J — Logo file setup
✅ Task K — Global component cleanups
✅ Task L — Account + Admin palette
Build: ✅ passes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

*Prudent Gabriel · Session 7 — Design Overhaul*
*Prepared by Nony | SonsHub Media*
