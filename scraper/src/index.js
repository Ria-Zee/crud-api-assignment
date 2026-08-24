import { mkdir, writeFile } from 'fs/promises';
import { discoverCatalogue } from './crawler.js';
import { extractBook } from './extractor.js';
import { BookSchema, normalizeRecord } from './schema.js';

const OUTPUT_DIR = new URL('../output/', import.meta.url).pathname;

const catalogue = await discoverCatalogue();
console.log(`catalogue_pages=${catalogue.catalogue_pages}`);
console.log(`discovered=${catalogue.discovered}`);

const seen = new Set(); // canonical URLs already stored — guarantees idempotency
const validRecords = [];
const errorRecords = [];

for (const bookUrl of catalogue.unique_urls) {
  const sourcePage = catalogue.sourcePageFor.get(bookUrl);
  const raw = await extractBook(bookUrl, sourcePage);
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

console.log(`valid_records=${validRecords.length}`);
console.log(`invalid_records=${errorRecords.length}`);