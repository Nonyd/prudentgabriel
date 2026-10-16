/** Shapes the site-traffic page reads. Server-free so the client can import them. */
export type TrafficRangeId = "today" | "7d" | "30d" | "90d" | "12m";

export type CountRow = { key: string; count: number };

export type TrafficTotals = {
  visitors: number;
  newVisitors: number;
  returningVisitors: number;
  pageviews: number;
  sessions: number;
  engagedSessions: number;
  /** Null until a visit with engagement tracking exists in the period. */
  bounceRate: number | null;
  pagesPerSession: number;
  avgPageSeconds: number;
  orders: number;
  revenueNGN: number;
  /** Paid orders placed during a counted visit (they carry its attribution). */
  countedOrders: number;
  conversion: number;
  bots: number;
};

export type TrafficReport = {
  range: {
    id: TrafficRangeId;
    label: string;
    from: string;
    to: string;
    prevFrom: string;
    prevTo: string;
    monthly: boolean;
  };
  generatedAt: string;
  totals: TrafficTotals;
  prevTotals: TrafficTotals;
  series: { bucket: string; label: string; pageviews: number; visitors: number; sessions: number; returning: number }[];
  live: { minutesAgo: number; count: number }[];
  countries: CountRow[];
  countryKnown: boolean;
  channels: CountRow[];
  sources: { source: string; landings: number; orders: number; revenueNGN: number }[];
  campaigns: { label: string; landings: number; orders: number; revenueNGN: number }[];
  pages: { path: string; views: number; prevViews: number; entries: number; avgSeconds: number | null }[];
  landings: CountRow[];
  notFound: CountRow[];
  devices: CountRow[];
  browsers: CountRow[];
  os: CountRow[];
  screens: CountRow[];
  gaps: CountRow[];
  /** [weekday 0=Sun][hour 0-23], Lagos time. */
  heat: number[][];
  products: { productId: string; name: string; views: number; unitsSold: number }[];
  retentionDays: number;
  /** First day visitors, devices and countries were counted; older days have none. */
  visitorsSince: string | null;
};
