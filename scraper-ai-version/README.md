# book-scraper

A small, polite scraper for `books.toscrape.com`. Three catalogue pages in,
`out/books.json` (60 clean records) and `out/run-report.json` (what happened)
out. Zero npm dependencies, plain Node 18+.

```
npm test    # runs the offline test suite (18 checks, no network needed)
npm start   # runs the real crawl (needs outbound network to books.toscrape.com)
```

---

## Stage 0 - classifying the target

**What is `toscrape.com` / `books.toscrape.com`?**
It's a static demo site built by the Scrapy/ScrapingHub team specifically so
people can practice scraping without hitting a real business. The homepage
says so directly: "We love being scraped!" and a banner on every page reads
*"This is a demo website for web scraping purposes. Prices and ratings here
were randomly assigned and have no real meaning."* Confirmed live on
2026-08-25.

**robots.txt.** `https://books.toscrape.com/robots.txt` returns **404**
(no file present). Per the standard interpretation of the Robots Exclusion
Protocol, the absence of a robots.txt is "no restrictions stated," not
"assume everything is disallowed." Combined with the site's explicit
scrape-friendly banner, that's about as clear a green light as a target can
give. `src/robots.js` re-checks this **live, every run** rather than trusting
this write-up forever — a target's policy can change, and a scraper that
hardcodes "it was fine last time" is exactly the kind of tool that gets
someone in trouble later.

**Classification: safe, intended-for-scraping practice sandbox.** Still
scraped politely (named UA, real delay, respected timeouts, no concurrency)
because that's the right default regardless of target, not because this one
demanded it.

---

## Architecture (stages 1-5 map to files)

| Stage | File | What it does |
|---|---|---|
| 0 | `src/robots.js` | Live robots.txt check + verdict |
| 1 | `src/httpClient.js` | `PoliteClient`: named UA, 8000ms timeout, ≥500ms delay (+jitter), disk cache, retry/non-retry classification |
| 2 | `src/crawlCatalogue.js` | Walks the 3 configured catalogue pages, dedupes book URLs |
| 3 | `src/parse.js` | Pulls the 8 raw fields per book page |
| 4 | `src/normalize.js` + `src/schema.js` | Text → typed values, then validated against a hand-rolled schema |
| 5 | `src/scrapeBook.js` + `src/main.js` | Per-book try/catch so one bad page never kills the run; `run-report.json` records every failure |

Run everything: `src/main.js` (`npm start`).

### The 8 raw fields (Stage 3)
`title`, `product_url`, `price_text`, `availability_text`, `rating_text`,
`description`, `source_page`, `fetched_at`.

### The normalized record (Stage 4) — what lands in `books.json`
```json
{
  "title": "A Light in the Attic",
  "product_url": "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html",
  "price": 51.77,
  "currency": "GBP",
  "in_stock": true,
  "stock_count": 22,
  "rating": 3,
  "description": "It's hard to imagine a world without A Light in the Attic. ...",
  "source_page": 1,
  "fetched_at": "2026-08-25T11:20:00.000Z",
  "_raw": { "price_text": "£51.77", "availability_text": "In stock (22 available)", "rating_text": "Three" }
}
```
`_raw` is kept alongside on purpose: if a normalization rule is ever wrong,
you can see exactly what it was fed instead of just seeing a bad number and
guessing why.

### Politeness (Stage 1)
- User-Agent: `ZeeBookScraperBot/1.0 (+contact-link; educational scraping exercise, contact via link)` — identifies itself by name, not disguised as a browser. **Put a real contact URL/email in `src/config.js` before running this against anything besides this sandbox.**
- Timeout: 8000ms per request (`AbortController`), configurable in `src/config.js`.
- Delay: minimum 500ms between requests + up to 300ms random jitter, enforced in `PoliteClient` regardless of caller.
- No concurrency: fully sequential. Slower, but a "polite" scraper that fires requests in parallel is a contradiction.
- Disk cache (`cache/*.html`, keyed by URL hash): a rerun with cache enabled (default) re-uses previously fetched pages instead of hitting the server again. Delete `cache/` or pass `--no-cache` to force a fresh crawl.

### Retry vs. non-retry (Stage 5)
- **Retry-worthy:** request timeout, network error, any 5xx. Up to 3 retries with exponential backoff (1s, 2s, 4s), each still respecting the normal delay.
- **Non-retry:** 403 (told to go away — retrying is rude, not persistent), 404 (nothing there to retry into existence), any other 4xx.
- A book page that fails fetch, or that fetches fine but fails to parse (malformed markup) or fails schema validation, is recorded in `run-report.json` under `books.failures[]` with the URL, stage, and reason — and the run keeps going. Proven in `test/run-tests.js` with a mocked 404 and a mocked malformed page in the same batch as two good ones.

### `run-report.json` shape
```json
{
  "started_at": "...", "finished_at": "...", "target": "https://books.toscrape.com",
  "robots_check": { "verdict": "ALLOWED", "reason": "..." },
  "catalogue": { "pages_attempted": 3, "pages_failed": 0, "page_failures": [], "unique_book_urls_found": 60, "expected_book_urls": 60 },
  "books": { "attempted": 60, "succeeded": 60, "failed": 0, "failures": [] },
  "validation": { "valid_records": 60, "invalid_records": 0, "duplicate_urls": [] },
  "success": true
}
```

### Rerun behavior
The 3 catalogue pages are pinned in `src/config.js`
(`/catalogue/page-1.html` .. `page-3.html`), each holding 20 books =
60 unique URLs every time — the site's catalogue order is stable, so a rerun
(cached or fresh) should produce 60 records again, not a shifting count.
`validateCollection` also checks for duplicate `product_url`s across the
batch as a second line of defense.

---

## Known limitations — read this before trusting a green checkmark

This project was built in a sandbox with **outbound network access disabled**
(confirmed: `fetch()` to `books.toscrape.com` returns a proxy-level 403,
`x-deny-reason: host_not_allowed` — not the site refusing us, the build
environment itself has no internet). Practical consequences, stated plainly
rather than papered over:

1. **The live crawl has not been executed end-to-end in this environment.**
   Every page fetch, retry, delay, and timeout code path is written and unit
   tested against mocks/fixtures, but I have not watched `npm start` complete
   a real 60-book run against the live server. Run it yourself on a machine
   with normal internet access — that's the real acceptance test.
2. **The parsing selectors are based on well-documented, years-stable markup
   for this specific sandbox** (`article.product_pod`, `p.price_color`,
   `p.instock.availability`, `p.star-rating <Word>`, `#product_description`,
   `table.table-striped`) rather than bytes captured in this session — the
   read-only fetch tool available to me here renders pages to text/markdown
   and strips the CSS class attributes the parser actually needs, so I
   couldn't capture literal raw HTML to test against either. I verified
   titles, prices, stock text, and full description text live; I did not
   verify individual star-rating values (they don't appear as visible text).
   If the site's markup has changed since this was written, `npm test` will
   still pass (it tests logic against fixtures) but `npm start` could return
   0 books — check `run-report.json`'s `catalogue.unique_book_urls_found`
   first if that happens.
3. **No npm dependencies, on purpose but also of necessity** — this sandbox
   can't reach the npm registry either. The HTML extraction in `src/parse.js`
   is regex-based rather than a real DOM/selector engine (cheerio would be
   the natural upgrade — swap the function bodies, call sites don't change).
   This works cleanly for a template this stable and small; it is not a
   general-purpose HTML parser and would need real hardening (or just
   cheerio) before pointing it at a less predictable site.

None of this is a hedge to avoid saying "it works" — it's the actual state of
what has and hasn't been verified, per how this was asked to be built.

## What a top scraping engineer would flag

- **Sequential-only, no concurrency** costs runtime. Fine for 60 pages. At
  1,000 books, you'd want a small worker pool (2-3 concurrent) with the same
  per-worker delay — not because 500ms/request is wrong, but because pure
  serial fetching doesn't scale and you'd be leaving the target's actual
  capacity unused for no politeness gain past a point.
- **Regex HTML parsing is a liability the moment the target isn't this
  specific stable sandbox.** It survives here because the markup is old and
  frozen. Anywhere else, this is the first thing to replace with a real
  parser.
- **The cache has no TTL.** A rerun today and a rerun in six months both
  serve the same stale HTML. Fine for a scraping exercise on a static demo
  site; wrong for anything with real inventory or prices. Add a max-age check
  before reusing this pattern on a live catalogue.
