import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
import { getOrCreateClientProfile } from "@/lib/account-helpers";
import { prisma } from "@/lib/prisma";
import { logActivity, logError } from "@/lib/logger";
import { storedPublicMediaUrlSchema } from "@/lib/media/stored-url";

export async function GET() {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  try {
    const profile = await getOrCreateClientProfile(gate.session.user.id!);
    const [moodboards, bespokeOrders] = await Promise.all([
      prisma.moodboard.findMany({
        where: { clientId: profile.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.bespokeOrder.findMany({
        where: { clientProfileId: profile.id },
        select: { id: true, orderRef: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return NextResponse.json({ moodboards, bespokeOrders });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ACCOUNT_MOODBOARDS",
      message: e instanceof Error ? e.message : "Failed to get moodboards",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

const createSchema = z.object({
  title: z.string().min(1),
  notes: z.string().optional(),
  images: z.array(storedPublicMediaUrlSchema).max(12),
  bespokeOrderId: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const profile = await getOrCreateClientProfile(gate.session.user.id!);

    if (parsed.data.bespokeOrderId) {
      const order = await prisma.bespokeOrder.findFirst({
        where: { id: parsed.data.bespokeOrderId, clientProfileId: profile.id },
      });
      if (!order) {
        return NextResponse.json({ error: "Invalid bespoke order" }, { status: 400 });
      }
    }

    const moodboard = await prisma.moodboard.create({
      data: {
        clientId: profile.id,
        title: parsed.data.title,
        notes: parsed.data.notes,
        images: parsed.data.images,
        bespokeOrderId: parsed.data.bespokeOrderId ?? undefined,
      },
    });

    await logActivity({
      userId: gate.session.user.id,
      action: "CREATE",
      module: "account",
      description: `Created moodboard: ${parsed.data.title}`,
      recordId: moodboard.id,
      recordType: "Moodboard",
    });

    return NextResponse.json({ moodboard });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ACCOUNT_MOODBOARDS_CREATE",
      message: e instanceof Error ? e.message : "Failed to create moodboard",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
