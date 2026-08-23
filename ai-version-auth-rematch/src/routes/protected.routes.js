import { Router } from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { profile, dashboard } from "../controllers/protected.controller.js";

const router = Router();

// Every route in this file needs a valid token. Applying the guard at the
// router level, instead of repeating it on each route, is the reuse proof:
// one middleware call covers both handlers below with zero extra auth code.
router.use(verifyToken);

/**
 * @openapi
 * /protected/profile:
 *   get:
 *     summary: Get the current user's profile
 *     tags: [Protected]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile returned
 *       401:
 *         description: Missing, invalid, or expired token
 */
router.get("/profile", profile);

/**
 * @openapi
 * /protected/dashboard:
 *   get:
 *     summary: Get dashboard data (second route reusing the same guard)
 *     tags: [Protected]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data returned
 *       401:
 *         description: Missing, invalid, or expired token
 */
router.get("/dashboard", dashboard);

export default router;
