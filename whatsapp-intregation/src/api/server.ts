import Fastify from "fastify";
import { logger } from "../logger.js";
import { config } from "../config.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { messageRoutes } from "./routes/message.js";

export async function createServer() {
  const app = Fastify({
    logger: {
      level: config.logLevel,
    },
    // Return validation errors as proper JSON
    ajv: {
      customOptions: {
        removeAdditional: true,
        coerceTypes: true,
      },
    },
  });

  // ── CORS ────────────────────────────────────────────────────────────────────
  await app.register(import("@fastify/cors"), {
    origin: process.env.CORS_ORIGIN ?? false,
  });

  // ── Error handler ───────────────────────────────────────────────────────────
  app.setErrorHandler((error, _request, reply) => {
    logger.error({ err: error }, "Unhandled error");
    if (error.statusCode) {
      void reply.status(error.statusCode).send({
        error: error.name,
        message: error.message,
      });
    } else {
      void reply.status(500).send({
        error: "Internal Server Error",
        message: error.message,
      });
    }
  });

  // ── Not found ───────────────────────────────────────────────────────────────
  app.setNotFoundHandler((_request, reply) => {
    void reply.status(404).send({ error: "Not Found" });
  });

  // ── Routes ──────────────────────────────────────────────────────────────────
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(messageRoutes);

  return app;
}
