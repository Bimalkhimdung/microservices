import { randomUUID } from "node:crypto";
import {
  makeWASocket,
  fetchLatestBaileysVersion,
  DisconnectReason,
  type WASocket,
  type ConnectionState,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { config } from "../config.js";
import { logger as rootLogger } from "../logger.js";
import {
  loadAuthState,
  clearAuthDir,
  hasCredsSync,
} from "./auth-store.js";
import { generateQrDataUrl, generateQrTerminal } from "./qr.js";

const log = rootLogger.child({ module: "wa-connection" });

export type WaStatus = "disconnected" | "connecting" | "open";

export type WaConnectionState = {
  status: WaStatus;
  jid?: string;
  qrDataUrl?: string;
  qrExpiresAt?: number;
  lastError?: string;
};

type QrCallback = (qrDataUrl: string, expiresAt: number) => void;
type StatusChangeCallback = (state: WaConnectionState) => void;

const QR_TTL_MS = 60_000; // QR codes are valid for ~60 seconds

// ──────────────────────────────────────────────────────────────────────────────
// Singleton state
// ──────────────────────────────────────────────────────────────────────────────
let currentSocket: WASocket | null = null;
let currentState: WaConnectionState = { status: "disconnected" };
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY_MS = 30_000;

const qrListeners: Set<QrCallback> = new Set();
const statusListeners: Set<StatusChangeCallback> = new Set();

function notifyStatus(state: WaConnectionState) {
  currentState = state;
  for (const cb of statusListeners) {
    try {
      cb(state);
    } catch {
      // ignore listener errors
    }
  }
}

function notifyQr(qrDataUrl: string, expiresAt: number) {
  for (const cb of qrListeners) {
    try {
      cb(qrDataUrl, expiresAt);
    } catch {
      // ignore
    }
  }
}

export function onStatusChange(cb: StatusChangeCallback): () => void {
  statusListeners.add(cb);
  return () => statusListeners.delete(cb);
}

export function onQrCode(cb: QrCallback): () => void {
  qrListeners.add(cb);
  return () => qrListeners.delete(cb);
}

export function getConnectionState(): WaConnectionState {
  return { ...currentState };
}

export function isConnected(): boolean {
  return currentState.status === "open";
}

export function getSocket(): WASocket | null {
  return currentSocket;
}

// ──────────────────────────────────────────────────────────────────────────────
// Connect
// ──────────────────────────────────────────────────────────────────────────────
export async function connect(): Promise<void> {
  if (currentSocket) {
    log.debug("Socket already exists, skipping connect");
    return;
  }

  notifyStatus({ status: "connecting" });
  log.info({ authDir: config.authDir }, "Connecting to WhatsApp Web…");

  const { state, saveCreds } = await loadAuthState(config.authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: state.keys,
    },
    printQRInTerminal: false,
    logger: rootLogger.child({ module: "baileys" }) as never,
    browser: ["WhatsApp Integration", "Chrome", "10.0"],
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    markOnlineOnConnect: false,
  });

  currentSocket = sock;

  // ── Creds update ────────────────────────────────────────────────────────────
  sock.ev.on("creds.update", saveCreds);

  // ── Connection state ────────────────────────────────────────────────────────
  sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
    const { connection, lastDisconnect, qr } = update;

    // New QR code received
    if (qr) {
      log.info("QR code received from WhatsApp");
      try {
        const qrDataUrl = await generateQrDataUrl(qr);
        const expiresAt = Date.now() + QR_TTL_MS;
        notifyStatus({
          status: "connecting",
          qrDataUrl,
          qrExpiresAt: expiresAt,
        });
        notifyQr(qrDataUrl, expiresAt);

        // Print QR to terminal for easy dev scanning
        const terminalQr = await generateQrTerminal(qr);
        process.stdout.write(
          `\n\n📱 Scan this QR with WhatsApp → Linked Devices:\n\n${terminalQr}\n` +
          `Or open http://localhost:${config.port}/qr in your browser.\n\n`
        );
      } catch (err) {
        log.error({ err }, "Failed to generate QR");
      }
    }

    if (connection === "open") {
      reconnectAttempts = 0;
      const jid = sock.user?.id;
      log.info({ jid }, "✅ WhatsApp connected");
      notifyStatus({ status: "open", jid });
    }

    if (connection === "close") {
      currentSocket = null;
      const err = lastDisconnect?.error as Boom | undefined;
      const statusCode = err?.output?.statusCode;
      const reason = DisconnectReason;

      log.warn({ statusCode }, "WhatsApp connection closed");

      // Determine if we should reconnect
      if (statusCode === reason.loggedOut) {
        log.warn("WhatsApp logged out — clearing credentials");
        await clearAuthDir(config.authDir);
        notifyStatus({
          status: "disconnected",
          lastError: "Logged out from WhatsApp. Rescan QR to reconnect.",
        });
        return; // Don't reconnect — need fresh QR
      }

      const shouldReconnect =
        statusCode !== reason.connectionReplaced &&
        statusCode !== reason.badSession;

      if (shouldReconnect) {
        scheduleReconnect();
      } else {
        notifyStatus({
          status: "disconnected",
          lastError: `Connection closed: ${statusCode ?? "unknown"}`,
        });
      }
    }
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = Math.min(
    1000 * Math.pow(2, reconnectAttempts),
    MAX_RECONNECT_DELAY_MS
  );
  reconnectAttempts++;
  log.info({ delay, attempt: reconnectAttempts }, "Scheduling reconnect…");
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    notifyStatus({ status: "connecting" });
    try {
      await connect();
    } catch (err) {
      log.error({ err }, "Reconnect failed");
      scheduleReconnect();
    }
  }, delay);
}

// ──────────────────────────────────────────────────────────────────────────────
// Disconnect / Logout
// ──────────────────────────────────────────────────────────────────────────────
export async function disconnect(logout = false): Promise<void> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (!currentSocket) {
    if (logout) await clearAuthDir(config.authDir);
    notifyStatus({ status: "disconnected" });
    return;
  }
  const sock = currentSocket;
  currentSocket = null;
  try {
    if (logout) {
      await sock.logout();
      await clearAuthDir(config.authDir);
      log.info("Logged out and cleared credentials");
    } else {
      sock.ws?.close();
    }
  } catch (err) {
    log.warn({ err }, "Error during disconnect");
  }
  notifyStatus({ status: "disconnected" });
}
