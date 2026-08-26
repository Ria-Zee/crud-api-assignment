'use strict';

/**
 * Zero-dependency test runner. `node test/run-tests.js`
 *
 * Scope, honestly stated: these tests prove the PARSING, NORMALIZATION,
 * VALIDATION, RETRY-CLASSIFICATION, and ORCHESTRATION-SURVIVAL logic is
 * correct. They do NOT prove the live crawl works end to end, because this
 * build sandbox has no outbound network access (confirmed: fetch() to
 * books.toscrape.com returns a proxy 403 "host_not_allowed"). Run
 * `npm start` from a machine with normal internet access to do that.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { extractBookLinksFromCatalogue, extractBookFields, resolveCatalogueUrl } = require('../src/parse');
const { normalizePrice, normalizeAvailability, normalizeRating, normalizeRecord } = require('../src/normalize');
const { validateRecord, validateCollection } = require('../src/schema');
const { classifyFailure } = require('../src/httpClient');
const { scrapeAllBooks } = require('../src/scrapeBook');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  - ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL  - ${name}`);
    console.log(`        ${err.message}`);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok  - ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL  - ${name}`);
    console.log(`        ${err.message}`);
  }
}

function fixture(name) {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
}

async function main() {
  console.log('--- parse.js ---');

  test('extractBookLinksFromCatalogue finds all product pods', () => {
    const html = fixture('catalogue-page-1.html');
    const links = extractBookLinksFromCatalogue(html);
    assert.strictEqual(links.length, 4);
    assert.strictEqual(links[0], 'a-light-in-the-attic_1000/index.html');
  });

  test('resolveCatalogueUrl builds an absolute URL from a relative href', () => {
    const abs = resolveCatalogueUrl('https://books.toscrape.com/catalogue/page-1.html', 'a-light-in-the-attic_1000/index.html');
    assert.strictEqual(abs, 'https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html');
  });

  test('extractBookFields pulls all 8 raw fields from a real book page', () => {
    const html = fixture('book-a-light-in-the-attic.html');
    const fields = extractBookFields(html, { productUrl: 'https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html', sourcePage: 'https://books.toscrape.com/catalogue/page-1.html', fetchedAt: '2026-08-25T00:00:00.000Z' });
    assert.strictEqual(fields.title, 'A Light in the Attic');
    assert.strictEqual(fields.price_text, '£51.77');
    assert.strictEqual(fields.availability_text, 'In stock (22 available)');
    assert.strictEqual(fields.rating_text, 'Three');
    assert.ok(fields.description.startsWith("It's hard to imagine"));
    assert.strictEqual(fields.source_page, 'https://books.toscrape.com/catalogue/page-1.html');
    assert.strictEqual(fields.product_url, 'https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html');
    assert.ok(fields.fetched_at);
  });

  test('extractBookFields degrades to nulls (never throws) on a broken page', () => {
    const html = fixture('book-broken.html');
    const fields = extractBookFields(html, { productUrl: 'https://books.toscrape.com/catalogue/broken/index.html', sourcePage: 'https://books.toscrape.com/catalogue/page-1.html', fetchedAt: '2026-08-25T00:00:00.000Z' });
    assert.strictEqual(fields.title, 'Mystery Book With No Data');
    assert.strictEqual(fields.price_text, null);
    assert.strictEqual(fields.availability_text, null);
    assert.strictEqual(fields.rating_text, null);
    assert.strictEqual(fields.description, '');
  });

  console.log('--- normalize.js ---');

  test('normalizePrice parses GBP correctly', () => {
    assert.deepStrictEqual(normalizePrice('£51.77'), { amount: 51.77, currency: 'GBP' });
  });

  test('normalizePrice returns nulls for garbage input, never a guess', () => {
    const r = normalizePrice('contact us for price');
    assert.strictEqual(r.amount, null);
  });

  test('normalizeAvailability parses "In stock (N available)"', () => {
    assert.deepStrictEqual(normalizeAvailability('In stock (22 available)'), { in_stock: true, stock_count: 22 });
  });

  test('normalizeAvailability parses plain "In stock" with no count', () => {
    assert.deepStrictEqual(normalizeAvailability('In stock'), { in_stock: true, stock_count: null });
  });

  test('normalizeAvailability parses "Out of stock"', () => {
    assert.deepStrictEqual(normalizeAvailability('Out of stock'), { in_stock: false, stock_count: 0 });
  });

  test('normalizeRating maps word to number', () => {
    assert.strictEqual(normalizeRating('Three'), 3);
    assert.strictEqual(normalizeRating('Five'), 5);
  });

  test('normalizeRating returns null for an unrecognized word (no guessing)', () => {
    assert.strictEqual(normalizeRating('Bazillion'), null);
    assert.strictEqual(normalizeRating(null), null);
  });

  console.log('--- schema.js ---');

  test('validateRecord accepts a well-formed record', () => {
    const record = normalizeRecord({
      title: 'A Light in the Attic',
      product_url: 'https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html',
      price_text: '£51.77',
      availability_text: 'In stock (22 available)',
      rating_text: 'Three',
      description: 'Some description.',
      source_page: 'https://books.toscrape.com/catalogue/page-1.html',
      fetched_at: new Date().toISOString(),
    });
    const { valid, errors } = validateRecord(record);
    assert.strictEqual(valid, true, `unexpected errors: ${errors.join(', ')}`);
  });

  test('validateRecord rejects a record with an unresolvable rating', () => {
    const record = normalizeRecord({
      title: 'Broken Book',
      product_url: 'https://books.toscrape.com/catalogue/broken/index.html',
      price_text: null,
      availability_text: null,
      rating_text: null,
      description: '',
      source_page: 'https://books.toscrape.com/catalogue/page-1.html',
      fetched_at: new Date().toISOString(),
    });
    const { valid, errors } = validateRecord(record);
    assert.strictEqual(valid, false);
    assert.ok(errors.some((e) => e.startsWith('rating:')));
    assert.ok(errors.some((e) => e.startsWith('price:')));
  });

  test('validateRecord rejects a numeric source_page (regression: must be the catalogue page URL, not a page number)', () => {
    const record = normalizeRecord({
      title: 'A Light in the Attic',
      product_url: 'https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html',
      price_text: '£51.77',
      availability_text: 'In stock (22 available)',
      rating_text: 'Three',
      description: 'Some description.',
      source_page: 1, // wrong on purpose
      fetched_at: new Date().toISOString(),
    });
    const { valid, errors } = validateRecord(record);
    assert.strictEqual(valid, false);
    assert.ok(errors.some((e) => e.startsWith('source_page:')));
  });

  test('validateCollection flags duplicate product_url', () => {
    const base = normalizeRecord({
      title: 'Dup', product_url: 'https://books.toscrape.com/catalogue/dup/index.html',
      price_text: '£1.00', availability_text: 'In stock', rating_text: 'One', description: 'x',
      source_page: 'https://books.toscrape.com/catalogue/page-1.html', fetched_at: new Date().toISOString(),
    });
    const { duplicates } = validateCollection([base, { ...base }]);
    assert.deepStrictEqual(duplicates, ['https://books.toscrape.com/catalogue/dup/index.html']);
  });

  console.log('--- httpClient.js (failure classification) ---');

  test('403 and 404 are classified as non-retryable', () => {
    assert.strictEqual(classifyFailure({ status: 403 }).retryable, false);
    assert.strictEqual(classifyFailure({ status: 404 }).retryable, false);
  });

  test('5xx and timeout are classified as retryable', () => {
    assert.strictEqual(classifyFailure({ status: 500 }).retryable, true);
    assert.strictEqual(classifyFailure({ status: 503 }).retryable, true);
    assert.strictEqual(classifyFailure({ errorCode: 'TIMEOUT' }).retryable, true);
    assert.strictEqual(classifyFailure({ errorCode: 'NETWORK_ERROR' }).retryable, true);
  });

  test('other 4xx are non-retryable', () => {
    assert.strictEqual(classifyFailure({ status: 400 }).retryable, false);
    assert.strictEqual(classifyFailure({ status: 429 }).retryable, false);
  });

  console.log('--- scrapeBook.js (Stage 5: survive a broken page) ---');

  await testAsync('scrapeAllBooks continues past a 404 and a malformed page, still returns the good ones', async () => {
    const goodHtml = fixture('book-a-light-in-the-attic.html');
    const brokenHtml = fixture('book-broken.html');

    // Mock client: no real network, deterministic per-URL responses.
    const fakeClient = {
      get: async (url) => {
        if (url.includes('/good-1/')) return { ok: true, url, status: 200, html: goodHtml, fromCache: false, attempts: 1, failure: null };
        if (url.includes('/good-2/')) return { ok: true, url, status: 200, html: goodHtml, fromCache: false, attempts: 1, failure: null };
        if (url.includes('/missing/')) return { ok: false, url, status: 404, html: null, fromCache: false, attempts: 1, failure: { retryable: false, reason: 'HTTP_404' } };
        if (url.includes('/broken/')) return { ok: true, url, status: 200, html: brokenHtml, fromCache: false, attempts: 1, failure: null };
        throw new Error(`unexpected url in mock: ${url}`);
      },
    };

    const bookRefs = [
      { url: 'https://books.toscrape.com/catalogue/good-1/index.html', sourcePage: 'https://books.toscrape.com/catalogue/page-1.html' },
      { url: 'https://books.toscrape.com/catalogue/missing/index.html', sourcePage: 'https://books.toscrape.com/catalogue/page-1.html' },
      { url: 'https://books.toscrape.com/catalogue/broken/index.html', sourcePage: 'https://books.toscrape.com/catalogue/page-2.html' },
      { url: 'https://books.toscrape.com/catalogue/good-2/index.html', sourcePage: 'https://books.toscrape.com/catalogue/page-2.html' },
    ];

    const { records, failures } = await scrapeAllBooks(fakeClient, bookRefs);

    // Must not throw (we got here), must keep the 2 good records,
    // and must report exactly 2 failures with the right reasons.
    assert.strictEqual(records.length, 2);
    assert.strictEqual(failures.length, 2);
    assert.strictEqual(failures.find((f) => f.url.includes('missing')).failure.reason, 'HTTP_404');
    assert.strictEqual(failures.find((f) => f.url.includes('broken')).stage, 'validate');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
