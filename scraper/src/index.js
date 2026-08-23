import { discoverCatalogue } from './crawler.js';

const result = await discoverCatalogue();
console.log(`catalogue_pages=${result.catalogue_pages}`);
console.log(`discovered=${result.discovered}`);
console.log(`unique_urls=${result.unique_urls.length}`);