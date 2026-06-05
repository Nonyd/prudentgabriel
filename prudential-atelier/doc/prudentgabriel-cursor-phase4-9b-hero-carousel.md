# CURSOR AI — PRUDENTGABRIEL.COM
## Phase 4.9b: Hero Image/Video Carousel
### Prepared by SonsHub Media Ltd (Nony — Okafor Chinonso Daniel)

---

## OBJECTIVE

Replace the static hero image on the right side of the homepage hero section with a stacked image/video carousel. The carousel supports both images and videos, auto-advances, and is managed from the admin CMS.

---

## SOURCE REFERENCE

The 21st.dev component below is the REFERENCE for the stacked card carousel effect. DO NOT copy it directly — adapt it to match our design system and add video support.

**Reference logic to borrow:**
- The pos/offset calculation for stacked cards
- translateX + scale + rotateY transform pattern
- The 4000ms auto-advance interval
- The isCenter/isAdjacent visibility logic

```typescript
// REFERENCE ONLY — do not copy directly
const offset = index - currentIndex;
const total = images.length;
let pos = (offset + total) % total;
if (pos > Math.floor(total / 2)) {
  pos = pos - total;
}
const isCenter = pos === 0;
const isAdjacent = Math.abs(pos) === 1;
```

---

## BUILD THIS COMPONENT

**File:** `src/components/sections/HeroCarousel.tsx`

Add `'use client'` at the top.

### Types:

```typescript
interface HeroCarouselItem {
  type: 'image' | 'video'
  url: string
  alt?: string
}

interface HeroCarouselProps {
  items: HeroCarouselItem[]
}
```

### Design rules (Prudent Gabriel design system):

- Remove ALL shadcn/Button imports — use plain HTML buttons styled with Tailwind
- Remove background gradient divs
- Remove title/subtitle props
- Remove bg-background, text-foreground Tailwind classes
- Use these design tokens:
  - Border color: `rgba(226,209,194,0.15)`
  - Arrow button bg: `rgba(68,41,19,0.6)`
  - Arrow button hover: `rgba(92,52,34,0.8)`
  - Arrow icon color: `#E2D1C2`

---

### Carousel container:

- Width: 100% of right column (40% of hero)
- Height: 100% of hero section (min-height: 600px)
- No overflow visible beyond container
- CSS perspective: 1200px on the inner wrapper

---

### Card dimensions:

- Center card: 280px wide, full height portrait (aspect 3:4)
- Side cards: scaled 0.82, blur 3px, opacity 0.45
- Border-radius: `8px` (not rounded-3xl)
- Border: `0.5px solid rgba(226,209,194,0.12)`
- Box-shadow on center card: `0 24px 64px rgba(0,0,0,0.4)`

---

### Card transforms (adapt from reference):

```javascript
style={{
  transform: `
    translateX(${pos * 42}%) 
    scale(${isCenter ? 1 : isAdjacent ? 0.82 : 0.65})
    rotateY(${pos * -8}deg)
  `,
  zIndex: isCenter ? 10 : isAdjacent ? 5 : 1,
  opacity: isCenter ? 1 : isAdjacent ? 0.45 : 0,
  filter: isCenter ? 'blur(0px)' : `blur(3px)`,
  visibility: Math.abs(pos) > 1 ? 'hidden' : 'visible',
  transition: 'all 0.5s ease-in-out',
}}
```

---

### Video support:

If `item.type === 'video'`:
- Render `<video>` instead of `<img>`
- Props: `autoPlay muted loop playsInline`
- Style: `objectFit: cover`, `width: 100%`, `height: 100%`
- Only autoPlay when `isCenter === true`
- Pause when not center:

```typescript
const videoRef = useRef<HTMLVideoElement>(null)

useEffect(() => {
  if (!videoRef.current) return
  if (isCenter) {
    videoRef.current.play().catch(() => {})
  } else {
    videoRef.current.pause()
  }
}, [isCenter])
```

If `item.type === 'image'`:
- Render `<img>` with `object-cover` and `w-full h-full`

---

### Navigation arrows:

Use `ChevronLeft` and `ChevronRight` from `lucide-react`.

```
Position: absolute, vertically centered (top-1/2 -translate-y-1/2)
Left arrow: left: -18px
Right arrow: right: -18px

Style:
  width: 36px
  height: 36px
  border-radius: 50%
  background: rgba(68,41,19,0.6)
  border: 0.5px solid rgba(152,117,91,0.3)
  color: #E2D1C2
  backdrop-filter: blur(8px)
  transition: all 0.2s ease
  cursor: pointer

Hover:
  background: rgba(92,52,34,0.9)
  transform: scale(1.05)
```

---

### Auto-advance:

- Advance every 4000ms
- Pause on hover (`onMouseEnter` sets a ref flag)
- Resume on mouse leave (`onMouseLeave` clears the flag)

```typescript
const isPaused = useRef(false)

useEffect(() => {
  const timer = setInterval(() => {
    if (!isPaused.current) {
      setCurrentIndex(prev => (prev + 1) % items.length)
    }
  }, 4000)
  return () => clearInterval(timer)
}, [items.length])
```

---

### Dot indicators:

Row of dots below the carousel, centered:

```
Active dot:  width 20px, height 4px, background #98755B, border-radius 2px
Inactive dot: width 6px, height 4px, background rgba(152,117,91,0.3), border-radius 2px
Gap between dots: 4px
Transition: width 0.3s ease
```

---

### Fallback carousel items:

Use these if no CMS items are set:

```typescript
const FALLBACK_CAROUSEL_ITEMS: HeroCarouselItem[] = [
  {
    type: 'image',
    url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600',
    alt: 'Prudent Gabriel Collection'
  },
  {
    type: 'image',
    url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600',
    alt: 'Prudent Gabriel Atelier'
  },
  {
    type: 'image',
    url: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600',
    alt: 'Prudent Gabriel Bridal'
  },
  {
    type: 'image',
    url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600',
    alt: 'Prudent Gabriel Ready to Wear'
  },
  {
    type: 'image',
    url: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600',
    alt: 'Prudent Gabriel Lagos'
  },
]
```

---

## CMS INTEGRATION

### Reading items in homepage server component:

In `src/app/(public)/page.tsx`:

```typescript
const carouselSetting = await prisma.siteSetting.findUnique({
  where: { key: 'home_hero_carousel' }
})

const carouselItems: HeroCarouselItem[] = 
  carouselSetting?.value 
    ? JSON.parse(carouselSetting.value)
    : FALLBACK_CAROUSEL_ITEMS
```

Pass `carouselItems` as a prop to the hero section, 
then into `<HeroCarousel items={carouselItems} />`.

### Admin CMS addition:

In `/admin/content/pages` → Homepage → Hero section,
add a **"Hero Media Carousel"** sub-section:

```
HERO MEDIA CAROUSEL

[+ Add Image]  [+ Add Video]

Each item card:
  [thumbnail/icon]
  Type: IMAGE or VIDEO pill
  URL: [input — or Cloudinary upload button]
  Alt text: [input, optional]
  [↑] [↓] reorder buttons
  [× remove] button

[Save Carousel]
```

On save: `PUT /api/admin/content/pages` with key 
`home_hero_carousel` and value `JSON.stringify(items)`.

---

## REPLACING THE CURRENT HERO IMAGE

In the homepage hero section component, find where 
the current static right-side image renders and replace:

**Before:**
```tsx
<div className="hero-image-container">
  <img src={heroImage} alt="..." ... />
</div>
```

**After:**
```tsx
<HeroCarousel items={carouselItems} />
```

The carousel fills exactly the same space as the 
current right-side image. No changes to the hero 
layout, text, or buttons on the left side.

---

## MOBILE BEHAVIOUR

On screens narrower than 768px (`md` breakpoint):
- Show single card only — no side cards visible
- Card fills full width of its container
- Navigation arrows still visible but smaller (28px)
- Auto-advance still works
- Dots still visible

```typescript
// On mobile, force side cards to be hidden
// Use a CSS media query or a useWindowSize hook
// When isMobile: only render the center card
```

---

## COMPLETION CHECKLIST

- [ ] `HeroCarousel.tsx` created at `src/components/sections/`
- [ ] Stacked card effect works (center + 2 side cards visible)
- [ ] Auto-advances every 4 seconds
- [ ] Pauses on hover, resumes on mouse leave
- [ ] Left/right arrow navigation works
- [ ] Dot indicators show correct active state
- [ ] Image items render correctly
- [ ] Video items autoplay muted when center, pause when not
- [ ] Fallback items show when no CMS data
- [ ] CMS carousel editor in admin homepage section
- [ ] Mobile shows single card only
- [ ] `pnpm exec tsc --noEmit` passes with zero errors

---

*Prepared by SonsHub Media Ltd for Prudential Atelier — prudentgabriel.com*  
*₦7,500,000 engagement · Phase 4.9b of 5*
