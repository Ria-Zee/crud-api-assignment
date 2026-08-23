import { Router } from "express";
import { signup, login, logout } from "../controllers/auth.controller.js";
import { validateCredentials } from "../utils/validate.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = Router();

/**
 * @openapi
 * /auth/signup:
 *   post:
 *     summary: Create a new account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: zee@example.com
 *               password:
 *                 type: string
 *                 example: SuperSecret123!
 *               name:
 *                 type: string
 *                 example: Zee
 *     responses:
 *       201:
 *         description: Account created
 *       400:
 *         description: Missing or empty email/password, or Neon Auth rejected the input
 */
router.post("/signup", validateCredentials, signup);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Log in and receive a JWT
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: zee@example.com
 *               password:
 *                 type: string
 *                 example: SuperSecret123!
 *     responses:
 *       200:
 *         description: Login successful, token returned
 *       400:
 *         description: Missing or empty email/password
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", validateCredentials, login);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Log out the current session
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Logged out, no content
 *       401:
 *         description: Missing, invalid, or expired token
 */
router.post("/logout", verifyToken, logout);

export default router;
