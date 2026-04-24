# CURSOR SESSION PROMPT — SESSION 10
## Gallery Pages · Content Management · Settings Restructure · Notification Bell · Coupons Fix · Manual Bespoke
### Prudent Gabriel · prudentgabriel.com
### Prepared by Nony | SonsHub Media

---

> ## ⚠️ MANDATORY PRE-FLIGHT
>
> 1. **Never recreate files that exist.** Read File before creating.
> 2. **No `any` types.** All types derived from Prisma or explicit interfaces.
> 3. **This session touches DB schema** — run `npx prisma generate && npx prisma db push` after changes.
> 4. **Content management (editable texts) uses the existing `SiteSetting` model** —
>    no new model needed. Add text settings to the `CONTENT` group.
> 5. After every task: `npx tsc --noEmit` must pass.

---

## PRISMA SCHEMA ADDITIONS

Add only what is missing. Run `npx prisma generate && npx prisma db push` after.

```prisma
// ─────────────────────────────────────────
// GALLERY
// ─────────────────────────────────────────

model GalleryImage {
  id          String      @id @default(cuid())
  url         String      // Cloudinary URL
  publicId    String      @unique
  alt         String?
  caption     String?
  category    GalleryCategory
  width       Int?
  height      Int?
  sortOrder   Int         @default(0)
  isPublished Boolean     @default(true)
  uploadedBy  String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@index([category, isPublished])
  @@index([sortOrder])
}

enum GalleryCategory {
  ATELIER     // For /atelier page
  BRIDAL      // For /bridesals page
}

// ─────────────────────────────────────────
// ADD TO SettingGroup ENUM
// ─────────────────────────────────────────
// Add CONTENT to the SettingGroup enum if not present:
// enum SettingGroup {
//   STORE
//   PAYMENTS
//   EMAIL
//   SMS
//   SHIPPING
//   APPEARANCE
//   SOCIAL
//   NOTIFICATIONS
//   LOYALTY
//   SEO
//   CONTENT    ← ADD THIS
// }

// ─────────────────────────────────────────
// ADD TO AdminNotification (if not exists — for bell)
// ─────────────────────────────────────────

model AdminNotification {
  id          String               @id @default(cuid())
  type        AdminNotificationType
  title       String
  message     String
  link        String?              // /admin/orders/[id] etc.
  isRead      Boolean              @default(false)
  entityId    String?              // orderId, bespokeId, etc.
  createdAt   DateTime             @default(now())

  @@index([isRead, createdAt])
}

enum AdminNotificationType {
  NEW_ORDER
  NEW_BESPOKE
  NEW_CONSULTATION
  REVIEW_PENDING
  LOW_STOCK
  PAYMENT_FAILED
  NEW_CUSTOMER
  COUPON_EXPIRING
}
```

---

## TASK A — GALLERY SYSTEM

### A1 — Gallery API Routes

**`src/app/api/gallery/route.ts`** (GET — public)
```typescript
// Query params: category ('ATELIER' | 'BRIDAL'), page (default 1), limit (default 50)
// Fetch GalleryImages where isPublished: true, category: param
// OrderBy: sortOrder asc, createdAt desc
// Return: { images: GalleryImage[], total, page, totalPages, hasMore }
// Cache: revalidate 300
```

**`src/app/api/admin/gallery/route.ts`** (GET, POST)
```typescript
// GET: All gallery images (admin — includes unpublished)
//   Query: category, page, limit (default 30)
//   Return paginated with total

// POST: Upload new gallery image
//   Multipart: file, category (ATELIER|BRIDAL), alt?, caption?
//   Upload to Cloudinary folder: 'prudent-gabriel/gallery/[category.toLowerCase()]'
//   Get width/height from Cloudinary response
//   Create GalleryImage record
//   Return: GalleryImage
```

**`src/app/api/admin/gallery/[id]/route.ts`** (PATCH, DELETE)
```typescript
// PATCH: Update alt, caption, isPublished, sortOrder
// DELETE: Cloudinary destroy + DB delete
```

**`src/app/api/admin/gallery/reorder/route.ts`** (PATCH)
```typescript
// Body: { orderedIds: string[] }
//   Update sortOrder for each id based on array position
//   Use $transaction with multiple updates
```

### A2 — Atelier Gallery Page

**`src/app/(storefront)/atelier/page.tsx`** (Server Component)
```typescript
// Fetch initial 50 ATELIER images server-side
// revalidate: 300
// Pass to AtelierGalleryClient (client component for load more)

// Metadata:
// title: "The Atelier | Prudent Gabriel"
// description: "Step inside our Lagos atelier..."
```

**`src/components/gallery/AtelierGalleryClient.tsx`** (client component)

```
HERO SECTION (400px, black bg):
  Centered:
    Label (Jost 10px uppercase tracking, white/50): "PRUDENT GABRIEL"
    h1 (Bodoni Moda italic, 72px desktop / 40px mobile, white, line-height 0.95):
      "The Atelier."
    p (Jost 14px weight-300, white/60, mt-4):
      "Behind every piece — the hands, the craft, the story."

GALLERY SECTION (bg-white, padding 60px 0):
  max-w-[1400px] mx-auto px-4

  PINTEREST-STYLE MASONRY GRID:
    Implementation: CSS columns (not JS masonry library)
    
    Desktop: 4 columns
    Tablet (md): 3 columns
    Mobile: 2 columns
    
    CSS:
      .masonry-grid {
        columns: 4;        /* desktop */
        column-gap: 4px;
        break-inside: avoid-column;
      }
      .masonry-item {
        break-inside: avoid;
        margin-bottom: 4px;
        display: block;
      }
      @media (max-width: 1024px) { .masonry-grid { columns: 3; } }
      @media (max-width: 768px)  { .masonry-grid { columns: 2; } }
    
    Each image item:
      width: 100% (fills column)
      height: auto (natural aspect ratio — this is what makes it Pinterest-like)
      object-fit: cover
      display: block
      
      Hover overlay (opacity 0 → 1):
        bg-black/30
        Caption text (if set): Jost 12px weight-300 white, bottom-left, padding 12px
      
      No border-radius. No shadow. Tight 4px gaps.
      
      Use next/image with width/height from DB for proper sizing.
      If no dimensions: use fill with a wrapper div setting natural height.
  
  LOAD MORE BUTTON:
    Shows after initial 50 images IF hasMore: true
    Centered, mt-12:
    [LOAD MORE] button — outlined, 1px solid black, black text
                          Jost 11px uppercase tracking, padding 14px 48px
    
    On click:
      Fetch next 50: GET /api/gallery?category=ATELIER&page=2&limit=50
      Append to existing images (don't replace)
      If no more: hide button, show "— End of Gallery —" (Jost 11px, dark-grey)
    
    Loading state: [LOADING...] with thin spinner

  TOTAL COUNT (above grid):
    "[N] works" (Jost 11px uppercase tracking, dark-grey, text-right, mb-6)
```

### A3 — Bridal Gallery Page (Prudential Bride)

**`src/app/(storefront)/bridesals/page.tsx`** (Server Component)

Note: The navbar links to `/bridesals` — this is the Prudential Bride gallery.

```typescript
// Same structure as atelier but with BRIDAL category
// Fetch initial 50 BRIDAL images
// revalidate: 300
```

**`src/components/gallery/BridalGalleryClient.tsx`** (client component)

```
HERO (same structure as atelier but bride palette):
  Background: var(--bride-bg) — warm ivory, NOT black
  
  Label (Jost 10px uppercase tracking, bride-accent): "PRUDENTIAL BRIDE"
  h1 (Bodoni Moda italic, 72px, bride-dark): "Bridesals."
  p (Jost 14px weight-300, charcoal/70):
    "Every bride is a masterpiece. Every gown, a legacy."

GALLERY: Same Pinterest masonry as atelier
  But images use a warmer treatment:
  Hover overlay: bg-bride-dark/20 (very subtle — don't obscure bridal images)

LOAD MORE: Same button, bride-dark color

CTA SECTION (below gallery, bg-bride-bg, padding 80px, text-center):
  h2 (Bodoni Moda italic 40px, bride-dark): "Begin Your Bridal Journey."
  p (Jost 14px weight-300, charcoal/70, max-w-md mx-auto, mt-4):
    "Each Prudential Bride gown is created exclusively for you."
  Button row (mt-8, flex gap-4 justify-center):
    [BOOK BRIDAL CONSULTATION] → /consultation (bride-dark bg)
    [EXPLORE BRIDAL COLLECTION] → /shop?category=BRIDAL (outlined)
```

### A4 — Admin Gallery Management

**`src/app/(admin)/admin/gallery/page.tsx`** (Server Component)

Add "Gallery" to AdminSidebar under CATALOGUE section:
```typescript
// Icon: Images (Lucide)
// Label: "Gallery"
// Href: /admin/gallery
```

**`src/components/admin/GalleryManager.tsx`** (client component)

```
PAGE HEADER:
  "Gallery" (Bodoni Moda 24px)
  Tab row: [Atelier] [Bridal] — olive underline on active

TOOLBAR:
  [+ Upload Images] button (olive) — opens multi-file uploader
  [Reorder] toggle — enables drag mode
  Total count: "[N] images" (right)

UPLOAD MODAL (Radix Dialog):
  Tab: ATELIER / BRIDAL (which gallery to upload to)
  Drag-and-drop zone (same pattern as product images):
    Accept: image/jpeg, image/png, image/webp
    Multiple files
    Each: upload to /api/admin/gallery with { file, category }
    Show progress per image
    Preview thumbnails as they upload
  Alt text input (applies to all in this batch, can edit individually after)
  [Upload All] button

IMAGE GRID (masonry, same CSS as storefront):
  3 columns desktop, 2 tablet/mobile
  
  Each image tile:
    next/image (unoptimized for admin)
    Hover: control overlay appears:
      Top-right: [✓ Published] toggle (eye icon)
      Top-left: drag handle (if reorder mode)
      Bottom: [Edit] [Delete] icons
  
  [Edit] opens inline panel (right side):
    Alt text input
    Caption input
    Published toggle
    [Save Changes] → PATCH /api/admin/gallery/[id]
  
  [Delete]: AlertDialog confirm → DELETE /api/admin/gallery/[id]

REORDER MODE:
  Drag handles appear on each image
  Use simple up/down sort (no DnD library needed):
    Arrow buttons on each item: ↑ ↓
    On click: PATCH /api/admin/gallery/reorder { orderedIds }
  
  OR: Add 'sortOrder' number input to each item's edit panel

PAGINATION: Load 30 per page in admin, numbered pagination
```

---

## TASK B — CONTENT MANAGEMENT SYSTEM

### B1 — Content Settings Seed

**Add to `prisma/seed.ts`** — content text settings:

```typescript
const contentSettings = [
  // HOMEPAGE
  { key: 'content_hero_label', value: 'SS 2025 COLLECTION', group: 'CONTENT', label: 'Hero — Label', type: 'TEXT', isPublic: true, sortOrder: 1 },
  { key: 'content_hero_headline', value: 'The New\nEdit.', group: 'CONTENT', label: 'Hero — Headline (use \\n for line break)', type: 'TEXTAREA', isPublic: true, sortOrder: 2 },
  { key: 'content_hero_subtext', value: 'Designed for the woman who commands every room she enters.', group: 'CONTENT', label: 'Hero — Subtext', type: 'TEXTAREA', isPublic: true, sortOrder: 3 },
  { key: 'content_hero_cta1', value: 'SHOP THE COLLECTION', group: 'CONTENT', label: 'Hero — Button 1 Text', type: 'TEXT', isPublic: true, sortOrder: 4 },
  { key: 'content_hero_cta2', value: 'BOOK BESPOKE', group: 'CONTENT', label: 'Hero — Button 2 Text', type: 'TEXT', isPublic: true, sortOrder: 5 },
  
  { key: 'content_rtw_label', value: 'READY TO WEAR', group: 'CONTENT', label: 'RTW Section — Label', type: 'TEXT', isPublic: true, sortOrder: 10 },
  { key: 'content_rtw_headline', value: 'New Collections', group: 'CONTENT', label: 'RTW Section — Headline', type: 'TEXT', isPublic: true, sortOrder: 11 },
  
  { key: 'content_bride_label', value: 'PRUDENTIAL BRIDE', group: 'CONTENT', label: 'Bride Section — Label', type: 'TEXT', isPublic: true, sortOrder: 20 },
  { key: 'content_bride_headline', value: "For the Bride\nWho Dares to\nBe Remembered.", group: 'CONTENT', label: 'Bride Section — Headline', type: 'TEXTAREA', isPublic: true, sortOrder: 21 },
  { key: 'content_bride_body', value: 'Prudential Bride is our most intimate offering. Each gown is a singular creation — hand-crafted in our Lagos atelier, built around your story.', group: 'CONTENT', label: 'Bride Section — Body Text', type: 'TEXTAREA', isPublic: true, sortOrder: 22 },
  { key: 'content_bride_cta1', value: 'EXPLORE BRIDAL COLLECTION', group: 'CONTENT', label: 'Bride Section — Button 1', type: 'TEXT', isPublic: true, sortOrder: 23 },
  { key: 'content_bride_cta2', value: 'BOOK BRIDAL CONSULTATION', group: 'CONTENT', label: 'Bride Section — Button 2', type: 'TEXT', isPublic: true, sortOrder: 24 },
  
  { key: 'content_bespoke_label', value: 'BESPOKE COUTURE', group: 'CONTENT', label: 'Bespoke Section — Label', type: 'TEXT', isPublic: true, sortOrder: 30 },
  { key: 'content_bespoke_headline', value: "One Piece.\nOne Story.\nYours.", group: 'CONTENT', label: 'Bespoke Section — Headline', type: 'TEXTAREA', isPublic: true, sortOrder: 31 },
  { key: 'content_bespoke_body', value: 'From the first sketch to the final stitch — every bespoke piece is conceived, designed, and hand-crafted exclusively for you.', group: 'CONTENT', label: 'Bespoke Section — Body', type: 'TEXTAREA', isPublic: true, sortOrder: 32 },
  
  { key: 'content_atelier_label', value: 'THE ATELIER', group: 'CONTENT', label: 'Atelier Section — Label', type: 'TEXT', isPublic: true, sortOrder: 40 },
  { key: 'content_atelier_headline', value: "Built in Lagos.\nWorn Worldwide.", group: 'CONTENT', label: 'Atelier Section — Headline', type: 'TEXTAREA', isPublic: true, sortOrder: 41 },
  { key: 'content_atelier_body', value: 'Prudent Gabriel began as a single vision in Lagos, Nigeria. Today, our pieces are worn at weddings, galas, and boardrooms across four continents.', group: 'CONTENT', label: 'Atelier Section — Body', type: 'TEXTAREA', isPublic: true, sortOrder: 42 },
  
  { key: 'content_newsletter_headline', value: 'Join the Inner Circle.', group: 'CONTENT', label: 'Newsletter — Headline', type: 'TEXT', isPublic: true, sortOrder: 50 },
  { key: 'content_newsletter_subtext', value: 'New collections, exclusive access, and stories from the atelier.', group: 'CONTENT', label: 'Newsletter — Subtext', type: 'TEXT', isPublic: true, sortOrder: 51 },
  
  // SHOP PAGE
  { key: 'content_shop_headline', value: 'The Edit.', group: 'CONTENT', label: 'Shop — Headline', type: 'TEXT', isPublic: true, sortOrder: 60 },
  { key: 'content_shop_subtext', value: 'Ready-to-Wear · Bespoke · Bridal', group: 'CONTENT', label: 'Shop — Subtext', type: 'TEXT', isPublic: true, sortOrder: 61 },
  
  // CONSULTATION PAGE
  { key: 'content_consult_label', value: 'BOOK A CONSULTATION', group: 'CONTENT', label: 'Consultation — Label', type: 'TEXT', isPublic: true, sortOrder: 70 },
  { key: 'content_consult_headline', value: "Your Vision,\nOur Craft.", group: 'CONTENT', label: 'Consultation — Headline', type: 'TEXTAREA', isPublic: true, sortOrder: 71 },
  { key: 'content_consult_subtext', value: 'Choose your consultant. Select your session. Begin the journey.', group: 'CONTENT', label: 'Consultation — Subtext', type: 'TEXT', isPublic: true, sortOrder: 72 },
  
  // BESPOKE PAGE
  { key: 'content_bespoke_page_headline', value: "Your Vision,\nOur Craft.", group: 'CONTENT', label: 'Bespoke Page — Headline', type: 'TEXTAREA', isPublic: true, sortOrder: 80 },
  
  // PFA BANNER
  { key: 'content_pfa_label', value: 'PRUDENTIAL FASHION ACADEMY', group: 'CONTENT', label: 'PFA Banner — Label', type: 'TEXT', isPublic: true, sortOrder: 90 },
  { key: 'content_pfa_text', value: 'Over 5,000 designers trained. The school behind the brand.', group: 'CONTENT', label: 'PFA Banner — Text', type: 'TEXT', isPublic: true, sortOrder: 91 },
  { key: 'content_pfa_cta', value: 'EXPLORE PFA →', group: 'CONTENT', label: 'PFA Banner — Button Text', type: 'TEXT', isPublic: true, sortOrder: 92 },
  
  // ANNOUNCEMENT BAR
  { key: 'content_announce_1', value: 'FREE SHIPPING ON ORDERS OVER ₦150,000 WITHIN LAGOS', group: 'CONTENT', label: 'Announcement Bar — Message 1', type: 'TEXT', isPublic: true, sortOrder: 100 },
  { key: 'content_announce_2', value: 'NEW COLLECTION — THE EDIT IS NOW LIVE', group: 'CONTENT', label: 'Announcement Bar — Message 2', type: 'TEXT', isPublic: true, sortOrder: 101 },
  { key: 'content_announce_3', value: 'BOOK YOUR BESPOKE CONSULTATION TODAY', group: 'CONTENT', label: 'Announcement Bar — Message 3', type: 'TEXT', isPublic: true, sortOrder: 102 },
  
  // FOOTER
  { key: 'content_footer_tagline', value: 'Lagos, Nigeria', group: 'CONTENT', label: 'Footer — Tagline below logo', type: 'TEXT', isPublic: true, sortOrder: 110 },
  { key: 'content_footer_copyright', value: '© 2025 Prudent Gabriel. All Rights Reserved.', group: 'CONTENT', label: 'Footer — Copyright text', type: 'TEXT', isPublic: true, sortOrder: 111 },
]

for (const s of contentSettings) {
  await prisma.siteSetting.upsert({
    where: { key: s.key },
    update: {},
    create: s,
  })
}
```

### B2 — Wire Content into Pages

**Update `src/lib/settings.ts`** — add:
```typescript
// getContentSettings(): Promise<Record<string, string>>
//   Fetch all SiteSettings where group: 'CONTENT' and isPublic: true
//   Return key-value object
//   Cache 5 minutes (same pattern as other settings)

// getContent(key: string, fallback: string): string helper
//   Synchronous — use after awaiting getContentSettings()
```

**Update `src/app/(storefront)/page.tsx`** (homepage):
```typescript
// Server component — fetch both images and content:
const [images, content] = await Promise.all([
  getImageSettings(),
  getContentSettings(),
])

// Pass content to each section as props:
<Hero
  heroImage={images.img_hero}
  label={content.content_hero_label}
  headline={content.content_hero_headline}
  subtext={content.content_hero_subtext}
  cta1Text={content.content_hero_cta1}
  cta2Text={content.content_hero_cta2}
/>

<BrandMarquee
  messages={[
    content.content_announce_1,
    content.content_announce_2,
    content.content_announce_3,
  ]}
/>

<NewCollections
  label={content.content_rtw_label}
  headline={content.content_rtw_headline}
/>

<PrudentialBride
  label={content.content_bride_label}
  headline={content.content_bride_headline}
  body={content.content_bride_body}
  cta1Text={content.content_bride_cta1}
  cta2Text={content.content_bride_cta2}
  heroImage={images.img_bride_hero}
  portraitImage={images.img_bride_portrait}
/>

<BespokeCouture
  label={content.content_bespoke_label}
  headline={content.content_bespoke_headline}
  body={content.content_bespoke_body}
  image={images.img_bespoke}
/>

<AtelierStory
  label={content.content_atelier_label}
  headline={content.content_atelier_headline}
  body={content.content_atelier_body}
  wideImage={images.img_atelier_wide}
  portraitImage={images.img_atelier_portrait}
/>

<NewsletterSection
  headline={content.content_newsletter_headline}
  subtext={content.content_newsletter_subtext}
/>
```

**Each component must be updated to accept these props** with hardcoded defaults as fallback:
```typescript
// Example Hero.tsx:
interface HeroProps {
  heroImage?: string
  label?: string
  headline?: string
  subtext?: string
  cta1Text?: string
  cta2Text?: string
}

// Use prop OR fallback:
const displayHeadline = headline ?? 'The New\nEdit.'
// Render with line breaks: displayHeadline.split('\n').map((line, i) => <span key={i}>{line}<br/></span>)
```

**Wire content into other pages:**
- `src/app/(storefront)/shop/page.tsx` → `content_shop_headline`, `content_shop_subtext`
- `src/app/(storefront)/consultation/page.tsx` → `content_consult_*`
- `src/app/(storefront)/bespoke/page.tsx` → `content_bespoke_page_headline`
- `src/components/common/PFABanner.tsx` → fetch content client-side or pass as prop
- `src/components/layout/AnnouncementBar.tsx` → fetch `content_announce_*` client-side
- `src/components/layout/Footer.tsx` → `content_footer_*`

---

## TASK C — SETTINGS PAGE RESTRUCTURE

### C1 — Replace tabbed settings with page-per-group navigation

**Replace `src/app/(admin)/admin/settings/page.tsx`**:

```typescript
// This page becomes a SETTINGS OVERVIEW — shows all setting groups as cards
// No tabs. Each group card links to its own settings page.
```

```
PAGE: /admin/settings

HEADER:
  "Settings" (Bodoni Moda 24px)
  "Manage your store configuration" (Jost 13px, dark-grey)

SETTINGS GRID (2-col desktop, 1-col mobile, gap-4, mt-8):

Each group card (white, border 1px #EBEBEA, p-6, hover bg-[#FAFAFA]):
  Icon (large, 32px, olive) + Group name (Jost 14px weight-500 black)
  Description (Jost 13px, dark-grey, mt-1)
  "[N] settings" badge (right, Jost 11px, dark-grey)
  Arrow → (right, olive)
  Link to: /admin/settings/[group.toLowerCase()]

GROUP CARDS (in this order):
  📦 Store         → "Store name, contact, currency, shipping thresholds"
  🖼️  Appearance   → "Site images, logo, favicon"
  📝 Content       → "Edit all text and copy across the website"    ← NEW
  💳 Payments      → "Paystack, Flutterwave, Stripe, Monnify keys"
  📧 Email & SMS   → "Email provider, SMS gateway, templates"
  🔗 Social Media  → "Instagram, TikTok, Facebook, WhatsApp"
  ⭐ Loyalty       → "Points configuration and referral rewards"
  🔔 Notifications → "Admin alerts and Slack integration"
  🔍 SEO           → "Meta titles, descriptions, OG image"
  📁 Media Library → "Upload and manage all site media"
  🖼️  Gallery       → "Manage Atelier and Bridal gallery images"   ← LINK TO /admin/gallery
```

**Create individual settings pages:**

**`src/app/(admin)/admin/settings/[group]/page.tsx`** (Server Component):
```typescript
// Fetch settings for the group from DB
// Render appropriate settings form component
// Back link: ← Settings

// Route mapping:
// /admin/settings/store       → StoreSettingsForm
// /admin/settings/appearance  → AppearanceSettingsForm (rebuilt — see C2)
// /admin/settings/content     → ContentSettingsForm (new — see C3)
// /admin/settings/payments    → PaymentsSettingsForm
// /admin/settings/email       → EmailSmsSettingsForm
// /admin/settings/social      → SocialSettingsForm
// /admin/settings/loyalty     → LoyaltySettingsForm
// /admin/settings/notifications → NotificationsSettingsForm
// /admin/settings/seo         → SEOSettingsForm
// /admin/settings/media       → redirect to /admin/gallery (media is now gallery)
```

### C2 — Appearance Settings Form (rebuilt)

**`src/components/admin/settings/AppearanceSettingsForm.tsx`**:

```
LAYOUT: Two sections on same page

SECTION 1 — "Site Images"
  Description: "These images appear throughout the website. 
                Click Upload to replace any image."
  
  Clean 2-col grid of image slots:
  Each slot:
    ┌──────────────────────────────────────────────┐
    │  Label: "Homepage Hero Image"                 │
    │  ┌─────────────────┐                          │
    │  │  [Image preview │  [Upload New Image]       │
    │  │   200×130px]    │  [Preview Full Size]      │
    │  └─────────────────┘                          │
    │  URL: [text input — editable]                 │
    └──────────────────────────────────────────────┘
  
  Upload: file picker → POST /api/admin/upload → fills URL input
  Preview: opens image in Radix Dialog (full size)
  
  [Save All Images] button at bottom (olive)

SECTION 2 — "Brand Assets"
  Logo URL (with upload button)
  Favicon URL (with upload button)
  OG Share Image (with upload button)
```

### C3 — Content Settings Form (NEW)

**`src/components/admin/settings/ContentSettingsForm.tsx`**:

```
This is the most powerful admin feature — edit every text on the site.

LAYOUT: Grouped accordion sections (Radix Accordion)

Each section = one page/area of the site:

HOMEPAGE (defaultOpen):
  Hero Label (text input, 1 line)
  Hero Headline (textarea, note: "Use \n for line breaks")
  Hero Subtext (textarea)
  Hero Button 1 text (text input)
  Hero Button 2 text (text input)
  
  RTW Section Label (text input)
  RTW Section Headline (text input)
  
  Bridal Section Label, Headline, Body, CTA 1, CTA 2

  Bespoke Section Label, Headline, Body

  Atelier Section Label, Headline, Body
  
  Newsletter Headline, Subtext

ANNOUNCEMENT BAR:
  Message 1, Message 2, Message 3 (text inputs)
  Note: "These rotate in the announcement bar at the top of every page"

SHOP PAGE:
  Shop Headline, Subtext

CONSULTATION PAGE:
  Label, Headline, Subtext

BESPOKE PAGE:
  Headline

PFA BANNER:
  Label, Text, Button text

FOOTER:
  Tagline below logo
  Copyright text

STYLE:
  Each field: label (Jost 11px uppercase, dark-grey) + input/textarea
  Textarea: min-height 80px, resize-y
  Section header: Jost 12px weight-500 black + count of fields

[SAVE ALL CONTENT] button (olive, sticky bottom OR at end of page)
  On save: PATCH /api/admin/settings/CONTENT with all changed values
  Toast: "Content updated. Changes live within 5 minutes ✓"
  Note: "Changes take up to 5 minutes to appear due to caching."
```

---

## TASK D — NOTIFICATION BELL (FULL IMPLEMENTATION)

### D1 — Notifications API

**`src/app/api/admin/notifications/route.ts`** (GET)
```typescript
// Fetch ALL AdminNotifications, orderBy createdAt desc, take 50
// Return: {
//   notifications: AdminNotification[],
//   unreadCount: number,
//   counts: {
//     orders: number,         // NEW_ORDER unread
//     bespoke: number,        // NEW_BESPOKE unread
//     consultations: number,  // NEW_CONSULTATION unread
//     reviews: number,        // REVIEW_PENDING unread
//     lowStock: number,       // LOW_STOCK unread
//     paymentFailed: number,  // PAYMENT_FAILED unread
//   }
// }
```

**`src/app/api/admin/notifications/read/route.ts`** (PATCH)
```typescript
// Body: { id?: string, markAllRead?: boolean }
// If id: update single notification isRead: true
// If markAllRead: updateMany where isRead: false
// Return: { success: true }
```

**`src/app/api/admin/notifications/count/route.ts`** (GET)
```typescript
// Lightweight route — just returns unreadCount
// Polled every 30 seconds by admin topbar
// Return: { count: number }
// No auth needed for count (protected by middleware)
```

### D2 — Create Notifications When Events Happen

**`src/lib/notifications.ts`** (new file):
```typescript
import { prisma } from './prisma'
import { AdminNotificationType } from '@prisma/client'

// createNotification(params: {
//   type: AdminNotificationType
//   title: string
//   message: string
//   link?: string
//   entityId?: string
// }): Promise<void>
//   Create AdminNotification record
//   Fire and forget (don't await in calling code — use void)

// Convenience functions:
// notifyNewOrder(order): void
//   createNotification({ type: NEW_ORDER, title: 'New Order',
//     message: '#[orderNumber] — ₦[total] via [gateway]',
//     link: '/admin/orders/[id]', entityId: order.id })

// notifyNewBespoke(request): void
// notifyNewConsultation(booking): void
// notifyReviewPending(review, productName): void
// notifyLowStock(product, variant): void
// notifyPaymentFailed(order): void
// notifyNewCustomer(user): void
```

**Wire notifications into existing API routes:**
- `src/app/api/orders/create/route.ts` → call `notifyNewOrder(order)` after $transaction
- `src/app/api/bespoke/route.ts` → call `notifyNewBespoke(request)`
- `src/app/api/consultations/create/route.ts` → call `notifyNewConsultation(booking)`
- `src/app/api/reviews/route.ts` → call `notifyReviewPending(review, productName)`
- `src/app/api/payment/*/webhook/route.ts` → call `notifyPaymentFailed(order)` on failed

**For low stock:** wire into `src/app/api/orders/create/route.ts` — after decrementing stock,
check if any variant.stock <= variant.lowStockAt and call `notifyLowStock`.

### D3 — Notification Bell Component

**Update `src/components/admin/AdminTopbar.tsx`**:

Replace the static bell icon with `<NotificationBell />`:

**`src/components/admin/NotificationBell.tsx`** (client component):

```typescript
// STATE:
//   unreadCount: number (polled every 30s)
//   notifications: AdminNotification[]
//   isOpen: boolean (dropdown)
//   isLoading: boolean

// POLLING:
//   useEffect with setInterval(30000):
//     fetch /api/admin/notifications/count
//     update unreadCount
//   Clear interval on unmount

// ON OPEN:
//   fetch /api/admin/notifications (full list)
//   mark all as read: PATCH /api/admin/notifications/read { markAllRead: true }
//   After marking read: set unreadCount to 0

// BELL BUTTON:
//   Lucide Bell icon, 16px, #6B6B68
//   BADGE (shows when unreadCount > 0):
//     Absolute top-0 right-0
//     bg-olive, white text
//     Jost 9px weight-600
//     Min-width 16px, height 16px, rounded-full
//     Shows number if ≤ 9, shows "9+" if more
//     Animate: scale pulse on new notification (Framer Motion)

// DROPDOWN PANEL (Radix Popover):
//   Width: 380px
//   Max-height: 480px, overflow-y-auto
//   bg-white, border 1px #EBEBEA, shadow-lg
//   NO border-radius (brand rule)
//   
//   HEADER:
//     "Notifications" (Jost 12px uppercase tracking, black)
//     "[N] unread" (Jost 11px, olive) | [Mark all read] (Jost 11px, dark-grey, right)
//     Border-bottom 1px #EBEBEA
//   
//   NOTIFICATION LIST:
//     Each item (padding 14px 16px, border-bottom 1px #F5F5F3):
//       Unread: left border 3px solid olive, bg-[#FAFAF8]
//       Read: no border, white bg
//       
//       ICON (left, 32px circle):
//         NEW_ORDER:         bg-[#E8F5E9], ShoppingCart icon (green)
//         NEW_BESPOKE:       bg-[#F0E8FF], Scissors icon (purple)
//         NEW_CONSULTATION:  bg-[#E8F4FF], Calendar icon (blue)
//         REVIEW_PENDING:    bg-[#FFF8E7], Star icon (amber)
//         LOW_STOCK:         bg-[#FDECEA], AlertTriangle icon (red)
//         PAYMENT_FAILED:    bg-[#FDECEA], CreditCard icon (red)
//         NEW_CUSTOMER:      bg-[#E8F5E9], User icon (green)
//         COUPON_EXPIRING:   bg-[#FFF8E7], Tag icon (amber)
//       
//       CONTENT (right of icon):
//         Title: Jost 13px weight-500 black
//         Message: Jost 12px weight-300 dark-grey, line-clamp-2
//         Time: Jost 11px dark-grey/60, right-aligned
//               "Just now" | "5 min ago" | "2 hours ago" | "Yesterday"
//               Use date-fns formatDistanceToNow
//       
//       onClick: router.push(notification.link) + close dropdown
//   
//   EMPTY STATE:
//     Bell icon (32px, #E8E8E4)
//     "All caught up!" (Jost 13px, dark-grey)
//   
//   FOOTER:
//     [View All Activity] → /admin (links to dashboard)
//     Jost 11px, olive, centered, border-top

// OUTSIDE CLICK: closes dropdown (Radix Popover handles this)
```

---

## TASK E — COUPONS PAGE FIX

The existing coupons page has issues with adding new coupons. Rebuild it cleanly.

### E1 — Coupons Page

**Update `src/app/(admin)/admin/coupons/page.tsx`**:

```typescript
// Server component
// Fetch all coupons with usage counts
// Pass to CouponsClient
```

**`src/components/admin/CouponsClient.tsx`** (full rebuild):

```
PAGE HEADER:
  "Coupons" (Bodoni Moda 24px)
  "[N] active coupons" (Jost 13px, dark-grey)
  [+ CREATE COUPON] button (olive, right)

STATS ROW (4 cards, mb-6):
  Active Coupons | Total Uses (all time) | Revenue Saved (₦) | Expiring Soon

FILTER TABS:
  All | Active | Expired | Scheduled | Disabled
  (Filter by isActive + expiresAt)

COUPONS TABLE:
  Columns: Code | Type | Value | Min Order | Uses | Expiry | Status | Actions
  
  Code: Jost 12px weight-600, olive, monospace
  Type badge:
    PERCENTAGE:   bg-[#E8F4FF] text-[#1A5FAD] "% OFF"
    FIXED_AMOUNT: bg-[#E8F5E9] text-[#1B5E20] "₦ OFF"
    FREE_SHIPPING: bg-[#F0E8FF] text-[#6B3FAD] "FREE SHIP"
  Value: Jost 13px
  Uses: "[usedCount] / [max ?? ∞]"
  Expiry: formatted date OR "No expiry" (red if past, amber if < 7 days)
  Status toggle: Toggle.tsx (olive = active)
  Actions: [Edit] (pencil) | [Delete] (trash + confirm)

ROW CLICK: opens CouponFormModal (edit mode)
[+ CREATE COUPON]: opens CouponFormModal (create mode)
```

### E2 — CouponFormModal (complete rebuild)

**`src/components/admin/CouponFormModal.tsx`**:

```
Radix Dialog, width 560px, NO border-radius

HEADER:
  "Create Coupon" / "Edit Coupon" (Bodoni Moda 22px)
  X close button

FORM (React Hook Form + Zod, ALL fields visible at once):

ROW 1: Coupon Code
  Text input (uppercase, monospace font)
  In create mode: editable
  In edit mode: disabled with lock icon (code can't change after creation)
  [Generate Random] button: generates 8-char alphanumeric code
  Validation: unique check on blur (GET /api/admin/coupons/check?code=X)

ROW 2: Description (optional)
  Text input: "e.g. 10% off for new customers"

ROW 3: Discount Type (3 radio cards side by side)
  [ % Percentage ] [ ₦ Fixed Amount ] [ 🚚 Free Shipping ]
  Selected: olive border, olive icon
  
  If Percentage OR Fixed Amount selected → show:
  ROW 3b: Discount Value
    Number input with suffix "%" OR "₦" based on type
    Percentage: max 100
    Fixed: NGN amount (e.g. 5000)

ROW 4: Minimum Order Amount (optional)
  "₦" prefix number input
  Placeholder: "No minimum"

ROW 5: Usage Limits (2 inputs side by side)
  Max Total Uses: number input (empty = unlimited)
  Max Per Customer: number input (default 1)

ROW 6: Applies To (radio)
  ● All Products  ○ Specific Categories
  If Specific Categories:
    Multi-checkbox: Bridal, Evening Wear, Formal, Casual, Kiddies, Accessories

ROW 7: Validity Period (2 date inputs side by side)
  Start Date (default: today)
  End Date (optional — leave blank for no expiry)
  Quick buttons: [+7 days] [+30 days] [+90 days] — sets end date relative to today

ROW 8: Status
  Toggle: "Coupon is active" (olive when active)

PREVIEW CARD (below form, bg-[#FAFAF8], border 1px #EBEBEA, p-4):
  "Preview — how this coupon appears at checkout:"
  ┌────────────────────────────────────┐
  │ ✓ SUMMER20 applied                 │
  │ "20% off your order" — save ₦X,XXX │
  └────────────────────────────────────┘
  Updates live as user fills the form

FOOTER:
  [Cancel] (ghost) [Save Coupon] (olive, loading state)

SUBMIT:
  Create: POST /api/admin/coupons
  Edit: PATCH /api/admin/coupons/[id]
  On success: close modal, refresh list, toast "Coupon created ✓"
  On code-already-exists error: show error under code field
```

### E3 — Add coupon check API

**`src/app/api/admin/coupons/check/route.ts`** (GET):
```typescript
// Query: code (string)
// Check if coupon code already exists: prisma.coupon.findUnique({ where: { code } })
// Return: { exists: boolean }
// Used for real-time validation in the form
```

---

## TASK F — MANUAL BESPOKE ORDER ENTRY

### F1 — Manual Bespoke Form

Add a [+ Add Manual Request] button to `/admin/bespoke` page.

**`src/components/admin/ManualBespokeForm.tsx`** (client component):

```
Radix Dialog, width 640px, NO border-radius

HEADER:
  "Add Manual Bespoke Request" (Bodoni Moda 22px)
  Subtitle: "For clients who placed orders offline or by phone."
  X close

FORM SECTIONS:

SECTION 1 — "Client Information":
  Full Name (Input, required)
  Phone Number (Input, required)
  Email Address (Input, optional)
  Country (Select, default Nigeria)
  How did we hear from them? (Select: Walk-in, Phone call, WhatsApp, Referral, Other)

SECTION 2 — "Order Details":
  Occasion (Select: White Wedding, Traditional Wedding, Corporate Event, Birthday, Other)
  Description (Textarea, required, min 10 chars):
    Placeholder: "Describe the garment, style, fabric preferences, colours..."
  Budget Range (Select: Under ₦200k | ₦200k–₦500k | ₦500k–₦1M | Above ₦1M)
  Timeline (Select: Under 2 weeks | 2–4 weeks | 1–2 months | 3+ months)

SECTION 3 — "Pricing & Payment":
  Agreed Price (₦ number input, required)
    Label: "Agreed price with client"
  Payment Method (Select: Cash | Bank Transfer | POS | Paid Online | Pending)
  Deposit Paid (₦ number input, optional)
    Label: "Deposit amount received (if any)"
  Balance Due: auto-calculated — (Agreed Price - Deposit Paid), shown in olive

SECTION 4 — "Sketches & References" (optional):
  Upload Sketches:
    Multi-file upload (up to 10 files)
    Accept: image/*, application/pdf (PDFs for hand-drawn sketches)
    Each file: POST /api/admin/upload with folder=prudent-gabriel/bespoke-sketches
    Show thumbnails + PDF icon for PDFs
    Caption per file: small text input below each thumbnail
  
  Upload Reference Images:
    Separate upload zone (up to 5 images)
    Same upload pattern

SECTION 5 — "Measurements" (optional, collapsible accordion):
  Bust (cm), Waist (cm), Hips (cm), Height (cm)
  Additional Notes (textarea)

SECTION 6 — "Admin Notes":
  Internal notes (textarea)
  Label: "These notes are internal only — not visible to client"

INITIAL STATUS:
  Auto-set to: CONFIRMED (since admin is adding this directly — it's already agreed)
  Override radio: PENDING | CONFIRMED | IN_PROGRESS

FOOTER:
  [Cancel] [Save Manual Request] (olive)

ON SUBMIT:
  POST /api/admin/bespoke/manual with all form data
  
  API route creates BespokeRequest with:
    requestNumber: generateBespokeNumber()
    source: "MANUAL_ADMIN_ENTRY"
    status: selected status
    estimatedPrice: agreed price
    adminNotes: admin notes + "\n\nPayment: [method]. Deposit: ₦[deposit]. Balance: ₦[balance]."
    referenceImages: uploaded reference image URLs
    measurements: measurements object if filled
    (sketches stored in adminNotes or a new sketchUrls field — see below)
  
  Return: { success: true, requestNumber }
  Toast: "Bespoke request #[BQ-xxx] created ✓"
  Close modal, refresh bespoke table
```

### F2 — Add sketchUrls to BespokeRequest

**Update `prisma/schema.prisma`**:
```prisma
// Add to BespokeRequest model:
sketchUrls    String[]   // Cloudinary URLs of admin-uploaded sketches
agreedPrice   Float?     // Manually set agreed price
depositPaid   Float?     // Deposit received
paymentMethod String?    // Cash, Transfer, POS, etc.
entrySource   String?    // "MANUAL_ADMIN_ENTRY" | "WEBSITE"
```

### F3 — Show sketches in Bespoke Detail

**Update `src/app/(admin)/admin/bespoke/[id]/page.tsx`**:

```
In the admin bespoke detail view, show sketches section:
  If sketchUrls.length > 0:
    "Sketches" section label
    Thumbnail grid (3-col):
      Images: next/image
      PDFs: PDF icon + filename + "View" link (opens in new tab)
  
  Pricing summary card (if agreedPrice set):
    Agreed Price: ₦[agreedPrice]
    Deposit Paid: ₦[depositPaid ?? 0]
    Balance Due: ₦[agreedPrice - depositPaid] (olive if balance > 0, green if 0)
    Payment Method: [paymentMethod]
```

---

## TASK G — SEED GALLERY DEMO DATA

**Add to `prisma/seed.ts`**:

```typescript
// Create demo gallery images (using curated Unsplash URLs)
const atelierImages = [
  { url: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800', alt: 'Atelier workspace', caption: 'The workshop where every piece begins' },
  { url: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=600', alt: 'Design team at work', caption: 'Our team in Lagos' },
  { url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800', alt: 'Fabric selection' },
  { url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600', alt: 'Editorial fashion shot' },
  { url: 'https://images.unsplash.com/photo-1594463750939-ebb28c3f7f75?w=800', alt: 'Bridal gown detail' },
  { url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600', alt: 'Fashion editorial' },
  { url: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800', alt: 'Formal wear' },
  { url: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600', alt: 'Ready to wear' },
  { url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800', alt: 'Wardrobe curation' },
  { url: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=600', alt: 'Style consultation' },
  { url: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=800', alt: 'Bridal collection' },
  { url: 'https://images.unsplash.com/photo-1529636798458-92182e662485?w=600', alt: 'Wedding preparation' },
]

const bridalImages = [
  { url: 'https://images.unsplash.com/photo-1594463750939-ebb28c3f7f75?w=800', alt: 'Prudential Bride gown', caption: 'Amore Collection 2024' },
  { url: 'https://images.unsplash.com/photo-1519741347686-c1e331ec5e96?w=600', alt: 'Bride portrait' },
  { url: 'https://images.unsplash.com/photo-1529636798458-92182e662485?w=800', alt: 'Bridal gown detail' },
  { url: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=600', alt: 'Wedding collection' },
  { url: 'https://images.unsplash.com/photo-1560180474-e8563fd75bab?w=800', alt: 'Bride silhouette' },
  { url: 'https://images.unsplash.com/photo-1585241645927-c7a8e5840c42?w=600', alt: 'Bridal accessories' },
  { url: 'https://images.unsplash.com/photo-1594463750939-ebb28c3f7f75?w=700', alt: 'Traditional bridal' },
  { url: 'https://images.unsplash.com/photo-1519741347686-c1e331ec5e96?w=800', alt: 'White wedding gown' },
]

for (const [i, img] of atelierImages.entries()) {
  await prisma.galleryImage.upsert({
    where: { publicId: `seed-atelier-${i}` },
    update: {},
    create: {
      url: img.url,
      publicId: `seed-atelier-${i}`,
      alt: img.alt,
      caption: img.caption ?? null,
      category: 'ATELIER',
      sortOrder: i,
      isPublished: true,
    },
  })
}

for (const [i, img] of bridalImages.entries()) {
  await prisma.galleryImage.upsert({
    where: { publicId: `seed-bridal-${i}` },
    update: {},
    create: {
      url: img.url,
      publicId: `seed-bridal-${i}`,
      alt: img.alt,
      caption: img.caption ?? null,
      category: 'BRIDAL',
      sortOrder: i,
      isPublished: true,
    },
  })
}
```

---

## TASK H — NAVBAR UPDATE

Add Atelier and Bridesals to navbar properly:

**Update `src/components/layout/Navbar.tsx`**:
```typescript
// Navigation links:
// HOME · ATELIER · BRIDESALS · READY TO WEAR ▾ · BOOK A CONSULTATION
//
// ATELIER → /atelier (gallery page)
// BRIDESALS → /bridesals (bridal gallery page)
//
// These were already in the navbar — verify they link correctly
// If they linked to /our-story or /shop?category=BRIDAL, update them:
//   ATELIER → /atelier
//   BRIDESALS → /bridesals
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
/atelier                    → Pinterest masonry gallery, 12 demo images
/atelier                    → Load More button shows (after 50 images)
/bridesals                  → Bridal gallery, warm hero, bride palette
/admin/gallery              → Upload + manage gallery images
/admin/settings             → Overview page with group cards (not tabs)
/admin/settings/content     → All text fields for every page
/admin/settings/appearance  → Image slots with upload buttons
/admin/settings/payments    → Gateway forms
/admin/bespoke              → [+ Add Manual Request] button
/admin/bespoke/new (modal)  → Form with sketch upload
/admin/coupons              → [+ Create Coupon] works end-to-end
/admin topbar               → Bell shows count, opens dropdown with categorised notifications
Notification badge          → Creates when new order/bespoke/consultation comes in
```

---

## SESSION END FORMAT

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION 10 COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Task A — Gallery system (GalleryImage model, /atelier, /bridesals, /admin/gallery)
✅ Task B — Content management (50+ text settings, all pages wired)
✅ Task C — Settings restructure (page-per-group, content page, appearance rebuilt)
✅ Task D — Notification bell (AdminNotification model, polling, dropdown, icons)
✅ Task E — Coupons (full rebuild, modal form, code validation, preview)
✅ Task F — Manual bespoke entry (form, sketch upload, pricing, admin notes)
✅ Task G — Gallery seed data (12 atelier + 8 bridal demo images)
✅ Task H — Navbar links updated (/atelier + /bridesals)

Build: ✅ passes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

*Prudent Gabriel · Session 10*
*Prepared by Nony | SonsHub Media*
