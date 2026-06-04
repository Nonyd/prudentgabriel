"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/Badge";
import { formatPrice } from "@/lib/utils";

export type BestSellerProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  images: string[];
};

export function BestSellersGrid({ products }: { products: BestSellerProduct[] }) {
  return (
    <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product, index) => (
        <motion.div
          key={product.id}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: index * 0.1 }}
          viewport={{ once: true, margin: "-80px" }}
          whileHover={{ y: -4 }}
        >
          <Link href={`/rtw/${product.slug}`} className="group block">
            <div className="card-surface relative aspect-[3/4] overflow-hidden bg-ivory/5">
              {product.images[0] ? (
                <Image
                  src={product.images[0]}
                  alt={product.name}
                  fill
                  className="object-cover transition duration-300 group-hover:scale-[1.02]"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-bg/20 text-lightbr">
                  No image
                </div>
              )}
              <div className="absolute left-4 top-4">
                <Badge variant="accent">Best Seller</Badge>
              </div>
            </div>
            <div className="mt-4">
              <p className="font-serif text-lg font-medium text-cream">{product.name}</p>
              <p className="mt-1 font-sans text-sm text-lightbr">{formatPrice(product.price, "NGN")}</p>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
