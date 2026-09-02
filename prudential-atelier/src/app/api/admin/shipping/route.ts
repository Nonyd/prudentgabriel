import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { getShippingAdminStatus } from "@/lib/shipping/mode";
import {
  getShippingCopy,
  SHIPPING_MODE_INTERNATIONAL_KEY,
  SHIPPING_MODE_NIGERIA_KEY,
  SHIPPING_QUOTE_CONSENT_KEY,
  SHIPPING_QUOTE_MANUAL_CONSENT_KEY,
} from "@/lib/shipping/copy";
import { ensureShippingSettingKeys } from "@/lib/shipping-settings-bootstrap";
import { setSetting } from "@/lib/settings";

const lagosSchema = z.object({
  name: z.string().min(2),
  price: z.number().min(0),
  freeAboveNGN: z.number().min(0).optional().nullable(),
  etaText: z.string().min(1),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional(),
});

export async function GET() {
  const gate = await requireAdminApi("shop");
  if (!gate.ok) return gate.response;
  await ensureShippingSettingKeys();
  const [methods, packaging, status, copy] = await Promise.all([
    prisma.shippingMethod.findMany({
      include: {
        pickupLocations: { orderBy: { sortOrder: "asc" } },
        lagosLocations: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.packagingProfile.findMany({ orderBy: { name: "asc" } }),
    getShippingAdminStatus(),
    getShippingCopy(),
  ]);
  return NextResponse.json({
    methods,
    packaging,
    status,
    copy: {
      manualConsent: copy.manualConsent,
      unavailableConsent: copy.unavailableConsent,
    },
  });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi("shop");
  if (!gate.ok) return gate.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = lagosSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const local = await prisma.shippingMethod.findUnique({ where: { kind: "LOCAL_FLAT" } });
  if (!local) return NextResponse.json({ error: "Lagos delivery method is missing" }, { status: 500 });

  const maxSort = await prisma.lagosLocation.aggregate({ _max: { sortOrder: true } });
  const loc = await prisma.lagosLocation.create({
    data: {
      shippingMethodId: local.id,
      name: parsed.data.name,
      price: parsed.data.price,
      freeAboveNGN: parsed.data.freeAboveNGN ?? null,
      etaText: parsed.data.etaText,
      isActive: parsed.data.isActive ?? true,
      sortOrder: parsed.data.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json(loc);
}

const patchSchema = z.object({
  nigeriaMode: z.enum(["MANUAL", "LIVE"]).optional(),
  internationalMode: z.enum(["MANUAL", "LIVE"]).optional(),
  manualConsent: z.string().min(8).optional(),
  unavailableConsent: z.string().min(8).optional(),
});

export async function PATCH(req: NextRequest) {
  const gate = await requireAdminApi("shop");
  if (!gate.ok) return gate.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await ensureShippingSettingKeys();
  const userId = gate.session.user!.id!;
  if (parsed.data.nigeriaMode) {
    await setSetting(SHIPPING_MODE_NIGERIA_KEY, parsed.data.nigeriaMode, userId);
  }
  if (parsed.data.internationalMode) {
    await setSetting(SHIPPING_MODE_INTERNATIONAL_KEY, parsed.data.internationalMode, userId);
  }
  if (parsed.data.manualConsent) {
    await setSetting(SHIPPING_QUOTE_MANUAL_CONSENT_KEY, parsed.data.manualConsent, userId);
  }
  if (parsed.data.unavailableConsent) {
    await setSetting(SHIPPING_QUOTE_CONSENT_KEY, parsed.data.unavailableConsent, userId);
  }
  const [status, copy] = await Promise.all([getShippingAdminStatus(), getShippingCopy()]);
  return NextResponse.json({
    status,
    copy: { manualConsent: copy.manualConsent, unavailableConsent: copy.unavailableConsent },
  });
}
