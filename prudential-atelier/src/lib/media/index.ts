import { createLocalDiskMediaStore } from "@/lib/media/local-disk";
import type { MediaStore } from "@/lib/media/types";

export type { MediaPutOpts, MediaStore, StoredFile } from "@/lib/media/types";
export { createLocalDiskMediaStore, defaultMediaRoot } from "@/lib/media/local-disk";
export {
  folderFromMediaKey,
  isPrivateMediaKey,
  isValidMediaKey,
  keyFromMediaUrl,
} from "@/lib/media/key-parse";
export {
  isStoredPublicMediaUrl,
  isStoredPrivateMediaUrl,
  isStoredReceiptMediaUrl,
  isStoredMediaUrl,
  optionalStoredPublicMediaUrlSchema,
  optionalStoredPrivateMediaUrlSchema,
  emptyableStoredPublicMediaUrlSchema,
  storedPublicMediaUrlSchema,
  storedPrivateMediaUrlSchema,
  storedMediaUrlSchema,
  receiptMediaUrlSchema,
} from "@/lib/media/stored-url";

let testStore: MediaStore | null = null;

export function setMediaStoreForTest(store: MediaStore | null): void {
  testStore = store;
}

export function getMediaStore(): MediaStore {
  return testStore ?? createLocalDiskMediaStore();
}
