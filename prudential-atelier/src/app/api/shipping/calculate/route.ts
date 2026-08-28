import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listCheckoutShippingOptions } from "@/lib/shipping/options";
import { getShippingCopy } from "@/lib/shipping/copy";
import { NIGERIA_STATES } from "@/lib/geo/nigeria-states";
import { COUNTRIES } from "@/lib/geo/countries";
import { getLockedFx } from "@/lib/fx";

const bodySchema = z.object({
  address: z.object({
    city: z.string().optional().default(""),
    state: z.string().min(1),
    country: z.string().length(2),
  }),
  subtotalNGN: z.number().nonnegative(),
  isFreeShippingCoupon: z.boolean().optional().default(false),
  lines: z
    .array(
      z.object({
        quantity: z.number().int().positive(),
        variant: z
          .object({
            weightKg: z.number().optional(),
            lengthCm: z.number().optional(),
            widthCm: z.number().optional(),
            heightCm: z.number().optional(),
          })
          .optional(),
        product: z
          .object({
            weightKg: z.number().optional(),
            lengthCm: z.number().optional(),
            widthCm: z.number().optional(),
            heightCm: z.number().optional(),
          })
          .optional(),
      }),
    )
    .optional()
    .default([]),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { address, subtotalNGN, isFreeShippingCoupon, lines } = parsed.data;
  const { band, options, quoteConsent } = await listCheckoutShippingOptions({
    destination: address,
    subtotalNGN,
    lines,
    isFreeShippingCoupon,
  });

  const legacy = options.map((o) => ({
    zoneId: o.optionId,
    zoneName: o.name,
    costNGN: o.costNGN,
    isFree: o.isFree,
    estimatedDays: o.etaText,
    kind: o.kind,
    requiresConsent: o.requiresConsent,
    requiresAddress: o.requiresAddress,
    description: o.description,
  }));

  return NextResponse.json({
    band,
    options: legacy,
    quoteConsent,
  });
}

export async function GET() {
  const [copy, fx] = await Promise.all([getShippingCopy(), getLockedFx()]);
  return NextResponse.json({
    countries: COUNTRIES,
    nigeriaStates: NIGERIA_STATES,
    quoteConsent: copy.quoteConsent,
    dduDisclosure: copy.dduDisclosure,
    fx: { rate: fx.rate, source: fx.source, fetchedAt: fx.fetchedAt, stale: fx.stale },
  });
}
