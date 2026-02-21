import type { FastifyInstance, FastifyRequest } from "fastify";
import { apiKeyAuth } from "../middleware.js";
import {
  getConnectionState,
  connect,
  disconnect,
} from "../../whatsapp/connection.js";
import { hasCredsSync } from "../../whatsapp/auth-store.js";
import { config } from "../../config.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/status
   * Returns the current WhatsApp connection status.
   */
  app.get(
    "/api/status",
    { preHandler: [apiKeyAuth] },
    async (_request, reply) => {
      const state = getConnectionState();
      return reply.status(200).send({
        status: state.status,
        connected: state.status === "open",
        jid: state.jid ?? null,
        last_error: state.lastError ?? null,
      });
    }
  );

  /**
   * GET /api/qr
   * Initiates a login (if not connected) and returns a QR code as a data URL.
   * If already connected, returns `{ already_linked: true }`.
   */
  app.get(
    "/api/qr",
    { preHandler: [apiKeyAuth] },
    async (_request, reply) => {
      const state = getConnectionState();

      // Already connected
      if (state.status === "open") {
        return reply.status(200).send({
          already_linked: true,
          jid: state.jid ?? null,
          message: "WhatsApp is already connected.",
        });
      }

      // We have a fresh QR code pending
      if (
        state.qrDataUrl &&
        state.qrExpiresAt &&
        state.qrExpiresAt > Date.now()
      ) {
        return reply.status(200).send({
          already_linked: false,
          qr_data_url: state.qrDataUrl,
          expires_at: state.qrExpiresAt,
          message: "Scan this QR code with WhatsApp → Linked Devices.",
        });
      }

      // Kick off a connection, QR will be pushed to state via events
      // We wait briefly for a QR to appear
      const QR_WAIT_MS = 15_000;
      const deadline = Date.now() + QR_WAIT_MS;

      // Trigger connect (if not already connecting)
      if (state.status === "disconnected") {
        connect().catch(() => {
          // errors are handled inside connect()
        });
      }

      // Poll for QR
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 500));
        const current = getConnectionState();
        if (current.status === "open") {
          return reply.status(200).send({
            already_linked: true,
            jid: current.jid ?? null,
            message: "WhatsApp connected during QR wait.",
          });
        }
        if (
          current.qrDataUrl &&
          current.qrExpiresAt &&
          current.qrExpiresAt > Date.now()
        ) {
          return reply.status(200).send({
            already_linked: false,
            qr_data_url: current.qrDataUrl,
            expires_at: current.qrExpiresAt,
            message: "Scan this QR code with WhatsApp → Linked Devices.",
          });
        }
      }

      return reply.status(504).send({
        error: "QR timeout",
        message: "Timed out waiting for WhatsApp QR code. Try again.",
      });
    }
  );

  /**
   * POST /api/logout
   * Disconnects WhatsApp and clears saved credentials.
   * Body: { clear_session?: boolean }  (default true)
   */
  app.post(
    "/api/logout",
    { preHandler: [apiKeyAuth] },
    async (request, reply) => {
      const body = request.body as { clear_session?: boolean } | undefined;
      const clearSession = body?.clear_session !== false;
      await disconnect(clearSession);
      return reply.status(200).send({
        success: true,
        message: clearSession
          ? "Logged out and credentials cleared."
          : "Disconnected (credentials kept).",
      });
    }
  );

  /**
   * POST /api/connect
   * Manually triggers a (re)connect attempt.
   */
  app.post(
    "/api/connect",
    { preHandler: [apiKeyAuth] },
    async (_request, reply) => {
      const state = getConnectionState();
      if (state.status === "open") {
        return reply.status(200).send({
          message: "Already connected.",
          status: state.status,
        });
      }
      // If there are saved creds we'll reconnect; otherwise QR will appear
      await connect();
      return reply.status(200).send({
        message: "Connection initiated. Check /api/status or /api/qr.",
        has_credentials: hasCredsSync(config.authDir),
      });
    }
  );
}
