import { cloudinary } from "@/lib/cloudinary";

export const PRODUCT_CLOUDINARY_FOLDER = "prudential-atelier/products";

export async function uploadProductImageFromUrl(sourceUrl: string): Promise<string> {
  const configured =
    Boolean(process.env.CLOUDINARY_API_KEY?.length) &&
    Boolean(process.env.CLOUDINARY_API_SECRET?.length) &&
    Boolean(process.env.CLOUDINARY_CLOUD_NAME?.length);

  if (!configured) {
    return sourceUrl;
  }

  const result = await cloudinary.uploader.upload(sourceUrl, {
    folder: PRODUCT_CLOUDINARY_FOLDER,
    fetch_format: "auto",
    quality: "auto",
    transformation: [{ width: 1200, crop: "limit" }],
  });

  return result.secure_url;
}
