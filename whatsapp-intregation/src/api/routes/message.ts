import type { FastifyInstance, FastifyRequest } from "fastify";
import { apiKeyAuth } from "../middleware.js";
import { sendTextMessage, sendMediaMessage } from "../../whatsapp/send.js";

type SendTextBody = {
  to: string;
  text: string;
};

type SendMediaBody = {
  to: string;
  caption?: string;
  image_url?: string;
  document_url?: string;
  file_name?: string;
  mime_type?: string;
};

export async function messageRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/send
   * Send a text message to a WhatsApp number.
   *
   * Body:
   *   { "to": "+977980XXXXXXX", "text": "Hello!" }
   *
   * Response:
   *   { "message_id": "...", "to": "977980XXXXXXX@s.whatsapp.net" }
   */
  app.post(
    "/api/send",
    {
      preHandler: [apiKeyAuth],
      schema: {
        body: {
          type: "object",
          required: ["to", "text"],
          properties: {
            to: { type: "string", minLength: 5 },
            text: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: SendTextBody }>, reply) => {
      const { to, text } = request.body;

      try {
        const result = await sendTextMessage(to, text);
        return reply.status(200).send({
          success: true,
          message_id: result.messageId,
          to: result.to,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("not connected")) {
          return reply.status(503).send({ error: "Service unavailable", message });
        }
        return reply.status(500).send({ error: "Send failed", message });
      }
    }
  );

  /**
   * POST /api/send-media
   * Send an image or document to a WhatsApp number.
   *
   * Body:
   *   {
   *     "to": "+977980XXXXXXX",
   *     "caption": "Optional caption",
   *     "image_url": "https://..."       // for images
   *     // OR
   *     "document_url": "https://...",   // for documents
   *     "file_name": "report.pdf",
   *     "mime_type": "application/pdf"
   *   }
   */
  app.post(
    "/api/send-media",
    {
      preHandler: [apiKeyAuth],
      schema: {
        body: {
          type: "object",
          required: ["to"],
          properties: {
            to: { type: "string", minLength: 5 },
            caption: { type: "string" },
            image_url: { type: "string" },
            document_url: { type: "string" },
            file_name: { type: "string" },
            mime_type: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: SendMediaBody }>, reply) => {
      const { to, caption, image_url, document_url, file_name, mime_type } = request.body;

      if (!image_url && !document_url) {
        return reply.status(400).send({
          error: "Bad request",
          message: "Either image_url or document_url is required",
        });
      }

      try {
        const result = await sendMediaMessage(to, {
          caption,
          imageUrl: image_url,
          documentUrl: document_url,
          fileName: file_name,
          mimeType: mime_type,
        });
        return reply.status(200).send({
          success: true,
          message_id: result.messageId,
          to: result.to,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("not connected")) {
          return reply.status(503).send({ error: "Service unavailable", message });
        }
        return reply.status(500).send({ error: "Send failed", message });
      }
    }
  );
}
