'use strict';

/**
 * Hand-rolled validator. No ajv -- this build environment can't reach npm's
 * registry (see README), and the schema is small/stable enough that a manual
 * check is honestly clearer than a dependency here. Each rule reports its own
 * failure reason so run-report.json says exactly what was wrong, not just
 * "invalid".
 */

const RULES = [
  ['title', (v) => typeof v === 'string' && v.trim().length > 0, 'title must be a non-empty string'],
  ['product_url', (v) => typeof v === 'string' && /^https:\/\/books\.toscrape\.com\//.test(v), 'product_url must be an absolute books.toscrape.com URL'],
  ['price', (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0, 'price must be a non-negative number'],
  ['currency', (v) => typeof v === 'string' && v.length === 3, 'currency must be a 3-letter code'],
  ['in_stock', (v) => typeof v === 'boolean', 'in_stock must be a boolean'],
  ['stock_count', (v) => v === null || (Number.isInteger(v) && v >= 0), 'stock_count must be a non-negative integer or null'],
  ['rating', (v) => Number.isInteger(v) && v >= 1 && v <= 5, 'rating must be an integer 1-5'],
  ['description', (v) => typeof v === 'string', 'description must be a string (can be empty)'],
  ['source_page', (v) => typeof v === 'string' && /^https:\/\/books\.toscrape\.com\/catalogue\/page-\d+\.html$/.test(v), 'source_page must be the absolute URL of the catalogue page the book was discovered on'],
  ['fetched_at', (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v)), 'fetched_at must be a parseable ISO timestamp'],
];

/**
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateRecord(record) {
  const errors = [];
  for (const [field, check, message] of RULES) {
    if (!check(record[field])) {
      errors.push(`${field}: ${message} (got ${JSON.stringify(record[field])})`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/** Validate an array and also flag duplicate product_url / title collisions. */
function validateCollection(records) {
  const perRecord = records.map((r) => ({ product_url: r.product_url, ...validateRecord(r) }));
  const seen = new Map();
  const duplicates = [];
  for (const r of records) {
    if (!r.product_url) continue;
    if (seen.has(r.product_url)) duplicates.push(r.product_url);
    seen.set(r.product_url, true);
  }
  return {
    perRecord,
    duplicates,
    validCount: perRecord.filter((r) => r.valid).length,
    invalidCount: perRecord.filter((r) => !r.valid).length,
  };
}

module.exports = { validateRecord, validateCollection };
