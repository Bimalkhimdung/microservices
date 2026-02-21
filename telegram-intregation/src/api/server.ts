import Fastify from "fastify";
import { config } from "../config.js";
import { healthRoutes } from "./routes/health.js";
import { botRoutes } from "./routes/bot.js";
import { messageRoutes } from "./routes/message.js";
import { webhookRoutes } from "./routes/webhook.js";
import { logger } from "../logger.js";

export async function createServer() {
  const app = Fastify({ logger: { level: config.logLevel } });

  await app.register(import("@fastify/cors"), { origin: false });

  app.setErrorHandler((error, _req, reply) => {
    logger.error({ err: error }, "Unhandled error");
    void reply.status(error.statusCode ?? 500).send({
      error: error.name,
      message: error.message,
    });
  });

  app.setNotFoundHandler((_req, reply) => {
    void reply.status(404).send({ error: "Not Found" });
  });

  await app.register(healthRoutes);
  await app.register(botRoutes);
  await app.register(messageRoutes);
  await app.register(webhookRoutes);

  return app;
}
