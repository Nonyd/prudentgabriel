import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { MediaPutOpts, MediaStore, StoredFile } from "@/lib/media/types";
import { buildMediaKey, isValidMediaKey, originalNameMeta } from "@/lib/media/keys";
import { signMediaKey } from "@/lib/media/signed";

export function defaultMediaRoot(): string {
  return process.env.MEDIA_ROOT?.trim() || join(process.cwd(), ".data", "media");
}

export function createLocalDiskMediaStore(root = defaultMediaRoot()): MediaStore {
  const resolvedRoot = resolve(root);

  function absolutePath(key: string): string | null {
    if (!isValidMediaKey(key)) return null;
    const abs = resolve(resolvedRoot, ...key.split("/"));
    const rel = relative(resolvedRoot, abs);
    if (!rel || rel.startsWith("..") || rel.split(sep).includes("..")) return null;
    return abs;
  }

  function publicUrl(key: string): string {
    return `/media/${key}`;
  }

  return {
    async put(file, opts: MediaPutOpts): Promise<StoredFile> {
      const key = buildMediaKey({
        folder: opts.folder,
        bytes: file,
        mime: opts.mime,
        private: opts.private,
      });
      const dest = absolutePath(key);
      if (!dest) throw new Error("Invalid media key");
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, file);
      return {
        key,
        url: publicUrl(key),
        originalName: originalNameMeta(opts.originalName),
        mime: opts.mime,
        bytes: file.byteLength,
      };
    },
    url(key: string): string {
      return publicUrl(key);
    },
    signedUrl(key: string, ttlSeconds: number): string {
      const exp = Math.floor(Date.now() / 1000) + Math.max(1, ttlSeconds);
      const sig = signMediaKey(key, exp);
      const q = new URLSearchParams({ k: key, exp: String(exp), sig });
      return `/api/media/signed?${q.toString()}`;
    },
    async delete(key: string): Promise<void> {
      const dest = absolutePath(key);
      if (!dest) return;
      try {
        await unlink(dest);
      } catch (e) {
        const err = e as NodeJS.ErrnoException;
        if (err.code !== "ENOENT") throw e;
      }
    },
    absolutePath,
  };
}
