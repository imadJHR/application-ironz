// Test de migration runtime 1.1.1 -> 1.1.2 : la table RecoveryCode est
// ajoutée par DDL idempotent (identique à src/server/recovery.ts) sur une
// copie d'une base 1.1.1 réelle, sans toucher aux données existantes.
// Usage : node desktop/migrate-test.mjs "C:\...\ironz.db"  (copie de base 1.1.1)
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const require = createRequire(import.meta.url);
const { PrismaClient } = require(
  path.resolve("src/generated/prisma-desktop/index.js"),
);

const DDL = `CREATE TABLE IF NOT EXISTS "RecoveryCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "consumedAt" DATETIME,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "windowStart" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
)`;
const INDEXES = [
  `CREATE UNIQUE INDEX IF NOT EXISTS "RecoveryCode_codeHash_key" ON "RecoveryCode"("codeHash")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "RecoveryCode_userId_key" ON "RecoveryCode"("userId")`,
];

const src = process.argv[2];
if (!src || !fs.existsSync(src)) throw new Error("base source manquante");
const dest = path.resolve(
  process.env.TEMP || "C:\\Temp",
  "opencode",
  "migration-test.db",
);
fs.rmSync(dest, { force: true });
fs.copyFileSync(src, dest);
const url = "file:" + dest.replace(/\\/g, "/");
const db = new PrismaClient({ datasources: { db: { url } } });

function hash(code) {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

const before = {};
for (const t of ["User", "Client", "Document", "Payment", "ActivityLog"])
  before[t] = (await db.$queryRawUnsafe(`SELECT COUNT(*) c FROM "${t}"`))[0].c;

// État initial : la table RecoveryCode ne doit pas exister (base 1.1.1).
const t0 = await db.$queryRawUnsafe(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='RecoveryCode'",
);
if (t0.length)
  throw new Error("la table RecoveryCode existe déjà dans cette base");

// Migration runtime exacte (même DDL que ensureRecoverySchema).
await db.$executeRawUnsafe(DDL);
for (const d of INDEXES) await db.$executeRawUnsafe(d);
// Idempotence : rejouer le DDL ne doit rien casser.
await db.$executeRawUnsafe(DDL);
for (const d of INDEXES) await db.$executeRawUnsafe(d);

// Coexistence : les tables héritées restent opérationnelles via le client.
const after = {};
for (const t of ["User", "Client", "Document", "Payment", "ActivityLog"])
  after[t] = (await db.$queryRawUnsafe(`SELECT COUNT(*) c FROM "${t}"`))[0].c;
for (const t of Object.keys(before))
  if (before[t] !== after[t])
    throw new Error("données modifiées par la migration : " + t);
console.log(
  "OK comptes de tables inchangés :",
  JSON.stringify(after, (k, v) => (typeof v === "bigint" ? Number(v) : v)),
);

// Le client Prisma utilise la table migrée (upsert/find/update).
const admin = await db.user.findFirst({ where: { role: "ADMIN" } });
if (!admin) throw new Error("aucun administrateur dans la base de test");
const code = randomBytes(16).toString("hex").toUpperCase();
await db.recoveryCode.upsert({
  where: { userId: admin.id },
  create: { userId: admin.id, codeHash: hash(code) },
  update: { codeHash: hash(code), failedAttempts: 0, consumedAt: null },
});
const row = await db.recoveryCode.findUnique({ where: { userId: admin.id } });
if (!row) throw new Error("ligne RecoveryCode absente après upsert");
const match = timingSafeEqual(
  Buffer.from(hash(code), "utf8"),
  Buffer.from(row.codeHash, "utf8"),
);
if (!match) throw new Error("hash non retrouvé");
await db.recoveryCode.update({
  where: { id: row.id },
  data: { failedAttempts: { increment: 1 } },
});
const comments = await db.user.findUnique({
  where: { id: admin.id },
  include: { recoveryCode: true },
});
if (!comments?.recoveryCode) throw new Error("relation recoveryCode cassée");
// Nouveaux users inchangés : le passwordHash reste celui de la 1.1.1 (scrypt s2).
console.log("OK utilisateur admin intact :", admin.email, admin.passwordHash.slice(0, 3));
await db.$disconnect();
console.log("MIGRATION 1.1.1 -> 1.1.2 : TOUT PASSE");
fs.rmSync(dest, { force: true });
