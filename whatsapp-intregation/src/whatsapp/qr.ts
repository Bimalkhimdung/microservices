import QRCode from "qrcode";

/**
 * Convert a Baileys QR string to a base64-encoded PNG data URL
 * suitable for embedding in HTML or returning over HTTP.
 */
export async function generateQrDataUrl(qrString: string): Promise<string> {
  const dataUrl = await QRCode.toDataURL(qrString, {
    errorCorrectionLevel: "H",
    margin: 4,
    width: 300,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
  return dataUrl;
}

/**
 * Returns a terminal-friendly QR code string (for dev debugging).
 */
export async function generateQrTerminal(qrString: string): Promise<string> {
  return new Promise((resolve, reject) => {
    QRCode.toString(
      qrString,
      { type: "terminal", small: true },
      (err: Error | null | undefined, str: string) => {
        if (err) reject(err);
        else resolve(str);
      }
    );
  });
}
