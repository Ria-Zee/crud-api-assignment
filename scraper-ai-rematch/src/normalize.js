'use strict';

const { RATING_WORDS } = require('./parse');

const CURRENCY_SYMBOLS = { '£': 'GBP', '$': 'USD', '€': 'EUR' };

/**
 * "£51.77" -> { amount: 51.77, currency: "GBP" }
 * Returns { amount: null, currency: null } if it can't confidently parse --
 * callers decide whether that's a validation failure.
 */
function normalizePrice(priceText) {
  if (typeof priceText !== 'string') return { amount: null, currency: null };
  const trimmed = priceText.trim();
  const symbol = trimmed[0];
  const currency = CURRENCY_SYMBOLS[symbol] || null;
  const numeric = trimmed.replace(/[^0-9.]/g, '');
  const amount = numeric ? Number.parseFloat(numeric) : NaN;
  if (Number.isNaN(amount)) return { amount: null, currency };
  return { amount: Math.round(amount * 100) / 100, currency };
}

/**
 * "In stock (22 available)" -> { in_stock: true, stock_count: 22 }
 * "In stock"                -> { in_stock: true, stock_count: null }
 * "Out of stock"            -> { in_stock: false, stock_count: 0 }
 */
function normalizeAvailability(availabilityText) {
  if (typeof availabilityText !== 'string') return { in_stock: null, stock_count: null };
  const text = availabilityText.trim();
  const countMatch = text.match(/\((\d+)\s+available\)/i);
  const stock_count = countMatch ? Number.parseInt(countMatch[1], 10) : (/out of stock/i.test(text) ? 0 : null);
  const in_stock = /out of stock/i.test(text) ? false : /in stock/i.test(text) ? true : null;
  return { in_stock, stock_count };
}

/** "Three" -> 3. Unknown word -> null (never guess a number). */
function normalizeRating(ratingText) {
  if (typeof ratingText !== 'string') return null;
  return Object.prototype.hasOwnProperty.call(RATING_WORDS, ratingText) ? RATING_WORDS[ratingText] : null;
}

function normalizeDescription(descriptionText) {
  if (typeof descriptionText !== 'string') return null;
  return descriptionText.replace(/\s+/g, ' ').trim();
}

/**
 * Take one raw record (as produced by parse.extractBookFields) and produce
 * the final, typed record. Never throws; unresolvable fields become null so
 * the schema validator can catch and report them explicitly instead of the
 * pipeline crashing on a bad book.
 */
function normalizeRecord(raw) {
  const { amount, currency } = normalizePrice(raw.price_text);
  const { in_stock, stock_count } = normalizeAvailability(raw.availability_text);
  return {
    title: raw.title ?? null,
    product_url: raw.product_url ?? null,
    price: amount,
    currency,
    in_stock,
    stock_count,
    rating: normalizeRating(raw.rating_text),
    description: normalizeDescription(raw.description),
    source_page: raw.source_page ?? null,
    fetched_at: raw.fetched_at ?? null,
    // raw text kept alongside for auditability -- cheap insurance against a
    // normalization bug silently destroying information.
    _raw: {
      price_text: raw.price_text ?? null,
      availability_text: raw.availability_text ?? null,
      rating_text: raw.rating_text ?? null,
    },
  };
}

module.exports = { normalizePrice, normalizeAvailability, normalizeRating, normalizeDescription, normalizeRecord };
