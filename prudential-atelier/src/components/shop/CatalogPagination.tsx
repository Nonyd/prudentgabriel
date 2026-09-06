import Link from "next/link";

export function CatalogPagination({
  page,
  totalPages,
  hrefForPage,
}: {
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const prev = page > 1 ? hrefForPage(page - 1) : null;
  const next = page < totalPages ? hrefForPage(page + 1) : null;

  return (
    <nav className="mt-12 flex items-center justify-center gap-4 px-4 pb-16" aria-label="Pagination">
      {prev ? (
        <Link href={prev} className="font-sans text-[13px] font-normal text-text-mid hover:text-choc">
          Previous
        </Link>
      ) : (
        <span className="font-sans text-[13px] font-normal text-text-light">Previous</span>
      )}
      <span className="font-sans text-[13px] font-normal text-text-mid">
        Page {page} of {totalPages}
      </span>
      {next ? (
        <Link href={next} className="font-sans text-[13px] font-normal text-text-mid hover:text-choc">
          Next
        </Link>
      ) : (
        <span className="font-sans text-[13px] font-normal text-text-light">Next</span>
      )}
    </nav>
  );
}
