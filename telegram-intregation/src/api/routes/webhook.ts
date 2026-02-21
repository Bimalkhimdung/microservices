import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getBot, isRunning, getBotStatus } from "../../telegram/bot.js";
import { config } from "../../config.js";
import { logger as rootLogger } from "../../logger.js";

const log = rootLogger.child({ module: "webhook-route" });

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /telegram/webhook
   * Receives Telegram webhook updates and forwards them to the Grammy bot.
   * Only active when BOT_MODE=webhook.
   */
  if (config.botMode !== "webhook") return;

  app.post(
    "/telegram/webhook",
    {
      config: { rawBody: true },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Validate webhook secret if configured
      if (config.webhookSecret) {
        const secret = request.headers["x-telegram-bot-api-secret-token"];
        if (secret !== config.webhookSecret) {
          log.warn("Webhook secret mismatch");
          return reply.status(403).send({ error: "Forbidden" });
        }
      }

      const bot = getBot();
      if (!bot || !isRunning()) {
        return reply.status(503).send({ error: "Bot not ready" });
      }

      try {
        const update = request.body as Parameters<typeof bot.handleUpdate>[0];
        await bot.handleUpdate(update);
        return reply.status(200).send({ ok: true });
      } catch (err) {
        log.error({ err }, "Webhook update handling failed");
        return reply.status(200).send({ ok: false }); // Always return 200 to Telegram
      }
    }
  );

  log.info("Webhook route registered at POST /telegram/webhook");
}
