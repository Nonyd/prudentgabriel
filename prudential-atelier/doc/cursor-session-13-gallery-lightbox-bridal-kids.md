# CURSOR SESSION PROMPT — SESSION 13
## Bridal Gallery Redesign · Lightbox · /bridal URL · Kids Page · Instagram Handles
### Prudent Gabriel · prudentgabriel.com
### Prepared by Nony | SonsHub Media

---

> ## ⚠️ MANDATORY PRE-FLIGHT
>
> 1. **Never recreate files that exist.** Read File before creating.
> 2. **No `any` types.**
> 3. **The /bridesals route must still work** — add a redirect, do not delete the old page.
> 4. **GalleryCategory enum** already has ATELIER and BRIDAL — add KIDS.
> 5. After every task: `npx tsc --noEmit` must pass.

---

## PRISMA SCHEMA ADDITION

```prisma
// Update GalleryCategory enum — add KIDS:
enum GalleryCategory {
  ATELIER
  BRIDAL
  KIDS    // ← ADD THIS
}
```

Run `npx prisma generate && npx prisma db push` after.

---

## TASK A — LIGHTBOX COMPONENT

Build a reusable lightbox used by Bridal, Atelier, and Kids pages.

**Create `src/components/gallery/GalleryLightbox.tsx`** (client component):

```typescript
interface LightboxProps {
  images: {
    id: string
    url: string
    alt?: string | null
    caption?: string | null
    width?: number | null
    height?: number | null
  }[]
  initialIndex: number   // which image was clicked
  isOpen: boolean
  onClose: () => void
}
```

```
OVERLAY:
  Fixed inset-0, bg-black/95, z-[100]
  Framer Motion: opacity 0→1, duration 200ms
  Click backdrop → onClose()
  Escape key → onClose() (useEffect keydown listener)

LAYOUT: Full screen, flex items-center justify-center

MAIN IMAGE (center, max-w-[85vw] max-h-[85vh]):
  <img> tag (not next/image — no fixed dimensions needed)
  width: auto, height: auto
  max-width: 85vw, max-height: 85vh
  object-fit: contain
  
  Framer Motion on image change:
    When index changes: opacity 0→1 + x: ±30→0
    Direction based on next/prev
    Duration: 250ms ease

NAVIGATION ARROWS:
  LEFT ARROW (absolute left-4 or left-8, vertically centered):
    Large click target: 48×48px
    Icon: ChevronLeft (Lucide, 28px, white)
    bg-white/10 hover:bg-white/20
    transition 150ms
    onClick: go to previous image (wrap around)
    Disabled style: opacity-30 (at first image — or wrap around)
  
  RIGHT ARROW (absolute right-4 or right-8, same style):
    ChevronRight
    onClick: go to next image (wrap around)
  
  Keyboard navigation:
    ArrowLeft → previous
    ArrowRight → next
    Escape → close
    useEffect cleanup on unmount

TOP BAR (absolute top-0 left-0 right-0, p-4):
  LEFT: "[currentIndex + 1] / [total]"
        Jost 12px, white/60
  
  RIGHT: X close button
    32px circle, bg-white/10 hover:bg-white/20
    X icon (Lucide, 18px, white)
    onClick: onClose()

BOTTOM BAR (absolute bottom-0 left-0 right-0, p-4):
  Caption (if image has caption):
    Jost 13px weight-300, white/80, text-center
    Italic
  
  THUMBNAIL STRIP (below caption, overflow-x-auto, no scrollbar):
    max-width: 600px, mx-auto
    Flex row, gap-2
    Each thumbnail: 48×48px, object-cover, cursor-pointer
                    opacity-40 hover:opacity-80
                    Selected: opacity-100 + ring-1 ring-white
    Click: jump to that image

SWIPE SUPPORT (mobile):
  useEffect: track touchstart/touchend on overlay
  If swipeDistance > 50px:
    Left swipe → next image
    Right swipe → previous image
```

---

## TASK B — /bridal PAGE (FULL REDESIGN)

### B1 — Create new /bridal page

**Create `src/app/(storefront)/bridal/page.tsx`** (Server Component):

```typescript
// Fetch initial 24 BRIDAL gallery images server-side
// revalidate: 300
//
// Metadata:
// title: "Prudential Bride | Prudent Gabriel"
// description: "Every bride is a masterpiece. Explore the Prudential Bride collection."
```

**Create `src/components/gallery/BridalGalleryPage.tsx`** (client component):

```
FULL PAGE DESIGN:

HERO SECTION (bg-[#FAF7F4], padding: 80px 0 60px):
  Centered, text-center
  
  Label (Jost 9px uppercase tracking-[0.3em], bride-accent=#C8A97A):
    "PRUDENTIAL BRIDE"
  
  h1 (Bodoni Moda italic, 80px desktop / 44px mobile, bride-dark=#2A1F1A, mt-3, line-height 0.9):
    "Bridal."
  
  p (Jost 14px weight-300, charcoal/60, mt-4, max-w-sm mx-auto):
    "Every bride is a masterpiece. Every gown, a legacy."
  
  THIN ORNAMENTAL DIVIDER (mt-8, mx-auto):
    Width: 120px
    CSS: thin line with centered diamond: ——◆——
    Color: bride-accent/40
    Height: 1px with ::before/::after pseudo-elements
    OR: SVG inline with path

GALLERY HEADER (bg-[#FAF7F4], pb-4):
  max-w-[1200px] mx-auto px-6
  Flex justify-between items-center
  
  Left: "[N] works" (Jost 10px uppercase tracking, charcoal/40)
  Right: Instagram link:
    "@prudential_bridal ↗" (Jost 10px uppercase tracking, bride-accent)
    Opens: https://instagram.com/prudential_bridal in new tab

MASONRY GALLERY (bg-[#FAF7F4], pb-16):
  max-w-[1200px] mx-auto px-6
  
  CSS COLUMNS:
    Desktop (lg+): 3 columns
    Tablet (md):   2 columns
    Mobile:        1 column  ← single column on mobile for bridal (images are tall)
    Column-gap: 12px (wider than atelier — more breathing room for bridal)
  
  Each image item:
    break-inside: avoid
    margin-bottom: 12px (consistent spacing)
    cursor: pointer
    position: relative
    overflow: hidden
    
    <img>:
      width: 100%
      height: auto  ← CRITICAL — natural height for true masonry varying heights
      display: block
      transition: opacity 200ms ease
      hover: opacity: 0.92 (subtle, not dramatic — bridal is refined)
    
    CAPTION OVERLAY (absolute bottom-0, full width):
      Only shows on hover
      bg-gradient-to-t from-black/40 to-transparent
      padding: 20px 16px 12px
      opacity: 0 → 1 on hover, transition 250ms
      
      Caption text (Jost 12px weight-300 italic white):
        Only renders if image.caption exists
    
    onClick: open Lightbox at this image's index

LOAD MORE (if hasMore):
  mt-8, text-center
  
  Button (outlined, 1px solid bride-dark/30, bride-dark text):
    "LOAD MORE" (Jost 11px uppercase tracking)
    Padding: 12px 48px
    hover: border-bride-dark bg-bride-dark text-bride-bg
    Loading: "LOADING..." (no click)
  
  End state: "— [total] works —" (Jost 10px, charcoal/30)

CTA SECTION (bg-[#FAF7F4], border-top: 1px solid bride-accent/20, padding: 80px 0):
  Centered, max-w-xl mx-auto, text-center
  
  h2 (Bodoni Moda italic, 48px desktop / 32px mobile, bride-dark):
    "Begin Your Bridal Journey."
  
  p (Jost 14px weight-300, charcoal/60, mt-4, max-w-md mx-auto):
    "Each Prudential Bride gown is created exclusively for you,
     in our Lagos atelier."
  
  Button row (mt-8, flex gap-4 justify-center flex-wrap):
    [BOOK BRIDAL CONSULTATION] → /consultation
      bg-bride-dark, text-bride-bg, Jost 11px uppercase tracking, padding 14px 32px
    
    [EXPLORE BRIDAL COLLECTION] → /shop?category=BRIDAL
      outlined: 1px solid bride-dark, bride-dark text, same padding

FOOTER: standard footer
```

### B2 — Redirect /bridesals → /bridal

**Create `src/app/(storefront)/bridesals/page.tsx`** (replace existing with redirect):

```typescript
import { redirect } from 'next/navigation'

export default function BridesalsRedirect() {
  redirect('/bridal')
}
```

### B3 — Update Navbar

**Update `src/components/layout/Navbar.tsx`**:
```typescript
// Change "BRIDESALS" nav link:
//   href: /bridal (was /bridesals)
//   Label: "BRIDAL" (was "BRIDESALS")
//
// Desktop nav links:
// HOME · ATELIER · BRIDAL · READY TO WEAR ▾ · BOOK A CONSULTATION
```

**Update `src/components/layout/MobileMenu.tsx`**:
```typescript
// Same: BRIDAL → /bridal
```

**Update `src/app/sitemap.ts`**:
```typescript
// Replace /bridesals with /bridal
// Add /kids
// Keep /bridesals as redirect (no need in sitemap)
```

---

## TASK C — /atelier PAGE — ADD LIGHTBOX

**Update `src/components/gallery/AtelierGalleryClient.tsx`**:

Add lightbox to existing atelier page without changing the layout:

```typescript
// Add state:
const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

// On each image: onClick={() => setLightboxIndex(index)}
// Add cursor-pointer to image wrapper

// Add at bottom of component:
<GalleryLightbox
  images={images}
  initialIndex={lightboxIndex ?? 0}
  isOpen={lightboxIndex !== null}
  onClose={() => setLightboxIndex(null)}
/>
```

Also update atelier page header:
```typescript
// Add Instagram handle below the gallery header count:
// Right side: "@prudential_atelier ↗" (Jost 10px uppercase, olive)
// Opens: https://instagram.com/prudential_atelier in new tab
```

---

## TASK D — /kids PAGE

### D1 — Add KIDS to gallery seed

**Update `prisma/seed.ts`** — add kids gallery images:
```typescript
const kidsImages = [
  { url: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=800', alt: 'Little princess gown', caption: 'Prudential Kids — Flower Girl Collection' },
  { url: 'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?w=800', alt: 'Kids fashion editorial' },
  { url: 'https://images.unsplash.com/photo-1472162072942-cd5147eb3902?w=600', alt: 'Children\'s traditional wear' },
  { url: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800', alt: 'Kids party dress', caption: 'Birthday Collection' },
  { url: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=600', alt: 'Little gentleman suit' },
  { url: 'https://images.unsplash.com/photo-1476234251651-f353703a034d?w=800', alt: 'Flower girl dress' },
  { url: 'https://images.unsplash.com/photo-1502781252888-9143ba7f074e?w=600', alt: 'Kids trad wear', caption: 'Traditional Collection' },
  { url: 'https://images.unsplash.com/photo-1488716820095-cbe80883c496?w=800', alt: 'Children editorial' },
]

for (const [i, img] of kidsImages.entries()) {
  await prisma.galleryImage.upsert({
    where: { publicId: `seed-kids-${i}` },
    update: {},
    create: {
      url: img.url,
      publicId: `seed-kids-${i}`,
      alt: img.alt,
      caption: img.caption ?? null,
      category: 'KIDS',
      sortOrder: i,
      isPublished: true,
    },
  })
}
```

### D2 — Kids Gallery Page

**Create `src/app/(storefront)/kids/page.tsx`** (Server Component):

```typescript
// Fetch initial 24 KIDS gallery images
// revalidate: 300
//
// Metadata:
// title: "Prudential Kids | Prudent Gabriel"
// description: "Luxury fashion for the little ones."
```

**Create `src/components/gallery/KidsGalleryPage.tsx`** (client component):

```
DESIGN PHILOSOPHY:
  Playful BUT luxury. Think: clean white background with pops of color.
  NOT childish/cartoon. Think: mini editorial fashion magazine.
  Typography stays brand-consistent (Bodoni Moda + Jost).
  Colors: white bg + black text + olive accents + soft blush (#F9E8E8) as highlight.

HERO SECTION (bg-white, padding: 80px 0 60px):
  
  Label (Jost 9px uppercase tracking-[0.3em], olive): "PRUDENTIAL KIDS"
  
  h1 (Bodoni Moda italic, 80px desktop / 44px mobile, black, line-height 0.9, mt-3):
    "Little Ones."
  
  p (Jost 14px weight-300, dark-grey, mt-4, max-w-sm mx-auto, text-center):
    "Dressed for their greatest moments."
  
  DECORATIVE ELEMENT:
    Below heading: 3 small colored squares (12px each, gap-2, mx-auto):
      bg-olive, bg-[#F9E8E8] (blush), bg-black
    This adds playfulness without being childish

GALLERY HEADER (bg-white, pb-4):
  max-w-[1400px] mx-auto px-6
  Flex justify-between items-center
  
  Left: "[N] works" (Jost 10px uppercase, dark-grey/50)
  Right: "@prudential_kids ↗" (Jost 10px uppercase, olive)
         Opens https://instagram.com/prudential_kids in new tab

MASONRY GALLERY (bg-white, pb-16):
  max-w-[1400px] mx-auto px-6
  
  CSS COLUMNS:
    Desktop: 4 columns (kids items tend to be smaller — 4 cols feels right)
    Tablet:  3 columns
    Mobile:  2 columns
    Column-gap: 8px
  
  Each image item:
    break-inside: avoid
    margin-bottom: 8px
    cursor: pointer
    position: relative
    overflow: hidden
    
    <img>: width 100%, height auto, display block
    
    HOVER EFFECT (different from bridal — more playful):
      Image: scale(1.02) on hover, transition 400ms ease
      Bottom caption strip slides up (same as atelier)
      bg-white, padding 8px 10px
        Caption: Jost 11px, black
    
    onClick: open Lightbox
  
  Lightbox: GalleryLightbox component (same as bridal/atelier)

LOAD MORE: same pattern as other galleries

CTA SECTION (bg-[#F9F9F7], padding: 80px 0):
  Two cards side by side (desktop) / stacked (mobile):
  
  Card 1 (bg-white, border 1px #EBEBEA, p-8, text-center):
    Icon: small scissors illustration (SVG inline, 32px, olive)
    h3 (Bodoni Moda 24px): "Bespoke for Little Ones"
    p (Jost 13px weight-300, dark-grey, mt-2):
      "Custom-made pieces for birthdays, dedications, flower girls, and traditional ceremonies."
    [BOOK BESPOKE] → /bespoke, mt-4, outlined button
  
  Card 2 (bg-white, border 1px #EBEBEA, p-8, text-center):
    Icon: small hanger SVG (32px, olive)
    h3 (Bodoni Moda 24px): "Ready to Wear"
    p (Jost 13px weight-300, dark-grey, mt-2):
      "Browse our ready-made children's collection for immediate purchase and delivery."
    [SHOP KIDDIES] → /rtw?category=KIDDIES OR /shop?category=KIDDIES, mt-4, olive button
```

### D3 — Admin gallery supports KIDS

**Update `src/components/admin/GalleryManager.tsx`**:

```typescript
// Add "Kids" tab alongside "Atelier" and "Bridal":
// Tabs: [Atelier] [Bridal] [Kids]
// 
// Upload modal: category select now includes KIDS option
// Tab maps to GalleryCategory.KIDS

// Update tab type: 'ATELIER' | 'BRIDAL' | 'KIDS'
```

**Update `/api/gallery/route.ts`**:
```typescript
// category param now accepts 'ATELIER' | 'BRIDAL' | 'KIDS'
```

**Update `/api/admin/gallery/route.ts`**:
```typescript
// category param now accepts KIDS
```

---

## TASK E — INSTAGRAM HANDLES PER SECTION

Update all places where Instagram handles appear:

### E1 — Footer

**Update `src/components/layout/Footer.tsx`**:
```typescript
// Replace single Instagram link with section-specific handles:
// 
// Under SHOP column (or social row):
//   Ready to Wear: @the_prudentgabriel → https://instagram.com/the_prudentgabriel
//   Atelier: @prudential_atelier → https://instagram.com/prudential_atelier
//   Bridal: @prudential_bridal → https://instagram.com/prudential_bridal
//   Kids: @prudential_kids → https://instagram.com/prudential_kids
//
// Footer social icons row (logo area):
//   The main Instagram icon links to: https://instagram.com/the_prudentgabriel
//   (main brand account = RTW account)
//
// OR: Add a "Follow Us" mini-section in footer with all 4 handles listed:
//   FOLLOW US (Jost 10px uppercase, section label)
//   @the_prudentgabriel  — Ready to Wear
//   @prudential_atelier  — Behind the Scenes
//   @prudential_bridal   — Bridal
//   @prudential_kids     — Kids
//   Each: Jost 12px, white/60, hover white, Instagram icon 12px left
```

### E2 — Homepage Instagram section

**Update `src/components/home/InstagramGrid.tsx`** (if it exists):
```typescript
// Main handle → @the_prudentgabriel
// Link: https://instagram.com/the_prudentgabriel
```

### E3 — Gallery pages

Already handled in Tasks B, C, D — each gallery shows its own handle.

### E4 — Store settings seed

**Update `prisma/seed.ts`** content settings for Instagram:
```typescript
// Update social settings:
await prisma.siteSetting.upsert({
  where: { key: 'social_instagram' },
  update: { value: '@the_prudentgabriel' },
  create: { ... }
})

// Add new social settings:
const extraSocial = [
  { key: 'social_instagram_atelier', value: '@prudential_atelier', group: 'SOCIAL', label: 'Instagram — Atelier', type: 'TEXT', isPublic: true, sortOrder: 6 },
  { key: 'social_instagram_bridal', value: '@prudential_bridal', group: 'SOCIAL', label: 'Instagram — Bridal', type: 'TEXT', isPublic: true, sortOrder: 7 },
  { key: 'social_instagram_kids', value: '@prudential_kids', group: 'SOCIAL', label: 'Instagram — Kids', type: 'TEXT', isPublic: true, sortOrder: 8 },
]
for (const s of extraSocial) {
  await prisma.siteSetting.upsert({ where: { key: s.key }, update: {}, create: s })
}
```

---

## TASK F — NAVBAR UPDATES

**Update `src/components/layout/Navbar.tsx`**:

```typescript
// Full navigation:
// HOME · ATELIER · BRIDAL · READY TO WEAR ▾ · KIDS · BOOK A CONSULTATION
//
// Or: keep KIDS under a dropdown or as standalone:
// Add KIDS as its own nav link: href="/kids"
// Position: between BRIDAL and READY TO WEAR
//
// Desktop:
// HOME | ATELIER | BRIDAL | KIDS | READY TO WEAR ▾ | BOOK A CONSULTATION
//
// If too many links on desktop, group:
// HOME | COLLECTIONS ▾ | READY TO WEAR ▾ | BOOK A CONSULTATION
//   COLLECTIONS dropdown:
//     Atelier → /atelier
//     Bridal → /bridal
//     Kids → /kids
//
// Choose whichever fits better visually — 6 links may be too crowded.
// Recommended: keep individual links but slightly reduce font/tracking:
// HOME · ATELIER · BRIDAL · KIDS · READY TO WEAR · CONSULTATION

// Mobile menu: add KIDS between BRIDAL and READY TO WEAR
```

**Update `src/components/layout/Footer.tsx`** links:
```typescript
// Under SHOP column:
// New Arrivals → /rtw?sort=newest
// Ready to Wear → /rtw
// Bridal → /bridal  (was /bridesals)
// Kids → /kids  (NEW)
// Bespoke → /bespoke
// Sale → /shop?sale=true
```

---

## TASK G — /bridesals REDIRECT CLEANUP

```typescript
// src/app/(storefront)/bridesals/page.tsx:
// Replace current BridalGalleryClient with simple redirect:

import { redirect } from 'next/navigation'
export default function BridesalsRedirect() {
  redirect('/bridal')
}

// This file should NOT import or render any gallery component
// Just a clean redirect
```

Also update `src/app/sitemap.ts`:
```typescript
// Remove /bridesals
// Add /bridal (priority 0.8)
// Add /kids (priority 0.7)
// Add /atelier if not already there
```

---

## TASK H — ADMIN SETTINGS — SOCIAL MEDIA PAGE

**Update `src/components/admin/settings/SocialSettingsForm.tsx`** (or wherever social settings render):

```typescript
// Add the 4 Instagram handles as separate fields:
// Main Instagram (@the_prudentgabriel)
// Atelier Instagram (@prudential_atelier)
// Bridal Instagram (@prudential_bridal)
// Kids Instagram (@prudential_kids)
//
// Each field: label + text input + "Open ↗" preview link
```

---

## FINAL CHECKS

```bash
npx prisma generate
npx prisma db push
npx prisma db seed
npx tsc --noEmit    # must pass
npx next build      # must pass
```

Verify:
```
/bridal                     → elegant 3-col masonry, warm ivory bg, ornamental divider
/bridal                     → click image → lightbox opens with arrows
/bridal                     → lightbox → ArrowLeft/Right navigates
/bridal                     → lightbox → keyboard ← → Esc works
/bridal                     → mobile swipe left/right navigates lightbox
/bridesals                  → redirects to /bridal (301)
/atelier                    → lightbox works (click image → opens)
/atelier                    → @prudential_atelier handle shown
/kids                       → loads with 8 seed images
/kids                       → editorial feel, 4-col desktop masonry
/kids                       → lightbox works
/admin/gallery              → 3 tabs: Atelier | Bridal | Kids
Navbar                      → BRIDAL link → /bridal
Navbar                      → KIDS link visible
Footer                      → /bridesals replaced with /bridal
Footer                      → /kids added
Footer                      → 4 Instagram handles listed
```

---

## SESSION END FORMAT

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION 13 COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Task A — GalleryLightbox (arrows, keyboard, swipe, thumbnails)
✅ Task B — /bridal page (warm ivory, 3-col masonry, lightbox, CTA)
✅ Task C — /atelier lightbox + Instagram handle
✅ Task D — /kids page (playful luxury, 4-col, lightbox, CTA cards) + seed + admin tab
✅ Task E — Instagram handles per section (4 handles throughout site)
✅ Task F — Navbar (BRIDAL + KIDS links, footer updated)
✅ Task G — /bridesals → /bridal redirect
✅ Task H — Admin social settings updated

Build: ✅ passes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

*Prudent Gabriel · Session 13*
*Prepared by Nony | SonsHub Media*
