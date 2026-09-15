export type FunnelStep = {
  id: string;
  label: string;
  count: number;
  prevCount: number;
};

export type TrafficRow = {
  label: string;
  source: string;
  campaign: string;
  content: string;
  medium: string;
  landings: number;
  orders: number;
  revenueNGN: number;
};

export type LookedRow = {
  productId: string;
  name: string;
  views: number;
  unitsSold: number;
};

export type HouseNumbers = {
  visits: number;
  visitsPrev: number;
  orders: number;
  ordersPrev: number;
  conversion: number;
  conversionPrev: number;
  revenueNGN: number;
  revenuePrev: number;
  rtwFunnel: FunnelStep[];
  atelierFunnel: FunnelStep[];
  traffic: TrafficRow[];
  lookedNotBought: LookedRow[];
  abandoned: { sessions: number; valueNGN: number };
  email: { sent: number; failed: number; dead: number };
  points: { issued: number; redeemed: number; outstanding: number };
  atelierStages: { stage: string; count: number; avgDays: number }[];
  retentionDays: number;
  gloryNote: string;
};
