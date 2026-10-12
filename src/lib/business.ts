import Decimal from "decimal.js";
import { z } from "zod";
Decimal.set({ precision: 32, rounding: Decimal.ROUND_HALF_UP });
export const kinds = ["QUOTE", "ORDER", "DELIVERY", "INVOICE"] as const;
export type Kind = (typeof kinds)[number];
export const modules = {
  devis: {
    kind: "QUOTE",
    title: "Devis",
    singular: "devis",
    prefix: "DEV",
    description: "De la première proposition à la commande.",
  },
  commandes: {
    kind: "ORDER",
    title: "Bons de commande",
    singular: "bon de commande",
    prefix: "BC",
    description: "Vos engagements clients, au même endroit.",
  },
  livraisons: {
    kind: "DELIVERY",
    title: "Bons de livraison",
    singular: "bon de livraison",
    prefix: "BL",
    description: "Préparez, livrez et suivez chaque réception.",
  },
  factures: {
    kind: "INVOICE",
    title: "Factures",
    singular: "facture",
    prefix: "FAC",
    description: "Une facturation précise. Une trésorerie maîtrisée.",
  },
} as const;
export type Module = keyof typeof modules;
export function moduleFor(kind: Kind): Module {
  return (Object.keys(modules) as Module[]).find(
    (m) => modules[m].kind === kind,
  )!;
}
export const statusLabels: Record<string, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  ACCEPTED: "Accepté",
  REJECTED: "Refusé",
  EXPIRED: "Expiré",
  CONVERTED: "Converti",
  CONFIRMED: "Confirmé",
  PREPARING: "En préparation",
  DELIVERED: "Livré",
  CANCELLED: "Annulé",
  PREPARED: "Préparé",
  RECEIVED: "Réceptionné",
  PARTIAL: "Partiellement payée",
  PAID: "Payée",
  OVERDUE: "En retard",
};
export const transitions: Record<Kind, Record<string, string[]>> = {
  QUOTE: {
    DRAFT: ["SENT"],
    SENT: ["ACCEPTED", "REJECTED", "EXPIRED"],
    ACCEPTED: ["REJECTED"],
    REJECTED: [],
    EXPIRED: [],
    CONVERTED: [],
  },
  ORDER: {
    DRAFT: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["PREPARING", "CANCELLED"],
    PREPARING: ["CANCELLED"],
    DELIVERED: [],
    CANCELLED: [],
  },
  DELIVERY: {
    DRAFT: ["PREPARED"],
    PREPARED: ["DELIVERED"],
    DELIVERED: ["RECEIVED"],
    RECEIVED: [],
  },
  INVOICE: {
    DRAFT: ["SENT", "CANCELLED"],
    SENT: ["CANCELLED"],
    PARTIAL: [],
    PAID: [],
    OVERDUE: ["CANCELLED"],
    CANCELLED: [],
  },
};
const amount = z.coerce.number().finite().min(0).max(999999999);
export const lineSchema = z.object({
  productId: z.string().optional(),
  sourceItemId: z.string().optional(),
  reference: z.string().max(100).default(""),
  name: z.string().trim().min(1, "La désignation est obligatoire.").max(500),
  description: z.string().max(4000).default(""),
  unit: z.string().max(30).default("unité"),
  quantity: z.coerce
    .number()
    .finite()
    .positive()
    .max(999999)
    .refine(
      (n) => Math.abs(n * 1000 - Math.round(n * 1000)) < 0.000001,
      "Trois décimales au maximum.",
    ),
  unitPrice: amount.refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.000001,
    "Deux décimales au maximum.",
  ),
  discountRate: z.coerce
    .number()
    .min(0)
    .max(100)
    .refine(
      (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.000001,
      "Deux décimales au maximum.",
    ),
  taxRate: z.coerce
    .number()
    .min(0)
    .max(100)
    .refine(
      (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.000001,
      "Deux décimales au maximum.",
    ),
});
export const documentSchema = z
  .object({
    kind: z.enum(kinds),
    clientId: z.string().min(1, "Sélectionnez un client."),
    date: z.iso.date(),
    dueDate: z.union([z.iso.date(), z.literal("")]).default(""),
    notes: z.string().max(5000).default(""),
    terms: z.string().max(5000).default(""),
    leadTime: z.string().max(500).default(""),
    deliveryAddress: z.string().max(1000).default(""),
    items: z.array(lineSchema).min(1).max(200),
  })
  .refine((d) => !d.dueDate || d.dueDate >= d.date, {
    message: "L'échéance doit être postérieure à la date.",
    path: ["dueDate"],
  });
export type Line = z.infer<typeof lineSchema>;
export type DocumentInput = z.infer<typeof documentSchema>;
export function calculate(
  items: Pick<Line, "quantity" | "unitPrice" | "discountRate" | "taxRate">[],
) {
  let subtotal = new Decimal(0),
    discount = new Decimal(0),
    totalHT = new Decimal(0),
    totalTax = new Decimal(0);
  const lines = items.map((item) => {
    const base = new Decimal(item.quantity)
      .times(item.unitPrice)
      .toDecimalPlaces(2);
    const reduction = base.times(item.discountRate).div(100).toDecimalPlaces(2);
    const ht = base.minus(reduction),
      tax = ht.times(item.taxRate).div(100).toDecimalPlaces(2);
    subtotal = subtotal.plus(base);
    discount = discount.plus(reduction);
    totalHT = totalHT.plus(ht);
    totalTax = totalTax.plus(tax);
    return {
      totalHT: ht.toFixed(2),
      totalTax: tax.toFixed(2),
      totalTTC: ht.plus(tax).toFixed(2),
    };
  });
  return {
    subtotal: subtotal.toFixed(2),
    discount: discount.toFixed(2),
    totalHT: totalHT.toFixed(2),
    totalTax: totalTax.toFixed(2),
    totalTTC: totalHT.plus(totalTax).toFixed(2),
    lines,
  };
}
export function invoiceStatus(
  total: string,
  paid: string,
  dueDate: Date | null,
  current = "SENT",
) {
  if (current === "DRAFT" || current === "CANCELLED") return current;
  if (new Decimal(paid).gte(total)) return "PAID";
  if (dueDate && dueDate.getTime() < new Date().setHours(0, 0, 0, 0))
    return "OVERDUE";
  return new Decimal(paid).gt(0) ? "PARTIAL" : "SENT";
}
