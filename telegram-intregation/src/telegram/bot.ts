import { Bot, type Context } from "grammy";
import { config } from "../config.js";
import { logger as rootLogger } from "../logger.js";

const log = rootLogger.child({ module: "tg-bot" });

export type BotStatus = "stopped" | "starting" | "running" | "error";

type StatusChangeCallback = (status: BotStatus, error?: string) => void;
type MessageCallback = (ctx: Context) => Promise<void> | void;

// ─── Singleton state ──────────────────────────────────────────────────────────
let botInstance: Bot | null = null;
let currentStatus: BotStatus = "stopped";
let botInfo: { id: number; username: string; firstName: string } | null = null;
let lastError: string | null = null;

const statusListeners: Set<StatusChangeCallback> = new Set();
const messageListeners: Set<MessageCallback> = new Set();

function setStatus(status: BotStatus, error?: string) {
  currentStatus = status;
  lastError = error ?? null;
  for (const cb of statusListeners) {
    try { cb(status, error); } catch { /* ignore */ }
  }
}

export function onStatusChange(cb: StatusChangeCallback): () => void {
  statusListeners.add(cb);
  return () => statusListeners.delete(cb);
}

export function onMessage(cb: MessageCallback): () => void {
  messageListeners.add(cb);
  return () => messageListeners.delete(cb);
}

export function getBotStatus(): BotStatus { return currentStatus; }
export function getBotInfo() { return botInfo; }
export function getLastError() { return lastError; }
export function getBot(): Bot | null { return botInstance; }

export function isRunning(): boolean {
  return currentStatus === "running";
}

// ─── Start ────────────────────────────────────────────────────────────────────
export async function startBot(): Promise<void> {
  if (botInstance) {
    log.debug("Bot already running, skipping start");
    return;
  }

  setStatus("starting");
  log.info({ mode: config.botMode }, "Starting Telegram bot…");

  const bot = new Bot(config.botToken);

  // Register message handler — fan out to all listeners
  bot.on("message", async (ctx) => {
    for (const cb of messageListeners) {
      try { await cb(ctx); } catch (err) {
        log.error({ err }, "Message listener error");
      }
    }
  });

  // Log incoming messages in debug mode
  bot.on("message:text", async (ctx) => {
    log.debug(
      { from: ctx.from?.id, text: ctx.message.text?.slice(0, 80) },
      "Incoming Telegram message"
    );
  });

  // Handle errors from Grammy
  bot.catch((err) => {
    log.error({ err: err.message, ctx: err.ctx?.update }, "Grammy error");
  });

  try {
    // Validate token and get bot info
    await bot.api.getMe().then((me) => {
      botInfo = { id: me.id, username: me.username ?? "", firstName: me.first_name };
      log.info({ botId: me.id, username: me.username }, "✅ Bot token validated");
    });

    botInstance = bot;

    if (config.botMode === "webhook" && config.webhookUrl) {
      // Webhook mode — Fastify handles POST /telegram/webhook
      await bot.api.setWebhook(config.webhookUrl, {
        secret_token: config.webhookSecret,
        allowed_updates: [
          "message",
          "callback_query",
          "inline_query",
          "chat_member",
          "my_chat_member",
        ],
        drop_pending_updates: true,
      });
      log.info({ webhookUrl: config.webhookUrl }, "Webhook registered");
      setStatus("running");
    } else {
      // Long-polling mode — no public URL needed
      await bot.api.deleteWebhook({ drop_pending_updates: true });
      // Start polling in background (non-blocking)
      bot.start({
        onStart: () => {
          log.info("🤖 Bot polling started");
          setStatus("running");
        },
        drop_pending_updates: true,
        allowed_updates: ["message", "callback_query"],
      }).catch((err: unknown) => {
        log.error({ err }, "Bot polling error");
        setStatus("error", String(err));
        botInstance = null;
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err }, "Failed to start bot");
    setStatus("error", msg);
    botInstance = null;
    throw err;
  }
}

// ─── Stop ─────────────────────────────────────────────────────────────────────
export async function stopBot(): Promise<void> {
  if (!botInstance) {
    setStatus("stopped");
    return;
  }
  const bot = botInstance;
  botInstance = null;
  log.info("Stopping Telegram bot…");
  try {
    await bot.stop();
  } catch (err) {
    log.warn({ err }, "Error stopping bot cleanly");
  }
  setStatus("stopped");
  log.info("Bot stopped");
}
