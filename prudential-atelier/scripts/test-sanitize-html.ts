/**
 * sanitizeCmsHtml: known XSS payloads are neutralised; allowlisted markup survives unchanged.
 * Pure — no DB. Run: npm run test:sanitize-html
 */
import { sanitizeCmsHtml } from "../src/lib/sanitize-html";

let failures = 0;
function check(ok: boolean, label: string, detail?: string) {
  if (ok) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ""}`);
  }
}

const ALLOWED = "p|br|strong|b|em|i|u|ul|ol|li|h2|h3|h4|blockquote|a|img|span|div";
/** Every "<" in the output must open a well-formed allowlisted tag with only quoted name="value" attrs. */
const TAG_RE = new RegExp(`^</?(?:${ALLOWED})(?: [a-z]+="[^"<>]*")*(?: /)?>`);

function structurallySafe(out: string): string | null {
  for (let i = out.indexOf("<"); i !== -1; i = out.indexOf("<", i + 1)) {
    const m = TAG_RE.exec(out.slice(i));
    if (!m) return `unexpected markup at ${i}: ${out.slice(i, i + 40)}`;
    const tag = m[0];
    for (const [, name, value] of tag.matchAll(/ ([a-z]+)="([^"]*)"/g)) {
      if (name!.startsWith("on")) return `event handler survived: ${tag}`;
      if ((name === "href" || name === "src") && /^\s*(?:javascript|vbscript|data):/i.test(value!)) {
        return `dangerous URL survived: ${tag}`;
      }
    }
  }
  return null;
}

console.log("XSS payloads are neutralised");
const payloads: Array<[string, string]> = [
  ["<img/src=x onerror=alert(1)>", "<img />"], // relative "x" is not an allowed img src
  ["<svg/onload=alert(1)>", ""],
  ['<a href="javascript:alert(1)">x</a>', "<a>x</a>"],
  ['<a href="JaVaScRiPt:alert(1)">', "<a>"],
  ["<iframe src=//evil>", ""],
  ["<scr<script>ipt>", "ipt>"], // tag name is "scr<script" (dropped); "ipt>" is inert text
  ["<p onclick=alert(1)>x</p>", "<p>x</p>"],
  ['<img src="x" onerror="alert(1)">', "<img />"],
  ["<style>*{}</style>", ""],
  ['<math><mi xlink:href="javascript:alert(1)">', ""],
  // a few more of the classics
  ['<img src="/a.jpg"/onerror=alert(1)>', '<img src="/a.jpg" />'],
  ['<a href=" javascript:alert(1)">x</a>', "<a>x</a>"],
  ['<a href="&#106;avascript:alert(1)">x</a>', "<a>x</a>"],
  ['<a href="java\tscript:alert(1)">x</a>', "<a>x</a>"],
  ['<a href="data:text/html,<script>alert(1)</script>">x</a>', "<a>x</a>"],
  ["<SCRIPT>alert(1)</SCRIPT >after", "after"],
  ["<script>alert(1)", ""],
  ["<div><!--<img src=x onerror=alert(1)>--></div>", "<div></div>"],
  ['<p title="a"onmouseover=alert(1)>x</p>', "<p>x</p>"],
  ['<a title="x" href=https://ok.example/ onfocus=alert(1) autofocus>y</a>', '<a title="x" href="https://ok.example/">y</a>'],
  ['<img src=x onerror=alert(1)//', ""],
  ["<p>1 < 2</p>", "<p>1 &lt; 2</p>"],
  ["<</p>script>alert(1)<</p>/script>", "&lt;</p>script>alert(1)&lt;</p>/script>"],
  ['<textarea></textarea><img src=x onerror=alert(1)></textarea>', "<img />"],
  ['<a href="https://ok.example/" title=\'"><img src=x onerror=alert(1)>\'>z</a>', '<a href="https://ok.example/" title="&quot;&gt;&lt;img src=x onerror=alert(1)&gt;">z</a>'],
];
for (const [input, expected] of payloads) {
  const out = sanitizeCmsHtml(input);
  const unsafe = structurallySafe(out);
  check(unsafe === null, `safe: ${JSON.stringify(input)}`, unsafe ?? undefined);
  check(out === expected, `  -> ${JSON.stringify(out)}`, `expected ${JSON.stringify(expected)}`);
}

console.log("\nAllowed markup survives unchanged");
const keep = [
  "<p>Hello <strong>world</strong> and <b>bold</b>, <em>em</em>, <i>i</i>, <u>u</u>.</p>",
  "<ul><li>One</li><li>Two</li></ul><ol><li>First</li></ol>",
  '<h2 id="who-we-are">Who we are</h2><h3 id="size-guide">Sizes</h3><h4>Notes</h4>',
  "<blockquote><p>Quote</p></blockquote><div><span>Inline</span></div>",
  '<p><a href="https://prudentgabriel.com/shop" title="Shop">Shop</a></p>',
  '<p><a href="/journal/post">Internal</a> <a href="#top">Top</a> <a href="mailto:hello@example.com">Mail</a></p>',
  '<p><a href="https://example.com/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">Ext</a></p>',
  '<p>Line<br />break</p><img src="https://cdn.example.com/x.jpg" alt="Gown" width="600" height="800" />',
  "<p>Fish &amp; chips &mdash; caf&eacute; &lt;3 &#8358;5,000</p>",
  "Plain text with no tags at all.",
];
for (const input of keep) {
  const out = sanitizeCmsHtml(input);
  check(out === input, `kept: ${input.slice(0, 70)}`, `got ${JSON.stringify(out)}`);
}

console.log("\nNormalisations (same rendering as before)");
const norm: Array<[string, string]> = [
  ["<P>Upper</P>", "<p>Upper</p>"],
  ["<br>", "<br />"],
  ["<br/>", "<br />"],
  ['<a href="https://x.example" target="_self">t</a>', '<a href="https://x.example" target="_blank" rel="noopener noreferrer">t</a>'],
  ['<h2 id="Bad Id">h</h2>', "<h2>h</h2>"],
  ['<p class="lead" style="color:red">x</p>', "<p>x</p>"],
  ["<section><p>x</p></section>", "<p>x</p>"],
  ["", ""],
];
for (const [input, expected] of norm) {
  const out = sanitizeCmsHtml(input);
  check(out === expected, `${JSON.stringify(input)} -> ${JSON.stringify(out)}`, `expected ${JSON.stringify(expected)}`);
}
check(sanitizeCmsHtml(null) === "" && sanitizeCmsHtml(undefined) === "", "null/undefined -> empty string");

if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nOK — test-sanitize-html");
