import type { FastifyInstance } from "fastify";
import { apiKeyAuth } from "../middleware.js";
import {
  sendTextMessage,
  sendPhotoMessage,
  sendDocumentMessage,
} from "../../telegram/send.js";

export async function messageRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/send
   * Send a text message to a Telegram chat.
   * Body: { chat_id, text, parse_mode?, reply_to_message_id?, disable_notification? }
   */
  app.post(
    "/api/send",
    {
      preHandler: [apiKeyAuth],
      schema: {
        body: {
          type: "object",
          required: ["chat_id", "text"],
          properties: {
            chat_id: { anyOf: [{ type: "string" }, { type: "number" }] },
            text: { type: "string", minLength: 1 },
            parse_mode: { type: "string", enum: ["HTML", "Markdown", "MarkdownV2"] },
            reply_to_message_id: { type: "number" },
            disable_notification: { type: "boolean" },
            disable_link_preview: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        chat_id: string | number;
        text: string;
        parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
        reply_to_message_id?: number;
        disable_notification?: boolean;
        disable_link_preview?: boolean;
      };

      try {
        const result = await sendTextMessage(body.chat_id, body.text, {
          parseMode: body.parse_mode,
          replyToMessageId: body.reply_to_message_id,
          disableNotification: body.disable_notification,
          disableLinkPreview: body.disable_link_preview,
        });
        return reply.status(200).send({
          success: true,
          message_id: result.messageId,
          chat_id: result.chatId,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("not running")) {
          return reply.status(503).send({ error: "Service unavailable", message });
        }
        return reply.status(500).send({ error: "Send failed", message });
      }
    }
  );

  /**
   * POST /api/send-photo
   * Send a photo URL to a Telegram chat.
   * Body: { chat_id, photo_url, caption? }
   */
  app.post(
    "/api/send-photo",
    {
      preHandler: [apiKeyAuth],
      schema: {
        body: {
          type: "object",
          required: ["chat_id", "photo_url"],
          properties: {
            chat_id: { anyOf: [{ type: "string" }, { type: "number" }] },
            photo_url: { type: "string" },
            caption: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        chat_id: string | number;
        photo_url: string;
        caption?: string;
      };
      try {
        const result = await sendPhotoMessage(body.chat_id, body.photo_url, body.caption);
        return reply.status(200).send({ success: true, message_id: result.messageId, chat_id: result.chatId });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.status(500).send({ error: "Send failed", message });
      }
    }
  );

  /**
   * POST /api/send-document
   * Send a document from a URL to a Telegram chat.
   * Body: { chat_id, file_url, file_name?, caption? }
   */
  app.post(
    "/api/send-document",
    {
      preHandler: [apiKeyAuth],
      schema: {
        body: {
          type: "object",
          required: ["chat_id", "file_url"],
          properties: {
            chat_id: { anyOf: [{ type: "string" }, { type: "number" }] },
            file_url: { type: "string" },
            file_name: { type: "string" },
            caption: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        chat_id: string | number;
        file_url: string;
        file_name?: string;
        caption?: string;
      };
      try {
        const result = await sendDocumentMessage(body.chat_id, body.file_url, {
          fileName: body.file_name,
          caption: body.caption,
        });
        return reply.status(200).send({ success: true, message_id: result.messageId, chat_id: result.chatId });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.status(500).send({ error: "Send failed", message });
      }
    }
  );
}
