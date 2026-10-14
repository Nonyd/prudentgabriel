import { requireAdminApi, requireAdminPortalApi } from "@/lib/admin-auth";
import { folderFromMediaKey } from "@/lib/media/keys";
import { permissionForUploadFolder } from "@/lib/admin-upload-folder";

/**
 * Who may open a private media file in the portal: the desk that owns its
 * folder (receipts → payments, consultations → consultations, …). One rule
 * for /api/admin/media/file and for a private /media/... path opened while
 * signed in to the portal.
 */
export async function gatePrivateMediaKey(key: string) {
  const needed = permissionForUploadFolder(folderFromMediaKey(key));
  if (!needed || needed === "portal") return requireAdminPortalApi();
  if (needed === "workroom") return requireAdminApi("bespoke");
  return requireAdminApi(needed);
}
