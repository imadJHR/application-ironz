// Seed de la base SQLite desktop (template embarqué dans le .exe).
// Exécuté via tsx avec DATABASE_URL + ADMIN_* positionnés par build.mjs.
import { PrismaClient } from "../src/generated/prisma-desktop/index.js";
import { hashPassword } from "../src/server/password";

const db = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12)
    throw new Error(
      "Définissez ADMIN_EMAIL et ADMIN_PASSWORD (12 caractères minimum).",
    );
  await db.companySettings.upsert({
    where: { id: "ironz" },
    create: { id: "ironz" },
    update: {},
  });
  await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: process.env.ADMIN_NAME || "Administrateur IRONZ",
      role: "ADMIN",
      passwordHash: await hashPassword(password),
    },
  });
  console.log("Base desktop initialisée (profil IRONZ + administrateur).");
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
