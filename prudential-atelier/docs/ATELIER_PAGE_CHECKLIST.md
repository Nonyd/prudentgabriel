# /atelier: what the house fills in (Slice BB4)

The code for Slice BB is on `staging`. Most of what a bride now sees on /atelier
depends on what is entered here. None of it needs a developer.

**Inventory, 23 September 2026** (published atelier gallery, the same on staging
and production): **8 frames, 3 gowns.** No gown has a price floor, a title or a
description. Two frames are the same file uploaded twice.

| Gown | What it looks like | Frames today (public order) |
|---|---|---|
| A | Pink, purple and blue beaded corset mini; pink studio backdrop; pink clutch | #1, #2, #3, #5, #7 |
| B | Green and navy beaded mini with a scalloped hem; chandelier room | #4, #6 |
| C | Silver beaded column gown with cape sleeves, worn with a gele; grey backdrop | #8 |

The `#` numbers are the ones shown on each tile in **Admin → Gallery → Atelier**.
They change if the gallery is reordered, so work from the photographs.

## 1. Frames that are one gown (Glory, 5 minutes)

**Admin → Gallery → Atelier.** A tile marked **Same file as #n** is an exact
duplicate. Deleting it no longer removes the photograph from its twin.

1. Delete **#3** (same file as #2) and **#7** (same file as #1).
2. Gown A: open **#2**, set **Piece** to "Another photograph of #1", Save. Do the same for **#5**.
3. Gown B: open **#6**, set **Piece** to "Another photograph of #4", Save.
4. Gown C is one photograph and needs nothing here.

Afterwards the header reads **3 pieces**. On /atelier each gown appears once,
with its photographs together.

## 2. Price floors (Mrs. Prudent decides; Glory enters)

**Admin → Gallery → Atelier**, open each gown's *main* photograph (#1, #4, #8),
**Price guide → From (₦)**. The dialog shows the exact sentence the page will
print: "Pieces like this begin around ₦3,000,000." A ceiling is optional.

- [ ] Gown A (#1): floor ₦________
- [ ] Gown B (#4): floor ₦________
- [ ] Gown C (#8): floor ₦________

Tiles marked **No price guide**, or the **Needs price guide** filter, list what
is still missing. Display only: nothing that charges money reads this (BA4).

## 3. Descriptions (Mrs. Prudent's words; Glory enters)

Same dialog, on each main photograph:

- **Title**: what the piece is called.
- **Description**: what it is, what it is made of, what it was for. For example: *"Ivory silk faille, a hand-beaded corset bodice. Made for a church wedding in Enugu."*

- [ ] Gown A (#1): title and description
- [ ] Gown B (#4): title and description
- [ ] Gown C (#8): title and description

Tiles marked **No description**, or the **Needs description** filter, list what
is still missing. Until a gown has words, it is shown as its photographs alone.

## 4. Stage lines (Mrs. Prudent, optional)

**Admin → Content → Pages → Atelier**: one **Stage line** for each of the nine
craft stages. The defaults are plain and make no claims about hours. If the
house wants a line such as *"Beading and finishing: four hundred hours,
sometimes more, by hand"*, write it here, with the real number.

The section heading counts the stages itself ("Nine stages of craft"). If the
**Process section headline** field names a number, it must be nine, or the page
ignores it. Use `{count}` to have the page fill in the number.

## 5. The hero photograph or film (Glory)

**No hero-grade photograph exists yet.** All the atelier images are 4:5 portrait
gallery frames. Until one is set, the hero shows the first gown in the gallery,
which is the house's own photography and never stock.

**Admin → Content → Pages → Atelier → Hero photograph or film.** Add an image,
or a video (MP4/WebM). A film gets a poster and a phone-sized copy, made by the
server, and waits for a tap on a phone, as on /rtw. On a wide screen it sits in
the right-hand column, so a **portrait** photograph or film works best. Change
it each season. The headline, line and button stay on the glass panel over it.

## What the gallery needs that no screen can fix

Three gowns is a small portfolio for a house quoting ₦3M to ₦10M. The page now
shows each gown once, well. It cannot show gowns that were never photographed.
A bridal and an evening commission photographed properly would do more for this
page than any further code.
