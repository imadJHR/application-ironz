import "server-only";
import { db } from "@/server/db";

// Comptes hérités d'essais antérieurs : IRONZ Gestion est monoposte, un seul
// compte ADMIN par installation. Les bases créées par des essais antérieurs
// peuvent contenir des comptes supplémentaires (COMMERCIAL, COMPTABILITE, ou
// un second ADMIN). Ils ne sont jamais supprimés automatiquement : le panneau
// de conflit les signale et l'administrateur décide ("Fusionner sur mon
// compte" = réaffectation de l'historique + suppression explicite).
export type ExtraAccount = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
  documents: number;
  payments: number;
  activities: number;
};

// Comptes autres que celui de l'administrateur courant, enrichis du volume
// de données commerciales qui leur est rattaché (avant réaffectation).
export async function listExtraAccounts(adminId: string): Promise<ExtraAccount[]> {
  const extras = await db.user.findMany({
    where: { id: { not: adminId } },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
    },
  });
  if (extras.length === 0) return [];
  const [docs, pays, acts] = await Promise.all([
    db.document.groupBy({ by: ["createdById"], _count: { _all: true } }),
    db.payment.groupBy({ by: ["createdById"], _count: { _all: true } }),
    db.activityLog.groupBy({ by: ["userId"], _count: { _all: true } }),
  ]);
  const docsMap = new Map<string, number>();
  const paysMap = new Map<string, number>();
  const actsMap = new Map<string, number>();
  for (const r of docs) docsMap.set(r.createdById, r._count._all);
  for (const r of pays) paysMap.set(r.createdById, r._count._all);
  for (const r of acts) actsMap.set(r.userId, r._count._all);
  return extras.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as string,
    active: u.active,
    createdAt: u.createdAt.toISOString().slice(0, 10),
    documents: docsMap.get(u.id) ?? 0,
    payments: paysMap.get(u.id) ?? 0,
    activities: actsMap.get(u.id) ?? 0,
  }));
}
