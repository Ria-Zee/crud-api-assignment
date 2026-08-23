/**
 * GET /public/info
 * No token required. Confirms the API is up and describes itself.
 */
export function info(req, res) {
  return res.status(200).json({
    name: "neon-auth-api",
    status: "ok",
    auth: "Neon Auth (Managed Better Auth)",
    protectedRoutes: ["/protected/profile", "/protected/dashboard"],
  });
}
