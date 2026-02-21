import { createServer } from "./api/server.js";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { connect, disconnect } from "./whatsapp/connection.js";
import { hasCredsSync } from "./whatsapp/auth-store.js";

const log = logger.child({ module: "main" });

async function main() {
  log.info(
    {
      port: config.port,
      authDir: config.authDir,
      logLevel: config.logLevel,
    },
    "🚀 Starting WhatsApp Integration Service"
  );

  // ── Start HTTP server ──────────────────────────────────────────────────────
  const app = await createServer();

  // ── Boot WhatsApp connection ───────────────────────────────────────────────
  log.info(
    { hasCreds: hasCredsSync(config.authDir) },
    "Initiating WhatsApp connection…"
  );
  // Non-blocking: connect runs in the background; QR/status is tracked via events
  connect().catch((err) => {
    log.error({ err }, "Initial WhatsApp connect failed");
  });

  // ── Start listening ────────────────────────────────────────────────────────
  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
    log.info(`✅ Server listening on port ${config.port}`);
  } catch (err) {
    log.fatal({ err }, "Failed to start HTTP server");
    process.exit(1);
  }

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    log.info({ signal }, "Received shutdown signal, gracefully stopping…");
    try {
      await app.close();
      await disconnect(false); // Keep credentials on SIGTERM
      log.info("Shutdown complete");
      process.exit(0);
    } catch (err) {
      log.error({ err }, "Error during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  process.on("uncaughtException", (err) => {
    log.fatal({ err }, "Uncaught exception");
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    log.error({ reason }, "Unhandled promise rejection");
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
