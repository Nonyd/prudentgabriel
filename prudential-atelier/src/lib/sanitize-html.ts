const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "a",
  "img",
  "span",
  "div",
]);

const ALLOWED_ATTR: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height"]),
};

function safeUrl(value: string, img: boolean): string | null {
  const v = value.trim();
  const lower = v.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("vbscript:") || lower.startsWith("data:")) {
    return null;
  }
  if (img) {
    if (lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("/")) return v;
    return null;
  }
  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("/") ||
    lower.startsWith("#")
  ) {
    return v;
  }
  return null;
}

function sanitizeAttrs(tag: string, rawAttrs: string): string {
  const allowed = ALLOWED_ATTR[tag];
  if (!allowed) return "";
  const out: string[] = [];
  const re = /([a-zA-Z:_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rawAttrs))) {
    const name = m[1].toLowerCase();
    if (name.startsWith("on")) continue;
    if (!allowed.has(name)) continue;
    const value = m[3] ?? m[4] ?? m[5] ?? "";
    if (name === "href" || name === "src") {
      const ok = safeUrl(value, tag === "img" && name === "src");
      if (!ok) continue;
      out.push(`${name}="${ok.replace(/"/g, "&quot;")}"`);
      continue;
    }
    if (name === "target") {
      out.push('target="_blank"');
      continue;
    }
    if (name === "rel") {
      out.push('rel="noopener noreferrer"');
      continue;
    }
    out.push(`${name}="${value.replace(/"/g, "&quot;")}"`);
  }
  if (tag === "a" && out.some((a) => a.startsWith("target=")) && !out.some((a) => a.startsWith("rel="))) {
    out.push('rel="noopener noreferrer"');
  }
  return out.length ? ` ${out.join(" ")}` : "";
}

/**
 * Allowlist sanitizer for CMS HTML. Run on render so existing unsanitized rows are safe.
 */
export function sanitizeCmsHtml(html: string | null | undefined): string {
  if (!html) return "";
  let s = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<\/?([a-zA-Z0-9]+)(\s[^>]*)?>/g, (full, tag: string, attrs: string | undefined) => {
    const name = tag.toLowerCase();
    const closing = full.startsWith("</");
    if (!ALLOWED_TAGS.has(name)) return "";
    if (closing) return `</${name}>`;
    if (full.endsWith("/>") || name === "br" || name === "img") {
      return `<${name}${sanitizeAttrs(name, attrs ?? "")} />`;
    }
    return `<${name}${sanitizeAttrs(name, attrs ?? "")}>`;
  });
  return s;
}
