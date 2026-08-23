/**
 * GET /protected/profile
 * Requires a valid token. req.user is the decoded JWT payload set by the
 * verifyToken middleware.
 */
export function profile(req, res) {
  return res.status(200).json({
    message: "Token verified. This is your profile.",
    user: {
      id: req.user.sub,
      email: req.user.email,
      name: req.user.name,
    },
  });
}

/**
 * GET /protected/dashboard
 * A second protected route. It runs behind the exact same verifyToken
 * middleware as /protected/profile, with no extra auth code written for
 * this route. That is the reuse proof: one guard, two routes.
 */
export function dashboard(req, res) {
  return res.status(200).json({
    message: "Token verified. Welcome to your dashboard.",
    user: {
      id: req.user.sub,
      email: req.user.email,
    },
    stats: {
      accessedAt: new Date().toISOString(),
    },
  });
}
