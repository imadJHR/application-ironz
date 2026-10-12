import { readFileSync } from "node:fs";
import Decimal from "decimal.js";

process.loadEnvFile(".env");
const databaseUrl = new URL(process.env.DATABASE_URL || "");
if (!/^mongodb(?:\+srv)?:$/.test(databaseUrl.protocol)) {
  throw new Error("DATABASE_URL doit pointer vers MongoDB Atlas.");
}
if (databaseUrl.pathname.replace(/^\//, "") !== "ironz") {
  throw new Error(
    "Par sécurité, l’import exige une base destination nommée ironz (jamais test).",
  );
}

const inputPath = process.argv[2];
if (!inputPath) {
  throw new Error(
    'Indique le chemin du fichier JSON exporté, ex. : npm run db:import-products -- "C:\\Users\\imadj\\Desktop\\test.products.json"',
  );
}
const source = JSON.parse(readFileSync(inputPath, "utf8"));
if (!Array.isArray(source)) {
  throw new Error("Le fichier doit contenir une liste JSON de produits.");
}

const seen = new Set();
const products = source.map((item, index) => {
  const name = String(item.name || "").trim();
  if (!name) throw new Error(`Le produit ${index + 1} n’a pas de nom.`);
  const sku = String(item.sku || "").trim();
  const reference = sku || null;
  const referenceKey = sku
    ? "ref:" + sku.toLocaleLowerCase("fr")
    : "source:" + String(item._id?.$oid || item._id || index + 1);
  if (seen.has(referenceKey)) {
    throw new Error(`Référence en double détectée à la ligne ${index + 1}.`);
  }
  seen.add(referenceKey);

  const price = new Decimal(item.price);
  if (!price.isFinite() || price.isNegative() || price.decimalPlaces() > 2) {
    throw new Error(`Prix invalide pour le produit ${index + 1}.`);
  }

  return {
    reference,
    referenceKey,
    type: "Produit",
    name: name.slice(0, 500),
    description: String(item.description || "").slice(0, 4000),
    category: [item.category, item.subCategory]
      .filter((part) => typeof part === "string" && part.trim())
      .join(" / ")
      .slice(0, 100),
    image: String(item.image || "").slice(0, 2000),
    unit: "unité",
    price: price.toFixed(2),
    tax: "0.00",
    active: true,
  };
});

const { PrismaClient } = await import("../src/generated/prisma/index.js");
const db = new PrismaClient();
try {
  const existing = await db.product.count();
  if (existing !== 0) {
    throw new Error(
      `La base ironz contient déjà ${existing} produit(s) ; aucun changement effectué.`,
    );
  }
  const result = await db.product.createMany({ data: products });
  console.log(
    `${result.count} produits importés dans ironz. TVA importée : 0 %. Les références manquantes restent vides.`,
  );
} finally {
  await db.$disconnect();
}
