import { InputFile } from "grammy";
import { getBot, isRunning } from "./bot.js";
import { logger as rootLogger } from "../logger.js";

const log = rootLogger.child({ module: "tg-send" });

export type SendTextResult = {
  messageId: number;
  chatId: string | number;
};

export type SendMediaResult = {
  messageId: number;
  chatId: string | number;
};

/**
 * Send a plain text message to a Telegram chat.
 * `chatId` can be a numeric ID, @username, or group/channel ID.
 */
export async function sendTextMessage(
  chatId: string | number,
  text: string,
  options?: {
    parseMode?: "HTML" | "Markdown" | "MarkdownV2";
    replyToMessageId?: number;
    disableNotification?: boolean;
    disableLinkPreview?: boolean;
  }
): Promise<SendTextResult> {
  const bot = getBot();
  if (!bot || !isRunning()) {
    throw new Error("Telegram bot is not running. Check BOT_TOKEN and service status.");
  }

  log.info({ chatId, textLen: text.length }, "Sending text message");
  try {
    const msg = await bot.api.sendMessage(chatId, text, {
      parse_mode: options?.parseMode,
      reply_parameters: options?.replyToMessageId
        ? { message_id: options.replyToMessageId }
        : undefined,
      disable_notification: options?.disableNotification,
      link_preview_options: options?.disableLinkPreview
        ? { is_disabled: true }
        : undefined,
    });
    log.info({ chatId, messageId: msg.message_id }, "✅ Message sent");
    return { messageId: msg.message_id, chatId };
  } catch (err) {
    log.error({ chatId, err }, "Failed to send message");
    throw new Error(`Telegram send failed: ${String(err)}`);
  }
}

/**
 * Send a photo from a URL to a Telegram chat.
 */
export async function sendPhotoMessage(
  chatId: string | number,
  photoUrl: string,
  caption?: string
): Promise<SendMediaResult> {
  const bot = getBot();
  if (!bot || !isRunning()) {
    throw new Error("Telegram bot is not running.");
  }
  log.info({ chatId, photoUrl }, "Sending photo");
  const msg = await bot.api.sendPhoto(chatId, photoUrl, {
    caption: caption ?? "",
  });
  return { messageId: msg.message_id, chatId };
}

/**
 * Send a document (file) from a URL to a Telegram chat.
 */
export async function sendDocumentMessage(
  chatId: string | number,
  fileUrl: string,
  options?: { caption?: string; fileName?: string }
): Promise<SendMediaResult> {
  const bot = getBot();
  if (!bot || !isRunning()) {
    throw new Error("Telegram bot is not running.");
  }
  log.info({ chatId, fileUrl }, "Sending document");
  const msg = await bot.api.sendDocument(
    chatId,
    new InputFile({ url: fileUrl }, options?.fileName),
    { caption: options?.caption }
  );
  return { messageId: msg.message_id, chatId };
}

/**
 * Forward a message from one chat to another.
 */
export async function forwardMessage(
  toChatId: string | number,
  fromChatId: string | number,
  messageId: number
): Promise<SendTextResult> {
  const bot = getBot();
  if (!bot || !isRunning()) throw new Error("Bot not running.");
  const msg = await bot.api.forwardMessage(toChatId, fromChatId, messageId);
  return { messageId: msg.message_id, chatId: toChatId };
}
