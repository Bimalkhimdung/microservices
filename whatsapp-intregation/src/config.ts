import "dotenv/config";
import { z } from "zod";
import path from "node:path";

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  API_KEY: z.string().min(1, "API_KEY must be set"),
  AUTH_DIR: z.string().default("./data/wa-auth"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  WA_ACCOUNT_ID: z.string().default("default"),
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
  authDir: path.resolve(env.AUTH_DIR),
  logLevel: env.LOG_LEVEL,
  accountId: env.WA_ACCOUNT_ID,
} as const;
