import { existsSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma/index.js";
import { hashPassword } from "../src/server/password";
if (existsSync(".env")) process.loadEnvFile(".env");
const db = new PrismaClient();
async function main() {
 const email = process.env.ADMIN_EMAIL?.trim().toLowerCase(), password = process.env.ADMIN_PASSWORD;
 if (!email || !password || password.length < 12) throw new Error("Définissez ADMIN_EMAIL et ADMIN_PASSWORD (12 caractères minimum).");
 await db.companySettings.upsert({ where: { id: "ironz" }, create: { id: "ironz" }, update: {} });
 await db.user.upsert({ where: { email }, update: {}, create: { email, name: process.env.ADMIN_NAME || "Administrateur IRONZ", role: "ADMIN", passwordHash: await hashPassword(password) } });
 console.log("Profil IRONZ et administrateur initialisés. Aucun exemple commercial n’a été ajouté.");
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());
