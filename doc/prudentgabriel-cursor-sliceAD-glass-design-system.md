# Slice AD — Glass Design System

**Repo:** `github.com/Nonyd/prudentgabriel` → `prudential-atelier/`
**Branch:** `staging`. Do not merge to `main` without being asked.
**Reference:** `prudential-mockup-D-glass.html` — the approved direction.

This replaces the visual language across storefront and admin with an Apple-style
liquid-glass aesthetic. **It keeps the existing structure** — hero video
carousel, page order, admin nav — and changes how surfaces look and feel.

It is a design-system change, not a page redesign. Build the primitives first
(AD0), prove them on one surface, then roll out. **Do not touch every component
in one pass.**

---

## AD0. Primitives — get these right and everything else follows

### The glass recipe

Three tiers, and every glass surface in the product uses one of them by name.

| Tier | Use | Light mode | Dark mode |
|---|---|---|---|
| `glass-1` | Chrome: nav pill, drawer, sticky bars, toasts | white @ 0.74, blur 28px, saturate 1.5 | choc-deep @ 0.66, blur 28px |
| `glass-2` | Cards and panels over imagery | white @ 0.62, blur 24px | choc-deep @ 0.58, blur 24px |
| `glass-3` | Modals and sheets — must read over anything | white @ 0.86, blur 32px | choc-deep @ 0.82, blur 32px |

Every tier gets: a 1px edge at `rgba(255,255,255,.55)` (light) or `.14` (dark),
an inset top highlight `inset 0 1px 0 rgba(255,255,255,.7)`, a soft deep shadow
`0 24px 60px -30px rgba(68,41,19,.35)`, and radius `26px` for panels, `999px`
for pills. Tokens, not values — one place to tune.

**The highlight line along the top edge is what makes it read as glass rather
than a translucent div.** Do not drop it.

### The field

Glass refracts what is behind it. On a flat background it is invisible.

- **Storefront:** a fixed, slow-drifting field of sand, gold and choc blurs — light
  through fabric — behind everything except the hero, where the video is the
  field. One ambient motion on the page; nothing else moves on its own.
- **Admin:** a **static** field, subtler, lower contrast. Someone works in the
  admin for hours; a drifting background is fatigue. Glass over a still field
  still reads as glass.
- The field stops entirely under `prefers-reduced-motion`.

### Fallbacks — non-negotiable

- `prefers-reduced-transparency`: every tier becomes opaque cream or choc. Apple
  users can turn glass off system-wide; honour it.
- `@supports not (backdrop-filter)`: opaque fallback, same tokens.
- **Contrast:** text on any glass tier must meet 4.5:1 against the *worst-case*
  field behind it. Where imagery is unpredictable — the hero, product cards —
  add a scrim between the image and the text, not more opacity on the glass.

### Motion

- Glass panels do not fade or slide in on scroll. That is the tell.
- Hover on a panel: a 1px lift and a slight brightening of the edge, 200ms. No
  scale.
- The only ambient motion is the field. Everything else responds to a person.

### Type

Unchanged: Cormorant Garamond display, Jost body and UI. Glass surfaces set body
in Jost 300 and controls in Jost 400. Drop the tracked-out capital eyebrow labels
wherever they remain — they date the page and fight the glass.

---

## AD1. Prove it on one surface first

Build the storefront **nav pill and cart drawer** with the primitives, push to
staging, and look at it on a real phone over the real hero video before anything
else. Report screenshots at 1440 and 390, over the video and over the field.

If the recipe needs tuning, tune it here where it is cheap. Only then continue.

---

## AD2. Storefront rollout — chrome first, then surfaces

**Chrome (glass-1 / glass-3):** nav pill detached from the top edge; mobile
drawer; cart drawer; Slice J's quick-add panel and mobile sticky bar; Slice S's
image dots; toasts; the currency switcher; modals (size chart, notify-me).

**Surfaces (glass-2):** homepage product tiles and the atelier panel as in the
mockup; the three-doors block; PDP information column; checkout steps; the
account pages; the success-page tracker.

**Hero:** keep the video carousel. The headline and CTA sit on a glass-1 panel
with a scrim beneath. Do not glass the video itself.

### What stays full-bleed

**The gallery grid from Slices M and S does not become glass tiles.** It is
photography-only at rest with hairline seams — that decision was made against
Elie Saab and it holds. Glass appears *over* it (quick-add, sticky bar, dots), not
*as* it. The homepage tiles in the mockup are a curated teaser, not the shop.

Say so in the code with a comment, because the next person will be tempted.

---

## AD3. Admin rollout — chrome glass, data opaque

The admin is a work tool. Mrs. Prudent and her team read tables in it for hours.

- **Glass on chrome only:** sidebar, topbar, modals, drawers, toasts, the
  permission editor, the product wizard rail, dashboard summary cards.
- **Data surfaces stay opaque:** the orders table, the ledger, the stock ledger,
  every form. Glass under a table of naira figures is unreadable and looks
  broken. Use a solid cream panel with the same radius and edge treatment so it
  belongs to the family without the blur.
- **Static field**, per AD0.
- **Dark mode** exists in the admin — build the dark tiers properly rather than
  inverting the light ones. Test the finance ledger in both.
- Slice T's nav derives from `admin-route-access.ts`; this changes how it looks,
  not what it contains.

---

## AD4. Performance budget

`backdrop-filter` is GPU work, and a mid-range Android in Lagos is the target
device. Slice S measured the mobile grid carefully; do not undo that.

- **At most 6 blurred surfaces visible at once on mobile.** If a screen needs
  more, the lower ones go opaque.
- Blur radius scales down below 768px — 28px becomes 16px.
- Measure before and after on `/shop`, the PDP, and `/checkout` on a real Android
  and report frame timing. If scrolling stutters, glass loses, not the customer.
- Never blur a surface that scrolls under another blurred surface. Stacked blur is
  where frame rates die.

---

## AD5. Do not glass

- Product photography. Ever.
- Data tables and the finance ledger.
- Form inputs — a text field on glass is hard to see. Inputs are solid.
- Email templates. Slice I's table-based layout has no `backdrop-filter`; emails
  keep their current design.
- The receipt lightbox and any private-media viewer.
- The maintenance page. It should just say the site is closed.

---

## Order and reporting

1. AD0 tokens and the three tiers, with fallbacks and the field. No surfaces yet.
2. AD1 nav pill and cart drawer. **Push. Look. Report with screenshots.**
3. AD2 storefront chrome, then surfaces. Push between them.
4. AD3 admin.
5. AD4 measurement.

Report after each numbered step with screenshots at desktop and phone width.
Every existing test script stays green throughout; `tsc --noEmit` clean.

## Constraints

- Structure unchanged: same pages, same order, same nav contents, same URLs.
- Slices J, M, S, Z5 behaviour unchanged — quick-add state machine, gallery
  grid, mobile swipe, 44px targets.
- No new colours. The four brand tokens plus the glass tiers.
- No scroll-triggered animation anywhere.
- Contrast and reduced-transparency are tested, not assumed.
