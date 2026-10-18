// Base héritée 1.1.0/1.1.1 (SANS table RecoveryCode) + mot de passe connu,
// pour tester la migration runtime et la création de code au premier usage.
import fs from "node:fs";
import path from "node:path";
import { scrypt, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const project = "C:/Users/imadj/Desktop/app-ironz/application-ironz";
const { PrismaClient } = require(
  path.resolve(project + "/src/generated/prisma-desktop/index.js"),
);
const dir = "C:/Users/imadj/AppData/Local/Temp/opencode";
const file = dir + "/legacy-112.db";
fs.rmSync(file, { force: true });
fs.copyFileSync(project + "/desktop/template/ironz.db", file);
const db = new PrismaClient({
  datasources: { db: { url: "file:" + file.replace(/\\/g, "/") } },
});
// La table RecoveryCode du template est supprimée : la base devient
// un "héritage" 1.1.0/1.1.1 fidèle (schema sans recovery).
await db.$executeRawUnsafe('DROP TABLE IF EXISTS "RecoveryCode"');
const derive = promisify(scrypt);
// Mot de passe de fixture généré à chaque préparation de base :
// jamais codé en dur dans le dépôt. Transmis au test E2E via un
// fichier temporaire (base jetable uniquement).
const pass = "Lgcy+" + randomBytes(12).toString("base64url") + "!9";
fs.writeFileSync(dir + "/legacy-pass.txt", pass, "utf8");
const salt = randomBytes(16).toString("hex");
const key = await derive(pass, salt, 64, {
  N: 131072,
  r: 8,
  p: 1,
  maxmem: 256 * 1024 * 1024,
});
const hashLegacy = `s2(N=131072;r=8;p=1):${salt}:${key.toString("hex")}`;
await db.$executeRawUnsafe(
  `INSERT INTO "User" ("id","name","email","passwordHash","role","active","createdAt")
   VALUES ('legacyadmin1','Admin Heritage','heritage@ironz.test',?, 'ADMIN',1,'2026-01-01 00:00:00')`,
  hashLegacy,
);
const tables = await db.$queryRawUnsafe(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='RecoveryCode'",
);
console.log("RecoveryCode absente (base héritée) :", tables.length === 0);
await db.$disconnect();
console.log("BASE HERITEE PRETE :", file);
