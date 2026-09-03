export type StoredFile = {
  key: string;
  /** Public path (`/media/public/...`). Private keys are not fetchable here. */
  url: string;
  originalName: string;
  mime: string;
  bytes: number;
};

export type MediaPutOpts = {
  folder: string;
  /** Original filename is metadata only — never used in the stored path. */
  originalName?: string;
  private?: boolean;
  mime: string;
};

export interface MediaStore {
  put(file: Buffer, opts: MediaPutOpts): Promise<StoredFile>;
  url(key: string): string;
  signedUrl(key: string, ttlSeconds: number): string;
  delete(key: string): Promise<void>;
  /** Absolute filesystem path, or null if the key is invalid. */
  absolutePath(key: string): string | null;
}
