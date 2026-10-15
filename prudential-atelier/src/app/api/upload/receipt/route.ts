import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { dailyUploadCapOr429, receiptTicketCapOr429 } from "@/lib/upload-limits";
import { verifyReceiptUploadTicket } from "@/lib/receipt-upload-ticket";
import { logViewAsRequest } from "@/lib/client-view-as";
import { storePrivateUpload } from "@/lib/media/private-upload";

const FOLDER = "prudential-atelier/receipts";

export async function POST(req: NextRequest) {
  const limited = await rateLimitOr429(req, "receipt-upload", 12, 15 * 60 * 1000);
  if (limited) return limited;

  const session = await auth();
  // Uploads skip the middleware, so an admin viewing as a client is logged here.
  if (session?.user?.viewAs) await logViewAsRequest(session, { method: "POST", pathname: "/api/upload/receipt" });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  if (!session?.user?.id) {
    const email = String(form.get("email") ?? "");
    const ticket = String(form.get("ticket") ?? "");
    const exp = Number(form.get("exp") ?? 0);
    if (!verifyReceiptUploadTicket(email, ticket, exp)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Slice AZ5: guest uploads are capped per ticket and per day; signed-in customers are not anonymous.
    const ticketCapped = await receiptTicketCapOr429(ticket, exp);
    if (ticketCapped) return ticketCapped;
    const capped = await dailyUploadCapOr429("receipt-upload");
    if (capped) return capped;
  }

  // The shared path for files from customers: size, magic bytes, HEIC → JPEG, private store.
  const up = await storePrivateUpload(form.get("file"), { folder: FOLDER, errorType: "RECEIPT_UPLOAD", fallbackName: "receipt" });
  if (!up.ok) return up.response;
  return NextResponse.json({ url: up.stored.url, publicId: up.stored.key });
}
