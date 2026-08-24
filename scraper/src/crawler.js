import * as cheerio from 'cheerio';
import { fetchPage } from './fetcher.js';

const DELAY_MS = 600;
const BASE_CATALOGUE_URL = 'https://books.toscrape.com/catalogue/page-1.html';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Discover all book detail page URLs across the catalogue's first 3 pages,
 * following the site's own "next" link rather than hardcoding page numbers.
 */
export async function discoverCatalogue() {
  const bookUrls = new Map(); // bookUrl -> catalogue page it was found on
  let pageUrl = BASE_CATALOGUE_URL;
  let pageCount = 0;
  const maxPages = 3;

  while (pageUrl && pageCount < maxPages) {
    const cacheKey = `catalogue-page-${pageCount + 1}`;
    const wasCached = !(await isFreshFetch(cacheKey));

    const html = await fetchPage(pageUrl, cacheKey);
    const $ = cheerio.load(html);
    const currentPageUrl = pageUrl;

    $('article.product_pod h3 a').each((_, el) => {
      const href = $(el).attr('href');
      const absoluteUrl = new URL(href, currentPageUrl).href;
      if (!bookUrls.has(absoluteUrl)) {
        bookUrls.set(absoluteUrl, currentPageUrl);
      }
    });

    pageCount += 1;

    const nextHref = $('li.next a').attr('href');
    pageUrl = nextHref ? new URL(nextHref, currentPageUrl).href : null;

    if (pageUrl && !wasCached) {
      await sleep(DELAY_MS);
    }
  }

  return {
    catalogue_pages: pageCount,
    discovered: bookUrls.size,
    unique_urls: [...bookUrls.keys()],
    sourcePageFor: bookUrls,
  };
}
// Cheap check so we only delay after a real network fetch, never after a cache hit
async function isFreshFetch(cacheKey) {
  const { existsSync } = await import('fs');
  const path = await import('path');
  const cacheDir = new URL('../cache/', import.meta.url).pathname;
  return existsSync(path.join(cacheDir, `${cacheKey}.html`));
}
