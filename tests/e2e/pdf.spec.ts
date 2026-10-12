import { test, expect } from "@playwright/test";
import { PrismaClient, Prisma } from "../../src/generated/prisma/index.js";
import { mkdirSync, writeFileSync } from "node:fs";
process.loadEnvFile(".env.test.local");
if (new URL(process.env.DATABASE_URL!).pathname !== "/ironz_test")
  throw new Error(
    "Les tests doivent utiliser uniquement la base ironz_test.",
  );
const db = new PrismaClient();
test.afterAll(async () => db.$disconnect());
test("A4 PDF paginates compact line items across pages without losing totals", async ({
  page,
}) => {
  const user = await db.user.findUniqueOrThrow({
      where: { email: process.env.ADMIN_EMAIL! },
    }),
    company = await db.companySettings.findUniqueOrThrow({
      where: { id: "ironz" },
    });
  const client = await db.client.create({
    data: {
      name: "Client du contrôle PDF",
      address: "12 rue du contrôle",
      city: "Casablanca",
      ice: "123456789012345",
    },
  });
  const items = Array.from({ length: 36 }, (_, n) => ({
    position: n,
    reference: "PDF-" + String(n + 1).padStart(3, "0"),
    name: "Prestation de contrôle " + (n + 1),
    description:
      n === 0
        ? "Description longue avec détails techniques et conditions de réalisation. ".repeat(
            50,
          )
        : "Une description de prestation qui doit rester lisible et conserver une séparation nette entre les lignes du document.",
    quantity: "2.000",
    unit: "heure",
    unitPrice: "100.00",
    discountRate: "0.00",
    taxRate: "20.00",
    totalHT: "200.00",
    totalTax: "40.00",
    totalTTC: "240.00",
  }));
  const doc = await db.document.create({
    data: {
      kind: "INVOICE",
      number: "FAC-TEST-PDF",
      status: "SENT",
      date: new Date(Date.now() - 3 * 86400000),
      dueDate: new Date(Date.now() - 86400000),
      clientId: client.id,
      createdById: user.id,
      clientSnapshot: JSON.parse(
        JSON.stringify(client),
      ) as Prisma.InputJsonValue,
      companySnapshot: JSON.parse(
        JSON.stringify(company),
      ) as Prisma.InputJsonValue,
      subtotal: "7200.00",
      discount: "0.00",
      totalHT: "7200.00",
      totalTax: "1440.00",
      totalTTC: "8640.00",
      terms:
        "Paiement à réception. Coordonnées bancaires selon le profil IRONZ.",
      notes:
        "Contrôle de pagination A4, descriptions longues et conservation des totaux.",
      items: { create: items },
    },
  });
  await page.goto("/connexion");
  await page.getByLabel("Email professionnel").fill(process.env.ADMIN_EMAIL!);
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL("http://localhost:3001/");
  const pdf = await page.request.get("/api/documents/" + doc.id + "/pdf");
  expect(pdf.status()).toBe(200);
  const bytes = await pdf.body();
  expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
  const raw = bytes.toString("latin1");
  const pageCount = (raw.match(/\/Type \/Page\b/g) || []).length;
  expect(pageCount).toBeGreaterThanOrEqual(2);
  const mediaBox = raw.match(/\/MediaBox\s*\[([\d.\s]+)\]/);
  expect(mediaBox).not.toBeNull();
  const dimensions = mediaBox![1].trim().split(/\s+/).map(Number);
  expect(dimensions[2]).toBeCloseTo(595.28, 1);
  expect(dimensions[3]).toBeCloseTo(841.89, 1);
  mkdirSync(".local", { recursive: true });
  writeFileSync(".local/verification-invoice.pdf", bytes);
  await page.goto("/factures?status=OVERDUE&q=FAC-TEST-PDF");
  await expect(
    page.getByRole("link", { name: "FAC-TEST-PDF", exact: true }),
  ).toBeVisible();
  await expect(page.locator("tbody .status")).toHaveText("En retard");
  await page.goto("/factures/" + doc.id + "/imprimer");
  await expect(
    page.getByRole("heading", { name: "Facture", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Prestation de contrôle 36", { exact: true }),
  ).toBeVisible();
});
