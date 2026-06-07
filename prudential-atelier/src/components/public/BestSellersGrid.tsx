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
    <div className="mt-12 grid grid-cols-2 gap-4 md:gap-5 lg:grid-cols-4 lg:gap-6">
      {products.map((product, index) => (
        <motion.div
          key={product.id}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: index * 0.08 }}
          viewport={{ once: true, margin: "-80px" }}
          whileHover={{ y: -4 }}
          className="h-full"
        >
          <Link
            href={`/shop/${product.slug}`}
            className="group flex h-full flex-col overflow-hidden border border-sand/70 bg-bg-card transition-shadow duration-300 hover:shadow-[0_10px_32px_rgba(42,36,31,0.08)]"
          >
            <div className="img-portrait relative shrink-0 bg-ivory-dark">
              {product.images[0] ? (
                <Image
                  src={product.images[0]}
                  alt={product.name}
                  fill
                  className="object-cover object-top transition duration-500 group-hover:scale-[1.03]"
                  sizes="(max-width: 640px) 50vw, 25vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center font-serif text-lg text-lightbr">
                  No image
                </div>
              )}
              <span className="absolute left-3 top-3 rounded-sm bg-wine px-2.5 py-1 font-sans text-[9px] font-semibold uppercase tracking-[0.12em] text-cream">
                Best Seller
              </span>
            </div>
            <div className="flex flex-1 flex-col px-4 py-4 md:px-5 md:py-5">
              <p className="font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-lightbr">
                {product.category}
              </p>
              <p className="mt-2 line-clamp-2 font-serif text-[15px] leading-snug text-choc transition-colors group-hover:text-nut md:text-base">
                {product.name}
              </p>
              <p className="mt-2.5 font-body text-[13px] font-medium text-choc">
                {formatPrice(product.price, "NGN")}
              </p>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
