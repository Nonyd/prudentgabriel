import Link from "next/link";
import { BlogStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BlogPreviewImage } from "./BlogPreviewImage";

export async function BlogPreview() {
  let posts: {
    id: string;
    title: string;
    slug: string;
    featuredImage: string | null;
    category: string | null;
    readTime: number | null;
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
        featuredImage: true,
        category: true,
        readTime: true,
      },
    });
  } catch {
    return null;
  }

  if (posts.length === 0) return null;

  return (
    <section className="bg-bg-page px-6 py-20 lg:px-10">
      <div className="mx-auto max-w-site">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-lightbr">
              Latest from the Journal
            </p>
            <h2 className="mt-3 font-serif text-[42px] font-medium leading-tight text-choc">
              Stories from the atelier
            </h2>
          </div>
          <Link
            href="/journal"
            className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-nut transition-colors hover:text-choc"
          >
            Read All →
          </Link>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/journal/${post.slug}`}
              className="group block"
            >
              <div className="img-portrait relative overflow-hidden bg-bg">
                <BlogPreviewImage
                  src={post.featuredImage}
                  alt={post.title}
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
              <div className="mt-4">
                {post.category ? (
                  <p className="font-sans text-[10px] font-medium uppercase tracking-[0.16em] text-lightbr">
                    {post.category}
                  </p>
                ) : null}
                <h3 className="mt-2 font-serif text-xl font-medium text-choc group-hover:text-nut">
                  {post.title}
                </h3>
                <p className="mt-2 font-sans text-[11px] font-light text-text-light">
                  {post.readTime ? `${post.readTime} min read` : "Read article"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
