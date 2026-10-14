import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { db, isPreview } from "./db";
import type { Role } from "@/generated/prisma";
import { allowed } from "@/lib/permissions";
export { allowed } from "@/lib/permissions";
export const sessionHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
// Origines autorisées pour le login : APP_URL accepte une liste séparée par
// des virgules (prod + vercel.app), le dev local est toujours accepté.
export function appOrigins(): Set<string> {
  const hosts = new Set<string>();
  for (const entry of (process.env.APP_URL || "").split(",")) {
    const url = entry.trim();
    if (!url) continue;
    try {
      hosts.add(new URL(url).host);
    } catch {
      // Entrée invalide ignorée.
    }
  }
  if (hosts.size === 0) hosts.add("localhost:3000");
  hosts.add("localhost:3000");
  hosts.add("127.0.0.1:3000");
  return hosts;
}
export function appBaseUrl(): string {
  const first = (process.env.APP_URL || "")
    .split(",")
    .map((entry) => entry.trim())
    .find(Boolean);
  return first || "http://localhost:3000";
}
export const currentUser = cache(async () => {
  if (isPreview())
    return {
      id: "preview",
      name: "Équipe IRONZ",
      email: "",
      role: "ADMIN" as Role,
      active: true,
    };
  const token = (await cookies()).get("ironz_session")?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sessionHash(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active)
    return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
    active: session.user.active,
  };
});
export type Permission = import("@/lib/permissions").Permission;
export async function requireUser(
  permission: Permission = "read",
  mutation = false,
) {
  const user = await currentUser();
  if (!user) redirect("/connexion");
  if (!allowed(user.role, permission)) {
    if (!mutation) redirect("/acces-refuse");
    const error = new Error(
      "Vous n’avez pas l’autorisation pour cette action.",
    );
    error.name = "BusinessError";
    throw error;
  }
  if (mutation && isPreview()) {
    const error = new Error(
      "Connectez MongoDB Atlas pour enregistrer vos données.",
    );
    error.name = "BusinessError";
    throw error;
  }
  return user;
}
export async function requireDocumentWrite(kind: string) {
  return requireUser(kind === "INVOICE" ? "invoice" : "sales", true);
}
