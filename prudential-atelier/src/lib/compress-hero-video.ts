"use client";

import {
  HERO_VIDEO_SOURCE_TOO_LARGE_MESSAGE,
  HERO_VIDEO_SOURCE_TYPE_MESSAGE,
  HERO_VIDEO_TOO_LARGE_MESSAGE,
  HERO_VIDEO_TOO_LONG_MESSAGE,
  HERO_VIDEO_UNSUPPORTED_BROWSER_MESSAGE,
  MAX_HERO_VIDEO_SECONDS,
  heroVideoNeedsCompress,
  heroVideoOutputSize,
  heroVideoSourceTooLarge,
  heroVideoSourceTypeOk,
  heroVideoTargetBitrate,
  heroVideoTooLarge,
  heroVideoTooLong,
} from "@/lib/hero-video-limits";

export type CompressHeroVideoProgress = (percent: number, label: string) => void;

type ClipMeta = { duration: number; width: number; height: number };

function webCodecsAvailable(): boolean {
  return typeof VideoEncoder !== "undefined" && typeof VideoDecoder !== "undefined";
}

function readMetaWithVideoElement(file: File): Promise<ClipMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = url;
    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };
    video.onloadedmetadata = () => {
      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;
      cleanup();
      if (!Number.isFinite(duration) || duration <= 0 || width < 1 || height < 1) {
        reject(new Error("Could not read the video"));
        return;
      }
      resolve({ duration, width, height });
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("Could not read the video"));
    };
  });
}

async function readMetaWithMediabunny(file: File): Promise<ClipMeta> {
  const { Input, ALL_FORMATS, BlobSource } = await import("mediabunny");
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("Could not read the video");
    const [duration, width, height] = await Promise.all([
      input.getDurationFromMetadata().then((d) => d ?? input.computeDuration()),
      track.getDisplayWidth(),
      track.getDisplayHeight(),
    ]);
    if (!Number.isFinite(duration) || duration <= 0 || width < 1 || height < 1) {
      throw new Error("Could not read the video");
    }
    return { duration, width, height };
  } finally {
    input.dispose();
  }
}

async function readHeroClipMeta(file: File): Promise<ClipMeta> {
  try {
    return await readMetaWithVideoElement(file);
  } catch {
    return readMetaWithMediabunny(file);
  }
}

async function transcodeHeroClip(params: {
  file: File;
  width: number;
  height: number;
  duration: number;
  bitrate: number;
  onProgress?: CompressHeroVideoProgress;
}): Promise<File> {
  const {
    Input,
    Output,
    Conversion,
    ALL_FORMATS,
    BlobSource,
    Mp4OutputFormat,
    BufferTarget,
    Quality,
    canEncodeVideo,
  } = await import("mediabunny");

  const avcOk = await canEncodeVideo("avc", {
    width: params.width,
    height: params.height,
    quality: new Quality({ bitrate: params.bitrate }),
  });
  if (!avcOk) throw new Error(HERO_VIDEO_UNSUPPORTED_BROWSER_MESSAGE);

  const input = new Input({ source: new BlobSource(params.file), formats: ALL_FORMATS });
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat(), target });

  try {
    const conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      showWarnings: false,
      video: {
        width: params.width,
        height: params.height,
        fit: "fill",
        codec: "avc",
        quality: new Quality({ bitrate: params.bitrate, bitrateMode: "variable" }),
        frameRate: 30,
        forceTranscode: true,
        keyFrameInterval: 2,
      },
      audio: { discard: true },
      trim: { end: Math.min(params.duration, MAX_HERO_VIDEO_SECONDS) },
    });

    if (!conversion.isValid) {
      const videoFailed = conversion.discardedTracks.some(
        (row) => row.track.isVideoTrack() && row.reason !== "discarded_by_user",
      );
      if (videoFailed) throw new Error(HERO_VIDEO_UNSUPPORTED_BROWSER_MESSAGE);
      throw new Error("Could not compress this clip");
    }

    conversion.onProgress = (progress) => {
      params.onProgress?.(Math.min(99, Math.round(progress * 100)), "Compressing");
    };
    await conversion.execute();
  } finally {
    input.dispose();
  }

  if (!target.buffer) throw new Error("Could not compress this clip");
  return new File([target.buffer], "hero.mp4", { type: "video/mp4" });
}

/**
 * Returns a muted H.264 MP4 sized for the RTW / homepage hero. Skips work when
 * the source is already that file. Browser-only: uses WebCodecs via Mediabunny.
 */
export async function compressHeroVideo(file: File, onProgress?: CompressHeroVideoProgress): Promise<File> {
  if (heroVideoSourceTooLarge(file.size)) {
    throw new Error(HERO_VIDEO_SOURCE_TOO_LARGE_MESSAGE);
  }
  if (!heroVideoSourceTypeOk(file.type, file.name)) {
    throw new Error(HERO_VIDEO_SOURCE_TYPE_MESSAGE);
  }

  onProgress?.(2, "Reading clip");
  const meta = await readHeroClipMeta(file);
  if (heroVideoTooLong(meta.duration)) {
    throw new Error(HERO_VIDEO_TOO_LONG_MESSAGE);
  }

  if (
    !heroVideoNeedsCompress({
      sizeBytes: file.size,
      mime: file.type || null,
      width: meta.width,
      height: meta.height,
    })
  ) {
    onProgress?.(100, "Ready");
    return file;
  }

  if (!webCodecsAvailable()) {
    throw new Error(HERO_VIDEO_UNSUPPORTED_BROWSER_MESSAGE);
  }

  const size = heroVideoOutputSize(meta.width, meta.height);
  const bitrate = heroVideoTargetBitrate(meta.duration);
  onProgress?.(4, "Compressing");

  let out = await transcodeHeroClip({
    file,
    width: size.width,
    height: size.height,
    duration: meta.duration,
    bitrate,
    onProgress,
  });

  if (heroVideoTooLarge(out.size)) {
    onProgress?.(8, "Compressing");
    out = await transcodeHeroClip({
      file,
      width: size.width,
      height: size.height,
      duration: meta.duration,
      bitrate: Math.max(500_000, Math.floor(bitrate * 0.65)),
      onProgress,
    });
  }

  if (heroVideoTooLarge(out.size)) {
    throw new Error(HERO_VIDEO_TOO_LARGE_MESSAGE);
  }
  onProgress?.(100, "Ready");
  return out;
}
