import type { FastifyInstance } from "fastify";
import { isRunning } from "../../telegram/bot.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async (_req, reply) => {
    await reply.status(200).send({ status: "ok" });
  });

  app.get("/ready", async (_req, reply) => {
    if (isRunning()) {
      await reply.status(200).send({ status: "ready", bot_running: true });
    } else {
      await reply.status(503).send({ status: "not_ready", bot_running: false });
    }
  });
}
