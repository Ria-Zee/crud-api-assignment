'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cfg = require('./config');

/**
 * Failure classification.
 * Retry-worthy: request timeout, network error, 5xx (server's fault, might be transient).
 * Non-retry:    403 (told to go away), 404 (nothing there), other 4xx (our request is wrong).
 */
function classifyFailure({ status, errorCode }) {
  if (errorCode === 'TIMEOUT' || errorCode === 'NETWORK_ERROR') {
    return { retryable: true, reason: errorCode };
  }
  if (status >= 500 && status <= 599) {
    return { retryable: true, reason: `HTTP_${status}` };
  }
  if (status === 403 || status === 404) {
    return { retryable: false, reason: `HTTP_${status}` };
  }
  if (status >= 400 && status <= 499) {
    return { retryable: false, reason: `HTTP_${status}` };
  }
  return { retryable: false, reason: 'UNKNOWN' };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cacheKeyFor(url) {
  return crypto.createHash('sha1').update(url).digest('hex');
}

class PoliteClient {
  /**
   * @param {object} opts
   * @param {string} opts.userAgent
   * @param {number} opts.timeoutMs
   * @param {number} opts.minDelayMs
   * @param {number} opts.jitterMs
   * @param {number} opts.maxRetries
   * @param {string} opts.cacheDir      - absolute or relative dir for cached pages
   * @param {boolean} opts.useCache     - read from cache if present
   * @param {function} opts.onLog       - optional logger(level, msg, meta)
   */
  constructor(opts = {}) {
    this.userAgent = opts.userAgent || cfg.USER_AGENT;
    this.timeoutMs = opts.timeoutMs || cfg.TIMEOUT_MS;
    this.minDelayMs = opts.minDelayMs || cfg.MIN_DELAY_MS;
    this.jitterMs = opts.jitterMs ?? cfg.DELAY_JITTER_MS;
    this.maxRetries = opts.maxRetries ?? cfg.MAX_RETRIES;
    this.cacheDir = opts.cacheDir || cfg.CACHE_DIR;
    this.useCache = opts.useCache !== false; // default true
    this.onLog = opts.onLog || (() => {});
    this._lastRequestAt = 0;
    fs.mkdirSync(this.cacheDir, { recursive: true });
  }

  _cachePath(url) {
    return path.join(this.cacheDir, `${cacheKeyFor(url)}.html`);
  }

  async _respectDelay() {
    const wait = this.minDelayMs + Math.floor(Math.random() * (this.jitterMs || 0));
    const elapsed = Date.now() - this._lastRequestAt;
    const remaining = wait - elapsed;
    if (remaining > 0) await sleep(remaining);
    this._lastRequestAt = Date.now();
  }

  _readCache(url) {
    const p = this._cachePath(url);
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf8');
    }
    return null;
  }

  _writeCache(url, html) {
    fs.writeFileSync(this._cachePath(url), html, 'utf8');
  }

  /**
   * Fetch a single URL politely, with caching, timeout, and retry on
   * retry-worthy failures. Never throws on a "clean" HTTP failure (403/404/5xx
   * exhausted) -- returns a result object instead so callers can keep going.
   *
   * @returns {Promise<{ok: boolean, url: string, status: number|null, html: string|null,
   *                     fromCache: boolean, attempts: number, failure: object|null}>}
   */
  async get(url) {
    if (this.useCache) {
      const cached = this._readCache(url);
      if (cached !== null) {
        this.onLog('info', `cache hit: ${url}`);
        return { ok: true, url, status: 200, html: cached, fromCache: true, attempts: 0, failure: null };
      }
    }

    let attempt = 0;
    let lastFailure = null;

    while (attempt <= this.maxRetries) {
      attempt += 1;
      await this._respectDelay();

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        this.onLog('info', `GET ${url} (attempt ${attempt}/${this.maxRetries + 1})`);
        const res = await fetch(url, {
          headers: {
            'User-Agent': this.userAgent,
            Accept: 'text/html,application/xhtml+xml',
          },
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!res.ok) {
          const failure = classifyFailure({ status: res.status });
          lastFailure = { ...failure, status: res.status };
          this.onLog('warn', `non-OK status ${res.status} for ${url} (${failure.reason})`);
          if (!failure.retryable) {
            return { ok: false, url, status: res.status, html: null, fromCache: false, attempts: attempt, failure: lastFailure };
          }
          // retryable: fall through to backoff + loop
        } else {
          const html = await res.text();
          if (this.useCache) this._writeCache(url, html);
          return { ok: true, url, status: res.status, html, fromCache: false, attempts: attempt, failure: null };
        }
      } catch (err) {
        clearTimeout(timer);
        const errorCode = err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR';
        const failure = classifyFailure({ errorCode });
        lastFailure = { ...failure, message: err.message };
        this.onLog('warn', `${errorCode} for ${url}: ${err.message}`);
        if (!failure.retryable) {
          return { ok: false, url, status: null, html: null, fromCache: false, attempts: attempt, failure: lastFailure };
        }
        // retryable: fall through to backoff + loop
      }

      if (attempt <= this.maxRetries) {
        const backoff = cfg.RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
        this.onLog('info', `retrying ${url} in ${backoff}ms`);
        await sleep(backoff);
      }
    }

    return { ok: false, url, status: lastFailure?.status ?? null, html: null, fromCache: false, attempts: attempt, failure: lastFailure };
  }
}

module.exports = { PoliteClient, classifyFailure, cacheKeyFor };
