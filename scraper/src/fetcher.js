import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const USER_AGENT = 'FlyRankInternshipA9/1.0 (+https://github.com/Ria-Zee/crud-api-assignment)';
const TIMEOUT_MS = 8000;
const CACHE_DIR = new URL('../cache/', import.meta.url).pathname;

/**
 * Fetch a URL politely, or read it from the local cache if we already have it.
 * cacheKey is the filename (without extension) to store/read the HTML under.
 */
const NO_RETRY_STATUSES = new Set([404, 403]);

/**
 * Fetch a URL politely, or read it from the local cache if we already have it.
 * On a timeout or 5xx, retries once after a short pause. Never retries a 404
 * or 403 — asking again won't help either of those.
 * Returns { html, wasCached }.
 */
export async function fetchPage(url, cacheKey, attempt = 1) {
  await mkdir(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.html`);

  if (existsSync(cachePath)) {
    const html = await readFile(cachePath, 'utf-8');
    console.log(`CACHE HIT  ${url}  (${html.length} bytes)`);
    return { html, wasCached: true };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 1000));
      return fetchPage(url, cacheKey, attempt + 1);
    }
    throw new Error(`Fetch failed for ${url}: ${err.message}`);
  }
  clearTimeout(timeout);

  if (response.status !== 200) {
    const shouldRetry = attempt < 2 && response.status >= 500 && !NO_RETRY_STATUSES.has(response.status);
    if (shouldRetry) {
      await new Promise((r) => setTimeout(r, 1000));
      return fetchPage(url, cacheKey, attempt + 1);
    }
    throw new Error(`Fetch failed for ${url}: status ${response.status}`);
  }

  const html = await response.text();
  await writeFile(cachePath, html, 'utf-8');
  console.log(`FETCH      ${url}  (${html.length} bytes)`);
  return { html, wasCached: false };
}