import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { PrismaClient } from "@/generated/prisma";

// Chemin du fichier SQLite courant (DATABASE_URL = file:<chemin>).
// Le chemin est déterminé par le serveur lui-même : jamais de chemin
// utilisateur arbitraire côté serveur.
export function databaseFile(): string {
  const url = process.env.DATABASE_URL || "";
  if (!url.startsWith("file:"))
    throw new Error("Base de données locale introuvable.");
  const file = url.slice("file:".length);
  return path.normalize(file.replace(/\\/g, "/"));
}
function urlFor(file: string) {
  return "file:" + file.replace(/\\/g, "/");
}
// Surface brute SQL : les méthodes $*Raw existent dans le client SQLite
// (bundle desktop) mais pas dans le client Mongo (arbre web, typage build).
// Le double appel est façonné par cast — la vérification de schéma valide
// les tables cœur, si un mélange de bases se produit.
type RawSurface = {
  $queryRawUnsafe: <T>(query: string, ...params: unknown[]) => Promise<T>;
  $executeRawUnsafe: (query: string) => Promise<unknown>;
  $disconnect: () => Promise<void>;
};
const raw = (client: unknown): RawSurface =>
  client as RawSurface;
async function diskClient(file: string) {
  const Ctor = PrismaClient as unknown as new (opts: {
    datasourceUrl: string;
  }) => PrismaClient;
  return new Ctor({ datasourceUrl: urlFor(file) });
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function retry(unit: () => void, label: string, times = 8): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      unit();
      return;
    } catch (e) {
      if (i >= times)
        throw new Error(
          `${label} impossible : ${e instanceof Error ? e.message : "erreur inconnue"}`,
        );
      await wait(250);
    }
  }
}
async function retryOrFalse(unit: () => void, times = 8): Promise<boolean> {
  try {
    await retry(unit, "opération", times);
    return true;
  } catch {
    return false;
  }
}
// Tables cœur attendues d'un schéma IRONZ compatible (schéma SQLite 1.0+).
const CORE_TABLES = [
  "User",
  "Session",
  "LoginAttempt",
  "Client",
  "Product",
  "CompanySettings",
  "DocumentSequence",
  "Document",
  "DocumentItem",
  "Payment",
  "ActivityLog",
];
function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(
    d.getHours(),
  )}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
// Intégrité d'un fichier SQLite par une connexion dédiée fermée à la fin.
export async function integrityCheck(file: string): Promise<string> {
  const client = await diskClient(file);
  try {
    const rows = await raw(client).$queryRawUnsafe<{ integrity_check: string }[]>(
      "PRAGMA integrity_check",
    );
    return rows?.[0]?.integrity_check || "unknown";
  } finally {
    await client.$disconnect();
  }
}
async function coreTablesPresent(file: string): Promise<string[]> {
  const client = await diskClient(file);
  try {
    const rows = await raw(client).$queryRawUnsafe<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table'",
    );
    return CORE_TABLES.filter((t) => !rows?.some((r) => r.name === t));
  } finally {
    await client.$disconnect();
  }
}
// Checkpoint WAL de la base vivante : le fichier principal devient
// cohérent par lui-même, une simple copie est fiable.
export async function checkpoint() {
  try {
    await raw(db).$executeRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)");
  } catch {
    // WAL non utilisé (journal DELETE) : rien à faire.
  }
}
export const isSqliteFile = (bytes: Uint8Array) =>
  bytes.length > 16 &&
  Buffer.from(bytes.subarray(0, 15)).toString("ascii") === "SQLite format 3";
export type BackupResult = { ok: boolean; message: string; file?: string; size?: number };
export async function createBackup(): Promise<BackupResult> {
  const dbFile = databaseFile();
  const dir = path.dirname(dbFile),
    backupsDir = path.join(dir, "sauvegardes");
  fs.mkdirSync(backupsDir, { recursive: true });
  await checkpoint();
  const target = path.join(backupsDir, `ironz-sauvegarde-${stamp()}.db`);
  fs.copyFileSync(dbFile, target);
  const integrity = await integrityCheck(target);
  if (integrity !== "ok") {
    fs.rmSync(target, { force: true });
    return {
      ok: false,
      message: "La sauvegarde est illisible (intégrité " + integrity + ").",
    };
  }
  const missing = await coreTablesPresent(target);
  if (missing.length) {
    fs.rmSync(target, { force: true });
    return {
      ok: false,
      message: "Sauvegarde incomplète : tables manquantes (" + missing.join(", ") + ").",
    };
  }
  return { ok: true, message: "Sauvegarde créée et vérifiée.", file: target, size: fs.statSync(target).size };
}
export function latestBackupName(): string | null {
  try {
    const dir = path.join(path.dirname(databaseFile()), "sauvegardes");
    const files = fs
      .readdirSync(dir)
      .filter((f) => /^ironz-sauvegarde-.*\.db$/.test(f))
      .sort();
    return files.at(-1) || null;
  } catch {
    return null;
  }
}
export function backupFilePath(name: string): string {
  // Sécurité : uniquement des noms issus du dossier de sauvegardes local.
  if (!/^ironz-sauvegarde-[0-9-]+\.db$/.test(name))
    throw new Error("Nom de sauvegarde invalide.");
  const dir = path.join(path.dirname(databaseFile()), "sauvegardes");
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) throw new Error("Sauvegarde introuvable.");
  return file;
}
export type RestoreResult = {
  ok: boolean;
  message: string;
  details?: string;
};
// Restauration : le fichier est transmis par l'utilisateur via upload
// (du navigateur) ; le serveur le traite dans son dossier de données,
// sans jamais accepter de chemin arbitraire.
export async function restoreFromUpload(
  bytes: Uint8Array,
): Promise<RestoreResult> {
  if (!isSqliteFile(bytes))
    return { ok: false, message: "Fichier non reconnu : ce n’est pas une base SQLite." };
  const limit = 512 * 1024 * 1024;
  if (bytes.length > limit)
    return { ok: false, message: "Fichier trop volumineux (> 512 Mo)." };
  const dbFile = databaseFile();
  const dir = path.dirname(dbFile);
  const tag = stamp() + "-" + randomUUID().slice(0, 8);
  const incoming = path.join(dir, `ironz-restore-${tag}.incoming`);
  fs.writeFileSync(incoming, bytes);
  try {
    const integrity = await integrityCheck(urlFor(incoming));
    if (integrity !== "ok") {
      fs.rmSync(incoming, { force: true });
      return {
        ok: false,
        message: `Sauvegarde corrompue (intégrité ${integrity}). Restauration annulée.`,
      };
    }
    const missing = await coreTablesPresent(urlFor(incoming));
    if (missing.length) {
      fs.rmSync(incoming, { force: true });
      return {
        ok: false,
        message: `Schéma incompatible : tables manquantes (${missing.join(", ")}).`,
      };
    }
    // 1. Sauvegarde de sécurité : le fichier vivant est copié puis écarté
    // (renommé) vers "sauvegardes" — jamais supprimé ni écrasé.
    await checkpoint();
    const previous = path.join(
      dir,
      "sauvegardes",
      `ironz-avant-restauration-${tag}.db`,
    );
    await retry(() => fs.copyFileSync(dbFile, previous), "copie de sécurité");
    // 2. Fermer proprement la connexion à la base du programme : le moteur
    // Windows retient le fichier quelques centaines de ms après $disconnect,
    // d'où les tentatives avec attente avant d'échanger le fichier.
    await db.$disconnect();
    // 3. Écarter les fichiers journal/WAL pointant vers l'ancienne base.
    for (const ext of ["-wal", "-shm"]) {
      try {
        fs.rmSync(dbFile + ext, { force: true });
      } catch {
        // Disk IO best effort.
      }
    }
    // 4. Échange : l'ancienne base prend le nom de sécurité, la nouvelle
    // occupe sa place. Fallback : recopie "in place" si le rename échoue.
    const renamed = await retryOrFalse(() => fs.renameSync(dbFile, previous));
    if (!renamed) {
      await retryOrFalse(() => fs.copyFileSync(incoming, dbFile));
    } else {
      await retry(() => fs.renameSync(incoming, dbFile), "échange du fichier");
    }
    // 5. Post-vérification sur le fichier restauré (connexion dédiée) :
    // en cas d'échec, la sauvegarde de sécurité est recopiée à sa place.
    const afterIntegrity = await integrityCheck(urlFor(dbFile));
    const afterMissing =
      afterIntegrity === "ok" ? await coreTablesPresent(urlFor(dbFile)) : CORE_TABLES.slice();
    if (afterIntegrity !== "ok" || afterMissing.length) {
      await retryOrFalse(() => fs.copyFileSync(previous, dbFile));
      await db.$connect?.();
      throw new Error(
        `Post-vérification échouée (intégrité ${afterIntegrity}` +
          (afterMissing.length ? ", tables : " + afterMissing.join(", ") : "") +
          "). Base précédente restaurée automatiquement.",
      );
    }
    return {
      ok: true,
      message:
        "Restauration réussie. Redirigé vers la connexion (sécurité datée : " +
        path.basename(previous) +
        ").",
    };
  } catch (e) {
    return { ok: false, message: "Restauration impossible : " + (e instanceof Error ? e.message : "erreur inconnue") };
  } finally {
    // Nettoyage du fichier entrant si la restauration ne l'a pas renommé.
    try {
      if (fs.existsSync(incoming)) fs.rmSync(incoming, { force: true });
    } catch {
      // Best effort.
    }
  }
}
