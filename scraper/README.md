# The Polite Scraper

A small scraping pipeline that downloads the first three catalogue pages of [Books to Scrape](https://books.toscrape.com), visits all 60 book pages, and turns the raw HTML into clean, schema-checked JSON — politely, and with an honest report at the end of every run.

## Target classification

- **Site:** [books.toscrape.com](https://books.toscrape.com), a fictional online bookstore.
- **Why this site:** it's a purpose-built practice sandbox. The site's own homepage describes itself as "a fictional bookstore that desperately wants to be scraped... a safe place for beginners learning web scraping." Every page carries a banner: "We love being scraped! ... Warning! This is a demo website for web scraping purposes." This is one of the only kinds of site this assignment is meant to touch.
- **Scope:** the first 3 catalogue pages only (`page-1.html` through `page-3.html`), which link to 60 unique book detail pages.
- **Data collected:** for each book — title, product URL, price, availability, star rating, description, plus the catalogue page it was found on and the time it was fetched.
- **robots.txt check:** requested `https://books.toscrape.com/robots.txt` once — it returned a 404. No robots file exists. A missing file is not permission on its own; the site's explicit "we love being scraped" banner and stated purpose are what make scraping it appropriate here, not the absence of a robots file.

I will not reuse this code on another site without checking its rules and terms first.