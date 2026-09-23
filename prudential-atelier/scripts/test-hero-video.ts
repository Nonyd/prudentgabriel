/**
 * /rtw hero video: a poster first, a phone-sized H.264 encode, tap-to-play on
 * a phone, and preload="none". The ffmpeg check runs where ffmpeg is installed
 * (the laptop and the production image); live checks with BASE_URL.
 *
 *   pnpm test:hero-video
 *   BASE_URL=http://localhost:3100 pnpm test:hero-video
 */
import "./preload-test-env";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  HERO_VIDEO_PREFIX,
  ensureHeroVariant,
  heroVariantKeys,
  heroVariantRequest,
  heroVariantUrls,
} from "../src/lib/hero-video-variants";
import { heroVideoSrc, heroWaitsForTap } from "../src/lib/hero-playback";
import { getMediaStore } from "../src/lib/media";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const base = process.env.BASE_URL?.replace(/\/$/, "");

function units() {
  const src = `${HERO_VIDEO_PREFIX}abc123.mp4`;
  const keys = heroVariantKeys(src);
  assert(keys?.phone === `${HERO_VIDEO_PREFIX}abc123-phone.mp4` && keys.poster === `${HERO_VIDEO_PREFIX}abc123-poster.jpg`, "variant keys sit beside the upload");
  assert(heroVariantUrls(`/media/${src}`)?.poster === `/media/${keys.poster}`, "and have /media URLs");
  assert(heroVariantKeys("public/prudent-gabriel/products/abc.mp4") === null, "only hero uploads get variants");
  assert(heroVariantRequest("public/prudent-gabriel/products/abc-phone.mp4") === null, "a request outside the hero folder never starts ffmpeg");
  assert(heroVariantUrls("https://res.cloudinary.com/x/video/upload/v1/a.mp4") === null, "Cloudinary sources are left alone");
  assert(heroVariantKeys(keys.phone) === null, "the phone encode is not a source of its own");
  assert(heroVariantRequest(keys.phone)?.sources.includes(`${HERO_VIDEO_PREFIX}abc123.webm`), "a variant may come from a WebM upload");

  assert(heroWaitsForTap({ narrow: true, saveData: false, reducedMotion: false }), "a phone waits for a tap");
  assert(!heroWaitsForTap({ narrow: false, saveData: false, reducedMotion: false }), "a wide screen plays by itself");
  assert(heroWaitsForTap({ narrow: false, saveData: true, reducedMotion: false }), "Save-Data waits for a tap");
  const item = { url: `/media/${src}`, phoneUrl: `/media/${keys.phone}` };
  assert(heroVideoSrc(item, true) === item.phoneUrl, "a phone plays the phone encode");
  assert(heroVideoSrc(item, false).startsWith(item.url), "a wide screen plays the upload");

  const hero = readFileSync(resolve("src/components/rtw/RTWLandingHero.tsx"), "utf8");
  assert(!hero.includes('preload="auto"'), "the hero never preloads the whole file");
  assert(hero.includes('preload="none"'), "it says preload=none");
  console.log("ok units: variant keys, hero folder only, tap below the width, phone encode on a phone, preload none");
}

function hasFfmpeg(): boolean {
  return spawnSync(process.env.FFMPEG_PATH?.trim() || "ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
}

async function encode(): Promise<string | null> {
  if (!hasFfmpeg()) {
    console.log("skip ffmpeg: not installed here");
    return null;
  }
  const store = getMediaStore();
  const key = `${HERO_VIDEO_PREFIX}hero-test-${Date.now()}.mp4`;
  const abs = store.absolutePath(key);
  assert(abs, "media store resolves the key");
  mkdirSync(dirname(abs), { recursive: true });
  // Three seconds at the campaign's own shape: 1080x1920.
  execFileSync(process.env.FFMPEG_PATH?.trim() || "ffmpeg", [
    "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=1080x1920:rate=30:duration=3",
    "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", abs,
  ]);
  const keys = heroVariantKeys(key)!;
  const [poster, phone] = await Promise.all([ensureHeroVariant(keys.poster), ensureHeroVariant(keys.phone)]);
  assert(poster && phone, "both variants are made");
  const phoneAbs = store.absolutePath(keys.phone)!;
  const probe = execFileSync(process.env.FFPROBE_PATH?.trim() || "ffprobe", [
    "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height", "-of", "csv=p=0", phoneAbs,
  ]).toString().trim();
  assert(probe === "h264,720,1280", `the phone encode is H.264 at 720x1280 (${probe})`);
  assert(statSync(store.absolutePath(keys.poster)!).size > 1000, "the poster is a real image");
  assert(await ensureHeroVariant(keys.phone), "asking again is a no-op that answers yes");
  console.log("ok ffmpeg: a 1080x1920 upload gets a 720-wide H.264 phone encode and a poster");
  return key;
}

async function live(key: string | null) {
  if (!base) {
    console.log("skip live: set BASE_URL");
    return;
  }
  const html = await (await fetch(`${base}/rtw`)).text();
  assert(!html.includes('preload="auto"'), "live: /rtw preloads no video");
  assert(!/<video/i.test(html), "live: the server HTML carries no <video>, so nothing but the poster competes for first paint");
  if (/hero-videos\/[a-f0-9]+\.(mp4|webm)/.test(html)) {
    // A campaign video is configured: its poster is in the first HTML, fetched first.
    assert(/<img[^>]*fetchpriority="high"[^>]*(hero-videos%2F|hero%2F)[^"]*/i.test(html) || /<img[^>]*(hero-videos%2F|hero%2F)[^>]*fetchpriority="high"/i.test(html), "live: the hero poster is a high-priority <img> in the server HTML");
  }
  if (key) {
    const keys = heroVariantKeys(key)!;
    const poster = await fetch(`${base}/media/${keys.poster}`);
    assert(poster.status === 200 && poster.headers.get("content-type") === "image/jpeg", "live: the poster is served");
    const phone = await fetch(`${base}/media/${keys.phone}`, { headers: { range: "bytes=0-1023" } });
    assert(phone.status === 206, `live: the phone encode Range-streams (${phone.status})`);
  }
  const outside = await fetch(`${base}/media/public/prudent-gabriel/products/nothing-phone.mp4`);
  assert(outside.status === 404, "live: a variant name outside the hero folder is a plain 404");
  console.log("ok live: no preload, no server-side autoplay, variants served");
}

async function main() {
  units();
  const key = await encode();
  try {
    await live(key);
  } finally {
    if (key) {
      const store = getMediaStore();
      const keys = heroVariantKeys(key)!;
      for (const k of [key, keys.phone, keys.poster]) rmSync(store.absolutePath(k)!, { force: true });
    }
  }
  console.log("OK test-hero-video");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
