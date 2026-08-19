import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { signReceiptUploadTicket } from "@/lib/receipt-upload-ticket";

const bodySchema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const limited = rateLimitOr429(req, "receipt-ticket", 8, 15 * 60 * 1000);
  if (limited) return limited;
  if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "Upload unavailable" }, { status: 503 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  const { ticket, exp } = signReceiptUploadTicket(parsed.data.email);
  return NextResponse.json({ ticket, exp });
}
