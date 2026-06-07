"use client";

import Image from "next/image";
import { useState } from "react";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";

export function BlogPreviewImage({
  src,
  alt,
  sizes,
}: {
  src: string | null;
  alt: string;
  sizes: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <ImagePlaceholder className="absolute inset-0 h-full w-full" />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className="object-cover transition duration-500 group-hover:scale-[1.02]"
      sizes={sizes}
      onError={() => setFailed(true)}
    />
  );
}
