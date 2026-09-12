import { extractLegalToc } from "@/lib/legal-copy";
import { sanitizeCmsHtml } from "@/lib/sanitize-html";

type LegalPageTemplateProps = {
  title: string;
  lastUpdated: string;
  html: string;
};

export function LegalPageTemplate({ title, lastUpdated, html }: LegalPageTemplateProps) {
  const sanitized = sanitizeCmsHtml(html);
  const toc = extractLegalToc(sanitized);

  return (
    <article className="px-6 pb-24 pt-28 lg:px-10 lg:pt-32">
      <header className="mx-auto max-w-[68ch]">
        <h1
          className="mt-0"
          style={{
            fontFamily: "var(--font-cormorant)",
            fontSize: "48px",
            fontWeight: 400,
            color: "var(--choc)",
            lineHeight: 1.1,
          }}
        >
          {title}
        </h1>
      </header>

      <div className="legal-content glass-2 glass-panel mx-auto mt-10 max-w-[68ch] px-8 py-10 sm:px-10 sm:py-12">
        {toc.length > 0 ? (
          <nav className="legal-toc" aria-label="Contents">
            <p className="legal-toc-label">Contents</p>
            <ol>
              {toc.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`}>{item.text}</a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <div dangerouslySetInnerHTML={{ __html: sanitized }} />

        <p className="legal-updated">Last updated: {lastUpdated}</p>
      </div>
    </article>
  );
}
