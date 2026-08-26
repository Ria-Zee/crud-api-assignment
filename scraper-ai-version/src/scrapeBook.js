'use strict';

const { extractBookFields } = require('./parse');
const { normalizeRecord } = require('./normalize');
const { validateRecord } = require('./schema');

/**
 * Fetch + parse + normalize + validate one book page.
 * Never throws: any failure (network, parse, validation) comes back as a
 * structured `failures[]` entry so the caller can keep going (Stage 5).
 */
async function scrapeOneBook(client, { url, sourcePage }) {
  const result = await client.get(url);

  if (!result.ok) {
    return {
      ok: false,
      url,
      stage: 'fetch',
      failure: result.failure,
    };
  }

  let raw;
  try {
    raw = extractBookFields(result.html, {
      productUrl: url,
      sourcePage,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    // A page that doesn't match our expected markup at all (Stage 5: "broken page").
    return {
      ok: false,
      url,
      stage: 'parse',
      failure: { retryable: false, reason: 'PARSE_ERROR', message: err.message },
    };
  }

  const record = normalizeRecord(raw);
  const { valid, errors } = validateRecord(record);
  if (!valid) {
    return {
      ok: false,
      url,
      stage: 'validate',
      failure: { retryable: false, reason: 'SCHEMA_INVALID', message: errors.join('; ') },
      record, // kept for debugging even though it's invalid
    };
  }

  return { ok: true, url, record };
}

/**
 * Fetch + parse every discovered book URL sequentially (politeness comes from
 * the shared client's delay). Returns { records, failures }.
 */
async function scrapeAllBooks(client, bookRefs, { onProgress } = {}) {
  const records = [];
  const failures = [];

  for (let i = 0; i < bookRefs.length; i += 1) {
    const ref = bookRefs[i];
    const outcome = await scrapeOneBook(client, ref);
    if (outcome.ok) {
      records.push(outcome.record);
    } else {
      failures.push(outcome);
    }
    if (onProgress) onProgress({ index: i + 1, total: bookRefs.length, outcome });
  }

  return { records, failures };
}

module.exports = { scrapeOneBook, scrapeAllBooks };
