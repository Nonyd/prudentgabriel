import { NextResponse } from "next/server";
import { requireAdminApi, requireAdminPortalApi } from "@/lib/admin-auth";
import { permissionForUploadFolder } from "@/lib/admin-upload-folder";

export async function gateUploadFolder(folder: string) {
  const needed = permissionForUploadFolder(folder);
  if (!needed) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (needed === "portal") return requireAdminPortalApi();
  return requireAdminApi(needed);
}
