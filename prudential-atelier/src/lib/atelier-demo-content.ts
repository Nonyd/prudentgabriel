/**
 * PLACEHOLDER atelier content, invented so /atelier can be judged with words and
 * prices in it. None of it came from the house: names, occasions, fabrics and
 * floors are all made up. Every row it writes is marked `placeholder`, which
 * the admin flags on the tile and clears when Mrs. Prudent saves her own values;
 * the production site never renders it (placeholderContentVisible).
 *
 * Applied once, on staging only, by scripts/seed-atelier-demo.ts. Gowns are
 * found by the content hash in their file name, so the plan survives reorders.
 */

export type DemoGown = {
  key: string;
  /** Main photograph first, then the gown's other photographs. */
  files: string[];
  title: string;
  description: string;
  priceFloorNGN: number;
};

export const DEMO_CONTENT_MARKER = "atelier_demo_content_v1";

export const DEMO_GOWNS: DemoGown[] = [
  {
    key: "A",
    files: ["9f6eb9302a6d23629d66adc5cb9894f4", "58dfe3dfbcdc911da7eab18ea6af11c1", "60693b9a9f94286201e8fa89557f908e"],
    title: "Adaeze",
    description:
      "A corset mini for a fortieth birthday dinner, boned and then beaded by hand in violet, jade and sky, so the colour moves when she does.",
    priceFloorNGN: 2_000_000,
  },
  {
    key: "B",
    files: ["d565b4bb9dc541801f94aa224fb4bfac", "f25cadc1420d4eedb54a7b6dd487ce38", "4472016f48fbc32b060038ec2fa6e24f"],
    title: "Ifeoma",
    description:
      "For the after-party of a Lagos wedding: navy, emerald and gold beads laid in swirls over a structured bodice, and a scalloped hem beaded to its edge so it holds its shape on the dance floor.",
    priceFloorNGN: 2_500_000,
  },
  {
    key: "C",
    files: ["4696eada76848b79175bf95b0610eefe", "4777b76434896042c3f3f6f72b283897"],
    title: "Morenike",
    description:
      "An engagement gown in silver crepe, the skirt worked from waist to ankle in ribbons of folded fabric. The cape sleeves carry crystal and pearl, matched to her gele.",
    priceFloorNGN: 3_500_000,
  },
  {
    key: "D",
    files: ["40574387932d3bea7463d736657c0f9c", "563f4d258a8d64de8a93fdb4aa54a1c1"],
    title: "Titilayo",
    description:
      "A traditional wedding gown in violet sequinned lace. The black sleeves are pleated and built out from the shoulder, and the neckline is edged with fabric flowers sewn on one at a time.",
    priceFloorNGN: 3_000_000,
  },
  {
    key: "E",
    files: ["f680ae56ad57a75316258e7915047b80", "2801d5b680d61c11a34294de6e046a97"],
    title: "Chiamaka",
    description:
      "Made for the sister of the bride: emerald beaded lace with lattice shoulders shaped over a fine wire frame and set with crystals, with a gele and bag to match.",
    priceFloorNGN: 4_000_000,
  },
];

export type DemoRow = {
  id: string;
  url: string;
  caption: string | null;
  description: string | null;
  priceFloorNGN: number | null;
  priceCeilingNGN: number | null;
  pieceOfId: string | null;
};

export type DemoPlan = {
  /** Rows showing the same file as an earlier row: delete the row, keep the file. */
  deleteDuplicates: string[];
  /** Frame → its gown's main photograph. */
  group: Array<{ id: string; pieceOfId: string }>;
  /** Main photographs that get placeholder words and a floor. */
  fill: Array<{ id: string; gown: string; caption: string; description: string; priceFloorNGN: number }>;
  /** Gowns left alone, and why. */
  skipped: Array<{ gown: string; reason: string }>;
};

function fileHash(url: string): string | null {
  return /([0-9a-f]{32})\.(jpe?g|png|webp)(\?|$)/i.exec(url.trim())?.[1]?.toLowerCase() ?? null;
}

/**
 * What the seed will do to the atelier gallery, given its rows in public order.
 * Never overwrites anything the house has written: a gown whose main
 * photograph already has a title, description or floor keeps them.
 */
export function planDemoContent(rows: DemoRow[]): DemoPlan {
  const plan: DemoPlan = { deleteDuplicates: [], group: [], fill: [], skipped: [] };
  const firstByUrl = new Map<string, DemoRow>();
  const kept: DemoRow[] = [];
  for (const row of rows) {
    const url = row.url.trim();
    if (firstByUrl.has(url)) plan.deleteDuplicates.push(row.id);
    else {
      firstByUrl.set(url, row);
      kept.push(row);
    }
  }
  const byHash = new Map<string, DemoRow>();
  for (const row of kept) {
    const hash = fileHash(row.url);
    if (hash && !byHash.has(hash)) byHash.set(hash, row);
  }

  for (const gown of DEMO_GOWNS) {
    const [mainHash, ...others] = gown.files;
    const main = byHash.get(mainHash!);
    if (!main) {
      plan.skipped.push({ gown: gown.key, reason: "main photograph not in the gallery" });
      continue;
    }
    for (const hash of others) {
      const frame = byHash.get(hash);
      if (frame && frame.id !== main.id && frame.pieceOfId !== main.id) plan.group.push({ id: frame.id, pieceOfId: main.id });
    }
    const written = Boolean(main.caption?.trim() || main.description?.trim() || main.priceFloorNGN != null);
    if (written) {
      plan.skipped.push({ gown: gown.key, reason: "the house has already written this gown" });
      continue;
    }
    plan.fill.push({
      id: main.id,
      gown: gown.key,
      caption: gown.title,
      description: gown.description,
      priceFloorNGN: gown.priceFloorNGN,
    });
  }
  return plan;
}

/**
 * Where the seed may write: the staging site on the staging database, or a
 * laptop's scratch database with ALLOW_FIXTURES=true. Never production.
 */
export function demoSeedRefusal(opts: {
  siteUrl: string | undefined;
  productionDb: boolean;
  stagingDb: boolean;
  allowFixtures: boolean;
}): string | null {
  if (opts.productionDb) return "the database looks like production";
  const stagingSite = /^https:\/\/staging\.prudentgabriel\.com(\/|$)/.test(opts.siteUrl?.trim() ?? "");
  if (stagingSite) return opts.stagingDb ? null : "the staging site is not on the staging database";
  if (opts.stagingDb) return "the staging database, but not the staging site";
  return opts.allowFixtures ? null : "not staging; set ALLOW_FIXTURES=true for a scratch database";
}
