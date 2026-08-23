import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger.js";
import authRoutes from "./routes/auth.routes.js";
import publicRoutes from "./routes/public.routes.js";
import protectedRoutes from "./routes/protected.routes.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/auth", authRoutes);
app.use("/public", publicRoutes);
app.use("/protected", protectedRoutes);

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Neon Auth API is running. See /api-docs for the full spec.",
  });
});

// Unknown route.
app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

// Last-resort error handler. Anything an async handler throws that wasn't
// already caught lands here instead of crashing the process.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

export default app;
