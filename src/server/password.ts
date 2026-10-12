import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await derive(password, salt, 64)) as Buffer;
  return salt + ":" + key.toString("hex");
}
export async function verifyPassword(password: string, encoded: string) {
  const [salt, key] = encoded.split(":");
  if (!salt || !key) return false;
  const derived = (await derive(password, salt, 64)) as Buffer;
  const stored = Buffer.from(key, "hex");
  return stored.length === derived.length && timingSafeEqual(stored, derived);
}
