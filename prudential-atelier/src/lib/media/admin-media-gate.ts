import { NextResponse } from "next/server";
import { requireAdminApi, requireAdminPortalApi } from "@/lib/admin-auth";
import { folderFromMediaKey } from "@/lib/media/keys";
import { permissionForUploadFolder } from "@/lib/admin-upload-folder";

/** BF7: chat files are reached only through the chat routes, tied to their conversation. */
const CHAT_FOLDER = "prudential-atelier/chat";

/**
 * Who may open a private media file in the portal: the desk that owns its
 * folder (receipts → payments, consultations → consultations, …). One rule
 * for /api/admin/media/file and for a private /media/... path opened while
 * signed in to the portal. Chat attachments are never opened this way.
 */
export async function gatePrivateMediaKey(key: string) {
  const folder = folderFromMediaKey(key);
  if (folder.toLowerCase() === CHAT_FOLDER) {
    return { ok: false as const, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  const needed = permissionForUploadFolder(folder);
  if (!needed || needed === "portal") return requireAdminPortalApi();
  if (needed === "workroom") return requireAdminApi("bespoke");
  return requireAdminApi(needed);
}
