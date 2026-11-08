import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  throw new Error(
    "Thiếu hoặc sai định dạng ENCRYPTION_KEY (phải là 64 ký tự Hex)!",
  );
}

const ALGORITHM = "aes-256-gcm";
const keyBuffer = Buffer.from(ENCRYPTION_KEY, "hex");

export class EncryptionService {
  static encrypt(text: string): string {
    if (!text) return text;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  }

  static decrypt(encryptedData: string): string {
    if (!encryptedData || !encryptedData.includes(":")) return encryptedData;

    const [ivHex, authTagHex, encryptedText] = encryptedData.split(":");
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      keyBuffer,
      Buffer.from(ivHex, "hex"),
    );

    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}
