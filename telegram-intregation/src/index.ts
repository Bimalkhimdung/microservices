import { createServer } from "./api/server.js";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { startBot, stopBot } from "./telegram/bot.js";

const log = logger.child({ module: "main" });

async function main() {
  log.info({ port: config.port, mode: config.botMode }, "🚀 Starting Telegram Integration Service");

  const app = await createServer();

  // Start the Grammy bot (non-blocking)
  startBot().catch((err) => {
    log.error({ err }, "Failed to start Telegram bot — check TELEGRAM_BOT_TOKEN");
  });

  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
    log.info(`✅ Server listening on port ${config.port}`);
  } catch (err) {
    log.fatal({ err }, "Failed to start HTTP server");
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    log.info({ signal }, "Shutting down…");
    try {
      await app.close();
      await stopBot();
      log.info("Shutdown complete");
      process.exit(0);
    } catch (err) {
      log.error({ err }, "Shutdown error");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("uncaughtException", (err) => { log.fatal({ err }, "Uncaught exception"); process.exit(1); });
  process.on("unhandledRejection", (reason) => { log.error({ reason }, "Unhandled rejection"); });
}

main().catch((err) => { console.error("Fatal startup error:", err); process.exit(1); });
