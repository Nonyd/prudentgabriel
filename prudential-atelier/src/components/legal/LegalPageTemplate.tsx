import { sanitizeCmsHtml } from "@/lib/sanitize-html";

type LegalPageTemplateProps = {
  title: string;
  lastUpdated: string;
  html: string;
};

export function LegalPageTemplate({ title, lastUpdated, html }: LegalPageTemplateProps) {
  return (
    <article className="bg-ivory px-6 pb-24 pt-20 lg:px-10">
      <header className="mx-auto max-w-[760px] text-center">
        <p
          className="uppercase"
          style={{
            fontFamily: "var(--font-jost)",
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.2em",
            color: "var(--lightbr)",
          }}
        >
          Legal
        </p>
        <h1
          className="mt-3"
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
        <p
          className="mt-3"
          style={{
            fontFamily: "var(--font-jost)",
            fontSize: "11px",
            color: "var(--text-light)",
          }}
        >
          Last updated: {lastUpdated}
        </p>
      </header>

      <div
        className="legal-content mx-auto mt-12 max-w-[760px]"
        dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(html) }}
      />
    </article>
  );
}
