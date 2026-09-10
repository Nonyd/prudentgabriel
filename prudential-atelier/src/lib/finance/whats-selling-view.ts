export type SellingSort = "units" | "revenue";

export const DEMAND_COPY =
  "These figures are confirmed paid orders, not stock leaving a rail. Units and revenue are what to cut more of; trend is against the previous period.";

export const COLLECTION_DOUBLE_COUNT_COPY =
  "A piece in two collections is counted in both. Collection totals will not add up to the shop total.";

export const NO_SALES_COPY = "No sales in this period yet";

export const NO_COLLECTION_ASSIGNMENTS_COPY =
  "No pieces have been assigned to a collection yet. Collection figures stay empty until they are.";

export const NO_ORDERS_COPY =
  "Published pieces with no confirmed orders this period.";

export type SellingSizeRow = {
  size: string;
  sold: number;
};

export type SellingPiece = {
  productId: string;
  slug: string;
  name: string;
  thumbnailUrl: string | null;
  unitsSold: number;
  revenueNGN: number;
  orderedToMeasure: number;
  sizes: SellingSizeRow[];
  unitsPrev: number;
  revenuePrev: number;
};

export type SellingCollection = {
  collectionId: string;
  name: string;
  slug: string;
  unitsSold: number;
  revenueNGN: number;
  orderedToMeasure: number;
  unitsPrev: number;
  revenuePrev: number;
};

export type NotSellingPiece = {
  productId: string;
  slug: string;
  name: string;
  thumbnailUrl: string | null;
};

export type WhatsSellingReport = {
  pieces: SellingPiece[];
  collections: SellingCollection[];
  collectionsAssigned: boolean;
  notSelling: NotSellingPiece[];
};

export function sortValue(
  sort: SellingSort,
  row: { unitsSold: number; revenueNGN: number },
): number {
  if (sort === "revenue") return row.revenueNGN;
  return row.unitsSold;
}

export function compareSelling<T extends { name: string; unitsSold: number; revenueNGN: number }>(
  sort: SellingSort,
  a: T,
  b: T,
): number {
  const va = sortValue(sort, a);
  const vb = sortValue(sort, b);
  if (vb !== va) return vb - va;
  return b.unitsSold - a.unitsSold || a.name.localeCompare(b.name);
}

export function whatsSellingCsv(pieces: SellingPiece[]): string {
  const headers = [
    "Name",
    "Units sold",
    "Revenue (NGN)",
    "Ordered to measure",
    "Units previous",
    "Revenue previous (NGN)",
  ];
  const rows = pieces.map((p) => [
    p.name,
    String(p.unitsSold),
    String(p.revenueNGN),
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
