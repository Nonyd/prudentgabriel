# /atelier: what the house fills in

The atelier gallery on `staging` holds **34 photographs of 11 gowns**. Each gown
is one card with its photographs inside it. Its name and price sit under the
photograph at every width; its description shows on hover on a desktop.

(Earlier counts of 3 and then 5 gowns were wrong. Both came from what the page
showed, and the page loaded only the first 8 rows, then only 12 cards. The page
now loads every published photograph and shows up to 48 gowns.)

## The names, words and prices on staging are PLACEHOLDERS

**Everything in this table was invented** so the page could be judged with
content in it. None of it came from the house: not the names, occasions,
fabrics or prices. Mrs. Prudent's real values replace it.

| Gown | Photographs | Name | Floor | Description |
|---|---|---|---|---|
| A | pink, purple and blue beaded corset mini (3) | Adaeze | ₦2,000,000 | A corset mini for a fortieth birthday dinner, boned and then beaded by hand in violet, jade and sky, so the colour moves when she does. |
| B | green and navy beaded mini, scalloped hem (3) | Ifeoma | ₦2,500,000 | For the after-party of a Lagos wedding: navy, emerald and gold beads laid in swirls over a structured bodice, and a scalloped hem beaded to its edge so it holds its shape on the dance floor. |
| C | silver sculpted column, cape sleeves (3) | Morenike | ₦3,500,000 | An engagement gown in silver crepe, the skirt worked from waist to ankle in ribbons of folded fabric. The cape sleeves carry crystal and pearl, matched to her gele. |
| D | purple sequinned column, black pleated sleeves (3) | Titilayo | ₦3,000,000 | A traditional wedding gown in violet sequinned lace. The black sleeves are pleated and built out from the shoulder, and the neckline is edged with fabric flowers sewn on one at a time. |
| E | green beaded gown, lattice shoulders (4) | Chiamaka | ₦4,000,000 | Made for the sister of the bride: emerald beaded lace with lattice shoulders shaped over a fine wire frame and set with crystals, with a gele and bag to match. |
| F | powder-blue corset mermaid, petal hem, orange gele (3) | Folasade | ₦3,500,000 | A mermaid gown in powder-blue satin for a traditional engagement. The hem opens into stiffened petals lined in orange, green and gold, and a peacock is beaded across the hip by hand. |
| G | purple aso-oke gown, green-striped pleated sleeves, train (4) | Omolara | ₦4,000,000 | For a Yoruba traditional wedding: aso-oke woven in violet and green, pleated into sleeves that stand out from the shoulder, with coral beads at the neck and a train of purple silk behind. |
| H | gold sequinned column, couple portraits (3) | Ebele | ₦2,500,000 | A pre-wedding portrait gown: a fitted column embroidered in gold sequins and bugle beads, cut to sit beside the groom's jacket so the two catch the light together. |
| I | black beaded bodice, ivory-and-black patterned column, couple with agbada (3) | Yewande | ₦3,000,000 | For an introduction ceremony: a black bodice beaded in silver with sculpted shoulders, over a column skirt embroidered in an ivory-and-black pattern. |
| J | gold corset mini with beaded fringe (3) | Zainab | ₦1,500,000 | A cocktail mini for a thirtieth birthday: a gold corset worked in paillettes and bugle beads, finished with a beaded fringe that swings below the knee. |
| K | beadwork close-ups, flowers on turquoise, feather bag (2) | Nkechi | ₦3,500,000 | Close work from a reception gown: flowers cut and stitched by hand in pearl, coral and gold over turquoise and blush beading, with a feather bag dyed to match. |

Two things to check with the house: whether H's and I's couple portraits show
the house's work on the groom too, and whether K's two close-ups belong to a
gown photographed elsewhere. If K's close-ups belong to another gown, open each
in the admin and set **Piece** to that gown.

### How they are marked

- Each gown's main photograph carries `placeholder = true` in the database.
- **Admin → Gallery → Atelier**: its tile shows a red **Placeholder · invented, replace** badge. The header counts them ("… · 11 placeholder"), and a **Placeholder** filter lists them.
- Opening one shows a red box: *"Placeholder: invented for review. The title, description and price on this piece were made up so the page could be judged. None of it came from the house."*
- **They never appear on the production site.** The live page shows a placeholder gown as its photographs alone, and `deploy/sync-storefront-from-staging.sh` strips placeholder values when it copies the gallery to production.

### How Mrs. Prudent replaces them

**Admin → Gallery → Atelier**, choose the **Placeholder** filter, and edit each red-badged tile:

- **Title**: the gown's real name.
- **Description**: what it is, what it is made of, what it was for.
- **Price guide → From (₦)**: her floor. The dialog previews the sentence.

Saving any change to the title, description or floor clears the mark, and the
red badge goes. A gown she agrees with as written can be kept by unticking
**Still a placeholder** and saving; she should do that only for words she
would have written herself.

How it got there: `scripts/seed-atelier-demo.ts` (content in
`src/lib/atelier-demo-content.ts`). The staging container runs it at start-up,
once per version (`atelier_demo_content_v1`, then `_v2`). It refuses any
database that looks like production. It never overwrites a gown the house has
written, and never moves a photograph the house has grouped.

## What the seed also did (real, not placeholder)

- Deleted the two duplicate uploads: two of gown A's photographs had each been uploaded twice. The files stay.
- Grouped each gown's photographs under its main photograph, so the page shows 11 gowns rather than 34 frames.

## Still to come from the house

- [ ] Real name, description and floor for each of the eleven gowns (above).
- [ ] **A hero photograph.** Until one is set, the hero shows gown A's first frame, a 1080 × 1350 file stretched across a laptop screen. **Admin → Content → Pages → Atelier → Hero photograph or film.** Best is a landscape photograph at least 2400 px wide with the subject to the right (the headline panel sits on the left). A film works too.
- [ ] Optional: the stage lines (**Admin → Content → Pages → Atelier**), with real numbers if the house wants them ("four hundred hours, sometimes more, by hand").
