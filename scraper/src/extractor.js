import * as cheerio from 'cheerio';
import { fetchPage } from './fetcher.js';

const DELAY_MS = 600;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cacheKeyFor(url) {
  // e.g. .../a-light-in-the-attic_1000/index.html -> a-light-in-the-attic_1000
  const parts = url.split('/').filter(Boolean);
  return parts[parts.length - 2];
}

/**
 * Fetch and parse one book detail page into a raw record.
 * All 8 keys are always present; description is null when the page has none.
 * Throws on fetch failure — the caller is responsible for isolating that
 * failure so it doesn't take down the whole run.
 */
export async function extractBook(bookUrl, sourcePage) {
  const cacheKey = cacheKeyFor(bookUrl);
  const { html, wasCached } = await fetchPage(bookUrl, cacheKey);
  const $ = cheerio.load(html);

  const productMain = $('.product_main');
  const title = productMain.find('h1').text().trim();
  const priceText = productMain.find('.price_color').first().text().trim();
  const availabilityText = productMain.find('.availability').text().replace(/\s+/g, ' ').trim();

  const ratingClasses = productMain.find('p.star-rating').attr('class') || '';
  const ratingWord = ratingClasses.split(' ').find((c) => c !== 'star-rating');

  const descriptionEl = $('#product_description').next('p');
  const description = descriptionEl.length ? descriptionEl.text().trim() : null;

  if (!wasCached) {
    await sleep(DELAY_MS);
  }

  return {
    title,
    product_url: bookUrl,
    price_text: priceText,
    availability_text: availabilityText,
    rating_text: ratingWord || null,
    description,
    source_page: sourcePage,
    fetched_at: new Date().toISOString(),
  };
}