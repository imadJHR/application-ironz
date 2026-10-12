import { z } from "zod";
const text = (max = 500) => z.string().trim().max(max).default("");
const cents = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 0.000001;
const email = z.union([z.email(), z.literal("")]).default("");
const iceField = text(30).refine(
  (v) => !v || /^\d{15}$/.test(v),
  "L’ICE comporte exactement 15 chiffres.",
);
export const clientSchema = z.object({
  type: z.enum(["Entreprise", "Particulier"]),
  name: z.string().trim().min(2).max(200),
  contact: text(),
  phone: text(50),
  email,
  address: text(1000),
  city: text(100),
  country: text(100),
  ice: iceField,
  taxId: text(30),
  rc: text(30),
  patente: text(30),
  notes: text(5000),
});
export const productSchema = z.object({
  reference: z.string().trim().max(100).default(""),
  type: z.enum(["Produit", "Service"]),
  name: z.string().trim().min(2).max(500),
  description: text(4000),
  category: text(100),
  image: text(2000),
  unit: z.enum([
    "unité",
    "pièce",
    "kg",
    "heure",
    "jour",
    "forfait",
    "m²",
    "mois",
  ]),
  price: z.coerce
    .number()
    .finite()
    .min(0)
    .max(999999999)
    .refine(cents, "Deux décimales au maximum."),
  tax: z.coerce
    .number()
    .finite()
    .min(0)
    .max(100)
    .refine(cents, "Deux décimales au maximum."),
});
export const paymentSchema = z.object({
  idempotencyKey: z.uuid(),
  invoiceId: z.string().min(1),
  date: z.iso.date(),
  amount: z.coerce
    .number()
    .finite()
    .positive()
    .max(999999999)
    .refine(
      (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001,
      "Deux décimales au maximum.",
    ),
  method: z.enum(["Espèces", "Virement", "Chèque", "Carte", "Autre"]),
  reference: text(),
  notes: text(5000),
});
export const settingsSchema = z.object({
  name: z.string().trim().min(2).max(200),
  logo: text(200000).refine(
    (v) => !v || /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(v),
    "Le logo doit être une image PNG ou JPEG.",
  ),
  address: text(1000),
  city: text(100),
  phone: text(50),
  email,
  website: text(200),
  ice: iceField,
  taxId: text(30),
  rc: text(30),
  patente: text(30),
  currency: z.enum(["MAD", "EUR", "USD"]),
  defaultTax: z.coerce
    .number()
    .min(0)
    .max(100)
    .refine(cents, "Deux décimales au maximum."),
  bank: text(200),
  rib: text(100),
  iban: text(100),
  quoteValidity: z.coerce.number().int().min(1).max(365),
  paymentTerms: text(5000),
  footer: text(5000),
});
export const userSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(12, "12 caractères au minimum.").max(128),
  role: z.enum(["ADMIN", "COMMERCIAL", "COMPTABILITE"]),
});
