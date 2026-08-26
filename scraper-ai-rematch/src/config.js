'use strict';

// Single source of truth for every "politeness" number in this project.
// Change values here, not inline in the crawler.

const BOT_NAME = 'ZeeBookScraperBot';
const BOT_VERSION = '1.0';
const CONTACT = 'https://github.com/zee-scraper-contact'; // swap for a real contact URL/email before real-world use

module.exports = {
  BASE_URL: 'https://books.toscrape.com',
  CATALOGUE_PATH: '/catalogue',
  START_PAGES: [
    '/catalogue/page-1.html',
    '/catalogue/page-2.html',
    '/catalogue/page-3.html',
  ],
  EXPECTED_BOOK_COUNT: 60, // 3 pages x 20 books

  USER_AGENT: `${BOT_NAME}/${BOT_VERSION} (+${CONTACT}; educational scraping exercise, contact via link)`,

  TIMEOUT_MS: 8000,          // hard floor from spec: >= 8000ms
  MIN_DELAY_MS: 500,         // hard floor from spec: >= 500ms between requests
  DELAY_JITTER_MS: 300,      // extra random 0-300ms so we don't look like a metronome

  MAX_RETRIES: 3,            // for retry-worthy failures only (timeout, 5xx)
  RETRY_BASE_DELAY_MS: 1000, // exponential backoff base

  CACHE_DIR: 'cache',
  OUT_DIR: 'out',
  BOOKS_JSON: 'out/books.json',
  RUN_REPORT_JSON: 'out/run-report.json',
};
