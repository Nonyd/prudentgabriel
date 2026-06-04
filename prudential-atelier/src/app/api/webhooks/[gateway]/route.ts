import { NextRequest, NextResponse } from "next/server";

const HANDLERS: Record<string, () => Promise<{ POST: (req: NextRequest) => Promise<Response> }>> = {
  paystack: () => import("@/app/api/payment/paystack/webhook/route"),
  flutterwave: () => import("@/app/api/payment/flutterwave/webhook/route"),
  stripe: () => import("@/app/api/payment/stripe/webhook/route"),
  monnify: () => import("@/app/api/payment/monnify/webhook/route"),
};

export async function POST(req: NextRequest, { params }: { params: { gateway: string } }) {
  const gateway = params.gateway.toLowerCase();
  const load = HANDLERS[gateway];
  if (!load) {
    return NextResponse.json({ error: "Unknown gateway" }, { status: 404 });
  }
  const mod = await load();
  return mod.POST(req);
}
