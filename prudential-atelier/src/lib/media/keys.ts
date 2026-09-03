import { createHash } from "node:crypto";
import { extForMime } from "@/lib/media/key-parse";

export {
  extForMime,
  extFromOriginalName,
  folderFromMediaKey,
  isPrivateMediaKey,
  isValidMediaKey,
  keyFromMediaUrl,
  mimeForExt,
  originalNameMeta,
} from "@/lib/media/key-parse";

export function buildMediaKey(opts: {
  folder: string;
  bytes: Buffer;
  mime: string;
  private?: boolean;
}): string {
  const vis = opts.private ? "private" : "public";
  const digest = createHash("sha256").update(opts.bytes).digest("hex").slice(0, 32);
  return `${vis}/${opts.folder}/${digest}${extForMime(opts.mime)}`;
}
