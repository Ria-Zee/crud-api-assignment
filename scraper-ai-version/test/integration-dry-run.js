'use strict';

/**
 * This does NOT talk to the real internet. It monkey-patches global.fetch
 * with a synthetic in-memory version of books.toscrape.com's 3 catalogue
 * pages + 60 book pages, then runs the real `src/main.js` orchestrator
 * against it unmodified. This is the strongest offline proof available in
 * a network-disabled sandbox that Stages 0-5 wire together correctly and
 * that a clean run really does produce 60/60 valid records.
 *
 * It is still not a substitute for running `npm start` against the live
 * site -- see README "Known limitations".
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const RATING_WORDS = ['One', 'Two', 'Three', 'Four', 'Five'];

function makeBookHtml({ title, price, stock, ratingWord, description }) {
  const availability = stock === 0
    ? 'Out of stock'
    : `In stock (${stock} available)`;
  return `
<html><body>
<div class="col-sm-6 product_main">
  <h1>${title}</h1>
  <p class="price_color">£${price.toFixed(2)}</p>
  <p class="instock availability"><i class="icon-ok"></i> ${availability}</p>
  <p class="star-rating ${ratingWord}"><i class="icon-star"></i></p>
</div>
<div id="product_description" class="sub-header"><h2>Product Description</h2></div>
<p>${description}</p>
<table class="table table-striped">
  <tr><th>UPC</th><td>deadbeef</td></tr>
  <tr><th>Availability</th><td>${availability}</td></tr>
</table>
</body></html>`;
}

function makeCatalogueHtml(bookSlugs) {
  const pods = bookSlugs.map((slug) => `
    <article class="product_pod">
      <div class="image_container"><a href="${slug}/index.html"><img src="x.jpg" class="thumbnail"/></a></div>
      <p class="star-rating One"><i class="icon-star"></i></p>
      <h3><a href="${slug}/index.html" title="${slug}">${slug}</a></h3>
      <div class="product_price">
        <p class="price_color">£10.00</p>
        <p class="instock availability"><i class="icon-ok"></i> In stock</p>
      </div>
    </article>`).join('\n');
  return `<html><body><ol class="row">${pods}</ol></body></html>`;
}

async function main() {
  // Build a synthetic 60-book catalogue: 3 pages x 20 books.
  const site = new Map(); // url path -> { status, html }
  const bookSlugs = [];

  for (let page = 1; page <= 3; page += 1) {
    const slugsForPage = [];
    for (let i = 1; i <= 20; i += 1) {
      const n = (page - 1) * 20 + i;
      const slug = `synthetic-book-${n}`;
      slugsForPage.push(slug);
      bookSlugs.push(slug);
      const html = makeBookHtml({
        title: `Synthetic Book ${n}`,
        price: 5 + (n % 40),
        stock: n % 7 === 0 ? 0 : (n % 15) + 1,
        ratingWord: RATING_WORDS[n % 5],
        description: `Description for synthetic book number ${n}, generated for an offline integration test.`,
      });
      site.set(`/catalogue/${slug}/index.html`, { status: 200, html });
    }
    site.set(`/catalogue/page-${page}.html`, { status: 200, html: makeCatalogueHtml(slugsForPage) });
  }
  site.set('/robots.txt', { status: 404, html: '' });

  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const u = new URL(url);
    const entry = site.get(u.pathname);
    if (!entry) {
      return { ok: false, status: 404, headers: new Map(), text: async () => '' };
    }
    return {
      ok: entry.status >= 200 && entry.status < 300,
      status: entry.status,
      headers: new Map(),
      text: async () => entry.html,
    };
  };

  // Run against a scratch cwd so this never touches the real project's out/ or cache/.
  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'book-scraper-integration-'));
  const originalCwd = process.cwd();
  process.chdir(scratchDir);

  try {
    delete require.cache[require.resolve('../src/main')];
    const { run } = require('../src/main');
    const { records, report } = await run({ useCache: false });

    assert.strictEqual(records.length, 60, `expected 60 records, got ${records.length}`);
    assert.strictEqual(report.catalogue.unique_book_urls_found, 60);
    assert.strictEqual(report.books.succeeded, 60);
    assert.strictEqual(report.books.failed, 0);
    assert.strictEqual(report.validation.valid_records, 60);
    assert.strictEqual(report.validation.invalid_records, 0);
    assert.strictEqual(report.validation.duplicate_urls.length, 0);
    assert.strictEqual(report.robots_check.verdict, 'ALLOWED');
    assert.strictEqual(report.success, true);

    const booksJson = JSON.parse(fs.readFileSync(path.join(scratchDir, 'out', 'books.json'), 'utf8'));
    assert.strictEqual(booksJson.length, 60);
    assert.ok(booksJson.every((r) => typeof r.price === 'number'));
    assert.ok(booksJson.every((r) => r.rating >= 1 && r.rating <= 5));

    console.log('INTEGRATION DRY RUN: ok - 60/60 valid records, clean run-report, success=true');
    console.log(`  (scratch dir: ${scratchDir})`);
  } finally {
    process.chdir(originalCwd);
    global.fetch = originalFetch;
  }
}

main().catch((err) => {
  console.error('INTEGRATION DRY RUN: FAIL');
  console.error(err.stack || err.message);
  process.exit(1);
});
