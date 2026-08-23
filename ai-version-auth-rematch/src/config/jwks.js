import { createRemoteJWKSet } from "jose";

/**
 * Neon Auth signs tokens with EdDSA (Ed25519) and publishes the public keys
 * at <NEON_AUTH_URL>/.well-known/jwks.json. createRemoteJWKSet fetches that
 * endpoint on first use and caches the keys, refetching automatically if a
 * token shows up signed with a key it hasn't seen (key rotation). This is
 * the "live call to the provider" the verification step relies on: your
 * server never trusts a token on signature alone without checking it
 * against keys the provider currently publishes.
 *
 * Built once at module load, not per request. Building it per request
 * would refetch the JWKS on every single API call and add latency for no
 * security benefit.
 */
if (!process.env.NEON_AUTH_BASE_URL) {
  throw new Error("NEON_AUTH_BASE_URL is not set. Check your .env file.");
}

export const NEON_AUTH_ORIGIN = new URL(process.env.NEON_AUTH_BASE_URL).origin;

// NEON_AUTH_BASE_URL already contains the full auth path (for example
// https://ep-xxx.../neondb/auth). Appending a leading-slash path with
// `new URL()` would strip that path back to the origin, so this uses plain
// string concatenation, same as Neon's own verification examples.
const jwksUrl = new URL(`${process.env.NEON_AUTH_BASE_URL}/.well-known/jwks.json`);

export const JWKS = createRemoteJWKSet(jwksUrl);
