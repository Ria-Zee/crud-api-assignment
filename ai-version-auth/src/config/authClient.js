import { createAuthClient } from "@neondatabase/auth";

/**
 * Neon Auth (Managed Better Auth) issues sessions through cookies under the
 * hood, even when you only care about the raw JWT in the response body.
 * A single shared client at module scope would let one user's cookie jar
 * leak into another user's request on a multi-tenant backend.
 *
 * getAuthClient() returns a fresh client for every call. Each request in
 * this API creates one, uses it once, and throws it away. No state is kept
 * between requests, which is what a stateless bearer-token API needs.
 */
export function getAuthClient() {
  const authUrl = process.env.NEON_AUTH_URL;

  if (!authUrl) {
    throw new Error("NEON_AUTH_URL is not set. Check your .env file.");
  }

  return createAuthClient(authUrl, {
    fetchOptions: {
      headers: {
        Origin: `http://localhost:${process.env.PORT || 3000}`,
      },
    },
  });
}
