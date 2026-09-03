/**
 * Copy Cloudinary URLs that the database still points at onto the local MediaStore.
 * Does not copy leftover Cloudinary folders (samples, old product prefix, naijaratels).
 * Does not delete anything from Cloudinary.
 *
 *   pnpm media:migrate              # plan only
 *   pnpm media:migrate --apply      # write files + update URLs
 *
 * Idempotent: already-local URLs are skipped; content-hash keys make a re-run a no-op.
 * Resumable: a crash mid-row leaves that row on Cloudinary; the next --apply retries it.
 */
import "./preload-test-env";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { getMediaStore } from "../src/lib/media";
import { mimeFromMagicBytes, mimeFromVideoMagicBytes } from "../src/lib/image-upload-mime";
import { classifyMediaUrl, folderFromCloudinaryUrl } from "../src/lib/media/migrate-plan";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

type Row = {
  source: string;
  id: string;
  url: string;
  kind: "scalar" | "json-carousel";
};

type Result = {
  source: string;
  id: string;
  url: string;
  status: "copied" | "already-local" | "skipped" | "not-found" | "failed";
  bytes?: number;
  newUrl?: string;
  note?: string;
};

async function collect(): Promise<Row[]> {
  const rows: Row[] = [];
  const push = (source: string, id: string, url: string | null | undefined) => {
    if (url?.trim()) rows.push({ source, id, url: url.trim(), kind: "scalar" });
  };

  const products = await prisma.productImage.findMany({ select: { id: true, url: true } });
  for (const r of products) push("ProductImage", r.id, r.url);

  const colors = await prisma.productColor.findMany({ select: { id: true, imageUrl: true } });
  for (const r of colors) push("ProductColor", r.id, r.imageUrl);

  const collections = await prisma.collection.findMany({ select: { id: true, coverImage: true } });
  for (const r of collections) push("Collection.cover", r.id, r.coverImage);

  const gallery = await prisma.galleryImage.findMany({ select: { id: true, url: true } });
  for (const r of gallery) push("GalleryImage", r.id, r.url);

  const media = await prisma.mediaItem.findMany({ select: { id: true, url: true } });
  for (const r of media) push("MediaItem", r.id, r.url);

  const posts = await prisma.blogPost.findMany({ select: { id: true, featuredImage: true } });
  for (const r of posts) push("BlogPost.featured", r.id, r.featuredImage);

  const payments = await prisma.payment.findMany({ select: { id: true, receiptUrl: true } });
  for (const r of payments) push("Payment.receipt", r.id, r.receiptUrl);

  const orders = await prisma.order.findMany({ select: { id: true, paymentReceiptUrl: true } });
  for (const r of orders) push("Order.receipt", r.id, r.paymentReceiptUrl);

  const bespoke = await prisma.bespokeOrder.findMany({
    select: { id: true, paymentReceiptUrl: true, moodboardImages: true },
  });
  for (const r of bespoke) {
    push("Bespoke.receipt", r.id, r.paymentReceiptUrl);
    r.moodboardImages.forEach((u, i) => push(`Bespoke.moodboard[${i}]`, r.id, u));
  }

  const consults = await prisma.consultationBooking.findMany({
    select: { id: true, paymentReceiptUrl: true, moodboardImages: true, referenceImages: true },
  });
  for (const r of consults) {
    push("Consult.receipt", r.id, r.paymentReceiptUrl);
    r.moodboardImages.forEach((u, i) => push(`Consult.moodboard[${i}]`, r.id, u));
    r.referenceImages.forEach((u, i) => push(`Consult.refs[${i}]`, r.id, u));
  }

  const stage = await prisma.orderStageMedia.findMany({ select: { id: true, url: true } });
  for (const r of stage) push("OrderStageMedia", r.id, r.url);

  const jobs = await prisma.jobApplication.findMany({
    select: { id: true, cvUrl: true, schoolItLetter: true, schoolIdCard: true },
  });
  for (const r of jobs) {
    push("JobApp.cv", r.id, r.cvUrl);
    push("JobApp.letter", r.id, r.schoolItLetter);
    push("JobApp.idcard", r.id, r.schoolIdCard);
  }

  const settings = await prisma.siteSetting.findMany({
    where: { OR: [{ type: "IMAGE" }, { key: "home_hero_carousel" }] },
    select: { id: true, key: true, value: true },
  });
  for (const r of settings) {
    if (r.key === "home_hero_carousel") {
      rows.push({ source: "SiteSetting.carousel", id: r.id, url: r.value, kind: "json-carousel" });
    } else {
      push(`SiteSetting.${r.key}`, r.id, r.value);
    }
  }

  const consultants = await prisma.consultant.findMany({ select: { id: true, image: true } });
  for (const r of consultants) push("Consultant.image", r.id, r.image);

  const users = await prisma.user.findMany({ select: { id: true, image: true } });
  for (const r of users) push("User.image", r.id, r.image);

  const reviews = await prisma.review.findMany({ select: { id: true, testimonialImage: true } });
  for (const r of reviews) push("Review.testimonial", r.id, r.testimonialImage);

  const testimonials = await prisma.testimonial.findMany({
    select: { id: true, clientImage: true, adminImage: true },
  });
  for (const r of testimonials) {
    push("Testimonial.client", r.id, r.clientImage);
    push("Testimonial.admin", r.id, r.adminImage);
  }

  const reqs = await prisma.bespokeRequest.findMany({
    select: { id: true, referenceImages: true, sketchUrls: true },
  });
  for (const r of reqs) {
    r.referenceImages.forEach((u, i) => push(`BespokeReq.refs[${i}]`, r.id, u));
    r.sketchUrls.forEach((u, i) => push(`BespokeReq.sketches[${i}]`, r.id, u));
  }

  return rows;
}

async function headBytes(url: string): Promise<{ ok: boolean; status: number; bytes: number | null }> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    const len = res.headers.get("content-length");
    return { ok: res.ok, status: res.status, bytes: len ? Number(len) : null };
  } catch {
    return { ok: false, status: 0, bytes: null };
  }
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function mimeOf(buf: Buffer): string {
  return (
    mimeFromMagicBytes(buf, { allowPdf: true, allowGif: true }) ||
    mimeFromVideoMagicBytes(buf) ||
    "application/octet-stream"
  );
}

async function verifyReadable(url: string): Promise<boolean> {
  if (url.startsWith("/media/")) {
    const store = getMediaStore();
    const key = url.replace(/^\/media\//, "");
    const abs = store.absolutePath(key);
    if (!abs) return false;
    try {
      const { stat } = await import("node:fs/promises");
      const st = await stat(abs);
      return st.isFile() && st.size > 0;
    } catch {
      return false;
    }
  }
  const head = await headBytes(url);
  return head.ok;
}

async function writeScalar(source: string, id: string, newUrl: string): Promise<void> {
  if (source === "ProductImage") {
    await prisma.productImage.update({ where: { id }, data: { url: newUrl } });
    return;
  }
  if (source === "ProductColor") {
    await prisma.productColor.update({ where: { id }, data: { imageUrl: newUrl } });
    return;
  }
  if (source === "Collection.cover") {
    await prisma.collection.update({ where: { id }, data: { coverImage: newUrl } });
    return;
  }
  if (source === "GalleryImage") {
    const key = newUrl.replace(/^\/media\//, "");
    await prisma.galleryImage.update({
      where: { id },
      data: { url: newUrl, publicId: `${key}::${id}` },
    });
    return;
  }
  if (source === "MediaItem") {
    const key = newUrl.replace(/^\/media\//, "");
    await prisma.mediaItem.update({
      where: { id },
      data: { url: newUrl, publicId: `${key}::${id}` },
    });
    return;
  }
  if (source === "BlogPost.featured") {
    await prisma.blogPost.update({ where: { id }, data: { featuredImage: newUrl } });
    return;
  }
  if (source === "Payment.receipt") {
    await prisma.payment.update({ where: { id }, data: { receiptUrl: newUrl } });
    return;
  }
  if (source === "Order.receipt") {
    await prisma.order.update({ where: { id }, data: { paymentReceiptUrl: newUrl } });
    return;
  }
  if (source === "Bespoke.receipt") {
    await prisma.bespokeOrder.update({ where: { id }, data: { paymentReceiptUrl: newUrl } });
    return;
  }
  if (source === "Consult.receipt") {
    await prisma.consultationBooking.update({ where: { id }, data: { paymentReceiptUrl: newUrl } });
    return;
  }
  if (source === "OrderStageMedia") {
    await prisma.orderStageMedia.update({ where: { id }, data: { url: newUrl } });
    return;
  }
  if (source === "JobApp.cv") {
    await prisma.jobApplication.update({ where: { id }, data: { cvUrl: newUrl } });
    return;
  }
  if (source === "JobApp.letter") {
    await prisma.jobApplication.update({ where: { id }, data: { schoolItLetter: newUrl } });
    return;
  }
  if (source === "JobApp.idcard") {
    await prisma.jobApplication.update({ where: { id }, data: { schoolIdCard: newUrl } });
    return;
  }
  if (source.startsWith("SiteSetting.") && source !== "SiteSetting.carousel") {
    await prisma.siteSetting.update({ where: { id }, data: { value: newUrl } });
    return;
  }
  if (source === "Consultant.image") {
    await prisma.consultant.update({ where: { id }, data: { image: newUrl } });
    return;
  }
  if (source === "User.image") {
    await prisma.user.update({ where: { id }, data: { image: newUrl } });
    return;
  }
  if (source === "Review.testimonial") {
    await prisma.review.update({ where: { id }, data: { testimonialImage: newUrl } });
    return;
  }
  if (source === "Testimonial.client") {
    await prisma.testimonial.update({ where: { id }, data: { clientImage: newUrl } });
    return;
  }
  if (source === "Testimonial.admin") {
    await prisma.testimonial.update({ where: { id }, data: { adminImage: newUrl } });
    return;
  }
  const arrayMatch = source.match(/^(Bespoke|Consult|BespokeReq)\.(moodboard|refs|sketches)\[(\d+)\]$/);
  if (arrayMatch) {
    const [, owner, field, idxStr] = arrayMatch;
    const idx = Number(idxStr);
    if (owner === "Bespoke" && field === "moodboard") {
      const row = await prisma.bespokeOrder.findUnique({ where: { id }, select: { moodboardImages: true } });
      if (!row) return;
      const next = [...row.moodboardImages];
      next[idx] = newUrl;
      await prisma.bespokeOrder.update({ where: { id }, data: { moodboardImages: next } });
    }
    if (owner === "Consult" && field === "moodboard") {
      const row = await prisma.consultationBooking.findUnique({ where: { id }, select: { moodboardImages: true } });
      if (!row) return;
      const next = [...row.moodboardImages];
      next[idx] = newUrl;
      await prisma.consultationBooking.update({ where: { id }, data: { moodboardImages: next } });
    }
    if (owner === "Consult" && field === "refs") {
      const row = await prisma.consultationBooking.findUnique({ where: { id }, select: { referenceImages: true } });
      if (!row) return;
      const next = [...row.referenceImages];
      next[idx] = newUrl;
      await prisma.consultationBooking.update({ where: { id }, data: { referenceImages: next } });
    }
    if (owner === "BespokeReq" && field === "refs") {
      const row = await prisma.bespokeRequest.findUnique({ where: { id }, select: { referenceImages: true } });
      if (!row) return;
      const next = [...row.referenceImages];
      next[idx] = newUrl;
      await prisma.bespokeRequest.update({ where: { id }, data: { referenceImages: next } });
    }
    if (owner === "BespokeReq" && field === "sketches") {
      const row = await prisma.bespokeRequest.findUnique({ where: { id }, select: { sketchUrls: true } });
      if (!row) return;
      const next = [...row.sketchUrls];
      next[idx] = newUrl;
      await prisma.bespokeRequest.update({ where: { id }, data: { sketchUrls: next } });
    }
  }
}

async function copyOne(url: string): Promise<{ newUrl: string; bytes: number }> {
  const loc = folderFromCloudinaryUrl(url);
  if (!loc) throw new Error("could not parse Cloudinary folder");
  const buf = await download(url);
  const mime = mimeOf(buf);
  const stored = await getMediaStore().put(buf, {
    folder: loc.folder,
    mime,
    private: loc.private,
    originalName: url.split("/").pop(),
  });
  const ok = await verifyReadable(stored.url);
  if (!ok) throw new Error("stored file not readable");
  return { newUrl: stored.url, bytes: stored.bytes };
}

async function processRow(row: Row): Promise<Result[]> {
  if (row.kind === "json-carousel") {
    let slides: { type?: string; url?: string; alt?: string }[] = [];
    try {
      slides = JSON.parse(row.url) as typeof slides;
    } catch {
      return [{ source: row.source, id: row.id, url: row.url, status: "failed", note: "invalid JSON" }];
    }
    const out: Result[] = [];
    let changed = false;
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const url = slide?.url ?? "";
      const cls = classifyMediaUrl(url);
      if (cls.action !== "copy") {
        out.push({
          source: `${row.source}[${i}]`,
          id: row.id,
          url,
          status: cls.action === "already-local" ? "already-local" : "skipped",
          note: cls.reason,
        });
        continue;
      }
      const head = await headBytes(url);
      if (!head.ok) {
        out.push({
          source: `${row.source}[${i}]`,
          id: row.id,
          url,
          status: "not-found",
          note: `HEAD ${head.status}`,
        });
        continue;
      }
      if (!APPLY) {
        out.push({ source: `${row.source}[${i}]`, id: row.id, url, status: "copied", bytes: head.bytes ?? undefined, note: "plan" });
        continue;
      }
      try {
        const copied = await copyOne(url);
        slides[i] = { ...slide, url: copied.newUrl };
        changed = true;
        out.push({ source: `${row.source}[${i}]`, id: row.id, url, status: "copied", bytes: copied.bytes, newUrl: copied.newUrl });
      } catch (e) {
        out.push({
          source: `${row.source}[${i}]`,
          id: row.id,
          url,
          status: "failed",
          note: e instanceof Error ? e.message : String(e),
        });
      }
    }
    if (APPLY && changed) {
      await prisma.siteSetting.update({ where: { id: row.id }, data: { value: JSON.stringify(slides) } });
    }
    return out;
  }

  const cls = classifyMediaUrl(row.url);
  if (cls.action === "already-local") {
    return [{ source: row.source, id: row.id, url: row.url, status: "already-local" }];
  }
  if (cls.action !== "copy") {
    return [{ source: row.source, id: row.id, url: row.url, status: "skipped", note: cls.reason }];
  }
  const head = await headBytes(row.url);
  if (!head.ok) {
    return [{ source: row.source, id: row.id, url: row.url, status: "not-found", note: `HEAD ${head.status}` }];
  }
  if (!APPLY) {
    return [{ source: row.source, id: row.id, url: row.url, status: "copied", bytes: head.bytes ?? undefined, note: "plan" }];
  }
  try {
    const copied = await copyOne(row.url);
    await writeScalar(row.source, row.id, copied.newUrl);
    return [{ source: row.source, id: row.id, url: row.url, status: "copied", bytes: copied.bytes, newUrl: copied.newUrl }];
  } catch (e) {
    return [{
      source: row.source,
      id: row.id,
      url: row.url,
      status: "failed",
      note: e instanceof Error ? e.message : String(e),
    }];
  }
}

async function main() {
  const started = Date.now();
  const rows = await collect();
  const results: Result[] = [];
  for (const row of rows) {
    results.push(...(await processRow(row)));
  }

  const copied = results.filter((r) => r.status === "copied");
  const missing = results.filter((r) => r.status === "not-found");
  const failed = results.filter((r) => r.status === "failed");
  const skipped = results.filter((r) => r.status === "skipped" || r.status === "already-local");
  const bytes = copied.reduce((n, r) => n + (r.bytes ?? 0), 0);

  console.log(APPLY ? "APPLY" : "PLAN ONLY");
  console.log(`rows=${results.length} copied=${copied.length} skipped=${skipped.length} not-found=${missing.length} failed=${failed.length}`);
  console.log(`bytes=${bytes} mb=${(bytes / 1048576).toFixed(1)} durationMs=${Date.now() - started}`);
  if (missing.length) {
    console.log("\n404 / HEAD failures:");
    for (const r of missing) console.log(`  ${r.source} ${r.id} ${r.note} ${r.url}`);
  }
  if (failed.length) {
    console.log("\nFailures:");
    for (const r of failed) console.log(`  ${r.source} ${r.id} ${r.note}`);
  }
  if (!APPLY) console.log("\nNo files written. Re-run with --apply to copy.");

  const reportDir = process.env.MEDIA_ROOT?.trim() || join(process.cwd(), ".data");
  await mkdir(reportDir, { recursive: true });
  await writeFile(join(reportDir, "media-migrate-last.json"), JSON.stringify({ apply: APPLY, results }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
