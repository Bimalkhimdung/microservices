import type { FastifyInstance } from "fastify";
import { isConnected } from "../../whatsapp/connection.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /health — Liveness probe (always 200 if service is up)
   */
  app.get("/health", async (_request, reply) => {
    await reply.status(200).send({ status: "ok" });
  });

  /**
   * GET /ready — Readiness probe (200 only if WhatsApp socket is connected)
   */
  app.get("/ready", async (_request, reply) => {
    if (isConnected()) {
      await reply.status(200).send({ status: "ready", connected: true });
    } else {
      await reply.status(503).send({ status: "not_ready", connected: false });
    }
  });
}
