import { randomUUID } from "node:crypto";
import { logger as rootLogger } from "../logger.js";
import { getSocket, isConnected } from "./connection.js";

const log = rootLogger.child({ module: "wa-send" });

/**
 * Convert an E.164 phone number to WhatsApp JID format.
 * "+977980XXXXXXX" → "977980XXXXXXX@s.whatsapp.net"
 */
export function toWhatsAppJid(phone: string): string {
  const normalized = phone.replace(/^\+/, "").replace(/\s+/g, "");
  if (normalized.includes("@")) {
    return normalized; // Already a JID
  }
  return `${normalized}@s.whatsapp.net`;
}

export type SendTextResult = {
  messageId: string;
  to: string;
};

export async function sendTextMessage(
  to: string,
  text: string
): Promise<SendTextResult> {
  const sock = getSocket();
  if (!sock || !isConnected()) {
    throw new Error("WhatsApp is not connected. Scan the QR code first.");
  }

  const jid = toWhatsAppJid(to);
  const messageId = randomUUID();

  log.info({ jid, messageId }, "Sending text message");

  try {
    await sock.presenceSubscribe(jid);
    await sock.sendPresenceUpdate("composing", jid);

    const result = await sock.sendMessage(jid, { text });

    await sock.sendPresenceUpdate("paused", jid);

    const sentId = result?.key?.id ?? messageId;
    log.info({ jid, messageId: sentId }, "✅ Message sent");
    return { messageId: sentId, to: jid };
  } catch (err) {
    log.error({ jid, err }, "Failed to send message");
    throw new Error(`Failed to send message: ${String(err)}`);
  }
}

export type SendMediaResult = {
  messageId: string;
  to: string;
};

export async function sendMediaMessage(
  to: string,
  options: {
    caption?: string;
    imageUrl?: string;
    documentUrl?: string;
    fileName?: string;
    mimeType?: string;
  }
): Promise<SendMediaResult> {
  const sock = getSocket();
  if (!sock || !isConnected()) {
    throw new Error("WhatsApp is not connected. Scan the QR code first.");
  }
  const jid = toWhatsAppJid(to);
  const messageId = randomUUID();

  log.info({ jid, messageId }, "Sending media message");

  let result;
  if (options.imageUrl) {
    result = await sock.sendMessage(jid, {
      image: { url: options.imageUrl },
      caption: options.caption ?? "",
    });
  } else if (options.documentUrl) {
    result = await sock.sendMessage(jid, {
      document: { url: options.documentUrl },
      caption: options.caption ?? "",
      fileName: options.fileName ?? "document",
      mimetype: options.mimeType ?? "application/octet-stream",
    });
  } else {
    throw new Error("Either imageUrl or documentUrl must be provided");
  }

  const sentId = result?.key?.id ?? messageId;
  log.info({ jid, messageId: sentId }, "✅ Media message sent");
  return { messageId: sentId, to: jid };
}
