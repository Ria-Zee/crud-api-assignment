import { jwtVerify } from "jose";
import { JWKS, NEON_AUTH_ORIGIN } from "../config/jwks.js";

/**
 * verifyToken is the single guard function for this API. Mount it on any
 * route that needs an authenticated caller. It does three things:
 *
 * 1. Pulls the token out of the Authorization header.
 * 2. Verifies its signature against Neon Auth's live JWKS endpoint and
 *    checks the issuer and expiry.
 * 3. Attaches the decoded payload to req.user and calls next().
 *
 * Every failure path returns 401, matching "unauthorized/invalid or
 * expired token" in the spec. Nothing about this function is route
 * specific, so /protected/profile and /protected/dashboard both use it
 * unmodified. That reuse is the proof this middleware works as a guard,
 * not a one-off check bolted onto a single handler.
 */
export async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Missing or malformed Authorization header. Expected: Bearer <token>.",
    });
  }

  const token = authHeader.slice("Bearer ".length).trim();

  if (!token) {
    return res.status(401).json({ error: "No token provided." });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: NEON_AUTH_ORIGIN,
    });

    req.user = payload;
    return next();
  } catch (err) {
    // jose throws distinct error codes for expiry vs. bad signature vs.
    // bad claims. All of them mean the same thing to the caller: the
    // token is not good enough to proceed, hence one 401 for all of them.
    return res.status(401).json({
      error: "Invalid or expired token.",
      reason: err.code ?? err.message,
    });
  }
}
