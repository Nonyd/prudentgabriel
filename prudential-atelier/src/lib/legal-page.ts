import { LEGAL_PAGE_META } from "@/lib/cms-config";
import { cmsGet, getCMSContent } from "@/lib/cms";
import { ensureLegalCopy } from "@/lib/legal-bootstrap";
import { LEGAL_HTML, type LegalPageKey } from "@/lib/legal-copy";

export async function loadLegalPage(page: LegalPageKey) {
  await ensureLegalCopy();
  const meta = LEGAL_PAGE_META[page];
  const cms = await getCMSContent([meta.contentKey, meta.updatedKey]);
  return {
    title: meta.title,
    lastUpdated: cmsGet(cms, meta.updatedKey, meta.lastUpdated),
    html: cmsGet(cms, meta.contentKey, LEGAL_HTML[page]),
  };
}
