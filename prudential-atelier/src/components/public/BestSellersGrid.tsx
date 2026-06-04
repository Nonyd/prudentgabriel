"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { formatPrice } from "@/lib/utils";

export type BestSellerProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  category: string;
  images: string[];
};

export function BestSellersGrid({ products }: { products: BestSellerProduct[] }) {
  return (
    <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {products.map((product, index) => (
        <motion.div
          key={product.id}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: index * 0.08 }}
          viewport={{ once: true, margin: "-80px" }}
          whileHover={{ y: -4 }}
        >
          <Link href={`/rtw/${product.slug}`} className="group block">
            <div className="relative aspect-square overflow-hidden bg-bg">
              {product.images[0] ? (
                <Image
                  src={product.images[0]}
                  alt={product.name}
                  fill
                  className="object-cover transition duration-500 group-hover:scale-[1.02]"
                  sizes="(max-width: 640px) 50vw, 25vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center font-serif text-lg text-lightbr">
                  No image
                </div>
              )}
              <span className="absolute left-3 top-3 rounded-full bg-wine px-2.5 py-1 font-sans text-[9px] font-semibold uppercase tracking-[0.12em] text-cream">
                Best Seller
              </span>
            </div>
            <div className="mt-4">
              <p className="font-sans text-[10px] font-medium uppercase tracking-[0.16em] text-lightbr">
                {product.category}
              </p>
              <p className="mt-1 font-serif text-lg font-medium text-choc group-hover:text-nut">
                {product.name}
              </p>
              <p className="mt-1 font-sans text-[13px] text-text-mid">
                {formatPrice(product.price, "NGN")}
              </p>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
