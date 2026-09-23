import { spawn } from "node:child_process";
import { access, rename, stat, unlink } from "node:fs/promises";
import { constants } from "node:fs";
import { getMediaStore } from "@/lib/media";
import { keyFromMediaUrl } from "@/lib/media/keys";

/**
 * /rtw hero: the campaign video is 1080×1920, ~12 MB, and on a phone it is shown
 * at ~380×844. The server keeps two siblings beside the upload, made once with
 * the ffmpeg already in the image:
 *   <name>-poster.jpg  a still from the first second: the page's LCP
 *   <name>-phone.mp4   720 wide, H.264 (every iPhone decodes it), ~2–3 MB a minute
 * Glory uploads one file; nothing else changes in the editor.
 */

/** Only campaign hero uploads get variants, so a public request cannot set ffmpeg on any file. */
export const HERO_VIDEO_PREFIX = "public/prudent-gabriel/hero-videos/";
export const PHONE_SUFFIX = "-phone.mp4";
export const POSTER_SUFFIX = "-poster.jpg";

const FFMPEG_TIMEOUT_MS = 240_000;
const SOURCE_EXTS = [".mp4", ".webm", ".mov"];

function ffmpegBin(): string {
  return process.env.FFMPEG_PATH?.trim() || "ffmpeg";
}

async function readable(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function stem(key: string): string | null {
  const lower = key.toLowerCase();
  const ext = SOURCE_EXTS.find((e) => lower.endsWith(e));
  return ext ? key.slice(0, -ext.length) : null;
}

/** The variant keys for a hero source key, or null when the key is not a hero upload. */
export function heroVariantKeys(sourceKey: string): { phone: string; poster: string } | null {
  if (!sourceKey.startsWith(HERO_VIDEO_PREFIX)) return null;
  if (sourceKey.endsWith(PHONE_SUFFIX)) return null;
  const base = stem(sourceKey);
  return base ? { phone: `${base}${PHONE_SUFFIX}`, poster: `${base}${POSTER_SUFFIX}` } : null;
}

/** Media URLs for a hero video's variants; null for Cloudinary or any other source. */
export function heroVariantUrls(videoUrl: string): { phone: string; poster: string } | null {
  const key = keyFromMediaUrl(videoUrl);
  const keys = key ? heroVariantKeys(key) : null;
  if (!keys) return null;
  const url = (k: string) => `/media/${k}`;
  return { phone: url(keys.phone), poster: url(keys.poster) };
}

/** A requested key that is a hero variant: which kind, and the source files it may come from. */
export function heroVariantRequest(key: string): { kind: "phone" | "poster"; sources: string[] } | null {
  if (!key.startsWith(HERO_VIDEO_PREFIX)) return null;
  const kind = key.endsWith(PHONE_SUFFIX) ? "phone" : key.endsWith(POSTER_SUFFIX) ? "poster" : null;
  if (!kind) return null;
  const base = key.slice(0, -(kind === "phone" ? PHONE_SUFFIX : POSTER_SUFFIX).length);
  return { kind, sources: SOURCE_EXTS.map((e) => `${base}${e}`) };
}

export function ffmpegArgs(kind: "phone" | "poster", src: string, out: string): string[] {
  if (kind === "poster") {
    return ["-y", "-ss", "0.5", "-i", src, "-frames:v", "1", "-vf", "scale=w='min(1080,iw)':h=-2", "-q:v", "4", "-f", "image2", out];
  }
  return [
    "-y", "-i", src, "-an",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-maxrate", "360k", "-bufsize", "720k",
    "-pix_fmt", "yuv420p", "-profile:v", "main", "-level", "3.1",
    "-vf", "scale=w='min(720,iw)':h=-2",
    "-movflags", "+faststart", "-f", "mp4", out,
  ];
}

const inflight = new Map<string, Promise<boolean>>();

/** Make the variant for `key` if its source exists. True when the file is there afterwards. */
export async function ensureHeroVariant(key: string): Promise<boolean> {
  const req = heroVariantRequest(key);
  if (!req) return false;
  const store = getMediaStore();
  const outAbs = store.absolutePath(key);
  if (!outAbs) return false;
  if (await readable(outAbs)) return true;
  const pending = inflight.get(outAbs);
  if (pending) return pending;

  const work = (async () => {
    for (const source of req.sources) {
      const srcAbs = store.absolutePath(source);
      if (srcAbs && (await readable(srcAbs))) return run(req.kind, srcAbs, outAbs);
    }
    return false;
  })().finally(() => inflight.delete(outAbs));
  inflight.set(outAbs, work);
  return work;
}

/** Start both variants in the background so the first visitor is not the one who waits. */
export function warmHeroVideoVariants(videoUrl: string): void {
  const urls = heroVariantUrls(videoUrl);
  if (!urls) return;
  for (const u of [urls.poster, urls.phone]) {
    const key = keyFromMediaUrl(u);
    if (key) void ensureHeroVariant(key);
  }
}

function run(kind: "phone" | "poster", srcAbs: string, outAbs: string): Promise<boolean> {
  const tmp = `${outAbs}.tmp`;
  return new Promise((resolve) => {
    const child = spawn(ffmpegBin(), ["-v", "error", ...ffmpegArgs(kind, srcAbs, tmp)], { stdio: ["ignore", "ignore", "ignore"] });
    const timer = setTimeout(() => child.kill("SIGKILL"), FFMPEG_TIMEOUT_MS);
    const fail = () => {
      clearTimeout(timer);
      void unlink(tmp).catch(() => undefined).then(() => resolve(false));
    };
    child.on("error", fail);
    child.on("close", (code) => {
      if (code !== 0) return fail();
      clearTimeout(timer);
      void rename(tmp, outAbs).then(
        () => resolve(true),
        () => fail(),
      );
    });
  });
}
