export type SellingSort = "sellThrough" | "units" | "revenue";

export const SELL_THROUGH_COPY =
  "Sell-through is how many of a piece left the studio compared with how many you held when this period started. Three of three sold outranks five of forty.";

export const COLLECTION_DOUBLE_COUNT_COPY =
  "A piece in two collections is counted in both. Collection totals will not add up to the shop total.";

export const NO_SALES_COPY = "No sales in this period yet";

export const NO_COLLECTION_ASSIGNMENTS_COPY =
  "No pieces have been assigned to a collection yet. Collection figures stay empty until they are.";

export type SellingSizeRow = {
  size: string;
  sold: number;
  stockHeld: number;
};

export type SellingPiece = {
  productId: string;
  slug: string;
  name: string;
  thumbnailUrl: string | null;
  unitsSold: number;
  revenueNGN: number;
  orderedToMeasure: number;
  stockedAtStart: number;
  sellThrough: number | null;
  sizes: SellingSizeRow[];
  unitsPrev: number;
  revenuePrev: number;
  sellThroughPrev: number | null;
};

export type SellingCollection = {
  collectionId: string;
  name: string;
  slug: string;
  unitsSold: number;
  revenueNGN: number;
  orderedToMeasure: number;
  stockedAtStart: number;
  sellThrough: number | null;
  unitsPrev: number;
  revenuePrev: number;
  sellThroughPrev: number | null;
};

export type NotSellingPiece = {
  productId: string;
  slug: string;
  name: string;
  thumbnailUrl: string | null;
  stockHeld: number;
};

export type WhatsSellingReport = {
  pieces: SellingPiece[];
  collections: SellingCollection[];
  collectionsAssigned: boolean;
  notSelling: NotSellingPiece[];
};

export function sortValue(
  sort: SellingSort,
  row: { unitsSold: number; revenueNGN: number; sellThrough: number | null },
): number | null {
  if (sort === "units") return row.unitsSold;
  if (sort === "revenue") return row.revenueNGN;
  return row.sellThrough;
}

export function compareSelling<T extends { name: string; unitsSold: number; revenueNGN: number; sellThrough: number | null }>(
  sort: SellingSort,
  a: T,
  b: T,
): number {
  const va = sortValue(sort, a);
  const vb = sortValue(sort, b);
  if (va == null && vb == null) return b.unitsSold - a.unitsSold || a.name.localeCompare(b.name);
  if (va == null) return 1;
  if (vb == null) return -1;
  if (vb !== va) return vb - va;
  return b.unitsSold - a.unitsSold || a.name.localeCompare(b.name);
}

export function whatsSellingCsv(pieces: SellingPiece[]): string {
  const headers = [
    "Name",
    "Units sold",
    "Revenue (NGN)",
    "Sell-through",
    "Stocked at start",
    "Ordered to measure",
    "Units previous",
    "Revenue previous (NGN)",
  ];
  const rows = pieces.map((p) => [
    p.name,
    String(p.unitsSold),
    String(p.revenueNGN),
    p.sellThrough == null ? "" : String(Math.round(p.sellThrough * 1000) / 10) + "%",
    String(p.stockedAtStart),
    String(p.orderedToMeasure),
    String(p.unitsPrev),
    String(p.revenuePrev),
  ]);
  const escape = (cell: string) => {
    if (/[",\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
    return cell;
  };
  return "\uFEFF" + [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
}
