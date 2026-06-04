import Link from "next/link";
import Image from "next/image";
import { BlogStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function BlogPreview() {
  let posts: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    featuredImage: string | null;
    category: string | null;
    readTime: number | null;
    publishedAt: Date | null;
  }[] = [];

  try {
    posts = await prisma.blogPost.findMany({
      where: {
        status: BlogStatus.PUBLISHED,
        publishedAt: { lte: new Date() },
      },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        featuredImage: true,
        category: true,
        readTime: true,
        publishedAt: true,
      },
    });
  } catch {
    return null;
  }

  if (posts.length === 0) return null;

  return (
    <section className="bg-bg px-6 py-20 lg:px-10">
      <div className="mx-auto max-w-site">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Journal</p>
            <h2 className="mt-3 font-serif text-[clamp(2rem,3vw,2.625rem)] font-medium text-choc">
              From the Atelier
            </h2>
          </div>
          <Link
            href="/journal"
            className="hidden font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-nut sm:inline-flex"
          >
            View all
          </Link>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/journal/${post.slug}`}
              className="group block overflow-hidden border border-sand/60 bg-ivory transition hover:border-lightbr"
            >
              <div className="relative aspect-[4/3] bg-sand/30">
                {post.featuredImage ? (
                  <Image
                    src={post.featuredImage}
                    alt=""
                    fill
                    className="object-cover transition duration-500 group-hover:scale-[1.02]"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center font-serif text-lg text-lightbr">
                    Journal
                  </div>
                )}
              </div>
              <div className="p-5">
                {post.category ? (
                  <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-lightbr">
                    {post.category}
                  </p>
                ) : null}
                <h3 className="mt-2 font-serif text-xl font-medium text-choc group-hover:text-nut">
                  {post.title}
                </h3>
                {post.excerpt ? (
                  <p className="mt-2 line-clamp-2 font-sans text-sm font-light leading-relaxed text-text-mid">
                    {post.excerpt}
                  </p>
                ) : null}
                <p className="mt-3 font-sans text-[10px] uppercase tracking-wider text-text-light">
                  {post.readTime ? `${post.readTime} min read` : "Read article"}
                </p>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 text-center sm:hidden">
          <Link href="/journal" className="btn-ghost-light inline-flex">
            View all
          </Link>
        </div>
      </div>
    </section>
  );
}
