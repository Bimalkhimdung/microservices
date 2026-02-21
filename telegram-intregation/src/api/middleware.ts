import type { FastifyRequest, FastifyReply } from "fastify";
import { config } from "../config.js";

/**
 * API key preHandler for Fastify routes.
 */
export async function apiKeyAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const key = request.headers["x-api-key"];
  if (!key || key !== config.apiKey) {
    await reply.status(401).send({
      error: "Unauthorized",
      message: "Missing or invalid x-api-key header",
    });
  }
}
