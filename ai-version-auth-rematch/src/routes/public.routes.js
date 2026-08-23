import { Router } from "express";
import { info } from "../controllers/public.controller.js";

const router = Router();

/**
 * @openapi
 * /public/info:
 *   get:
 *     summary: Public API info, no token required
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: API metadata
 */
router.get("/info", info);

export default router;
