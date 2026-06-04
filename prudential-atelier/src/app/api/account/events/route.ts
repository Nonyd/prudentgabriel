import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
import { getOrCreateClientProfile } from "@/lib/account-helpers";
import { prisma } from "@/lib/prisma";
import { logActivity, logError } from "@/lib/logger";

export async function GET() {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  try {
    const profile = await getOrCreateClientProfile(gate.session.user.id!);
    const events = await prisma.eventDate.findMany({
      where: { clientId: profile.id },
      orderBy: { date: "asc" },
    });
    return NextResponse.json({ events });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ACCOUNT_EVENTS",
      message: e instanceof Error ? e.message : "Failed to get events",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

const createSchema = z.object({
  label: z.string().min(1),
  date: z.string().min(1),
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
    const event = await prisma.eventDate.create({
      data: {
        clientId: profile.id,
        label: parsed.data.label,
        date: new Date(parsed.data.date),
      },
    });

    await logActivity({
      userId: gate.session.user.id,
      action: "CREATE",
      module: "account",
      description: `Added event date: ${parsed.data.label}`,
      recordId: event.id,
      recordType: "EventDate",
    });

    return NextResponse.json({ event });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ACCOUNT_EVENTS_CREATE",
      message: e instanceof Error ? e.message : "Failed to create event",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
