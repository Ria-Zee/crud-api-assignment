import { discoverCatalogue } from './crawler.js';
import { extractBook } from './extractor.js';

const catalogue = await discoverCatalogue();

const records = [];
for (const bookUrl of catalogue.unique_urls) {
  const record = await extractBook(bookUrl, catalogue.unique_urls[0]);
  records.push(record);
}

console.log(JSON.stringify(records[0], null, 2));
console.log(`detail_pages=${records.length}`);