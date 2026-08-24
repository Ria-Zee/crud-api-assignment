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
