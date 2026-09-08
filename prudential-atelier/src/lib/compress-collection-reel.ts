"use client";

import {
  COLLECTION_REEL_PORTRAIT_MESSAGE,
  COLLECTION_REEL_TOO_LARGE_MESSAGE,
  COLLECTION_REEL_TOO_LONG_MESSAGE,
  COLLECTION_REEL_UNSUPPORTED_BROWSER_MESSAGE,
  collectionReelNeedsCompress,
  collectionReelOutputSize,
  collectionReelSourceDimensionsOk,
  collectionReelTargetVideoBitrate,
  collectionReelTooLarge,
  collectionReelTooLong,
  MAX_COLLECTION_REEL_SECONDS,
} from "@/lib/collection-reel-limits";

export type CompressCollectionReelProgress = (percent: number, label: string) => void;

type ReelMeta = { duration: number; width: number; height: number };

function webCodecsAvailable(): boolean {
  return typeof VideoEncoder !== "undefined" && typeof VideoDecoder !== "undefined";
}

function readMetaWithVideoElement(file: File): Promise<ReelMeta> {
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

async function readMetaWithMediabunny(file: File): Promise<ReelMeta> {
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

async function readCollectionReelMeta(file: File): Promise<ReelMeta> {
  try {
    return await readMetaWithVideoElement(file);
  } catch {
    return readMetaWithMediabunny(file);
  }
}

async function transcodeReel(params: {
  file: File;
  width: number;
  height: number;
  duration: number;
  bitrate: number;
  keepAudio: boolean;
  onProgress?: CompressCollectionReelProgress;
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
    canEncodeAudio,
  } = await import("mediabunny");

  const avcOk = await canEncodeVideo("avc", {
    width: params.width,
    height: params.height,
    quality: new Quality({ bitrate: params.bitrate }),
  });
  if (!avcOk) throw new Error(COLLECTION_REEL_UNSUPPORTED_BROWSER_MESSAGE);

  const audioOk = params.keepAudio ? await canEncodeAudio("aac", { quality: new Quality({ bitrate: 96_000 }) }) : false;
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
      audio: audioOk
        ? { codec: "aac", quality: new Quality({ bitrate: 96_000 }), forceTranscode: true }
        : { discard: true },
      trim: { end: Math.min(params.duration, MAX_COLLECTION_REEL_SECONDS) },
    });

    if (!conversion.isValid) {
      const videoFailed = conversion.discardedTracks.some(
        (row) => row.track.isVideoTrack() && row.reason !== "discarded_by_user",
      );
      if (videoFailed) throw new Error(COLLECTION_REEL_UNSUPPORTED_BROWSER_MESSAGE);
      throw new Error("Could not compress this reel");
    }

    conversion.onProgress = (progress) => {
      params.onProgress?.(Math.min(99, Math.round(progress * 100)), "Compressing");
    };
    await conversion.execute();
  } finally {
    input.dispose();
  }

  if (!target.buffer) throw new Error("Could not compress this reel");
  return new File([target.buffer], "reel.mp4", { type: "video/mp4" });
}

/**
 * Returns an H.264 MP4 under the stored reel cap. Skips work when the source is already that file.
 * Browser-only: uses WebCodecs via Mediabunny.
 */
export async function compressCollectionReel(
  file: File,
  onProgress?: CompressCollectionReelProgress,
): Promise<File> {
  onProgress?.(2, "Reading clip");
  const meta = await readCollectionReelMeta(file);
  if (collectionReelTooLong(meta.duration)) {
    throw new Error(COLLECTION_REEL_TOO_LONG_MESSAGE);
  }
  if (!collectionReelSourceDimensionsOk(meta.width, meta.height)) {
    throw new Error(COLLECTION_REEL_PORTRAIT_MESSAGE);
  }

  if (
    !collectionReelNeedsCompress({
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
    throw new Error(COLLECTION_REEL_UNSUPPORTED_BROWSER_MESSAGE);
  }

  const size = collectionReelOutputSize(meta.width, meta.height);
  const bitrate = collectionReelTargetVideoBitrate(meta.duration);
  onProgress?.(4, "Compressing");

  let out: File;
  try {
    out = await transcodeReel({
      file,
      width: size.width,
      height: size.height,
      duration: meta.duration,
      bitrate,
      keepAudio: true,
      onProgress,
    });
  } catch (err) {
    if (err instanceof Error && err.message === COLLECTION_REEL_UNSUPPORTED_BROWSER_MESSAGE) throw err;
    out = await transcodeReel({
      file,
      width: size.width,
      height: size.height,
      duration: meta.duration,
      bitrate,
      keepAudio: false,
      onProgress,
    });
  }

  if (collectionReelTooLarge(out.size)) {
    onProgress?.(8, "Compressing");
    out = await transcodeReel({
      file,
      width: size.width,
      height: size.height,
      duration: meta.duration,
      bitrate: Math.max(500_000, Math.floor(bitrate * 0.65)),
      keepAudio: false,
      onProgress,
    });
  }

  if (collectionReelTooLarge(out.size)) {
    throw new Error(COLLECTION_REEL_TOO_LARGE_MESSAGE);
  }
  onProgress?.(100, "Ready");
  return out;
}
