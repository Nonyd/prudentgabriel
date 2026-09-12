import { extractLegalToc } from "@/lib/legal-copy";
import { sanitizeCmsHtml } from "@/lib/sanitize-html";
import { LegalToc } from "./LegalToc";

type LegalPageTemplateProps = {
  title: string;
  lastUpdated: string;
  html: string;
  termsVersion?: string;
};

export function LegalPageTemplate({ title, lastUpdated, html, termsVersion }: LegalPageTemplateProps) {
  const sanitized = sanitizeCmsHtml(html);
  const toc = extractLegalToc(sanitized);

  return (
    <article className="legal-page">
      <div className={toc.length > 0 ? "legal-shell legal-shell--toc" : "legal-shell"}>
        {toc.length > 0 ? <LegalToc items={toc} /> : null}

        <header className="legal-header">
          <h1 className="legal-title">{title}</h1>
        </header>

        <div className="legal-content glass-2 glass-panel">
          <div dangerouslySetInnerHTML={{ __html: sanitized }} />
          <p className="legal-updated">
            Last updated: {lastUpdated}
            {termsVersion ? <span className="legal-version">Version {termsVersion}</span> : null}
          </p>
        </div>
      </div>
    </article>
  );
}
