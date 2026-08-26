'use strict';

const cfg = require('./config');
const { extractBookLinksFromCatalogue, resolveCatalogueUrl } = require('./parse');

/**
 * Fetch each configured catalogue page and return a de-duplicated list of
 * { url, sourcePage }. A catalogue page that fails outright (non-retryable,
 * or retries exhausted) is recorded in `pageFailures` and skipped -- it does
 * NOT stop the other pages from being crawled (Stage 5 requirement).
 */
async function crawlCatalogue(client, pages = cfg.START_PAGES) {
  const bookUrls = [];
  const seen = new Set();
  const pageFailures = [];

  for (let i = 0; i < pages.length; i += 1) {
    const pageNumber = i + 1;
    const pageUrl = new URL(pages[i], cfg.BASE_URL).toString();
    const result = await client.get(pageUrl);

    if (!result.ok) {
      pageFailures.push({ page: pageNumber, url: pageUrl, failure: result.failure });
      continue;
    }

    const hrefs = extractBookLinksFromCatalogue(result.html);
    for (const href of hrefs) {
      const absolute = resolveCatalogueUrl(pageUrl, href);
      if (!seen.has(absolute)) {
        seen.add(absolute);
        bookUrls.push({ url: absolute, sourcePage: pageNumber });
      }
    }
  }

  return { bookUrls, pageFailures };
}

module.exports = { crawlCatalogue };
