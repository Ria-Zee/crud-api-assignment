# Neon Auth API

Express API that hands off credential checking to Neon Auth (Managed Better
Auth) and protects routes with a single reusable JWT guard.

## Stack

- Node.js + Express
- Neon Auth (`@neondatabase/auth`) for signup, login, credential storage
- `jose` for JWT verification against Neon Auth's live JWKS endpoint
- Swagger UI (`swagger-jsdoc` + `swagger-ui-express`) for interactive docs

## Setup

1. In the Neon Console, open your project, enable Auth, and copy the Auth
   URL from the Auth tab.
2. Copy `.env.example` to `.env` and fill in `NEON_AUTH_URL` and
   `NEON_AUTH_BASE_URL` (same value, used in two places for clarity).
3. Install dependencies and run:

```bash
npm install
npm run dev
```

4. Open `http://localhost:3000/api-docs` for Swagger UI.

## Auth flow

1. Client calls `POST /auth/signup` or `POST /auth/login` on this backend.
2. This backend forwards the credentials to Neon Auth using a fresh
   `@neondatabase/auth` client for that one request only.
3. Neon Auth validates the credentials and returns a session, which
   includes a signed JWT (`session.token`).
4. This backend returns that JWT to the client in the response body.
5. The client attaches it to every future request as
   `Authorization: Bearer <token>`.
6. `verifyToken` middleware fetches Neon Auth's public keys from its JWKS
   endpoint, checks the token's signature, issuer, and expiry, and only
   then lets the request reach the route handler.

Step 6 is the "live call to the provider": the JWKS keys are fetched from
Neon Auth over the network and cached, and refetched automatically if a
token arrives signed with a key not yet in the cache (key rotation). No
route trusts a token on the strength of its signature alone without
checking it against keys the provider currently publishes.

## Routes

| Method | Route                | Auth required | Success | Failure |
|--------|-----------------------|:---:|---------|---------|
| POST   | `/auth/signup`        | No  | 201 | 400 missing/empty email or password |
| POST   | `/auth/login`         | No  | 200, returns token | 400 missing/empty fields, 401 invalid credentials |
| POST   | `/auth/logout`        | Yes | 204 | 401 missing/invalid/expired token |
| GET    | `/public/info`        | No  | 200 | - |
| GET    | `/protected/profile`  | Yes | 200 | 401 missing/invalid/expired token |
| GET    | `/protected/dashboard`| Yes | 200 | 401 missing/invalid/expired token |

## Reusable middleware proof

`src/middleware/verifyToken.js` is mounted once in
`src/routes/protected.routes.js`:

```js
router.use(verifyToken);
```

Both `/protected/profile` and `/protected/dashboard` sit behind that one
line. Neither route file nor either controller repeats a single line of
token-checking code. `/auth/logout` reuses the same guard directly.

## Known limitation: logout

Neon Auth issues stateless JWTs that expire in 15 minutes and carries no
mechanism, reachable from a bearer token alone, to revoke a token before
it expires. `POST /auth/logout` checks that the caller currently holds a
valid token (proving the guard works there too) and returns 204. The
actual act of logging out is the client discarding the token. If you need
tokens to die immediately on logout, add a server-side token blocklist
(Redis, keyed by `jti` or the token itself, with a TTL matching the token's
remaining lifetime) and check it inside `verifyToken`.

## Known limitation: per-request auth client

Neon Auth's SDK manages sessions through cookies internally. A single
`authClient` instance shared across all requests on a multi-tenant Node
backend would risk one user's session state leaking into another's. This
API creates a new client per request (`getAuthClient()` in
`src/config/authClient.js`) and uses it exactly once, so no state persists
between requests or users.

## Testing in Swagger

1. `POST /auth/signup` with an email and password.
2. `POST /auth/login` with the same credentials, copy the `token` field
   from the response.
3. Click **Authorize** at the top of the Swagger UI page, paste the token
   in as a Bearer token.
4. Call `GET /protected/profile` and `GET /protected/dashboard`. Both
   succeed with the same token.
5. Try either protected route with no token, or with an expired one, and
   confirm you get 401.
