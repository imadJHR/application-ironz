import "server-only";
import { Prisma, PrismaClient } from "@/generated/prisma";
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalDb.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalDb.prisma = db;
export const isPreview = () =>
  process.env.NODE_ENV === "development" && process.env.PREVIEW_MODE === "true";
export async function atomic<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
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
