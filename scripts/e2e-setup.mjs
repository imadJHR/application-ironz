import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

process.loadEnvFile(".env");
const source = new URL(process.env.DATABASE_URL);
if (!/^mongodb(?:\+srv)?:$/.test(source.protocol)) {
  throw new Error("DATABASE_URL doit être une URL MongoDB Atlas.");
}

// E2E may only ever target this dedicated database, never the configured app DB.
const testUrl = new URL(source);
testUrl.pathname = "/ironz_test";
const { PrismaClient } = await import("../src/generated/prisma/index.js");
const testingDb = new PrismaClient({
  datasources: { db: { url: testUrl.toString() } },
});
try {
  await testingDb.$runCommandRaw({ dropDatabase: 1 });
} finally {
  await testingDb.$disconnect();
}

const env = {
  ...process.env,
  DATABASE_URL: testUrl.toString(),
  APP_URL: "http://localhost:3001",
  ADMIN_EMAIL: "test-admin@ironz.invalid",
  ADMIN_PASSWORD: randomBytes(18).toString("base64url"),
  ADMIN_NAME: "Administrateur de test",
  PREVIEW_MODE: "false",
};
writeFileSync(
  ".env.test.local",
  Object.entries(env)
    .filter(([key]) =>
      [
        "DATABASE_URL",
        "APP_URL",
        "ADMIN_EMAIL",
        "ADMIN_PASSWORD",
        "ADMIN_NAME",
        "PREVIEW_MODE",
      ].includes(key),
    )
    .map(([key, value]) => key + '="' + value + '"')
    .join("\n") + "\n",
  { mode: 0o600 },
);

for (const args of [
  ["node_modules/prisma/build/index.js", "db", "push"],
  ["--import", "tsx", "prisma/seed.ts"],
]) {
  const result = spawnSync("node", args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(
  "Base MongoDB de test dédiée prête. Seule la base ironz_test a été réinitialisée.",
);
