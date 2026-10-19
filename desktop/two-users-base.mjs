// Base multi-comptes héritée : admin + commercial (COMMERCIAL = compte
// hérité d'une installation d'essai) avec historique réel : client,
// facture, paiement, journal. Sert au test du panneau de conflit 0.1.1.
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
const file = dir + "/two-users.db";
fs.rmSync(file, { force: true });
fs.copyFileSync(project + "/desktop/template/ironz.db", file);
const db = new PrismaClient({
  datasources: { db: { url: "file:" + file.replace(/\\/g, "/") } },
});
const derive = promisify(scrypt);
// Mots de passe de fixture générés à chaque préparation : jamais codés
// en dur dans le dépôt. Transmis via fichiers temporaires.
const adminPass = "Ad2u+" + randomBytes(12).toString("base64url") + "!7";
const extraPass = "Cm2r+" + randomBytes(12).toString("base64url") + "!3";
fs.writeFileSync(dir + "/two-users-admin-pass.txt", adminPass, "utf8");
fs.writeFileSync(dir + "/two-users-extra-pass.txt", extraPass, "utf8");
fs.writeFileSync(
  dir + "/two-users-extra-email.txt",
  "commercial@ironz.test",
  "utf8",
);
const hash = async (pass) => {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(pass, salt, 64, {
    N: 131072,
    r: 8,
    p: 1,
    maxmem: 256 * 1024 * 1024,
  });
  return `s2(N=131072;r=8;p=1):${salt}:${key.toString("hex")}`;
};
await db.$executeRawUnsafe(
  `INSERT INTO "User" ("id","name","email","passwordHash","role","active","createdAt")
   VALUES ('adminbase1','Admin Deux Comptes','admin@ironz.test',?, 'ADMIN',1,'2026-01-01 00:00:00')`,
  await hash(adminPass),
);
await db.$executeRawUnsafe(
  `INSERT INTO "User" ("id","name","email","passwordHash","role","active","createdAt")
   VALUES ('commercial1','Slimane Commercial','commercial@ironz.test',?, 'COMMERCIAL',1,'2026-02-01 00:00:00')`,
  await hash(extraPass),
);
await db.$executeRawUnsafe(
  `INSERT INTO "Client" ("id","name","createdAt","updatedAt")
   VALUES ('clientx1','Client Hérité SARL','2026-02-02 00:00:00','2026-02-02 00:00:00')`,
);
await db.$executeRawUnsafe(
  `INSERT INTO "Document" ("id","kind","number","date","status","clientId","clientSnapshot","companySnapshot","createdById","subtotal","discount","totalHT","totalTax","totalTTC","createdAt","updatedAt")
   VALUES ('facturex1','INVOICE','FA-2026-0001','2026-02-03 00:00:00','ISSUED','clientx1','{}','{}','commercial1','1000','0','1000','200','1200','2026-02-03 00:00:00','2026-02-03 00:00:00')`,
);
await db.$executeRawUnsafe(
  `INSERT INTO "Payment" ("id","idempotencyKey","number","clientId","invoiceId","date","amount","method","createdById","createdAt")
   VALUES ('paiementx1','idem-x-1','PA-2026-0001','clientx1','facturex1','2026-02-05 00:00:00','600','Virement','commercial1','2026-02-05 00:00:00')`,
);
await db.$executeRawUnsafe(
  `INSERT INTO "ActivityLog" ("id","userId","action","entityType","entityId","createdAt")
   VALUES ('journalx1','commercial1','Facture créée','document','facturex1','2026-02-03 00:00:00')`,
);
const counts = await db.$queryRawUnsafe(
  `SELECT (SELECT COUNT(*) FROM "User") AS u,
          (SELECT COUNT(*) FROM "Document") AS d,
          (SELECT COUNT(*) FROM "Payment") AS p,
          (SELECT COUNT(*) FROM "ActivityLog") AS a`,
);
await db.$disconnect();
const ok =
  counts[0].u === 2n && counts[0].d === 1n && counts[0].p === 1n && counts[0].a === 1n;
if (!ok)
  throw new Error(
    "base deux-comptes incohérente : " +
      String(counts[0].u) + "/" + String(counts[0].d) + "/" +
      String(counts[0].p) + "/" + String(counts[0].a),
  );
console.log(
  "BASE DEUX COMPTES PRETE :", file,
  String(counts[0].u) + "/" + String(counts[0].d) + "/" +
  String(counts[0].p) + "/" + String(counts[0].a),
);
