'use strict';

/**
 * books.toscrape.com is a static Scrapy demo project whose markup has not
 * changed in years (github.com/scrapy/quotesbot-style sandbox). We rely on
 * that stability instead of a full DOM/CSS-selector engine, since this
 * project intentionally has zero npm dependencies (no network access to
 * install cheerio in this build environment -- see README "Known
 * limitations"). If cheerio ever becomes available, swap the bodies of these
 * functions for real selector queries; the call sites in scrapeBook.js /
 * crawlCatalogue.js don't need to change.
 */

function decodeEntities(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&pound;/g, '£')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/**
 * Extract every book's relative product URL from a catalogue page's raw HTML.
 * Each product lives in <article class="product_pod">...<h3><a href="...">.
 */
function extractBookLinksFromCatalogue(html) {
  const links = [];
  const podRegex = /<article class="product_pod">([\s\S]*?)<\/article>/g;
  let m;
  while ((m = podRegex.exec(html)) !== null) {
    const pod = m[1];
    const hrefMatch = pod.match(/<h3>\s*<a href="([^"]+)"/);
    if (hrefMatch) links.push(hrefMatch[1]);
  }
  return links;
}

/** Resolve a catalogue-relative href against the page it was found on. */
function resolveCatalogueUrl(baseUrl, href) {
  return new URL(href, baseUrl).toString();
}

const RATING_WORDS = { One: 1, Two: 2, Three: 3, Four: 4, Five: 5 };

/**
 * Extract the 8 raw fields from a single book detail page's HTML.
 * Returns raw/near-raw strings; numeric normalization happens in normalize.js.
 */
function extractBookFields(html, { productUrl, sourcePage, fetchedAt }) {
  const titleMatch = html.match(/<div class="col-sm-6 product_main">\s*<h1>([^<]*)<\/h1>/)
    || html.match(/<h1>([^<]*)<\/h1>/);
  const title = titleMatch ? decodeEntities(titleMatch[1].trim()) : null;

  const priceMatch = html.match(/<p class="price_color">([^<]*)<\/p>/);
  const price_text = priceMatch ? decodeEntities(priceMatch[1].trim()) : null;

  const availMatch = html.match(/<p class="instock availability">\s*([\s\S]*?)\s*<\/p>/);
  const availability_text = availMatch ? stripTags(availMatch[1]) : null;

  const ratingMatch = html.match(/<p class="star-rating ([A-Za-z]+)">/);
  const rating_text = ratingMatch ? ratingMatch[1] : null;

  let description = null;
  const descMatch = html.match(
    /<div id="product_description"[^>]*>[\s\S]*?<\/div>\s*<p>([\s\S]*?)<\/p>/
  );
  if (descMatch) {
    description = stripTags(descMatch[1]);
  } else if (!/id="product_description"/.test(html)) {
    // A handful of books on the real site ship with no description block at all.
    description = '';
  }

  return {
    title,
    product_url: productUrl,
    price_text,
    availability_text,
    rating_text,
    description,
    source_page: sourcePage,
    fetched_at: fetchedAt,
  };
}

module.exports = {
  decodeEntities,
  stripTags,
  extractBookLinksFromCatalogue,
  resolveCatalogueUrl,
  extractBookFields,
  RATING_WORDS,
};
