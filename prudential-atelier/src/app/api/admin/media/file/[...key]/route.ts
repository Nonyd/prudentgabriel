import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, requireAdminPortalApi } from "@/lib/admin-auth";
import { folderFromMediaKey, isValidMediaKey } from "@/lib/media/keys";
import { permissionForUploadFolder } from "@/lib/admin-upload-folder";
import { streamMediaKey } from "@/lib/media/stream";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await ctx.params;
  const key = parts.map(decodeURIComponent).join("/");
  if (!isValidMediaKey(key)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const folder = folderFromMediaKey(key);
  const needed = permissionForUploadFolder(folder);
  const gate = !needed
    ? await requireAdminPortalApi()
    : needed === "portal"
      ? await requireAdminPortalApi()
      : await requireAdminApi(needed);
  if (!gate.ok) return gate.response;
  return streamMediaKey(key, { allowPrivate: true, cache: "private" });
}
