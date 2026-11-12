import "server-only";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { Prisma } from "@/generated/prisma";
import { recoverySchemaStatements } from "./recovery";

export const MAX_BACKUP_BYTES = 512 * 1024 * 1024;
const BACKUP_NAME = /^ironz-sauvegarde-[0-9-]+(?:-[0-9a-f]{8})?\.db$/;
const SQLITE_HEADER = Buffer.from("SQLite format 3\0");
let restoring = false;

function databaseFile(): string {
  const url = process.env.DATABASE_URL || "";
  if (!url.startsWith("file:") || url.length === 5)
    throw new Error("Base de données locale introuvable.");
  return path.normalize(url.slice(5));
}

function backupDirectory(file = databaseFile()) {
  return path.join(path.dirname(file), "sauvegardes");
}

function backupTag() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const date = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate());
  const time =
    pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
  const milliseconds = String(now.getMilliseconds()).padStart(3, "0");
  return `${date}-${time}-${milliseconds}-${randomUUID().slice(0, 8)}`;
}

function verifyDatabase(connection: DatabaseSync) {
  const integrity = connection.prepare("PRAGMA integrity_check(1)").get();
  if (integrity?.integrity_check !== "ok")
    throw new Error("La sauvegarde SQLite est corrompue.");

  const tableInfo = connection.prepare(
    "SELECT name FROM pragma_table_info(?) WHERE EXISTS (SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?)",
  );
  for (const model of Prisma.dmmf.datamodel.models) {
    const table = model.dbName || model.name;
    const columns = new Set(tableInfo.all(table, table).map((row) => row.name));
    if (table === "RecoveryCode" && columns.size === 0) continue;
    if (columns.size === 0)
      throw new Error(`Schéma incompatible : table ${table} manquante.`);
    for (const field of model.fields) {
      if (field.kind !== "object" && !columns.has(field.dbName || field.name))
        throw new Error(
          `Schéma incompatible : colonne ${table}.${field.name} manquante.`,
        );
    }
  }
}

async function openDatabase(file: string, readOnly: boolean) {
  const { DatabaseSync } = await import("node:sqlite");
  const connection = new DatabaseSync(file, { readOnly });
  try {
    connection.exec("PRAGMA trusted_schema = OFF; PRAGMA busy_timeout = 5000;");
    if (!readOnly) {
      // Les fichiers temporaires doivent rester autonomes après leur fermeture.
      const journal = connection.prepare("PRAGMA journal_mode = DELETE").get();
      if (journal?.journal_mode !== "delete")
        throw new Error("Impossible de fermer le journal de la sauvegarde.");
    }
    return connection;
  } catch (error) {
    connection.close();
    throw error;
  }
}

async function copyDatabase(source: string, target: string) {
  const { backup } = await import("node:sqlite");
  const connection = await openDatabase(source, true);
  try {
    // SQLite copie un instantané cohérent, y compris les écritures du WAL.
    await backup(connection, target);
  } finally {
    connection.close();
  }
}

async function writeVerifiedBackup(source: string, target: string) {
  await mkdir(path.dirname(target), { recursive: true });
  const staging = target + ".incoming";
  try {
    await copyDatabase(source, staging);
    const connection = await openDatabase(staging, false);
    try {
      verifyDatabase(connection);
    } finally {
      connection.close();
    }
    await rename(staging, target);
  } finally {
    await removeStagingDatabase(staging);
  }
}

async function removeStagingDatabase(file: string) {
  await Promise.allSettled(
    ["", "-journal", "-wal", "-shm"].map((suffix) =>
      rm(file + suffix, { force: true }),
    ),
  );
}

type BackupResult = {
  ok: boolean;
  message: string;
  file?: string;
  size?: number;
};

export async function createBackup(): Promise<BackupResult> {
  const source = databaseFile();
  const target = path.join(
    backupDirectory(source),
    `ironz-sauvegarde-${backupTag()}.db`,
  );
  try {
    await writeVerifiedBackup(source, target);
    return {
      ok: true,
      message: "Sauvegarde créée et vérifiée.",
      file: target,
      size: (await stat(target)).size,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        "Sauvegarde impossible : " +
        (error instanceof Error ? error.message : "erreur inconnue"),
    };
  }
}

export function latestBackupName(): string | null {
  try {
    return (
      readdirSync(backupDirectory())
        .filter((name) => BACKUP_NAME.test(name))
        .sort()
        .at(-1) || null
    );
  } catch {
    return null;
  }
}

export function backupFilePath(name: string): string {
  if (!BACKUP_NAME.test(name)) throw new Error("Nom de sauvegarde invalide.");
  const file = path.join(backupDirectory(), name);
  if (!existsSync(file)) throw new Error("Sauvegarde introuvable.");
  return file;
}

export async function restoreFromUpload(
  bytes: Uint8Array,
): Promise<{ ok: boolean; message: string }> {
  if (bytes.length > MAX_BACKUP_BYTES)
    return { ok: false, message: "Fichier trop volumineux (> 512 Mo)." };
  if (
    !Buffer.from(bytes.subarray(0, SQLITE_HEADER.length)).equals(SQLITE_HEADER)
  )
    return {
      ok: false,
      message: "Fichier non reconnu : ce n’est pas une base SQLite.",
    };
  if (restoring)
    return { ok: false, message: "Une restauration est déjà en cours." };

  const live = databaseFile();
  const tag = backupTag();
  const incoming = path.join(
    path.dirname(live),
    `ironz-restore-${tag}.incoming`,
  );
  const previous = path.join(
    backupDirectory(live),
    `ironz-avant-restauration-${tag}.db`,
  );
  restoring = true;
  try {
    await writeFile(incoming, bytes, { flag: "wx" });
    const connection = await openDatabase(incoming, false);
    try {
      verifyDatabase(connection);
      connection.exec('DELETE FROM "Session"');
      for (const ddl of recoverySchemaStatements) connection.exec(ddl);
    } finally {
      connection.close();
    }

    await writeVerifiedBackup(live, previous);
    // La copie vers la base ouverte est appliquée par SQLite dans sa propre
    // transaction. Un échec ne laisse pas un fichier remplacé à moitié.
    await copyDatabase(incoming, live);
    return {
      ok: true,
      message: `Restauration réussie. Reconnectez-vous. Copie de sécurité : ${path.basename(previous)}.`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        "Restauration impossible : " +
        (error instanceof Error ? error.message : "erreur inconnue"),
    };
  } finally {
    await removeStagingDatabase(incoming);
    restoring = false;
  }
}
