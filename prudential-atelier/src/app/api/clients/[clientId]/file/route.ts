import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveSessionAccess } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/roles";
import { composeClientFile, isFileSection } from "@/lib/client-file";
import { logError } from "@/lib/logger";

type Params = { params: Promise<{ clientId: string }> };

/**
 * Slice BC1 — the client file, composed per viewer.
 *
 *   GET /api/clients/:clientId/file              every section; hidden ones say why
 *   GET /api/clients/:clientId/file?section=…    one section; 403 if it is not yours
 *
 * Reaching the file needs the `clients` key or a workroom assignment on one of
 * her commissions. Each section is then decided in composeClientFile (AZ8 for
 * measurements and payments, Slice T keys for the rest).
 */
export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await params;
  const raw = new URL(req.url).searchParams.get("section");
  if (raw !== null && !isFileSection(raw)) {
    return NextResponse.json({ error: "Unknown section" }, { status: 400 });
  }

  try {
    // Preview and "view as" apply here too, so what the page shows is honest.
    const { role, actor } = await resolveSessionAccess(session);
    const result = await composeClientFile(
      {
        userId: session.user.id,
        role,
        email: actor.email ?? null,
        allows: (p) => hasPermission(role, p, actor),
      },
      clientId,
      raw ?? undefined,
    );
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "CLIENT_FILE",
      message: e instanceof Error ? e.message : "Failed to compose client file",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
