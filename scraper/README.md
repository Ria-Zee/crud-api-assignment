# The Polite Scraper

A small scraping pipeline that downloads the first three catalogue pages of [Books to Scrape](https://books.toscrape.com), visits all 60 book pages, and turns the raw HTML into clean, schema-checked JSON — politely, and with an honest report at the end of every run.

## Target classification

- **Site:** [books.toscrape.com](https://books.toscrape.com), a fictional online bookstore.
- **Why this site:** it's a purpose-built practice sandbox. The site's own homepage describes itself as "a fictional bookstore that desperately wants to be scraped... a safe place for beginners learning web scraping." Every page carries a banner: "We love being scraped! ... Warning! This is a demo website for web scraping purposes." This is one of the only kinds of site this assignment is meant to touch.
- **Scope:** the first 3 catalogue pages only (`page-1.html` through `page-3.html`), which link to 60 unique book detail pages.
- **Data collected:** for each book — title, product URL, price, availability, star rating, description, plus the catalogue page it was found on and the time it was fetched.
- **robots.txt check:** requested `https://books.toscrape.com/robots.txt` once — it returned a 404. No robots file exists. A missing file is not permission on its own; the site's explicit "we love being scraped" banner and stated purpose are what make scraping it appropriate here, not the absence of a robots file.

I will not reuse this code on another site without checking its rules and terms first.
## Run it

```bash
npm install
node src/index.js
```

Requires Node.js 20+. Produces `output/books.json`, `output/errors.json`, and `output/run-report.json`. Cached HTML pages are stored in `cache/` (git-ignored) so re-running during development doesn't re-fetch pages already saved.

## Record schema

Each entry in `books.json` has these fields, validated with [Zod](https://zod.dev) before storage:

| Field | Type | Notes |
|---|---|---|
| `title` | string | |
| `product_url` | string (URL) | canonical identity — used to dedupe |
| `price_text` | string | raw text as scraped, e.g. `"£51.77"` |
| `price_gbp` | number | normalized from `price_text` |
| `availability_text` | string | e.g. `"In stock (22 available)"` |
| `rating_text` | string \| null | e.g. `"Three"` |
| `description` | string \| null | `null` when the page has none — never invented |
| `source_page` | string (URL) | which catalogue page this book was discovered on |
| `fetched_at` | string (ISO timestamp) | when this record was fetched |

Records that fail validation land in `errors.json` with a reason, never in `books.json`.

## Politeness rules

- **User-agent:** every request identifies itself as `FlyRankInternshipA9/1.0 (+https://github.com/Ria-Zee/crud-api-assignment)`.
- **Timeout:** every request gives up after 8 seconds rather than hanging forever.
- **Delay:** at least 600ms between real requests to the site. Cached pages are read from disk with no delay.
- **Cache:** every fetched page is saved to `cache/` and read from there on subsequent runs, so the site is asked once per page during development, not fifty times.
- **Retry rules:** a timeout or 5xx response is retried once after a short pause. A 404 or 403 is never retried — asking again won't create a missing page or change a site's refusal.

## Run report

A real `output/run-report.json` from a completed run:

```json
{
  "start_time": "2026-08-24T21:30:31.956Z",
  "duration_ms": 4612,
  "catalogue_pages_fetched": 3,
  "detail_pages_attempted": 60,
  "detail_pages_fetched": 60,
  "valid_records": 60,
  "invalid_records": 0,
  "failed_pages": 0
}
```

## Why no browser was needed

The book data — title, price, availability, rating, description — is already present in the raw HTML the server sends back on the first request. Nothing on these pages is rendered client-side by JavaScript after load. A browser (via something like Playwright) would add real cost — a much heavier process, slower startup, more memory — for zero additional data. A plain HTTP request plus an HTML parser is the correct, minimal tool here.

## Ethics note

I only scrape sites that clearly invite it, like this practice sandbox, or where I have explicit permission. Where an official API exists for the data I need, I use that instead of scraping. I never attempt to bypass a login, a paywall, or a block a site has put in place — those are the site telling me no, and a polite scraper listens. I collect only the fields I actually need for the task, not everything a page happens to contain.

## AI vs me — Stage 7 (scraper rematch)

### My prompt

You're a Senior Backend Engineer, build a small, polite scraper that turns three pages of messy HTML into clean, checked JSON — without ever being rude to the server. This is the URL for the practice site; https://books.toscrape.com/
Follow the following stages:

* Stage 0: classify the target (read `toscrape.com`, check `robots.txt`, write it up)
* Stage 1: fetch + cache the first catalogue page politely (identify by name in the user-agent, timeout of at least 8000ms, delay between requests at least 500ms, status check)
* Stage 2: crawl all 3 catalogue pages, collect 60 unique book URLs
* Stage 3: extract 8 raw field names from each of the 60 book pages (title, product_url, price_text, availability_text, rating_text, description, source_page, fetched_at)
* Stage 4: normalize text like ''$51.77'' into real numbers + schema-validate + store as `books.json`
* Stage 5: survive a broken page without crashing, retry-worthy failures(timeout, 5xx), non-retry(403,404), write `run-report.json`
* Stage 6: publish with README

Note: For the lane, use Javascript.
Produce 60 records on a rerun

### What the AI did better

It wrote a live, runtime `robots.txt` check that can actually halt the entire scrape if the verdict is DISALLOWED, not just a one-time manual check documented in a README like mine — real defensive code, not just a write-up. Its `run-report.json` is more structured than mine: it separately tracks catalogue-page failures from book-page failures, records the specific failure reason and retry decision per URL, and includes an `expected_book_urls: 60` sanity check that flags itself even without a hard failure. Its HTTP client uses exponential backoff with jitter on retries, rather than my flat one-second wait — a real production pattern the assignment brief itself names as *next week's* topic, built here unprompted. It also normalized `availability_text` into a structured `{ in_stock: true, stock_count: 22 }` and split price into `{ price, currency }`, both more useful downstream than my raw text fields. Notably, it had no access to npm's registry in its own execution environment, so it wrote its own dependency-free HTML parser instead of using Cheerio — and disclosed this constraint directly in a code comment rather than silently substituting something and hoping I wouldn't notice.

### What it got wrong or silently ignored

I specified `source_page` as one of the eight required fields, matching my own field definition (the URL of the catalogue page a book was found on, e.g. `"https://books.toscrape.com/catalogue/page-1.html"`). The AI's first version tracked it as a plain page **number** instead (`1`, `2`, or `3`) all the way from `crawlCatalogue.js` through to the final stored record, and its own schema validator was written to expect an integer, so the wrong value passed validation silently — no crash, no `null`, just a quietly wrong value with the same field name I asked for. Confirmed by printing `books.json` directly: `source_page: 1`, not a URL. This breaks provenance, the exact concept the assignment brief calls out by name — an integer can't be clicked through to re-verify where a fact came from three weeks later, a URL can.

### What my prompt forgot to specify, and what the AI silently decided for me

I never named Zod or any specific schema-validation library, only said "schema-validate" as part of Stage 4. Since it had no npm access, it built its own hand-rolled field-by-field validator instead — a reasonable substitution given its constraints, and one it disclosed rather than hid, but it means the actual deliverable doesn't match the validator technology my own version and the original assignment brief specify. I also never said how granular the run report needed to be; it independently decided to separate catalogue-page failures from book-page failures and track per-field validation results, going well beyond the plain counts I specified.

### One rematch

I regenerated with one correction: `source_page` must be the full absolute URL of the catalogue page, not a page number, confirmed by actually running the first version and printing the wrong value. The fix landed correctly and thoroughly — not only does `crawlCatalogue.js` now pass through the real page URL end to end, but the schema validator itself was independently strengthened to check the exact URL pattern (`^https://books\.toscrape\.com/catalogue/page-\d+\.html$`), catching a malformed URL too, not just a non-string value. Confirmed by running the regenerated code and printing the first record's `source_page` directly: `https://books.toscrape.com/catalogue/page-1.html`.
