import { LEGAL_PAGE_META } from "@/lib/cms-config";
import { cmsGet, getCMSContent } from "@/lib/cms";
import { ensureLegalCopy } from "@/lib/legal-bootstrap";
import { LEGAL_HTML, type LegalPageKey } from "@/lib/legal-copy";
import { createLegalTermsSnapshot, renderLegalHtml } from "@/lib/legal-tokens";

export async function loadLegalPage(page: LegalPageKey) {
  await ensureLegalCopy();
  const meta = LEGAL_PAGE_META[page];
  const [cms, snapshot] = await Promise.all([
    getCMSContent([meta.contentKey, meta.updatedKey]),
    createLegalTermsSnapshot(),
  ]);
  const raw = cmsGet(cms, meta.contentKey, LEGAL_HTML[page]);
  return {
    title: meta.title,
    lastUpdated: cmsGet(cms, meta.updatedKey, meta.lastUpdated),
    html: renderLegalHtml(raw, snapshot.tokens, "public"),
    termsVersion: snapshot.version,
  };
}
