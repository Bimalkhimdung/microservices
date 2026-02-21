import type { FastifyInstance } from "fastify";
import { apiKeyAuth } from "../middleware.js";
import {
  getBotStatus,
  getBotInfo,
  getLastError,
} from "../../telegram/bot.js";

export async function botRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/status
   * Returns the current bot status and bot info.
   */
  app.get(
    "/api/status",
    { preHandler: [apiKeyAuth] },
    async (_req, reply) => {
      const info = getBotInfo();
      return reply.status(200).send({
        status: getBotStatus(),
        running: getBotStatus() === "running",
        bot: info
          ? {
              id: info.id,
              username: info.username,
              first_name: info.firstName,
            }
          : null,
        last_error: getLastError() ?? null,
      });
    }
  );
}
