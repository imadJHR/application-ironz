// Base de test single-user (un compte ADMIN, mot de passe connu via
// fichier temporaire) pour les tests e2e 0.1.2.
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
const file = dir + "/single-user.db";
fs.rmSync(file, { force: true });
fs.copyFileSync(project + "/desktop/template/ironz.db", file);
const db = new PrismaClient({
  datasources: { db: { url: "file:" + file.replace(/\\/g, "/") } },
});
const derive = promisify(scrypt);
const adminPass = "S1ngl+" + randomBytes(12).toString("base64url") + "!8";
fs.writeFileSync(dir + "/single-pass.txt", adminPass, "utf8");
fs.writeFileSync(dir + "/single-email.txt", "admin@ironz.test", "utf8");
const salt = randomBytes(16).toString("hex");
const key = await derive(adminPass, salt, 64, {
  N: 131072,
  r: 8,
  p: 1,
  maxmem: 256 * 1024 * 1024,
});
const hash = `s2(N=131072;r=8;p=1):${salt}:${key.toString("hex")}`;
await db.$executeRawUnsafe(
  `INSERT INTO "User" ("id","name","email","passwordHash","role","active","createdAt")
   VALUES ('adminsingle','Admin Mises A Jour','admin@ironz.test',?, 'ADMIN',1,'2026-01-01 00:00:00')`,
  hash,
);
const count = await db.$queryRawUnsafe(
  `SELECT COUNT(*) c, (SELECT COUNT(*) FROM "Document" LIMIT 1) d FROM "User"`,
);
await db.$disconnect();
if (count[0].c === 1n) console.log("BASE SINGLE-USER PRETE :", file);
else throw new Error("prep échouée : " + JSON.stringify(count[0].c));
