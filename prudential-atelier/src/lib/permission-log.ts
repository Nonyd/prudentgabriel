import { logActivity } from "@/lib/logger";
import type { Session } from "next-auth";

export async function logPermissionChange(opts: {
  session: Session;
  recordId: string;
  recordType: "Role" | "User";
  description: string;
}): Promise<void> {
  await logActivity({
    userId: opts.session.user?.id,
    userEmail: opts.session.user?.email ?? undefined,
    userRole: opts.session.user?.role,
    action: "UPDATE",
    module: "permissions",
    description: opts.description,
    recordId: opts.recordId,
    recordType: opts.recordType,
  });
}
