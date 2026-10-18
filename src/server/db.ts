import "server-only";
import { Prisma, PrismaClient } from "@/generated/prisma";
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalDb.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalDb.prisma = db;
export const isPreview = () =>
  process.env.NODE_ENV === "development" && process.env.PREVIEW_MODE === "true";
// Version desktop (.exe, SQLite) : le connecteur SQLite ne prend pas en charge
// `mode: "insensitive"` (le LIKE y est déjà insensible à la casse en ASCII),
// et ne gère pas les transactions interactives (mono-poste : exécution directe).
export const isDesktopDb = () => process.env.IRONZ_SQLITE === "1";
// Le type `object` (sans props connues) évite le contrôle de props
// excédentaires : le schéma SQLite ne déclare pas `mode`, contrairement à Mongo.
export const insensitive = (): object =>
  isDesktopDb() ? {} : { mode: "insensitive" };
export async function atomic<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (isDesktopDb()) return work(db as Prisma.TransactionClient);
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await db.$transaction(work, {
        timeout: 15000,
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2034" ||
        attempt === 5
      )
        throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, 30 * 2 ** attempt + Math.random() * 40),
      );
    }
  }
  throw new Error("Veuillez réessayer.");
}
export const jsonSnapshot = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value));
export async function nextNumber(
  tx: Prisma.TransactionClient,
  prefix: string,
  date: Date,
) {
  const year = date.getUTCFullYear();
  const sequence = await tx.documentSequence.upsert({
    where: { id: prefix + "-" + year },
    create: { id: prefix + "-" + year, value: 1 },
    update: { value: { increment: 1 } },
  });
  return prefix + "-" + year + "-" + String(sequence.value).padStart(3, "0");
}
