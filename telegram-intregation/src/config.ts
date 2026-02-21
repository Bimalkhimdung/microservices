import "dotenv/config";
import { z } from "zod";
import path from "node:path";

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  API_KEY: z.string().min(1, "API_KEY must be set"),
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN must be set"),
  TELEGRAM_ALLOWED_USER_IDS: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : []
    ),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  BOT_MODE: z.enum(["polling", "webhook"]).default("polling"),
  WEBHOOK_URL: z.string().url().optional(),
  WEBHOOK_SECRET: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  console.error(parsed.error.format());
  process.exit(1);
}

const env = parsed.data;

export const config = {
  port: env.PORT,
  apiKey: env.API_KEY,
  botToken: env.TELEGRAM_BOT_TOKEN,
  allowedUserIds: env.TELEGRAM_ALLOWED_USER_IDS,
  logLevel: env.LOG_LEVEL,
  botMode: env.BOT_MODE,
  webhookUrl: env.WEBHOOK_URL,
  webhookSecret: env.WEBHOOK_SECRET,
} as const;
