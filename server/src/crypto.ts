import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SECRET_PATH = new URL("../data/secret.key", import.meta.url).pathname;

// ponytail: file-based secret-at-rest, not an OS keychain. Fine for a single-user
// localhost tool; move to a keychain if this ever runs on a shared machine.
function loadOrCreateSecret(): Buffer {
  if (existsSync(SECRET_PATH)) return readFileSync(SECRET_PATH);
  mkdirSync(dirname(SECRET_PATH), { recursive: true });
  const key = randomBytes(32);
  writeFileSync(SECRET_PATH, key, { mode: 0o600 });
  return key;
}

const secret = loadOrCreateSecret();

export function encrypt(plaintext: string): { iv: Buffer; tag: Buffer; data: Buffer } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret, iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), data };
}

export function decrypt(iv: Buffer, tag: Buffer, data: Buffer): string {
  const decipher = createDecipheriv("aes-256-gcm", secret, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
