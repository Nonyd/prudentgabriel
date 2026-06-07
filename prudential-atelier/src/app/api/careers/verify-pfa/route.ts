import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyPFAStudent } from "@/lib/pfa-verify";

const bodySchema = z.object({
  regNumber: z.string().min(4),
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

  const result = await verifyPFAStudent(parsed.data.regNumber);
  return NextResponse.json(result);
}
