# Slice BF — live chat, properly staffed: what was measured (15 October 2026)

All numbers below were taken on a local production build (`next build` + `next start`)
against the Neon dev database, on the same machine for before and after. Before
is `6c712ae` (the commit this slice starts from), frozen as its own build on port
3200; after is the BF build on port 3000.

## 1. The greeting and LCP (`/` and `/rtw`)

Method from `VERIFICATION_2026-09.md` §6: headless Chrome via `puppeteer-core`,
390×844 at DPR 3, Android UA, Slow 4G (1.6 Mbps / 750 kbps, 150 ms RTT), 4× CPU,
cache off. LCP is observed for 25 s after `load`, beyond the greeting's 15 s
default delay, and the last entry is the reported LCP. Chat switched on and open,
greeting at its default (15 s). Medians; the ranges are the runs.

| Page, visit | Before | After (BF, widget loaded lazily) | LCP element (both) |
|---|---|---|---|
| `/rtw`, first visit (5 runs) | 8.8 s (7.2–9.9) | 7.9 s (7.2–9.7) | cookie-banner text |
| `/rtw`, returning (3 runs) | 4.1 s (3.9–4.9) | 3.3 s (3.0–3.9) | the headline |
| `/`, first visit (3 runs) | 25.5 s (25.2–26.1) | 25.2 s (25.1–25.6) | hero poster |
| `/`, returning (3 runs) | 25.5 s (24.4–26.6) | 24.1 s (22.6–25.6) | hero poster |

- **No LCP entry was ever recorded at or after the greeting appeared**, in any run.
  The greeting is 272×48 px on a phone (4% of the screen) and 272×83 px at 1440;
  it is never the largest element.
- It appears 15 s after the page has settled (`load`, then idle), about 22–28 s
  into these throttled loads. On a phone's first visit it does not appear at all
  while the cookie banner is up (it waits for the banner to go), so first-visit
  LCP on a phone cannot include it.
- The homepage's ~25 s here is the local server fetching the hero poster from
  the dev database's remote images under Slow 4G; it is the same before and after
  and is not comparable with staging's 6.2 s.
- An intermediate build that loaded the widget's code with the page measured
  `/rtw` first visit at 8.5 s (8.0–8.6), inside the baseline's spread but higher.
  The cookie banner (that page's LCP) paints after hydration, so the widget now
  loads after the page (`ChatWidgetLazy`). That build is the one in the table.

**Cost: none measurable.** Every after-range overlaps its before-range, the LCP
element is the same element, and the greeting never became a candidate.

## 2. The stream, and the fallback

- Typing, measured by `test:slice-bf` on the live stream: the visitor saw
  "Jubilee is typing" **513 ms** after the admin's keystroke (the first signal,
  which also looks up her display name), and the house saw the visitor typing
  **139 ms** after hers.
- Fallback, proved in a real browser (`puppeteer-core`, the real widget) with
  `/api/chat/stream` aborted at the network layer:

| Stream | Widget mode | House's reply visible after | Her next message reached the house |
|---|---|---|---|
| blocked | `poll` | 4.0 s | yes |
| allowed | `stream` | 2.8 s | yes |

(Both times include the reply request itself against the remote dev database.)

## 3. What held-open connections cost

500 inbox streams opened one after another against the production build, the
server's working set read every 100:

| Open streams | 0 | 100 | 200 | 300 | 400 | 500 |
|---|---|---|---|---|---|---|
| Working set | 700 MB | 702 | 702 | 703 | 704 | 706 MB |

About **12 KB per open stream**, and no database connection is held (events fan
out in memory). A stream exists only while a chat panel is open on a conversation,
or the inbox is open — browsing the shop holds nothing. At the house's scale (tens
of conversations a day, a handful at once) this is noise.

Where it would start to matter: memory would not be the limit until tens of
thousands of streams. The first limits are the container's open-file limit
(each stream is a socket here and in Traefik; check `ulimit -n` inside the app
container — Docker's default is usually 1,048,576, but some hosts set 1,024,
which would cap chat at roughly 1,000 open panels), and the single process: the
fan-out is in memory, so a second app container would need Postgres
LISTEN/NOTIFY first.

## 4. Erase deletes the files

`test:slice-bf` uploads a PDF from the visitor and a photograph from the house,
checks both files exist at their paths on disk, has a SUPER_ADMIN erase the
conversation, then looks for each file again: **both gone** (`ENOENT`), the
response says `filesDeleted: 2`, and no attachment row remains. The retention job
and account deletion use the same file deletion.
