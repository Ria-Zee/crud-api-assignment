# Auth API

A secured API with sign up, log in, log out, and protected routes, backed by [Neon Auth](https://neon.tech/docs/auth/overview) (managed Better Auth). Built with Express and verified with JWKS-based JWT verification.

## Setup

1. Create a free [Neon](https://neon.tech) project and enable Neon Auth on it (Console → Auth → toggle on).
2. Copy `.env.example` to `.env` and fill in your own `AUTH_URL` and `JWKS_URL` from Neon's Console → Auth → Configuration tab:

```bash
cp .env.example .env
```

3. Install dependencies:

```bash
npm install
```

## Run it

```bash
node server.js
```

Server runs on `http://localhost:3000`.

## Endpoints

| Method | Path                  | Description                  | Auth required |
|--------|------------------------|-------------------------------|----------------|
| GET    | /public/info           | Public, open data              | No              |
| POST   | /auth/signup            | Create a new user account       | No              |
| POST   | /auth/login              | Authenticate & return a JWT      | No              |
| GET    | /protected/profile        | Read private profile data         | Yes — `Authorization: Bearer <token>` |
| GET    | /protected/dashboard       | Read protected dashboard data      | Yes — `Authorization: Bearer <token>` |
| POST   | /auth/logout              | End the user's session            | Yes — `Authorization: Bearer <token>` |

All error responses return a JSON body: `{ "error": "..." }`.

## Swagger UI

Interactive docs, with a bearer-token "Authorize" padlock, available at `http://localhost:3000/docs` once the server is running.

![Swagger UI with bearer auth](auth-swagger-screenshot.png)

## Neon Auth vs Supabase — what actually differed

The assignment brief is written around Supabase Auth. This project uses Neon Auth instead (staff-approved substitution — see Stage 7 for the AI comparison this enabled). A few real, non-obvious differences surfaced while building this that are worth documenting, since they're not just implementation trivia — they shaped how the auth flow had to be built:

- **An `Origin` header is required on every server-to-server call.** Neon Auth's underlying Better Auth engine rejects requests without one, even from a backend that isn't a browser. Fixed by setting a default `Origin` header in `auth.js`'s `fetchOptions`.

- **Signup requires a `name` field.** Supabase's `signUp()` only needs email and password; Neon Auth's `signUp.email()` throws without a `name`. This API's `/auth/signup` route still only requires email and password from the client — it derives a default name from the email address if none is sent, so the public contract matches the brief's spec.

- **The JWT plugin isn't exposed through Neon's managed console.** Supabase's `getUser(token)` is a single call. Neon Auth's dedicated `/token` endpoint (via `authClient.token()`) isn't available on managed projects, and there's no toggle for it under Auth → Plugins. Instead, this API verifies the JWT that's already embedded inside `session.token` — returned from a cookie-based `getSession()` call — against Neon's public JWKS endpoint, using the `jose` library. This is arguably a *more* standard verification pattern (real signature check) than a live network round-trip, and it's the pattern the brief's `/protected/profile` checkpoint (tamper one character → 401) is built to test either way.

- **The session cookie's name and format took direct reverse-engineering.** Neon Auth's actual cookie is `__Secure-neon-auth.session_token`, and its value includes a URL-encoded HMAC signature suffix that isn't documented anywhere obvious. This was found by logging the raw `Set-Cookie` header from a real login response rather than guessing at Better Auth's generic defaults.

- **Logout's actual server-side effect is unverifiable from the client.** `POST /auth/logout` returns `204` and doesn't throw, but there's no way to confirm from outside Neon's dashboard whether the session was actually revoked, or whether the call quietly no-op'd. This is left as an open, honestly-flagged gap rather than a claimed guarantee — and it overlaps with the brief's own optional extra on why "instant logout" is genuinely hard with stateless JWTs.

## Example request

```
curl -i -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

Response:

```
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8

{"token":"...","user":{"name":"test","email":"test@example.com", ...}}
```