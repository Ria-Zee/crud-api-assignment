import { mkdir, writeFile } from 'fs/promises';
import { discoverCatalogue } from './crawler.js';
import { extractBook } from './extractor.js';
import { BookSchema, normalizeRecord } from './schema.js';

const OUTPUT_DIR = new URL('../output/', import.meta.url).pathname;

const startTime = Date.now();

const catalogue = await discoverCatalogue();
console.log(`catalogue_pages=${catalogue.catalogue_pages}`);
console.log(`discovered=${catalogue.discovered}`);

const seen = new Set(); // canonical URLs already stored — guarantees idempotency
const validRecords = [];
const errorRecords = [];
let failedPages = 0;
let pagesFetched = 0;

for (const bookUrl of catalogue.unique_urls) {
  const sourcePage = catalogue.sourcePageFor.get(bookUrl);

  let raw;
  try {
    raw = await extractBook(bookUrl, sourcePage);
    pagesFetched += 1;
  } catch (err) {
    console.log(`SKIP (book) ${bookUrl}: ${err.message}`);
    failedPages += 1;
    errorRecords.push({ product_url: bookUrl, reason: `fetch failed: ${err.message}` });
    continue; // one bad page must not stop the run
  }

  const normalized = normalizeRecord(raw);

  if (seen.has(normalized.product_url)) {
    continue; // already have this canonical URL, skip silently
  }

  const result = BookSchema.safeParse(normalized);
  if (result.success) {
    seen.add(normalized.product_url);
    validRecords.push(result.data);
  } else {
    errorRecords.push({
      product_url: normalized.product_url,
      reason: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    });
  }
}

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(`${OUTPUT_DIR}books.json`, JSON.stringify(validRecords, null, 2));
await writeFile(`${OUTPUT_DIR}errors.json`, JSON.stringify(errorRecords, null, 2));

const durationMs = Date.now() - startTime;

const runReport = {
  start_time: new Date(startTime).toISOString(),
  duration_ms: durationMs,
  catalogue_pages_fetched: catalogue.catalogue_pages,
  detail_pages_attempted: catalogue.unique_urls.length,
  detail_pages_fetched: pagesFetched,
  valid_records: validRecords.length,
  invalid_records: errorRecords.length - failedPages,
  failed_pages: failedPages,
};

await writeFile(`${OUTPUT_DIR}run-report.json`, JSON.stringify(runReport, null, 2));

console.log(`valid_records=${validRecords.length}`);
console.log(`invalid_records=${errorRecords.length}`);
console.log(`failed_pages=${failedPages}`);