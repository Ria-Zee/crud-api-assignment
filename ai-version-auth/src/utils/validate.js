/**
 * validateCredentials checks that email and password are present and not
 * just whitespace. Used by both signup and login so the 400 rule ("missing
 * or empty email/password") is enforced in exactly one place.
 */
export function validateCredentials(req, res, next) {
  const { email, password } = req.body ?? {};

  const missing = [];
  if (!email || !String(email).trim()) missing.push("email");
  if (!password || !String(password).trim()) missing.push("password");

  if (missing.length > 0) {
    return res.status(400).json({
      error: `Missing or empty field(s): ${missing.join(", ")}.`,
    });
  }

  return next();
}
