import "server-only";
import { db } from "./db";
import {
  generateRecoveryCode,
  hashRecoveryCode,
  normalizeRecoveryCode,
  recoveryHashMatches,
} from "./recovery-format";

export {
  generateRecoveryCode,
  hashRecoveryCode,
  normalizeRecoveryCode,
  recoveryHashMatches,
};

// Migration runtime (1.1.2) : la table RecoveryCode est ajoutée aux bases
// héritées (1.0.0, 1.1.0, 1.1.1) et aux sauvegardes antérieures à la 1.1.2
// restaurées après coup. CREATE TABLE IF NOT EXISTS : les tables existantes
// ne sont jamais modifiées, aucune donnée utilisateur n'est touchée.
// Le DDL est celui produit par `prisma db push` (template 1.1.2) — les deux
// sources de vérité restent identiques.
export const recoverySchemaStatements = [
  `CREATE TABLE IF NOT EXISTS "RecoveryCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "consumedAt" DATETIME,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "windowStart" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "RecoveryCode_codeHash_key" ON "RecoveryCode"("codeHash")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "RecoveryCode_userId_key" ON "RecoveryCode"("userId")`,
];

type RawSurface = {
  $executeRawUnsafe: (query: string) => Promise<unknown>;
};
const raw = (client: unknown): RawSurface => client as RawSurface;

const globalSchema = globalThis as unknown as {
  __ironzRecoverySchema?: Promise<void>;
};
// Réservé à la version desktop (SQLite) ; la version web (Atlas) ne propose
// jamais de récupération par code — ses bases ne créent jamais la table.
export function ensureRecoverySchema(): Promise<void> {
  if (!globalSchema.__ironzRecoverySchema) {
    const run = async () => {
      if (process.env.IRONZ_SQLITE !== "1") return;
      for (const ddl of recoverySchemaStatements)
        await raw(db).$executeRawUnsafe(ddl);
    };
    globalSchema.__ironzRecoverySchema = run().catch((e) => {
      globalSchema.__ironzRecoverySchema = undefined;
      throw e;
    });
  }
  return globalSchema.__ironzRecoverySchema;
}

// Tentatives de saisie erronée admites par code avant blocage durable.
export const RECOVERY_MAX_FAILED_ATTEMPTS = 5;
export const RECOVERY_WINDOW_MS = 15 * 60 * 1000;
export const RECOVERY_WINDOW_ATTEMPTS = 10;

export async function verifyRecoveryCodeInput(
  userId: string,
  rawCode: string,
): Promise<{ ok: boolean; blocked: boolean; codeId?: string }> {
  const code = await db.recoveryCode.findUnique({ where: { userId } });
  if (!code || code.consumedAt) return { ok: false, blocked: false };
  if (code.failedAttempts >= RECOVERY_MAX_FAILED_ATTEMPTS)
    return { ok: false, blocked: true };
  const hash = hashRecoveryCode(normalizeRecoveryCode(rawCode));
  if (!recoveryHashMatches(hash, code.codeHash))
    return { ok: false, blocked: false, codeId: code.id };
  return { ok: true, blocked: false, codeId: code.id };
}
