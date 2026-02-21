import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { useMultiFileAuthState, makeCacheableSignalKeyStore } from "@whiskeysockets/baileys";
import type { AuthenticationState } from "@whiskeysockets/baileys";
import { logger as rootLogger } from "../logger.js";

const log = rootLogger.child({ module: "auth-store" });

export function resolveCredsPath(authDir: string): string {
  return path.join(authDir, "creds.json");
}

export function resolveCredsBackupPath(authDir: string): string {
  return path.join(authDir, "creds.json.bak");
}

export function hasCredsSync(authDir: string): boolean {
  try {
    const stats = fsSync.statSync(resolveCredsPath(authDir));
    return stats.isFile() && stats.size > 1;
  } catch {
    return false;
  }
}

export async function ensureAuthDir(authDir: string): Promise<void> {
  await fs.mkdir(authDir, { recursive: true });
  try {
    await fs.chmod(authDir, 0o700);
  } catch {
    // best-effort on platforms without chmod support
  }
}

export async function clearAuthDir(authDir: string): Promise<void> {
  try {
    const entries = await fs.readdir(authDir);
    await Promise.all(
      entries.map((entry) =>
        fs.rm(path.join(authDir, entry), { recursive: true, force: true })
      )
    );
    log.info({ authDir }, "Auth directory cleared");
  } catch {
    // Already empty or does not exist
  }
}

/** Back up creds.json before saving to avoid corruption on abrupt restarts */
async function backupCreds(authDir: string): Promise<void> {
  const src = resolveCredsPath(authDir);
  const dst = resolveCredsBackupPath(authDir);
  try {
    const raw = fsSync.readFileSync(src, "utf-8");
    JSON.parse(raw); // Validate JSON before backup
    fsSync.copyFileSync(src, dst);
    try {
      fsSync.chmodSync(dst, 0o600);
    } catch {
      // ignore
    }
  } catch {
    // keep existing backup on invalid JSON
  }
}

export async function loadAuthState(
  authDir: string
): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  await ensureAuthDir(authDir);

  // Try to restore from backup if creds.json is corrupt
  const credsPath = resolveCredsPath(authDir);
  const backupPath = resolveCredsBackupPath(authDir);
  try {
    if (fsSync.existsSync(credsPath)) {
      const raw = fsSync.readFileSync(credsPath, "utf-8");
      JSON.parse(raw);
    }
  } catch {
    log.warn({ authDir }, "creds.json appears corrupted, restoring from backup");
    try {
      fsSync.copyFileSync(backupPath, credsPath);
    } catch {
      // no backup available
    }
  }

  const { state, saveCreds: rawSave } = await useMultiFileAuthState(authDir);

  // Wrap saveCreds to also create a backup
  const saveCreds = async () => {
    await backupCreds(authDir);
    await rawSave();
    try {
      fsSync.chmodSync(resolveCredsPath(authDir), 0o600);
    } catch {
      // best-effort
    }
  };

  return { state, saveCreds };
}

export function makeSignalKeyStore(state: AuthenticationState): ReturnType<typeof makeCacheableSignalKeyStore> {
  return makeCacheableSignalKeyStore(state.keys, rootLogger as never);
}
