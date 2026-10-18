import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";
// Format versionné : "s2<N=131072;r=8;p=1>:<salt hex>:<key hex>".
// Paramètres OWASP 2024 pour mots de passe interactifs : N=2^15, r=8, p=1.
// Les hashs de la version 1.0.0 (scrypt par défaut, sel 16 octets, clé 64,
// sans préfixe) restent vérifiables : rétro-compatibilité garantie.
const SCRYPT_V2: ScryptOptions = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const DERIVE_BYTES = 64;
function derive(
  password: string,
  salt: string,
  keylen: number,
  options?: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password,
      salt,
      keylen,
      options ?? {},
      (err, key) => (err ? reject(err) : resolve(key)),
    ),
  );
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, DERIVE_BYTES, SCRYPT_V2);
  return `s2(N=131072;r=8;p=1):${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const parts = encoded.split(":");
  if (parts.length < 2) return false;
  let salt = parts[0];
  let key = parts[1];
  let options: ScryptOptions | undefined;
  if (encoded.startsWith("s2(")) {
    if (parts.length < 3) return false;
    const spec = salt.slice(3, -1); // N=131072;r=8;p=1
    const params: Record<string, number> = {};
    for (const part of spec.split(";")) {
      const [k, v] = part.split("=");
      const n = Number(v);
      if (!k || !Number.isFinite(n) || n <= 0) return false;
      params[k] = n;
    }
    if (!params.N || !params.r || !params.p) return false;
    options = { N: params.N, r: params.r, p: params.p, maxmem: 256 * 1024 * 1024 };
    salt = parts[1];
    key = parts[2];
  }
  // Sinon : format 1.0.0 (salt:clé hex, scrypt avec paramètres par défaut Node).
  if (!/^[0-9a-f]{32}$/i.test(salt) || !/^[0-9a-f]+$/i.test(key)) return false;
  let stored: Buffer;
  let derived: Buffer;
  try {
    stored = Buffer.from(key, "hex");
    derived = await derive(password, salt, stored.length, options);
  } catch {
    return false;
  }
  if (stored.length !== derived.length) return false;
  return timingSafeEqual(stored, derived);
}
export function dummyHash() {
  // Structure valide (périmètre d'analyse constant) sans secret réel :
  // la vérification coûte alors le même temps qu'un mot de passe réel, qu'il
  // soit bon ou mauvais (l'analyse se fait sur le même coût de scrypt).
  return `s2(N=131072;r=8;p=1):${"0".repeat(32)}:${"0".repeat(128)}`;
}
