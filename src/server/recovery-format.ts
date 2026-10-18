import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Code de récupération de compte (1.1.2) : 16 octets aléatoires
// (crypto.randomBytes, 128 bits d'entropie minimum), affichés en
// 4 groupes hexadécimaux de 8 caractères séparés par des tirets.
// Seul le hash SHA-256 du code normalisé est stocké : le code lui-même
// ne quitte jamais l'affichage unique où il est présenté.
export const RECOVERY_CODE_REGEX = /^[0-9A-F]{8}(?:-[0-9A-F]{8}){3}$/;

export function normalizeRecoveryCode(raw: string): string {
  return raw.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
}

export function hashRecoveryCode(normalized: string): string {
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function generateRecoveryCode(): { plain: string; hash: string } {
  const hex = randomBytes(16).toString("hex").toUpperCase();
  const plain = hex.replace(/(.{8})(?=.)/g, "$1-");
  return { plain, hash: hashRecoveryCode(hex) };
}

// Comparaison à temps constant des hashs (anti-chronométrage).
export function recoveryHashMatches(computed: string, stored: string): boolean {
  const a = Buffer.from(computed, "utf8");
  const b = Buffer.from(stored, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
