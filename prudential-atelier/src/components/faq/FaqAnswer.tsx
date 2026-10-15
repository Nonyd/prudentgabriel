import Link from "next/link";
import type { FaqBlock, FaqInline } from "@/lib/faq-content";

const linkClass =
  "text-choc underline decoration-gold/60 decoration-1 underline-offset-[3px] transition-colors hover:decoration-choc focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

function Inline({ part }: { part: FaqInline }) {
  if (typeof part === "string") return <>{part}</>;
  if (part.href.startsWith("/")) {
    return (
      <Link href={part.href} className={linkClass}>
        {part.label}
      </Link>
    );
  }
  return (
    <a href={part.href} className={`${linkClass} break-words`}>
      {part.label}
    </a>
  );
}

function Parts({ parts }: { parts: FaqInline[] }) {
  return (
    <>
      {parts.map((part, i) => (
        <Inline key={i} part={part} />
      ))}
    </>
  );
}

/** Renders one answer: paragraphs, bullet lists and links. */
export function FaqAnswer({ blocks }: { blocks: FaqBlock[] }) {
  return (
    <div className="space-y-3 font-body text-[15px] leading-7 text-charcoal-mid">
      {blocks.map((block, i) =>
        block.kind === "p" ? (
          <p key={i}>
            <Parts parts={block.parts} />
          </p>
        ) : (
          <ul key={i} className="space-y-1.5">
            {block.items.map((item, j) => (
              <li key={j} className="relative pl-5">
                <span aria-hidden className="absolute left-0 top-[0.8em] h-px w-2.5 bg-gold" />
                <Parts parts={item} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
