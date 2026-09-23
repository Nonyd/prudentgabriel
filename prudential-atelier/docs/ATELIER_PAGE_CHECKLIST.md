# /atelier: what the house fills in (Slices BB and BB2)

The code is on `staging`. What a bride sees on /atelier now depends on what is
entered here, and none of it needs a developer.

**Inventory, 23 September 2026.** The published atelier gallery has **14 rows
showing 5 gowns in 12 distinct photographs.** Two rows are the same file
uploaded twice. No gown has a price floor, a title or a description.

(An earlier count of "3 gowns in 8 frames" was wrong. The old page loaded only
the first 8 rows, so the other gowns never appeared.)

| Gown | What it looks like | Tiles in Admin → Gallery → Atelier |
|---|---|---|
| A | Pink, purple and blue beaded corset mini; pink studio backdrop | #1, #2, #5, plus duplicates #3 (of #2) and #7 (of #1) |
| B | Green and navy beaded mini with scalloped hem; chandelier room | #4, #6, #14 |
| C | Silver sculpted column gown with beaded cape sleeves, silver gele; grey backdrop | #8, #9 |
| D | Purple sequinned column, black pleated ruffle sleeves, purple gele, coral necklace | #10, #13 |
| E | Green beaded gown with lattice shoulders, green gele, green patent bag | #11, #12 |

The `#` numbers are the ones printed on each tile, and they assume no hidden
rows sit between them. If a number doesn't match the description, go by the
photograph. Numbers change when the gallery is reordered.

## 1. Frames that are one gown (Glory, about 10 minutes)

**Admin → Gallery → Atelier.** A tile marked **Same file as #n** is an exact
duplicate. Deleting it leaves its twin's photograph in place.

1. Delete **#3** and **#7**, the two duplicates.
2. For each extra photograph, open it, set **Piece** to "Another photograph of #n", then Save:
   - Gown A: #2 and #5 → #1
   - Gown B: #6 and #14 → #4
   - Gown C: #9 → #8
   - Gown D: #13 → #10
   - Gown E: #12 → #11

Afterwards the header reads **5 pieces**, and /atelier shows five gowns. Each
gown's photographs page inside its card: swipe on a phone, arrows on a desktop.

## 2. Price floors (Mrs. Prudent decides; Glory enters)

**Admin → Gallery → Atelier**. Open each gown's *main* photograph (#1, #4, #8,
#10, #11) and fill in **Price guide → From (₦)**. The card then shows "Begins
around ₦3,000,000 · A guide, not a price"; the dialog previews the wording.

- [ ] Gown A (#1): ₦________
- [ ] Gown B (#4): ₦________
- [ ] Gown C (#8): ₦________
- [ ] Gown D (#10): ₦________
- [ ] Gown E (#11): ₦________

Use the **Needs price guide** filter to see what is still missing. Display
only: nothing that charges money reads this (BA4).

## 3. Titles and descriptions (Mrs. Prudent's words; Glory enters)

In the same dialog, on each main photograph:

- **Title**: what the piece is called.
- **Description**: what it is, what it is made of, what it was for. For example: *"Ivory silk faille with a hand-beaded corset bodice. Made for a church wedding in Enugu."*

- [ ] Gown A · [ ] Gown B · [ ] Gown C · [ ] Gown D · [ ] Gown E

Use the **Needs description** filter to see what is still missing. The name,
description and floor appear over the photograph on hover on a desktop, and
under it on a phone. A gown with no words shows its photograph alone.

## 4. Stage lines (Mrs. Prudent, optional)

**Admin → Content → Pages → Atelier** has one **Stage line** per craft stage.
The defaults make no claims about hours. If the house wants a line such as
*"Beading and finishing: four hundred hours, sometimes more, by hand"*, write
it here with the real number. The heading counts the stages itself; to word it
differently, use `{count}` where the number goes.

## 5. The hero photograph or film (Glory)

**No hero-grade photograph exists yet.** Until one is set, the hero shows gown
A's first frame. That file is 1080 × 1350 and 86 KB, so on a laptop it is
stretched across a 1440-wide screen and looks soft. The code can't sharpen it.

**Admin → Content → Pages → Atelier → Hero photograph or film.** The hero is
edge to edge at every width, so the ideal is a **landscape photograph at least
2400 px wide**, with the subject off to the right (the headline panel sits on
the left). A film works too: the server makes its poster and a phone-sized
copy. Change it each season.

## What no screen can fix

Five gowns, each shown once with its photographs together, is a real
portfolio. Five is still few for a house quoting ₦3M to ₦10M, and every new
commission photographed properly adds to this page with no code at all.
