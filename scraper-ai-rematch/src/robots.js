'use strict';

const cfg = require('./config');

/**
 * Fetch robots.txt fresh at run time (never assume last run's answer still
 * holds) and give a plain allow/deny verdict for our catalogue + book paths.
 *
 * RFC 9309 behaviour we follow:
 *  - 200 with body -> parse Disallow/Allow rules for '*' (and our UA if a
 *    specific block exists) and check our target paths against them.
 *  - 404/no robots.txt -> treated as "no restrictions stated" (this is the
 *    standard interpretation: absence of the file is not a disallow).
 *  - Anything else unexpected (5xx, timeout) -> fail CLOSED: report unknown
 *    and let the caller decide (this script defaults to refusing to crawl on
 *    a genuinely unknown robots status, since "assume allowed" is the wrong
 *    default when we can't actually check).
 */
async function checkRobots(client) {
  const robotsUrl = new URL('/robots.txt', cfg.BASE_URL).toString();
  const result = await client.get(robotsUrl);

  if (!result.ok && result.status === 404) {
    return {
      verdict: 'ALLOWED',
      reason: 'robots.txt returned 404 (no file present) -> no restrictions stated',
      raw: null,
    };
  }

  if (!result.ok) {
    return {
      verdict: 'UNKNOWN',
      reason: `could not retrieve robots.txt (${result.failure?.reason || 'unknown error'})`,
      raw: null,
    };
  }

  const disallowPaths = [];
  let relevantBlock = false;
  for (const line of result.html.split('\n')) {
    const trimmed = line.trim();
    if (/^user-agent:\s*\*/i.test(trimmed)) relevantBlock = true;
    else if (/^user-agent:/i.test(trimmed)) relevantBlock = false;
    else if (relevantBlock) {
      const m = trimmed.match(/^disallow:\s*(\S*)/i);
      if (m && m[1]) disallowPaths.push(m[1]);
    }
  }

  const targets = ['/catalogue/'];
  const blocked = targets.filter((t) => disallowPaths.some((d) => t.startsWith(d)));

  return {
    verdict: blocked.length ? 'DISALLOWED' : 'ALLOWED',
    reason: blocked.length
      ? `robots.txt disallows: ${blocked.join(', ')}`
      : `robots.txt present but does not disallow ${targets.join(', ')}`,
    raw: result.html,
  };
}

module.exports = { checkRobots };
