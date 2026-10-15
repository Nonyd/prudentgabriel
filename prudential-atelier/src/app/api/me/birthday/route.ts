import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { isValidBirthday } from "@/lib/birthday";

/** Any signed-in account (client, staff, admin) reads and sets its own birthday: day and month, no year. */
export async function GET() {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;
  const user = await prisma.user.findUnique({
    where: { id: gate.session.user.id },
    select: { birthdayDay: true, birthdayMonth: true },
  });
  return NextResponse.json({ day: user?.birthdayDay ?? null, month: user?.birthdayMonth ?? null });
}

const bodySchema = z.union([
  z.object({ day: z.number().int(), month: z.number().int() }),
  z.object({ day: z.null(), month: z.null() }),
]);

export async function PUT(req: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a day and a month" }, { status: 400 });
  const { day, month } = parsed.data;
  if (day !== null && month !== null && !isValidBirthday(day, month)) {
    return NextResponse.json({ error: "That day does not exist in that month" }, { status: 400 });
  }
  await prisma.user.update({
    where: { id: gate.session.user.id },
    data: { birthdayDay: day, birthdayMonth: month },
  });
  return NextResponse.json({ day, month });
}
