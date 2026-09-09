import { spawn } from "node:child_process";
import { access, rename, unlink } from "node:fs/promises";
import { constants } from "node:fs";
import { getMediaStore } from "@/lib/media";
import { keyFromMediaUrl } from "@/lib/media/keys";

const FFMPEG_TIMEOUT_MS = 240_000;

function ffmpegBin(): string {
  return process.env.FFMPEG_PATH?.trim() || "ffmpeg";
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

const inflight = new Map<string, Promise<boolean>>();

/**
 * iPhone Safari will not decode WebM. Write a Baseline H.264 MP4 next to the
 * source so `/media/.../hash.mp4` can Range-stream like the homepage heroes.
 */
export async function ensureMp4FromWebm(webmAbs: string, mp4Abs: string): Promise<boolean> {
  if (await exists(mp4Abs)) return true;
  if (!(await exists(webmAbs))) return false;
  const pending = inflight.get(mp4Abs);
  if (pending) return pending;
  const work = transcodeWebmToMp4(webmAbs, mp4Abs).finally(() => inflight.delete(mp4Abs));
  inflight.set(mp4Abs, work);
  return work;
}

/** Start a sibling MP4 in the background so the iPhone request is not the first transcode. */
export function warmHeroWebmMp4(url: string): void {
  const key = keyFromMediaUrl(url);
  if (!key || !key.toLowerCase().endsWith(".webm")) return;
  const store = getMediaStore();
  const webmAbs = store.absolutePath(key);
  const mp4Abs = store.absolutePath(`${key.slice(0, -5)}.mp4`);
  if (!webmAbs || !mp4Abs) return;
  void ensureMp4FromWebm(webmAbs, mp4Abs);
}

function transcodeWebmToMp4(webmAbs: string, mp4Abs: string): Promise<boolean> {
  const tmp = `${mp4Abs}.tmp`;
  return new Promise((resolve) => {
    const child = spawn(
      ffmpegBin(),
      [
        "-y",
        "-i",
        webmAbs,
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-profile:v",
        "baseline",
        "-level",
        "4.0",
        "-vf",
        "scale=w='min(1080,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
        "-movflags",
        "+faststart",
        tmp,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, FFMPEG_TIMEOUT_MS);

    child.on("error", () => {
      clearTimeout(timer);
      void unlink(tmp).catch(() => undefined);
      resolve(false);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      void (async () => {
        if (code !== 0) {
          await unlink(tmp).catch(() => undefined);
          resolve(false);
          return;
        }
        try {
          await unlink(mp4Abs).catch(() => undefined);
          await rename(tmp, mp4Abs);
          resolve(true);
        } catch {
          await unlink(tmp).catch(() => undefined);
          resolve(false);
        }
      })();
    });
  });
}
