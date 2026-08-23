import { getAuthClient } from "../config/authClient.js";

/**
 * POST /auth/signup
 * Creates the user directly through Neon Auth. Returns 201 with the new
 * user record. If your Neon project requires email verification, no usable
 * session token comes back at this step; the client should verify and then
 * call /auth/login.
 */
export async function signup(req, res) {
  const { email, password, name } = req.body;
  const auth = getAuthClient();

  const { data, error } = await auth.signUp.email({
    email,
    password,
    name: name || email.split("@")[0],
  });

  if (error) {
    // Duplicate email, weak password, and similar issues are client
    // input problems, so they map to 400 like any other bad request.
    return res.status(400).json({ error: error.message });
  }

  return res.status(201).json({
    user: data.user,
    token: data.session?.token ?? null,
  });
}

/**
 * POST /auth/login
 * Verifies credentials against Neon Auth and returns the JWT the client
 * attaches to every future request as "Authorization: Bearer <token>".
 */
export async function login(req, res) {
  const { email, password } = req.body;
  const auth = getAuthClient();

  const { data, error } = await auth.signIn.email({ email, password });

  if (error) {
    return res.status(401).json({ error: error.message });
  }

  return res.status(200).json({
    user: data.user,
    token: data.session.token,
    expiresAt: data.session.expiresAt,
  });
}

/**
 * POST /auth/logout
 * Neon Auth's JWTs are stateless and short lived (15 minutes) with no
 * server-side blocklist reachable from a bearer token alone. This route
 * confirms the caller is holding a currently valid token (reusing the
 * same verifyToken guard as the protected routes) and returns 204. The
 * actual "logout" is the client discarding the token; it stops being
 * usable on its own at expiry regardless.
 */
export async function logout(req, res) {
  return res.status(204).send();
}
