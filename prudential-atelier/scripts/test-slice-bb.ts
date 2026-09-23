/**
 * Slice BB — dress the atelier page.
 *
 *   pnpm test:slice-bb                                  # renders the real components (CI)
 *   BASE_URL=http://localhost:3100 pnpm test:slice-bb   # and the served /atelier page
 *
 * - BB2: the stage list shows craft, not administration, and its heading states
 *   the number of stages it shows — rendered, including a CMS heading that says
 *   "Thirteen".
 * - BB3: one piece, one entry (frames grouped, a file uploaded twice shown
 *   once); a piece with no floor and no description renders its photographs and
 *   no empty slot; the admin rules for joining a piece.
 * - BB1: the hero puts no <video> in the server HTML; what paints first is an
 *   <img> fetched at high priority (the poster, or the house's own photograph),
 *   under a glass-1 panel.
 */
import "./preload-test-env";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
import { STAGE_ORDER } from "../src/lib/bespoke-stages";
import {
  ADMINISTRATIVE_STAGES,
  CRAFT_STAGES,
  craftStageLineKey,
  craftStages,
  processHeadline,
} from "../src/lib/atelier-craft-stages";
import {
  duplicateFileOf,
  groupAtelierPieces,
  joiningPieceId,
  pieceGaps,
  planPieceChange,
  type AtelierPiece,
  type GalleryRow,
} from "../src/lib/atelier-gallery";
import { AtelierLandingPage, AtelierPieceEntry } from "../src/components/atelier/AtelierLandingPage";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];

/** The numbers a heading states, read independently of the code under test. */
function numbersIn(text: string): number[] {
  const digits = (text.match(/\b\d+\b/g) ?? []).map(Number);
  const words = (text.toLowerCase().match(/[a-z]+/g) ?? []).map((w) => WORDS.indexOf(w)).filter((n) => n > 0);
  return [...digits, ...words];
}

function stagesSection(html: string): { heading: string; items: number } {
  const heading = /<h2 id="atelier-stages"[^>]*>([^<]*)<\/h2>/.exec(html)?.[1];
  assert(heading !== undefined, "the stage section has its heading");
  const list = /<ol[^>]*data-atelier-stages="(\d+)"[^>]*>([\s\S]*?)<\/ol>/.exec(html);
  assert(list, "the stage section has its list");
  const items = (list[2]!.match(/<li\b/g) ?? []).length;
  assert(Number(list[1]) === items, "the list's own count is its items");
  return { heading, items };
}

// The screening form (untouched by this slice) asks for the app router; outside Next, a stub.
const router = {
  back() {}, forward() {}, refresh() {}, prefetch() {}, push() {}, replace() {},
} as unknown as AppRouterInstance;

// next/image outside Next has no host allow-list loaded; the host policy is not what this test checks.
const images = {
  ...imageConfigDefault,
  remotePatterns: [
    { protocol: "http" as const, hostname: "**" },
    { protocol: "https" as const, hostname: "**" },
  ],
};

function render(el: ReturnType<typeof h>): string {
  return renderToStaticMarkup(
    h(ImageConfigContext.Provider, { value: images }, h(AppRouterContext.Provider, { value: router }, el)),
  );
}

function page(props: Partial<Parameters<typeof AtelierLandingPage>[0]>): string {
  return render(h(AtelierLandingPage, { heroItems: [], pieces: [], reviews: [], cms: {}, ...props }));
}

function stages() {
  assert(STAGE_ORDER.length === 13, "the pipeline keeps all thirteen stages");
  for (const s of ADMINISTRATIVE_STAGES) assert(STAGE_ORDER.includes(s), `${s} stays in the pipeline`);
  assert(CRAFT_STAGES.length === 9, "nine stages involve cloth");
  const list = craftStages();
  assert(list.every((s) => !ADMINISTRATIVE_STAGES.includes(s.stage)), "no administrative stage is shown");
  assert(list.every((s) => s.line && s.line.length > 20), "every stage carries a line of description");
  assert(!list.some((s) => /\b(invoice|fee|booking|payment)s?\b/i.test(`${s.label} ${s.line}`)), "none of it is about invoices");
  assert(craftStages({ [craftStageLineKey("BEADING_FINISHING")]: "By hand." }).find((s) => s.stage === "BEADING_FINISHING")?.line === "By hand.", "a stage line is editable in the CMS");

  assert(processHeadline(undefined, 9) === "Nine stages of craft", "the default heading counts the list");
  assert(processHeadline("Thirteen stages of craft", 9) === "Nine stages of craft", "a heading saying thirteen over nine is not printed");
  assert(processHeadline("The 13 Stages", 9) === "Nine stages of craft", "nor in digits");
  assert(processHeadline("How a gown is made, in {count} stages", 9) === "How a gown is made, in nine stages", "{count} is filled");
  assert(processHeadline("Stages of craft", 9) === "Stages of craft", "a heading with no number is kept");
  assert(processHeadline("Nine stages, one gown", 9) === "Nine stages, one gown", "a heading with the right number is kept");

  // Rendered: whatever the CMS says, the heading and the list agree.
  for (const cmsHeading of [undefined, "Thirteen stages of craft", "The Thirteen Stages", "{count} stages of craft", "13 steps"]) {
    const html = page({ cms: cmsHeading ? { atelier_process_headline: cmsHeading } : {} });
    const { heading, items } = stagesSection(html);
    assert(items === 9, `nine stages render (${items})`);
    const stated = numbersIn(heading);
    assert(stated.length > 0 && stated.every((n) => n === items), `"${heading}" agrees with ${items} stages (CMS: ${cmsHeading ?? "unset"})`);
    assert(!/Invoice Issuance|Consultation Fee|Consultation Booking/.test(html), "the administrative stages are not on the page");
  }
  console.log("ok stages: nine craft stages with lines; the heading always states the number shown");
}

const row = (id: string, url: string, extra: Partial<GalleryRow> = {}): GalleryRow => ({
  id,
  url,
  alt: null,
  caption: null,
  description: null,
  pieceOfId: null,
  priceFloorNGN: null,
  priceCeilingNGN: null,
  ...extra,
});

function pieces() {
  // The /atelier gallery on 23 September 2026, in public order: three gowns in eight
  // frames, two of them the same file uploaded twice.
  const A1 = "/media/public/g/9f6eb9.jpg";
  const A2 = "/media/public/g/58dfe3.jpg";
  const A3 = "/media/public/g/60693b.jpg";
  const B1 = "/media/public/g/d565b4.jpg";
  const B2 = "/media/public/g/f25cad.jpg";
  const C1 = "/media/public/g/4696ea.jpg";
  const today = [row("f1", A1), row("f2", A2), row("f3", A2), row("f4", B1), row("f5", A3), row("f6", B2), row("f7", A1), row("f8", C1)];

  const asIs = groupAtelierPieces(today);
  assert(asIs.length === 6, `a file uploaded twice is shown once (${asIs.length} entries from 8 frames)`);
  const dupes = duplicateFileOf(today);
  assert(dupes.get("f3") === "f2" && dupes.get("f7") === "f1" && dupes.size === 2, "the admin sees which rows share a file");

  const grouped = groupAtelierPieces(
    today.map((r) =>
      ["f2", "f3", "f5", "f7"].includes(r.id) ? { ...r, pieceOfId: "f1" } : r.id === "f6" ? { ...r, pieceOfId: "f4" } : r,
    ),
  );
  assert(grouped.length === 3, "grouped, the gallery is three pieces");
  assert(grouped.map((p) => p.frames.map((f) => f.id).join(",")).join(" | ") === "f1,f2,f5 | f4,f6 | f8", "each piece carries its own photographs, in order, once each");

  const hiddenHead = groupAtelierPieces([row("x2", "/b.jpg", { pieceOfId: "x1" }), row("y", "/c.jpg")]);
  assert(hiddenHead.length === 1 && hiddenHead[0]!.id === "y", "hiding a piece hides its frames");

  const words = groupAtelierPieces([
    row("h", "/h.jpg", { caption: " Ivory corset gown ", description: "Silk faille, hand-beaded bodice. For a church wedding in Enugu.", priceFloorNGN: 3_000_000 }),
    row("hf", "/hf.jpg", { pieceOfId: "h", description: "ignored", priceFloorNGN: 9 }),
  ])[0]!;
  assert(words.title === "Ivory corset gown" && words.guide.priceFloorNGN === 3_000_000, "the main photograph speaks for the piece");
  assert(words.frames[1]!.alt === "Ivory corset gown, another view", "every frame gets an alt from the piece");

  assert(pieceGaps(row("a", "/a")).needsPriceGuide && pieceGaps(row("a", "/a")).needsDescription, "a bare piece needs both");
  assert(!pieceGaps(row("a", "/a", { pieceOfId: "b" })).needsPriceGuide, "a frame is never flagged: its piece is");
  assert(!pieceGaps(row("a", "/a", { priceFloorNGN: 1, description: "x" })).needsDescription, "a finished piece needs nothing");

  // A piece with no floor and no description: its photographs, and no empty slot.
  for (const plain of [grouped[2]!, grouped[1]!]) {
    const html = render(h(AtelierPieceEntry, { piece: plain }));
    assert((html.match(/<img\b/g) ?? []).length === plain.frames.length, "the photographs render");
    assert(!/<h3\b/.test(html) && !/<figcaption/.test(html), "no title slot, no caption slot");
    assert(!/<(p|h3|div|span|figcaption)\b[^>]*>\s*<\/\1>/.test(html), "no empty element");
    assert(!/begin around|A guide, not a price/.test(html), "no price line without a floor");
    assert(!html.includes("7fr"), "no empty text column beside it");
  }
  const described: AtelierPiece = { ...grouped[0]!, title: "Ivory corset gown", description: "Silk faille.\nFor a church wedding.", guide: { priceFloorNGN: 3_000_000, priceCeilingNGN: null } };
  const full = render(h(AtelierPieceEntry, { piece: described }));
  assert(full.includes("Ivory corset gown") && full.includes("Silk faille.") && full.includes("7fr"), "a described piece has its words beside it");
  assert(full.includes("Pieces like this begin around ₦3,000,000.") && full.includes("A guide, not a price."), "and the price guide, as BA4 words it");
  const floorOnly = render(h(AtelierPieceEntry, { piece: { ...grouped[2]!, guide: { priceFloorNGN: 5_000_000, priceCeilingNGN: null } } }));
  assert(floorOnly.includes("₦5,000,000") && !/<h3\b/.test(floorOnly), "a floor alone shows the floor and no empty title");

  const pageHtml = page({ pieces: grouped });
  assert((pageHtml.match(/data-atelier-piece=/g) ?? []).length === 3, "the page shows one entry per piece");
  console.log("ok pieces: one piece one entry; duplicates once; a bare piece is photographs only");
}

function joining() {
  const base = { category: "ATELIER", caption: null, description: null, pieceOfId: null, priceFloorNGN: null, priceCeilingNGN: null };
  const f5 = { ...base, id: "f5", caption: "Side view", description: "Beaded lace.", priceFloorNGN: 3_000_000 };
  const f1 = { ...base, id: "f1" };

  assert(joiningPieceId(f5, { pieceOfId: "f1", moving: false }) === "f1", "joining is asked for");
  assert(joiningPieceId(f5, { pieceOfId: "f1", moving: true }) === null, "never while moving gallery");
  const err = (r: ReturnType<typeof planPieceChange>) => ("error" in r ? r.error : null);
  assert(err(planPieceChange(f5, { pieceOfId: "f5", moving: false }, null)) === "A photograph cannot belong to itself.", "not itself");
  assert(err(planPieceChange(f5, { pieceOfId: "nope", moving: false }, null)) !== null, "not a piece that is not there");
  assert(err(planPieceChange(f5, { pieceOfId: "f1", moving: false }, { ...f1, category: "BRIDAL" })) !== null, "not across galleries");
  assert(err(planPieceChange(f5, { pieceOfId: "f2", moving: false }, { ...f1, id: "f2", pieceOfId: "f1" })) === "Choose the piece's main photograph.", "one level only");

  const joined = planPieceChange(f5, { pieceOfId: "f1", moving: false }, f1);
  assert(!("error" in joined), "joining a bare piece works");
  assert(joined.head?.id === "f1" && joined.head.data.priceFloorNGN === 3_000_000 && joined.head.data.description === "Beaded lace." && joined.head.data.caption === "Side view", "what it carried moves to the piece");
  assert(joined.row.pieceOfId === "f1" && joined.row.priceFloorNGN === null && joined.row.description === null, "and the frame keeps no copy (typed once)");
  assert(joined.frames?.from === "f5" && joined.frames.to === "f1", "its own frames follow it");

  const priced = planPieceChange(f5, { pieceOfId: "f1", moving: false }, { ...f1, priceFloorNGN: 8_000_000, description: "Theirs." });
  assert(!("error" in priced) && priced.head && priced.head.data.priceFloorNGN === undefined && priced.head.data.description === undefined, "a piece's own floor and words are never overwritten");

  const frame = { ...base, id: "f7", pieceOfId: "f1" };
  assert(err(planPieceChange(frame, { priceFloorNGN: 4_000_000, moving: false }, null)) !== null, "a frame cannot take a floor of its own");
  assert(err(planPieceChange(frame, { description: "x", moving: false }, null)) !== null, "or a description");
  const alt = planPieceChange(frame, { moving: false }, null);
  assert(!("error" in alt) && alt.row.pieceOfId === "f1" && alt.frames === null, "saving a frame's alt text leaves it in its piece");

  const leave = planPieceChange(frame, { pieceOfId: null, description: "Now its own.", priceFloorNGN: 2_000_000, moving: false }, null);
  assert(!("error" in leave) && leave.row.pieceOfId === null && leave.row.priceFloorNGN === 2_000_000 && leave.row.description === "Now its own.", "leaving a piece makes it one");

  const moved = planPieceChange(frame, { moving: true }, null);
  assert(!("error" in moved) && moved.row.pieceOfId === null, "moving gallery takes it out of its piece");
  const movedHead = planPieceChange(f1, { moving: true }, null);
  assert(!("error" in movedHead) && movedHead.frames?.from === "f1" && movedHead.frames.to === null, "and a moved piece's frames stay behind, standing alone");
  console.log("ok joining: one level, one gallery, words and floor typed once and never lost");
}

function hero() {
  const lead = { id: "f1", url: "/media/public/prudent-gabriel/gallery/atelier/9f6eb9.jpg", alt: "Beaded corset mini" };
  const piece: AtelierPiece = { id: "f1", title: null, description: null, guide: { priceFloorNGN: null, priceCeilingNGN: null }, frames: [lead] };
  const firstImg = (html: string) => /<img\b[^>]*>/.exec(html)?.[0] ?? "";

  const film = page({
    heroItems: [{
      type: "video",
      url: "/media/public/prudent-gabriel/hero-videos/atelier.mp4",
      poster: "/media/public/prudent-gabriel/hero-videos/atelier-poster.jpg",
      phoneUrl: "/media/public/prudent-gabriel/hero-videos/atelier-phone.mp4",
    }],
    pieces: [piece],
  });
  assert(!/<video/i.test(film), "a hero film puts no <video> in the server HTML");
  assert(!/preload="auto"/.test(film), "nothing preloads a film");
  assert(/fetchpriority="high"/i.test(firstImg(film)) && firstImg(film).includes("atelier-poster.jpg"), "the first thing on the page is the poster, fetched at high priority");
  assert(!film.includes("atelier-phone.mp4"), "the phone encode is not requested until she taps");

  const house = page({ pieces: [piece] });
  assert(/fetchpriority="high"/i.test(firstImg(house)) && firstImg(house).includes("9f6eb9"), "with nothing set, the house's own first piece is the hero");
  assert(!/unsplash|pexels|stock/i.test(house), "never stock");

  const bare = page({});
  for (const html of [film, house, bare]) {
    const panel = /<div class="glass-1 glass-panel[^"]*">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "";
    assert(/<h1\b/.test(panel) && panel.includes('href="/consultation"'), "the heading and the call to action sit on a glass-1 panel");
    assert(!/blur\(/.test(html.slice(0, html.indexOf("atelier-stages"))), "no blur is applied to the photograph itself");
  }
  assert(/bg-choc/.test(bare.slice(0, 600)), "with no photograph at all the hero is the house's dark ground, not empty cream");
  console.log("ok hero: poster or house photograph first, no <video> in the HTML, heading on glass-1");
}

async function live() {
  const base = process.env.BASE_URL?.replace(/\/$/, "");
  if (!base) {
    console.log("skip live: set BASE_URL");
    return;
  }
  const res = await fetch(`${base}/atelier`);
  assert(res.status === 200, `live: /atelier is 200 (${res.status})`);
  const html = await res.text();
  assert(!/<video/i.test(html), "live: no <video> in the served HTML");
  const { heading, items } = stagesSection(html);
  assert(numbersIn(heading).every((n) => n === items) && items === 9, `live: "${heading}" over ${items} stages`);
  assert(!/Invoice Issuance/.test(html), "live: no invoice on the page");
  console.log("ok live: /atelier served with the counted heading and no video in the HTML");
}

async function main() {
  stages();
  pieces();
  joining();
  hero();
  await live();
  console.log("OK test-slice-bb");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
