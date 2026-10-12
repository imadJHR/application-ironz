import "server-only";
import { db, isPreview } from "./db";
import { Prisma } from "@/generated/prisma";
import Decimal from "decimal.js";
import { requireUser } from "./auth";
import { invoiceStatus, type Kind } from "@/lib/business";
export const serialize = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export const defaultSettings = {
  id: "ironz",
  name: "IRONZ",
  logo: "",
  address: "",
  city: "",
  phone: "",
  email: "",
  website: "",
  ice: "",
  taxId: "",
  rc: "",
  currency: "MAD",
  defaultTax: "20",
  bank: "",
  rib: "",
  iban: "",
  quoteValidity: 30,
  paymentTerms: "Paiement à 30 jours.",
  footer: "",
};
export async function settings() {
  await requireUser();
  return isPreview()
    ? defaultSettings
    : serialize(
        (await db.companySettings.findUnique({ where: { id: "ironz" } })) ||
          defaultSettings,
      );
}
export type Filters = {
  q?: string;
  status?: string;
  client?: string;
  from?: string;
  to?: string;
  page?: string;
  archived?: string;
  type?: string;
};
export const pageNumber = (p?: string) =>
  Math.max(1, Math.min(100000, parseInt(p || "1") || 1));
export async function clients(filters: Filters = {}) {
  await requireUser();
  if (isPreview()) return { rows: [], total: 0 };
  const where: Prisma.ClientWhereInput = {
    archived: filters.archived === "true",
    ...(filters.q
      ? {
          OR: ["name", "contact", "phone", "ice", "email"].map((field) => ({
            [field]: { contains: filters.q, mode: "insensitive" },
          })),
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.client.findMany({
      where,
      orderBy: { name: "asc" },
      take: 12,
      skip: (pageNumber(filters.page) - 1) * 12,
    }),
    db.client.count({ where }),
  ]);
  return { rows: serialize(rows), total };
}
export async function products(filters: Filters = {}) {
  await requireUser();
  if (isPreview()) return { rows: [], total: 0 };
  const where: Prisma.ProductWhereInput = {
    active: filters.archived !== "true",
    ...(filters.type === "service"
      ? { type: "Service" }
      : filters.type === "produit"
        ? { type: "Produit" }
        : {}),
    ...(filters.q
      ? {
          OR: ["name", "reference", "category"].map((field) => ({
            [field]: { contains: filters.q, mode: "insensitive" },
          })),
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { reference: "asc" },
      take: 12,
      skip: (pageNumber(filters.page) - 1) * 12,
    }),
    db.product.count({ where }),
  ]);
  return { rows: serialize(rows), total };
}
export async function productTypeCounts(archived = false) {
  await requireUser();
  if (isPreview()) return { produit: 0, service: 0 };
  const where = { active: !archived };
  const [produit, service] = await Promise.all([
    db.product.count({ where: { ...where, type: "Produit" } }),
    db.product.count({ where: { ...where, type: "Service" } }),
  ]);
  return { produit, service };
}
const validDate = (value?: string) =>
  value &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(new Date(value).getTime())
    ? new Date(value)
    : undefined;
export function effectiveDocument<
  T extends {
    kind: Kind;
    status: string;
    totalTTC: string;
    dueDate: Date | null;
    payments: { amount: string }[];
  },
>(doc: T) {
  return {
    ...doc,
    status:
      doc.kind === "INVOICE"
        ? invoiceStatus(
            doc.totalTTC.toString(),
            doc.payments
              .reduce((sum, p) => sum.plus(p.amount), new Decimal(0))
              .toString(),
            doc.dueDate,
            doc.status,
          )
        : doc.kind === "QUOTE" &&
            doc.status === "SENT" &&
            doc.dueDate &&
            doc.dueDate.getTime() < new Date().setHours(0, 0, 0, 0)
          ? "EXPIRED"
          : doc.status,
  };
}
export async function documents(kind: Kind, filters: Filters = {}) {
  await requireUser();
  if (isPreview()) return { rows: [], total: 0 };
  const date = {
    gte: validDate(filters.from),
    lte: validDate(filters.to)
      ? new Date(validDate(filters.to)!.getTime() + 86399999)
      : undefined,
  };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let statusWhere: Prisma.DocumentWhereInput = filters.status
    ? { status: filters.status }
    : {};
  if (kind === "INVOICE" && filters.status === "OVERDUE")
    statusWhere = {
      status: { in: ["SENT", "PARTIAL", "OVERDUE"] },
      dueDate: { lt: today },
    };
  if (kind === "INVOICE" && ["SENT", "PARTIAL"].includes(filters.status || ""))
    statusWhere = {
      status: filters.status,
      OR: [{ dueDate: null }, { dueDate: { gte: today } }],
    };
  if (kind === "QUOTE" && filters.status === "EXPIRED")
    statusWhere = {
      OR: [{ status: "EXPIRED" }, { status: "SENT", dueDate: { lt: today } }],
    };
  if (kind === "QUOTE" && filters.status === "SENT")
    statusWhere = {
      status: "SENT",
      OR: [{ dueDate: null }, { dueDate: { gte: today } }],
    };
  const search: Prisma.DocumentWhereInput = filters.q
    ? {
        OR: [
          { number: { contains: filters.q, mode: "insensitive" } },
          { client: { name: { contains: filters.q, mode: "insensitive" } } },
          { source: { number: { contains: filters.q, mode: "insensitive" } } },
        ],
      }
    : {};
  const where: Prisma.DocumentWhereInput = {
    kind,
    date,
    ...(filters.client ? { clientId: filters.client } : {}),
    AND: [statusWhere, search],
  };
  const [rows, total] = await Promise.all([
    db.document.findMany({
      where,
      orderBy: { date: "desc" },
      take: 12,
      skip: (pageNumber(filters.page) - 1) * 12,
      include: { client: true, source: true, payments: true },
    }),
    db.document.count({ where }),
  ]);
  return { rows: serialize(rows.map(effectiveDocument)), total };
}
export async function selectors() {
  await requireUser();
  if (isPreview()) return { clients: [], products: [] };
  const [clients, products] = await Promise.all([
    db.client.findMany({
      where: { archived: false },
      orderBy: { name: "asc" },
    }),
    db.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return serialize({ clients, products });
}
export async function notifications() {
  await requireUser();
  if (isPreview()) return { overdue: 0, pending: 0, total: 0 };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [overdue, pending] = await Promise.all([
    db.document.count({
      where: {
        kind: "INVOICE",
        status: { in: ["SENT", "PARTIAL", "OVERDUE"] },
        dueDate: { lt: today },
      },
    }),
    db.document.count({
      where: {
        kind: "QUOTE",
        status: "SENT",
        OR: [{ dueDate: null }, { dueDate: { gte: today } }],
      },
    }),
  ]);
  return { overdue, pending, total: overdue + pending };
}
export async function dashboard(from?: string, to?: string) {  await requireUser();
  const now = new Date(),
    start = validDate(from) || new Date(now.getFullYear(), 0, 1),
    end = validDate(to) ? new Date(validDate(to)!.getTime() + 86399999) : now;
  if (isPreview())
    return {
      invoices: [],
      payments: [],
      quotes: [],
      orders: [],
      deliveries: [],
      activity: [],
      start: start.toISOString(),
      end: end.toISOString(),
    };
  const date = { gte: start, lte: end };
  const [invoices, payments, quotes, orders, deliveries, activity] =
    await Promise.all([
      db.document.findMany({
        where: { kind: "INVOICE", date },
        include: { client: true, payments: true },
      }),
      db.payment.findMany({
        where: { date },
        include: { invoice: true, client: true },
      }),
      db.document.findMany({
        where: { kind: "QUOTE", date },
        include: { children: true, client: true },
      }),
      db.document.findMany({
        where: { kind: "ORDER", date },
        include: { client: true },
      }),
      db.document.findMany({
        where: { kind: "DELIVERY", date },
        include: { client: true },
      }),
      db.activityLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { user: { select: { name: true } } },
      }),
    ]);
  return serialize({
    invoices: invoices.map(effectiveDocument),
    payments,
    quotes: quotes.map((q) => ({
      ...q,
      status:
        q.status === "SENT" &&
        q.dueDate &&
        q.dueDate.getTime() < new Date().setHours(0, 0, 0, 0)
          ? "EXPIRED"
          : q.status,
    })),
    orders,
    deliveries,
    activity,
    start: start.toISOString(),
    end: end.toISOString(),
  });
}
export async function getDocument(id: string) {
  await requireUser();
  if (isPreview()) return null;
  const doc = await db.document.findUnique({
    where: { id },
    include: {
      items: { orderBy: { position: "asc" }, include: { sourceItem: true } },
      client: true,
      createdBy: { select: { name: true } },
      payments: {
        orderBy: { date: "desc" },
        include: { createdBy: { select: { name: true } } },
      },
      source: true,
      children: { include: { items: true } },
    },
  });
  if (!doc) return null;
  const ancestors = [];
  let next = doc.source;
  while (next) {
    ancestors.unshift(next);
    next = next.sourceId
      ? await db.document.findUnique({ where: { id: next.sourceId } })
      : null;
  }
  const descendants = [];
  let frontier = [id];
  while (frontier.length) {
    const children = await db.document.findMany({
      where: { sourceId: { in: frontier } },
      orderBy: { createdAt: "asc" },
    });
    descendants.push(...children);
    frontier = children.map((c) => c.id);
  }
  const history = await db.activityLog.findMany({
    where: { entityId: id },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } } },
  });
  return serialize({
    ...effectiveDocument(doc),
    ancestors,
    descendants,
    history,
  });
}
export async function clientDetail(id: string) {
  await requireUser();
  if (isPreview()) return null;
  const client = await db.client.findUnique({
    where: { id },
    include: {
      documents: { orderBy: { date: "desc" }, include: { payments: true } },
      payments: { orderBy: { date: "desc" }, include: { invoice: true } },
    },
  });
  return client
    ? serialize({
        ...client,
        documents: client.documents.map(effectiveDocument),
      })
    : null;
}
export async function globalSearch(q: string) {
  await requireUser();
  if (isPreview() || q.length < 2)
    return { clients: [], documents: [], products: [] };
  const [clients, documents, products] = await Promise.all([
    db.client.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { ice: { contains: q, mode: "insensitive" } },
          { contact: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 20,
    }),
    db.document.findMany({
      where: {
        OR: [
          { number: { contains: q, mode: "insensitive" } },
          { client: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      take: 30,
      include: { client: true },
    }),
    db.product.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { reference: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 20,
    }),
  ]);
  return serialize({ clients, documents, products });
}
