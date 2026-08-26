'use strict';

const fs = require('fs');
const path = require('path');
const cfg = require('./config');
const { PoliteClient } = require('./httpClient');
const { checkRobots } = require('./robots');
const { crawlCatalogue } = require('./crawlCatalogue');
const { scrapeAllBooks } = require('./scrapeBook');
const { validateCollection } = require('./schema');

function log(level, msg) {
  const ts = new Date().toISOString();
  // eslint-disable-next-line no-console
  console.log(`[${ts}] ${level.toUpperCase().padEnd(5)} ${msg}`);
}

async function run({ useCache = true } = {}) {
  const startedAt = new Date().toISOString();
  fs.mkdirSync(cfg.OUT_DIR, { recursive: true });

  const client = new PoliteClient({
    useCache,
    onLog: (level, msg) => log(level, msg),
  });

  // ---- Stage 0: robots check (runtime, not just the write-up) -----------
  const robots = await checkRobots(client);
  log('info', `robots.txt verdict: ${robots.verdict} -- ${robots.reason}`);
  if (robots.verdict === 'DISALLOWED') {
    log('error', 'robots.txt disallows the target paths. Stopping before any catalogue crawl.');
    const report = buildReport({ startedAt, robots, pageFailures: [], bookFailures: [], bookUrlsFound: 0, validation: null });
    fs.writeFileSync(cfg.RUN_REPORT_JSON, JSON.stringify(report, null, 2));
    return { records: [], report };
  }
  if (robots.verdict === 'UNKNOWN') {
    log('warn', 'robots.txt status could not be determined; proceeding cautiously since books.toscrape.com is an explicit public scraping sandbox (see README Stage 0 write-up), but this would be a hard stop on a real target.');
  }

  // ---- Stage 1 + 2: crawl the 3 catalogue pages, collect book URLs ------
  const { bookUrls, pageFailures } = await crawlCatalogue(client);
  log('info', `collected ${bookUrls.length} unique book URLs from ${cfg.START_PAGES.length} catalogue pages`);
  if (bookUrls.length !== cfg.EXPECTED_BOOK_COUNT) {
    log('warn', `expected ${cfg.EXPECTED_BOOK_COUNT} book URLs, got ${bookUrls.length} (see pageFailures in run-report.json)`);
  }

  // ---- Stage 3 + 4 + 5: fetch, extract, normalize, validate, survive ----
  const { records, failures: bookFailures } = await scrapeAllBooks(client, bookUrls, {
    onProgress: ({ index, total, outcome }) => {
      if (outcome.ok) log('info', `[${index}/${total}] ok: ${outcome.record.title}`);
      else log('warn', `[${index}/${total}] FAILED (${outcome.stage}/${outcome.failure.reason}): ${outcome.url}`);
    },
  });

  const validation = validateCollection(records);

  fs.writeFileSync(cfg.BOOKS_JSON, JSON.stringify(records, null, 2));
  log('info', `wrote ${records.length} records to ${cfg.BOOKS_JSON}`);

  const report = buildReport({
    startedAt,
    robots,
    pageFailures,
    bookFailures,
    bookUrlsFound: bookUrls.length,
    validation,
    recordCount: records.length,
  });
  fs.writeFileSync(cfg.RUN_REPORT_JSON, JSON.stringify(report, null, 2));
  log('info', `wrote run report to ${cfg.RUN_REPORT_JSON}`);

  return { records, report };
}

function buildReport({ startedAt, robots, pageFailures, bookFailures, bookUrlsFound, validation, recordCount }) {
  const finishedAt = new Date().toISOString();
  return {
    started_at: startedAt,
    finished_at: finishedAt,
    target: cfg.BASE_URL,
    robots_check: robots,
    catalogue: {
      pages_attempted: cfg.START_PAGES.length,
      pages_failed: pageFailures.length,
      page_failures: pageFailures,
      unique_book_urls_found: bookUrlsFound,
      expected_book_urls: cfg.EXPECTED_BOOK_COUNT,
    },
    books: {
      attempted: bookUrlsFound,
      succeeded: recordCount ?? 0,
      failed: bookFailures.length,
      failures: bookFailures.map((f) => ({
        url: f.url,
        stage: f.stage,
        reason: f.failure.reason,
        retryable: f.failure.retryable,
        message: f.failure.message || null,
      })),
    },
    validation: validation
      ? {
          valid_records: validation.validCount,
          invalid_records: validation.invalidCount,
          duplicate_urls: validation.duplicates,
        }
      : null,
    success: Boolean(
      robots.verdict !== 'DISALLOWED' &&
      recordCount === cfg.EXPECTED_BOOK_COUNT &&
      validation &&
      validation.invalidCount === 0 &&
      validation.duplicates.length === 0
    ),
  };
}

if (require.main === module) {
  const useCache = !process.argv.includes('--no-cache');
  run({ useCache })
    .then(({ report }) => {
      log('info', `DONE. success=${report.success}`);
      process.exit(report.success ? 0 : 1);
    })
    .catch((err) => {
      log('error', `fatal: ${err.stack || err.message}`);
      process.exit(2);
    });
}

module.exports = { run };
