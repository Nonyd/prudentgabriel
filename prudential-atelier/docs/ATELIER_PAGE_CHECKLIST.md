# /atelier: what the house fills in

The atelier gallery on `staging` shows **5 gowns**, each with its photographs
together. Each gown's name and price sit under its photograph at every width;
its description shows on hover on a desktop.

## The names, words and prices on staging are PLACEHOLDERS

**Everything below was invented** so the page could be judged with content in
it. None of it came from the house: not the names, occasions, fabrics or
prices. Mrs. Prudent's real values replace it.

| Gown | Photographs | Placeholder name | Placeholder floor | Placeholder description |
|---|---|---|---|---|
| A | pink, purple and blue beaded corset mini (3) | Adaeze | ₦2,000,000 | A corset mini for a fortieth birthday dinner, boned and then beaded by hand in violet, jade and sky, so the colour moves when she does. |
| B | green and navy beaded mini, scalloped hem (3) | Ifeoma | ₦2,500,000 | For the after-party of a Lagos wedding: navy, emerald and gold beads laid in swirls over a structured bodice, and a scalloped hem beaded to its edge so it holds its shape on the dance floor. |
| C | silver sculpted column, cape sleeves (2) | Morenike | ₦3,500,000 | An engagement gown in silver crepe, the skirt worked from waist to ankle in ribbons of folded fabric. The cape sleeves carry crystal and pearl, matched to her gele. |
| D | purple sequinned column, black pleated sleeves (2) | Titilayo | ₦3,000,000 | A traditional wedding gown in violet sequinned lace. The black sleeves are pleated and built out from the shoulder, and the neckline is edged with fabric flowers sewn on one at a time. |
| E | green beaded gown, lattice shoulders (2) | Chiamaka | ₦4,000,000 | Made for the sister of the bride: emerald beaded lace with lattice shoulders shaped over a fine wire frame and set with crystals, with a gele and bag to match. |

### How they are marked

- Each gown's main photograph carries `placeholder = true` in the database.
- **Admin → Gallery → Atelier**: its tile shows a red **Placeholder · invented, replace** badge. The header counts them ("… · 5 placeholder"), and a **Placeholder** filter lists them.
- Opening one shows a red box: *"Placeholder: invented for review. The title, description and price on this piece were made up so the page could be judged. None of it came from the house."*
- **They never appear on the production site.** The live page shows a placeholder gown as its photographs alone, and `deploy/sync-storefront-from-staging.sh` strips placeholder values when it copies the gallery to production.

### How Mrs. Prudent replaces them

**Admin → Gallery → Atelier** → the gown's main photograph (the red-badged tile) → edit:

- **Title**: the gown's real name.
- **Description**: what it is, what it is made of, what it was for.
- **Price guide → From (₦)**: her floor. The dialog previews the sentence.

Saving any change to the title, description or floor clears the placeholder
mark, and the red badge goes. A gown she agrees with as written can be kept by
unticking **Still a placeholder** and saving; she should do that only for words
she would have written herself.

How it got there: `scripts/seed-atelier-demo.ts` (content in
`src/lib/atelier-demo-content.ts`). The staging container runs it at start-up,
once. It refuses any database that looks like production, and never overwrites
a gown the house has already written. It leaves a record in the setting
`atelier_demo_content_v1`.

## What the seed also did (real, not placeholder)

- Deleted the two duplicate uploads: gown A's photographs had each been uploaded twice. The files themselves stay.
- Grouped each gown's photographs under its main photograph, so the page shows 5 gowns rather than 12 frames.

## Still to come from the house

- [ ] Real name, description and floor for each of the five gowns (above).
- [ ] **A hero photograph.** Until one is set, the hero shows gown A's first frame, a 1080 × 1350 file stretched across a laptop screen. **Admin → Content → Pages → Atelier → Hero photograph or film.** Best is a landscape photograph at least 2400 px wide with the subject to the right (the headline panel sits on the left). A film works too.
- [ ] Optional: the stage lines (**Admin → Content → Pages → Atelier**), with real numbers if the house wants them ("four hundred hours, sometimes more, by hand").
- [ ] More gowns. Five is a real portfolio but a short one for ₦3M–₦10M commissions. Each new gown is: upload, title, description, floor.
