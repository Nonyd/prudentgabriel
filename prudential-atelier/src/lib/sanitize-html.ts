/**
 * Allowlist sanitizer for CMS HTML (product details, journal, careers, legal pages).
 *
 * It does not pass input through. It tokenizes the input the way a browser's HTML
 * tokenizer does (tag names end at whitespace, "/" or ">", so `<img/src=x onerror=…>`
 * is an `img` tag with an `onerror` attribute) and then rebuilds the output from
 * scratch: only allowlisted tags with allowlisted, validated attributes are emitted,
 * every other tag is dropped, the bodies of script/style-like elements are dropped,
 * comments/doctypes/processing instructions are dropped, and any `<` that does not
 * start a tag is written as `&lt;`. Because the only markup in the output is markup we
 * wrote ourselves, a browser cannot re-parse it into anything else.
 *
 * Pure string code with no DOM dependency, so it runs the same in server components,
 * client components, route handlers and scripts.
 */

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
  h2: new Set(["id"]),
  h3: new Set(["id"]),
  h4: new Set(["id"]),
};

/** Elements whose whole body is dropped, not just the tags (raw-text / unsafe containers). */
const DROP_WITH_CONTENT = new Set([
  "script",
  "style",
  "iframe",
  "noscript",
  "noembed",
  "noframes",
  "textarea",
  "title",
  "xmp",
  "template",
  "object",
]);

function safeId(value: string): string | null {
  const v = value.trim();
  if (!/^[a-z][a-z0-9-]{0,79}$/.test(v)) return null;
  return v;
}

function safeUrl(value: string, img: boolean): string | null {
  const v = value.trim();
  const lower = v.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("vbscript:") || lower.startsWith("data:")) {
    return null;
  }
  // Allowlist on the literal prefix: the scheme is fixed by these characters, so entity
  // tricks (`&#106;avascript:`) or embedded tabs never reach an allowed branch.
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

function escapeAttr(value: string): string {
  return value.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type Attr = { name: string; value: string };

function sanitizeAttrs(tag: string, attrs: Attr[]): string {
  const allowed = ALLOWED_ATTR[tag];
  if (!allowed) return "";
  const out: string[] = [];
  const seen = new Set<string>();
  for (const { name: rawName, value } of attrs) {
    const name = rawName.toLowerCase();
    if (name.startsWith("on")) continue;
    if (!allowed.has(name)) continue;
    // Browsers keep the first occurrence of a duplicated attribute; do the same.
    if (seen.has(name)) continue;
    seen.add(name);
    if (name === "id") {
      const ok = safeId(value);
      if (!ok) continue;
      out.push(`id="${ok}"`);
      continue;
    }
    if (name === "href" || name === "src") {
      const ok = safeUrl(value, tag === "img" && name === "src");
      if (!ok) continue;
      out.push(`${name}="${escapeAttr(ok)}"`);
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
    out.push(`${name}="${escapeAttr(value)}"`);
  }
  if (tag === "a" && out.some((a) => a.startsWith("target=")) && !out.some((a) => a.startsWith("rel="))) {
    out.push('rel="noopener noreferrer"');
  }
  return out.length ? ` ${out.join(" ")}` : "";
}

const isWs = (c: string) => c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f";
const isAlpha = (c: string | undefined) => !!c && /[a-zA-Z]/.test(c);

type Tag = { name: string; closing: boolean; selfClosing: boolean; attrs: Attr[]; end: number };

/**
 * Parse a tag starting at `start` (which points at "<", followed by a letter or "/" + letter),
 * following the HTML tokenizer's tag-name / attribute states. Returns null when the input
 * ends before the tag is closed (browsers drop such a tag, and so do we).
 */
function parseTag(s: string, start: number): Tag | null {
  let i = start + 1;
  const closing = s[i] === "/";
  if (closing) i++;
  let name = "";
  while (i < s.length && !isWs(s[i]!) && s[i] !== "/" && s[i] !== ">") name += s[i++];
  const attrs: Attr[] = [];
  let selfClosing = false;
  while (i < s.length) {
    const c = s[i]!;
    if (c === ">") return { name: name.toLowerCase(), closing, selfClosing, attrs, end: i + 1 };
    if (isWs(c)) {
      i++;
      continue;
    }
    if (c === "/") {
      i++;
      selfClosing = s[i] === ">";
      continue;
    }
    selfClosing = false;
    // Attribute name: the first char may be "=", then runs to whitespace, "/", ">" or "=".
    let attrName = s[i++]!;
    while (i < s.length && !isWs(s[i]!) && s[i] !== "/" && s[i] !== ">" && s[i] !== "=") attrName += s[i++];
    while (i < s.length && isWs(s[i]!)) i++;
    let value = "";
    if (s[i] === "=") {
      i++;
      while (i < s.length && isWs(s[i]!)) i++;
      const q = s[i];
      if (q === '"' || q === "'") {
        const close = s.indexOf(q, i + 1);
        if (close === -1) return null;
        value = s.slice(i + 1, close);
        i = close + 1;
      } else {
        while (i < s.length && !isWs(s[i]!) && s[i] !== ">") value += s[i++];
      }
    }
    attrs.push({ name: attrName, value });
  }
  return null;
}

/**
 * Allowlist sanitizer for CMS HTML. Run on render so existing unsanitized rows are safe.
 */
export function sanitizeCmsHtml(html: string | null | undefined): string {
  if (!html) return "";
  const s = html;
  let out = "";
  let i = 0;
  while (i < s.length) {
    const lt = s.indexOf("<", i);
    if (lt === -1) {
      out += s.slice(i);
      break;
    }
    out += s.slice(i, lt);
    const next = s[lt + 1];

    // Comments, doctypes, CDATA, processing instructions: dropped entirely.
    if (s.startsWith("<!--", lt)) {
      const endC = s.indexOf("-->", lt + 2);
      i = endC === -1 ? s.length : endC + 3;
      continue;
    }
    if (next === "!" || next === "?") {
      const endB = s.indexOf(">", lt);
      i = endB === -1 ? s.length : endB + 1;
      continue;
    }

    const startsTag = isAlpha(next) || (next === "/" && isAlpha(s[lt + 2]));
    if (!startsTag) {
      // "</>" is ignored by browsers; any other stray "<" is plain text.
      if (next === "/" && s[lt + 2] === ">") {
        i = lt + 3;
        continue;
      }
      out += "&lt;";
      i = lt + 1;
      continue;
    }

    const tag = parseTag(s, lt);
    if (!tag) break; // unterminated tag at end of input: drop the rest

    i = tag.end;
    if (!tag.closing && DROP_WITH_CONTENT.has(tag.name)) {
      // Skip to the matching end tag (case-insensitive), dropping everything in between.
      // (A regex rather than toLowerCase()+indexOf: lower-casing can change string length.)
      const endRe = new RegExp(`</${tag.name}(?=[\\s/>]|$)`, "gi");
      endRe.lastIndex = i;
      const m = endRe.exec(s);
      if (!m) break;
      const endTag = parseTag(s, m.index);
      if (!endTag) break;
      i = endTag.end;
      continue;
    }

    if (!ALLOWED_TAGS.has(tag.name)) continue;
    if (tag.closing) {
      out += `</${tag.name}>`;
      continue;
    }
    const attrs = sanitizeAttrs(tag.name, tag.attrs);
    if (tag.selfClosing || tag.name === "br" || tag.name === "img") {
      out += `<${tag.name}${attrs} />`;
    } else {
      out += `<${tag.name}${attrs}>`;
    }
  }
  return out;
}
