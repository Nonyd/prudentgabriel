# CURSOR AI — PRUDENTGABRIEL.COM
## Fix: Homepage Issues + Full Dark Mode Audit
### Prepared by SonsHub Media Ltd (Nony — Okafor Chinonso Daniel)

---

## CRITICAL INSTRUCTIONS

1. Read the entire prompt before writing any code.
2. Dark mode fixes must use CSS variables — never hardcode colours that would break light mode.
3. The only exceptions are intentionally hardcoded brand elements (loyalty card #442913, stage tracker circles, hero banner).
4. Run `pnpm exec tsc --noEmit` after all changes.

---

## PART A — HOMEPAGE QUICK FIXES

### Fix 1 — Best sellers shows 3 products instead of 4

In the homepage best sellers section, the query is returning 3 products instead of 4.

Find the best sellers fetch in the homepage server component or `src/lib/best-sellers.ts`:

```typescript
// Current likely query — fix to always return 4:
const bestSellers = await prisma.product.findMany({
  where: { isPublished: true, isFeatured: true },
  take: 4,
  include: { images: true, variants: true },
  orderBy: { orderCount: 'desc' }
})

// If fewer than 4 featured products, fill with top products by orderCount:
if (bestSellers.length < 4) {
  const existingIds = bestSellers.map(p => p.id)
  const filler = await prisma.product.findMany({
    where: {
      isPublished: true,
      id: { notIn: existingIds }
    },
    take: 4 - bestSellers.length,
    include: { images: true, variants: true },
    orderBy: { orderCount: 'desc' }
  })
  bestSellers.push(...filler)
}
```

Also ensure the best sellers grid on the homepage 
uses a 4-column layout:
```css
/* Desktop: 4 columns */
grid-template-columns: repeat(4, 1fr);

/* Tablet: 2 columns */
@media (max-width: 1024px) {
  grid-template-columns: repeat(2, 1fr);
}

/* Mobile: 2 columns (smaller cards) */
@media (max-width: 640px) {
  grid-template-columns: repeat(2, 1fr);
}
```

### Fix 2 — Journal preview images are blank

The "Stories from the atelier" section on the homepage 
shows blank/empty image placeholders for the 3 blog posts.

**Root cause:** Blog posts were seeded without 
`featuredImage` URLs.

**Fix A — Update seed with real image URLs:**

In `scripts/seed-demo.ts`, update the 3 blog posts 
to include `featuredImage` URLs:

```typescript
// Post 1 — "Inside the beading room"
featuredImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800'

// Post 2 — "Choosing silk for a Lagos ceremony"
featuredImage: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=800'

// Post 3 — "The art of the second fitting"
featuredImage: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800'
```

Run: `pnpm run seed:demo`

**Fix B — Add fallback in the journal preview component:**

In the homepage journal preview section, if 
`post.featuredImage` is null or empty, show the 
`ImagePlaceholder` component instead of a broken image:

```tsx
{post.featuredImage ? (
  <img
    src={post.featuredImage}
    alt={post.title}
    className="object-cover w-full h-full"
    onError={(e) => {
      const target = e.target as HTMLImageElement
      target.style.display = 'none'
    }}
  />
) : (
  <ImagePlaceholder className="w-full h-full" />
)}
```

---

## PART B — FULL DARK MODE AUDIT

Go through every page and component systematically. 
For each issue found, fix using CSS variables only.

### Dark mode CSS variable reference:

```css
/* Light mode → Dark mode equivalents */
var(--bg)        /* #F0E8DD → dark page bg */
var(--bg-card)   /* white → dark card surface */
var(--choc)      /* #442913 → var(--cream) in dark */
var(--cream)     /* #E2D1C2 → stays cream in dark */
var(--sand)      /* #D4BBAC → slightly lighter in dark */
var(--text-mid)  /* medium brown → near-white in dark */
var(--text-light)/* light brown → medium grey in dark */
var(--border)    /* var(--sand) → rgba(white, 0.1) in dark */
```

### HARDCODED ELEMENTS — DO NOT CHANGE THESE:
These must stay the same colour in both modes:
- Loyalty card background: `#442913`
- Stage tracker circle fills
- Daily report banner: `#6B1C2A`
- Three ways section cards: `#442913`, `#5C3422`, `#3a1f0c`
- Bespoke journey section left column: `#442913`

---

### Pages to audit in order:

---

#### 1. PUBLIC NAVBAR

Check in dark mode:
- [ ] Logo shows white variant (not dark logo on dark bg)
- [ ] Nav links are readable (var(--cream) or near-white)
- [ ] Announcement bar background stays dark chocolate
- [ ] Cart icon, heart, user icon are visible
- [ ] Mobile menu overlay background is correct
- [ ] READY TO WEAR dropdown is readable in dark mode

Fix: ensure navbar reads `[data-theme="dark"]` correctly
and switches to white logo variant.

---

#### 2. HOMEPAGE

Check in dark mode:
- [ ] Hero section background stays var(--choc) — correct
- [ ] Hero text is readable (cream)
- [ ] Best sellers section background: should be dark page bg
- [ ] Product cards in dark mode: dark card bg, readable text
- [ ] "Three ways" section: hardcoded colours — already fixed
- [ ] Bespoke journey: left column hardcoded — already fixed
- [ ] Brand quote section: readable text
- [ ] Testimonials section: cards should have dark card bg
- [ ] Testimonial text readable (cream/near-white)
- [ ] PFA banner: stays wine/burgundy in both modes
- [ ] Journal preview: section bg correct, card text readable
- [ ] Footer: already dark — verify text is visible

---

#### 3. SHOP PAGE (`/shop`)

Check in dark mode:
- [ ] Page background: dark bg
- [ ] "Ready-to-Wear" heading: var(--cream)
- [ ] Filter pills: readable text, correct border
- [ ] Product cards: dark card bg
- [ ] Product name: var(--cream) or near-white
- [ ] Price text: readable
- [ ] Best Seller badge: wine background stays
- [ ] New In badge: readable on dark bg
- [ ] Hover states work in dark mode

---

#### 4. PRODUCT DETAIL PAGE (`/shop/[slug]`)

Check in dark mode:
- [ ] Page background: dark bg
- [ ] "PRUDENT GABRIEL" eyebrow: var(--lightbr)
- [ ] Product name: var(--cream)
- [ ] Price text: readable
- [ ] Size pills: correct colours (selected/unselected)
- [ ] ADD TO BAG button: stays dark chocolate bg
- [ ] ADD TO WISHLIST text: readable
- [ ] Trust badges: readable
- [ ] Accordion sections: bg and text correct
- [ ] Reviews section: card bg, text readable
- [ ] "You May Also Like" section: correct

---

#### 5. RTW PAGE (`/rtw`)

- [ ] Collections strip: card backgrounds correct
- [ ] Collection names readable
- [ ] Product grid same as shop

---

#### 6. COLLECTION DETAIL (`/rtw/collections/[slug]`)

- [ ] Header area readable
- [ ] Product grid correct

---

#### 7. ATELIER PAGE (`/atelier`)

- [ ] Hero stays dark chocolate — correct
- [ ] Process section: "Thirteen stages" bg and text
- [ ] Gallery section: bg and image borders
- [ ] Testimonials: readable
- [ ] CTA section: readable

---

#### 8. BRIDAL PAGE (`/bridal`)

- [ ] Hero readable
- [ ] Gallery section correct

---

#### 9. KIDS PAGE (`/kids`)

- [ ] Purple hero stays `#2D1B69` in both modes
- [ ] Amber accents correct
- [ ] Product grid readable

---

#### 10. JOURNAL PAGE (`/journal`)

- [ ] Page bg correct
- [ ] Featured post card: bg, title, excerpt readable
- [ ] Category pills correct
- [ ] Article cards: bg and text readable

---

#### 11. JOURNAL ARTICLE (`/journal/[slug]`)

- [ ] Article body text: readable (Lora, near-white in dark)
- [ ] Headings readable
- [ ] Author section correct
- [ ] Related posts correct

---

#### 12. CONSULTATION PAGE (`/consultation`)

- [ ] Page bg correct
- [ ] Step indicator readable
- [ ] Consultation type cards: bg and text correct
- [ ] Selected card state visible in dark mode
- [ ] "CONTINUE TO SCHEDULE" button correct
- [ ] Reviews slider: readable

---

#### 13. TRACK ORDER PAGE (`/track`)

- [ ] Search bar readable
- [ ] TRACK button correct
- [ ] Order summary card: dark chocolate bg stays
- [ ] Stage timeline: correct colours

---

#### 14. CONTACT PAGE (`/contact`)

- [ ] Form inputs: bg, border, text readable
- [ ] Labels readable
- [ ] Contact details text readable
- [ ] Send button correct
- [ ] Map section correct

---

#### 15. SIZE GUIDE (`/size-guide`)

- [ ] Tab navigation readable
- [ ] Table: header stays chocolate, rows correct in dark
- [ ] Alternating rows visible in dark mode
- [ ] "How to Measure" steps readable

---

#### 16. ABOUT PAGE (`/about`)

- [ ] Hero stays dark chocolate — correct
- [ ] Brand story section: text readable
- [ ] Founder section: dark chocolate bg — correct
- [ ] Stats row: numbers and labels readable
- [ ] Values cards: bg and text correct
- [ ] Location cards: bg and text correct

---

#### 17. CAREERS PAGE (`/careers`)

- [ ] Page bg correct
- [ ] Job cards: bg, text readable
- [ ] Filter pills correct
- [ ] Job type badges readable

---

#### 18. CAREERS DETAIL (`/careers/[slug]`)

- [ ] Job details text readable
- [ ] Application form: inputs, labels correct
- [ ] PFA verification section correct
- [ ] Submit button correct

---

#### 19. LOGIN MODAL

- [ ] Modal bg: ivory in light, dark card in dark mode
- [ ] Input fields readable
- [ ] Labels readable
- [ ] Submit button correct

---

#### 20. CLIENT DASHBOARD (`/account`)

- [ ] Sidebar: already dark chocolate — correct in both
- [ ] Page bg: correct
- [ ] Stats cards: bg and text correct
- [ ] Active commission card: bg and text
- [ ] Loyalty card: HARDCODED #442913 — stays same ✓
- [ ] Measurement vault card: correct
- [ ] Upcoming events card: correct
- [ ] Personalised picks: product cards correct

---

#### 21. ADMIN DASHBOARD (`/admin`)

- [ ] Sidebar: dark chocolate — correct in both modes
- [ ] Main content bg: correct in dark
- [ ] KPI cards: bg and text readable
- [ ] Daily report banner: HARDCODED wine — correct ✓
- [ ] Revenue chart: axis labels, legend readable
- [ ] Attendance panel: bg and text correct

---

#### 22. ADMIN — ALL OTHER PAGES

For each admin page, check:
- [ ] Page background correct
- [ ] Table rows: bg, text, borders readable
- [ ] Form inputs: bg, border, placeholder text readable
- [ ] Modal overlays: bg correct
- [ ] Button variants correct
- [ ] Status pills readable
- [ ] Empty states correct

Pages:
- /admin/bespoke
- /admin/consultations
- /admin/invoices
- /admin/clients
- /admin/attendance
- /admin/staff
- /admin/finance
- /admin/reviews
- /admin/careers
- /admin/content/pages
- /admin/settings

---

### Common dark mode fixes pattern:

**Problem: White card bg showing in dark mode**
```css
/* Wrong: */
background: white;
background: #ffffff;
background: var(--ivory);  ← inverts incorrectly

/* Right: */
background: var(--bg-card);
/* And ensure --bg-card is defined correctly in dark: */
/* [data-theme="dark"] { --bg-card: #1f1208; } */
```

**Problem: Dark text not readable on dark bg**
```css
/* Wrong: */
color: var(--choc);  ← inverts to cream, ok
color: #442913;      ← stays dark, invisible on dark bg
color: var(--text-mid);  ← verify this inverts

/* Right: */
color: var(--text-primary);  
/* defined as: */
/* light: #2A1A0E */
/* dark: #F0E8DD */
```

**Problem: Border invisible in dark mode**
```css
/* Wrong: */
border: 0.5px solid var(--sand);  ← too light on dark

/* Right: */
border: 0.5px solid var(--border);
/* defined as: */
/* light: var(--sand) */
/* dark: rgba(255,255,255,0.08) */
```

**Problem: Input fields dark on dark bg**
```css
/* Wrong: */
background: white;

/* Right: */
background: var(--input-bg);
/* defined as: */
/* light: white */
/* dark: rgba(255,255,255,0.05) */
```

### Ensure these CSS variables are defined in globals.css:

```css
:root {
  --bg-card: #ffffff;
  --bg-page: var(--bg);
  --text-primary: #2A1A0E;
  --border: var(--sand);
  --input-bg: #ffffff;
  --input-border: var(--sand);
}

[data-theme="dark"] {
  --bg-card: #1f1208;
  --bg-page: #150d05;
  --text-primary: #F0E8DD;
  --border: rgba(255,255,255,0.08);
  --input-bg: rgba(255,255,255,0.05);
  --input-border: rgba(226,209,194,0.15);
}
```

Use `var(--bg-card)` for all card backgrounds.
Use `var(--text-primary)` for all primary text.
Use `var(--border)` for all borders.
Use `var(--input-bg)` for all form input backgrounds.

---

## EXECUTION ORDER

1. Fix best sellers query (always return 4)
2. Fix best sellers grid (4-column layout)
3. Update blog post seed with featuredImage URLs
4. Run `pnpm run seed:demo`
5. Add ImagePlaceholder fallback to journal preview
6. Add missing CSS variables to globals.css
7. Audit and fix pages 1–22 in order
8. Test every page in dark mode after fixing
9. `pnpm exec tsc --noEmit` — must pass
10. Commit and push

---

## COMPLETION CHECKLIST

- [ ] Best sellers shows 4 products on homepage
- [ ] Journal preview images show (seeded or placeholder)
- [ ] All CSS variables defined for dark mode
- [ ] Navbar readable in dark mode, white logo shows
- [ ] All public pages readable in dark mode
- [ ] All form inputs readable in dark mode
- [ ] Client dashboard correct in dark mode
- [ ] Admin dashboard correct in dark mode
- [ ] No white-on-white or dark-on-dark text anywhere
- [ ] Hardcoded elements unchanged (loyalty card, banners)
- [ ] `pnpm build` passes with zero TypeScript errors

---

*Prepared by SonsHub Media Ltd for Prudential Atelier — prudentgabriel.com*
*₦7,500,000 engagement · Homepage Fixes + Dark Mode Audit*
