/**
 * Slice X: local MediaStore, folder gate, magic bytes, private receipts.
 *
 *   pnpm test:slice-x
 */
import "./preload-test-env";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalDiskMediaStore, setMediaStoreForTest } from "../src/lib/media";
import { streamMediaKey } from "../src/lib/media/stream";
import { folderFromMediaKey, isValidMediaKey, keyFromMediaUrl } from "../src/lib/media/keys";
import { signMediaKey, verifyMediaSignature } from "../src/lib/media/signed";
import { adminReceiptSrc } from "../src/lib/media/receipt-src";
import { mimeFromMagicBytes, mimeFromVideoMagicBytes, isHeifMagic } from "../src/lib/image-upload-mime";
import { permissionForUploadFolder, UI_UPLOAD_FOLDERS, folderIsPrivate } from "../src/lib/admin-upload-folder";
import { classifyMediaUrl, folderFromCloudinaryUrl } from "../src/lib/media/migrate-plan";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

function jpegBytes(): Buffer {
  const b = Buffer.alloc(16, 0);
  b[0] = 0xff;
  b[1] = 0xd8;
  b[2] = 0xff;
  b[3] = 0xe0;
  return b;
}

function pngBytes(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
}

function pdfBytes(): Buffer {
  return Buffer.from("%PDF-1.4 rest!!!!");
}

function mp4Bytes(): Buffer {
  const b = Buffer.alloc(16, 0);
  b.write("ftyp", 4, "ascii");
  b.write("isom", 8, "ascii");
  return b;
}

async function run() {
  process.env.AUTH_SECRET ??= "test-slice-x-auth-secret-do-not-use";
  const root = await mkdtemp(join(tmpdir(), "pg-media-"));
  const store = createLocalDiskMediaStore(root);
  setMediaStoreForTest(store);

  try {
    for (const folder of UI_UPLOAD_FOLDERS) {
      assert(permissionForUploadFolder(folder) !== null, `UI folder ${folder} must pass the gate`);
    }
    assert(permissionForUploadFolder("evil/etc") === null, "unknown folder is rejected");
    assert(permissionForUploadFolder("prudent-gabriel/hero") !== null, "hero is mapped");
    assert(permissionForUploadFolder("prudent-gabriel/hero-videos") !== null, "hero-videos is mapped");
    assert(permissionForUploadFolder("prudential-atelier/avatars/admin") === "portal", "admin avatar is portal");
    assert(permissionForUploadFolder("bespoke-stages") === "bespoke", "stage media folder");
    assert(permissionForUploadFolder("prudent-gabriel/bespoke-sketches") === "bespoke", "sketches");
    assert(permissionForUploadFolder("prudent-gabriel/general") !== null, "media library general folder");
    assert(folderIsPrivate("prudential-atelier/receipts"), "receipts are private");
    assert(!folderIsPrivate("prudential-atelier/products"), "products are public");

    assert(mimeFromMagicBytes(jpegBytes()) === "image/jpeg", "jpeg magic");
    assert(mimeFromMagicBytes(pngBytes()) === "image/png", "png magic");
    assert(mimeFromMagicBytes(pdfBytes(), { allowPdf: true }) === "application/pdf", "pdf magic");
    assert(mimeFromMagicBytes(Buffer.from("not-an-image!!!!")) === null, "declared MIME is ignored");
    const heic = Buffer.alloc(32, 0);
    heic.write("ftypheic", 4, "ascii");
    assert(mimeFromMagicBytes(heic) === null, "heic is refused unless opted in");
    assert(mimeFromMagicBytes(heic, { allowHeic: true }) === "image/heic", "receipts can opt into heic");
    assert(mimeFromVideoMagicBytes(mp4Bytes()) === "video/mp4", "mp4 ftyp");
    const { isHeifMagic } = await import("../src/lib/image-upload-mime");
    assert(!isHeifMagic(mp4Bytes()), "mp4 isom is not heif");
    assert(isHeifMagic(heic), "ftyp heic is heif");
    const { isStoredReceiptMediaUrl, isStoredPrivateMediaUrl, receiptMediaUrlSchema, storedPrivateMediaUrlSchema, emptyableStoredPublicMediaUrlSchema } = await import("../src/lib/media/stored-url");
    const privateReceipt = "/media/private/prudential-atelier/receipts/d20f6ffd523b78a86cd2f916fa34af5d.jpg";
    assert(isStoredReceiptMediaUrl(privateReceipt), "guest upload path is a valid receipt URL");
    assert(receiptMediaUrlSchema.safeParse(privateReceipt).success, "receipt schema accepts local private path");
    assert(!receiptMediaUrlSchema.safeParse("/media/public/prudential-atelier/products/x.jpg").success, "public media is not a receipt");
    const cvPath = "/media/private/prudential-atelier/careers/abc123def456abc123def456abc123de.pdf";
    assert(isStoredPrivateMediaUrl(cvPath), "career uploads are private local paths");
    assert(storedPrivateMediaUrlSchema.safeParse(cvPath).success, "CV persist accepts /media/private/");
    const avatar = "/media/public/prudential-atelier/avatars/customer/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg";
    assert(emptyableStoredPublicMediaUrlSchema.safeParse(avatar).success, "avatar persist accepts /media/public/");
    assert(emptyableStoredPublicMediaUrlSchema.safeParse("").success, "clearing an avatar with empty string still works");
    const persistFiles = [
      "src/app/api/account/moodboards/route.ts",
      "src/app/api/account/profile/route.ts",
      "src/app/api/account/profile/merged/route.ts",
      "src/app/api/account/testimonials/route.ts",
      "src/app/api/admin/account/route.ts",
      "src/app/api/careers/[slug]/apply/route.ts",
      "src/app/api/admin/consultations/[id]/session/route.ts",
      "src/app/api/bespoke/[orderId]/alterations/route.ts",
      "src/validations/consultation.ts",
      "src/validations/bespoke.ts",
      "src/lib/admin-testimonial-schema.ts",
    ];
    for (const rel of persistFiles) {
      const src = await readFile(join(process.cwd(), rel), "utf8");
      assert(!src.includes("z.string().url()"), `${rel} must not use z.string().url() for stored media`);
    }
    const meeting = await readFile(join(process.cwd(), "src/app/api/admin/consultations/[id]/send-link/route.ts"), "utf8");
    assert(meeting.includes("z.string().url()"), "Zoom/Meet links stay absolute URLs");
    assert(mimeFromVideoMagicBytes(jpegBytes()) === null, "jpeg is not a video");

    const publicFile = await store.put(jpegBytes(), {
      folder: "prudential-atelier/products",
      originalName: "../../../etc/passwd.jpg",
      mime: "image/jpeg",
      private: false,
    });
    assert(!publicFile.key.includes("passwd"), "original name is not in the key");
    assert(publicFile.key.startsWith("public/"), "public prefix");
    assert(isValidMediaKey(publicFile.key), "key shape");
    assert(publicFile.url === `/media/${publicFile.key}`, "public url path");
    const onDisk = store.absolutePath(publicFile.key);
    assert(onDisk && onDisk.startsWith(root), "file lives under MEDIA_ROOT");
    const roundTrip = await readFile(onDisk!);
    assert(roundTrip.equals(jpegBytes()), "bytes survive put");

    const pub = await streamMediaKey(publicFile.key, { allowPrivate: false, cache: "public" });
    assert(pub.status === 200, "public file is served");
    assert(pub.headers.get("Cache-Control")?.includes("immutable"), "long cache");

    const receipt = await store.put(pngBytes(), {
      folder: "prudential-atelier/receipts",
      originalName: "statement.png",
      mime: "image/png",
      private: true,
    });
    assert(receipt.key.startsWith("private/"), "receipts are private");
    const denied = await streamMediaKey(receipt.key, { allowPrivate: false, cache: "public" });
    assert(denied.status === 404, "private file is not on the public route");
    const allowed = await streamMediaKey(receipt.key, { allowPrivate: true, cache: "private" });
    assert(allowed.status === 200, "private file streams when allowed");
    assert(adminReceiptSrc(receipt.url).startsWith("/api/admin/media/file/"), "admin lightbox path");

    const exp = Math.floor(Date.now() / 1000) + 60;
    const sig = signMediaKey(receipt.key, exp);
    assert(verifyMediaSignature(receipt.key, exp, sig), "valid signature");
    assert(!verifyMediaSignature(receipt.key, exp - 120, sig), "expired signature");
    assert(!verifyMediaSignature(receipt.key, exp, "aaaa"), "bad signature");

    const traversal = streamMediaKey("public/../secrets.jpg", { allowPrivate: false, cache: "public" });
    assert((await traversal).status === 404, "path traversal key rejected");

    await store.delete(publicFile.key);
    const gone = await streamMediaKey(publicFile.key, { allowPrivate: false, cache: "public" });
    assert(gone.status === 404, "delete removes the file");

    assert(keyFromMediaUrl(receipt.url) === receipt.key, "keyFromMediaUrl round-trip");
    assert(folderFromMediaKey(receipt.key) === "prudential-atelier/receipts", "folder from key");

    const same = await store.put(jpegBytes(), {
      folder: "prudential-atelier/products",
      mime: "image/jpeg",
      private: false,
    });
    assert(same.key === publicFile.key, "content hash is idempotent");

    const uploadRoutes = [
      "src/app/api/admin/media/route.ts",
      "src/app/api/admin/gallery/route.ts",
      "src/app/api/account/upload/route.ts",
      "src/app/api/admin/upload/route.ts",
      "src/app/api/upload/receipt/route.ts",
      "src/app/api/careers/upload/route.ts",
      "src/app/api/consultations/upload/route.ts",
    ];
    for (const rel of uploadRoutes) {
      const src = await readFile(join(process.cwd(), rel), "utf8");
      assert(src.includes("mimeFromMagicBytes"), `${rel} must validate magic bytes`);
      assert(src.includes("getMediaStore"), `${rel} must go through MediaStore`);
    }

    assert(classifyMediaUrl("https://res.cloudinary.com/x/image/upload/v1/a/b.jpg").action === "copy", "cloudinary is copy");
    assert(classifyMediaUrl("/media/public/a/b.jpg").action === "already-local", "local is skipped");
    assert(classifyMediaUrl("https://images.unsplash.com/photo-1").action === "skip-remote", "unsplash is not copied");
    const { isStoredPublicMediaUrl } = await import("../src/lib/media/stored-url");
    assert(isStoredPublicMediaUrl(publicFile.url) === true, "local product url is accepted");
    assert(isStoredPublicMediaUrl("/media/private/prudential-atelier/receipts/x.pdf") === false, "private path rejected");
    assert(isStoredPublicMediaUrl("https://res.cloudinary.com/x/image/upload/a.jpg") === true, "https still accepted");
    assert(isStoredPublicMediaUrl("not-a-url") === false, "garbage rejected");
    assert(
      isStoredPublicMediaUrl("/media/public/prudential-atelier/collections/abc123.jpg") === true,
      "collection cover path is accepted",
    );
    const { collectionAdminSchema } = await import("../src/validations/collection");
    const coverOk = collectionAdminSchema.pick({ coverImage: true }).safeParse({
      coverImage: "/media/public/prudential-atelier/collections/abc123.jpg",
    });
    assert(coverOk.success === true, "collection schema accepts /media/ cover");
    const coverBad = collectionAdminSchema.pick({ coverImage: true }).safeParse({
      coverImage: "not-a-url",
    });
    assert(coverBad.success === false, "collection schema still rejects garbage");
    const imagesRoute = await readFile(join(process.cwd(), "src/app/api/admin/products/[id]/images/route.ts"), "utf8");
    assert(imagesRoute.includes("storedPublicMediaUrlSchema"), "product image persist accepts /media/ paths");
    const productVal = await readFile(join(process.cwd(), "src/validations/product.ts"), "utf8");
    assert(productVal.includes("storedPublicMediaUrlSchema"), "product save accepts /media/ image urls");
    const loc = folderFromCloudinaryUrl(
      "https://res.cloudinary.com/dwgbr0oyn/image/upload/v1780766238/prudential-atelier/receipts/abc.png",
    );
    assert(loc?.folder === "prudential-atelier/receipts" && loc.private, "receipt folder is private");
    const planAgain = await store.put(jpegBytes(), {
      folder: "prudential-atelier/products",
      mime: "image/jpeg",
      private: false,
    });
    assert(planAgain.key === same.key, "migration re-put of the same bytes is resumable");
  } finally {
    setMediaStoreForTest(null);
    await rm(root, { recursive: true, force: true });
  }

  console.log("slice-x: ok");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
