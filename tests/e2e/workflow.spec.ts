import { createHash } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "../../src/generated/prisma/index.js";
import { hashPassword } from "../../src/server/password";
process.loadEnvFile(".env.test.local");
if (new URL(process.env.DATABASE_URL!).pathname !== "/ironz_test")
  throw new Error(
    "Les tests doivent utiliser uniquement la base ironz_test.",
  );
const db = new PrismaClient();
const base = "http://localhost:3001";
const email = process.env.ADMIN_EMAIL!,
  password = process.env.ADMIN_PASSWORD!;
let clientId: string, orderId: string, invoiceId: string;
const login = async (
  page: Page,
  userEmail = email,
  userPassword = password,
) => {
  await page.goto("/connexion");
  await page.getByLabel("Email professionnel").fill(userEmail);
  await page.getByLabel("Mot de passe", { exact: true }).fill(userPassword);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(base + "/");
};
async function status(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  const confirm = page.getByRole("dialog");
  if (await confirm.isVisible())
    await confirm
      .getByRole("button", { name: "Confirmer", exact: true })
      .click();
  await expect(page.locator(".page-actions .status")).toHaveText(label);
}
test.describe.configure({ mode: "serial" });
test.afterAll(async () => db.$disconnect());
test("desktop sidebar collapses and remembers its state", async ({ page }) => {
  await login(page);
  const shell = page.locator(".app-shell");
  await page.getByRole("button", { name: "Réduire la barre latérale" }).click();
  await expect(shell).toHaveClass(/sidebar-collapsed/);
  await expect(page.locator(".sidebar")).toHaveCSS("width", "72px");
  await expect(page.locator('.nav-item[title="Utilisateurs"]')).toBeVisible();
  await expect(page.locator('.nav-item[title="Paramètres"]')).toBeVisible();
  await expect(page.locator(".sidebar-mini-logo")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Afficher la barre latérale" }),
  ).toBeVisible();
  await page.reload();
  await expect(shell).toHaveClass(/sidebar-collapsed/);
  await expect(page.locator(".sidebar")).toHaveCSS("width", "72px");
  await page
    .getByRole("button", { name: "Afficher la barre latérale" })
    .click();
  await expect(shell).not.toHaveClass(/sidebar-collapsed/);
  await expect(page.locator(".sidebar")).toHaveCSS("width", "236px");
});
test("private access, no public registration, and durable rate limiting", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(base + "/connexion");
  await expect(page.getByAltText("IRONZ").first()).toBeVisible();
  const pdf = await page.request.get("/api/documents/unknown/pdf");
  expect(pdf.status()).toBe(401);
  await expect(page.getByText("Créer un compte", { exact: true })).toHaveCount(
    0,
  );
  await page.getByLabel("Email professionnel").fill(email);
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("incorrect-password");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.locator(".login-error")).toContainText(
    "Email ou mot de passe incorrect.",
  );
  expect(
    await db.loginAttempt.count({
      where: { key: createHash("sha256").update(email).digest("hex") },
    }),
  ).toBeGreaterThan(0);
  await login(page);
  expect(
    await db.loginAttempt.count({
      where: { key: createHash("sha256").update(email).digest("hex") },
    }),
  ).toBe(0);
  const cookie = (await page.context().cookies()).find(
    (c) => c.name === "ironz_session",
  );
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.secure).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
});
test("client, catalogue and quote through linked partial deliveries", async ({
  page,
}) => {
  await login(page);
  await page.goto("/clients/nouveau");
  await page
    .getByLabel("Raison sociale / Nom")
    .fill("Client de vérification IRONZ");
  await page.getByLabel("Nom du contact").fill("Contact de test");
  await page
    .getByLabel("Email", { exact: true })
    .fill("client@verification.invalid");
  await page.getByLabel("Ville", { exact: true }).fill("Casablanca");
  await page.getByLabel("ICE", { exact: true }).fill("001234567890123");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page).toHaveURL(/\/clients\/c[a-z0-9]{20,}$/);
  clientId = page.url().split("/").pop()!;
  await page.goto("/produits/nouveau");
  await page.getByLabel("Référence *", { exact: true }).fill("TEST-ACIER");
  await page
    .getByLabel("Désignation *", { exact: true })
    .fill("Prestation de vérification");
  await page.getByLabel("Prix unitaire HT").fill("100");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page).toHaveURL(base + "/produits");
  await page.goto("/devis/nouveau?client=" + clientId);
  await page
    .getByLabel("Ajouter un article du catalogue")
    .selectOption({ label: "TEST-ACIER · Prestation de vérification" });
  await expect(
    page.getByLabel("Désignation ligne 1", { exact: true }),
  ).toHaveValue("Prestation de vérification");
  await page.getByLabel("Quantité ligne 1", { exact: true }).fill("10");
  await page
    .getByRole("button", { name: "Enregistrer le brouillon", exact: true })
    .click();
  await expect(page).toHaveURL(/\/devis\/c[a-z0-9]{20,}$/);
  const quoteId = page.url().split("/").pop()!;
  let quote = await db.document.findUniqueOrThrow({ where: { id: quoteId } });
  expect(Number(quote.totalTTC)).toBe(1200);
  await status(page, "Envoyé");
  await status(page, "Accepté");
  await page
    .getByRole("button", { name: "Créer la commande", exact: true })
    .click();
  await expect(page).toHaveURL(/\/commandes\/c[a-z0-9]{20,}$/);
  orderId = page.url().split("/").pop()!;
  await status(page, "Confirmé");
  const orderPdf = await page.request.get("/api/documents/" + orderId + "/pdf");
  expect(orderPdf.status()).toBe(200);
  await page.goto("/commandes/" + orderId + "/imprimer");
  expect(
    await page.locator(".print-page table thead th").allTextContents(),
  ).toEqual([
    "N°",
    "ARTICLE & DESCRIPTION",
    "QUANTITÉ",
    "P.U. HT",
    "MONTANT HT",
  ]);
  await expect(page.locator(".document-line-number").first()).toHaveText("01");
  await expect(page.locator(".client-card--business")).toBeVisible();
  await page.goto("/commandes/" + orderId);
  await page
    .getByRole("button", { name: "Préparer une livraison", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("spinbutton").fill("6");
  await page
    .getByRole("button", { name: "Créer le bon de livraison", exact: true })
    .click();
  await expect(page).toHaveURL(/\/livraisons\/c[a-z0-9]{20,}$/);
  const firstDelivery = page.url().split("/").pop()!;
  expect(
    Number(
      (
        await db.documentItem.findFirstOrThrow({
          where: { documentId: firstDelivery },
        })
      ).quantity,
    ),
  ).toBe(6);
  await status(page, "Préparé");
  await status(page, "Livré");
  await page
    .getByRole("button", { name: "Créer une facture", exact: true })
    .click();
  await expect(page).toHaveURL(/\/factures\/c[a-z0-9]{20,}$/);
  invoiceId = page.url().split("/").pop()!;
  await status(page, "Envoyé");
  const invoice = await db.document.findUniqueOrThrow({
    where: { id: invoiceId },
  });
  expect(Number(invoice.totalTTC)).toBe(720);
  expect(invoice.sourceId).toBe(firstDelivery);
  await page.goto("/commandes/" + orderId);
  await page
    .getByRole("button", { name: "Préparer une livraison", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("spinbutton")).toHaveValue(
    "4",
  );
  await page
    .getByRole("button", { name: "Créer le bon de livraison", exact: true })
    .click();
  await expect(page).toHaveURL(/\/livraisons\/c[a-z0-9]{20,}$/);
  await status(page, "Préparé");
  await status(page, "Livré");
  expect(
    (await db.document.findUniqueOrThrow({ where: { id: orderId } })).status,
  ).toBe("DELIVERED");
  await page.goto("/factures/" + invoiceId);
  await expect(page.getByText(quote.number, { exact: true })).toBeVisible();
  const pdf = await page.request.get("/api/documents/" + invoiceId + "/pdf");
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  const pdfBody = await pdf.body();
  expect(pdfBody.subarray(0, 4).toString()).toBe("%PDF");
  expect(pdfBody.toString("latin1")).toContain("/Subtype /Image");
  await page.goto("/factures/" + invoiceId + "/imprimer");
  await expect(page.locator(".document-line-number").first()).toHaveText("01");
  await page.goto("/factures/" + invoiceId + "/modifier");
  await expect(page.getByText(/Ce document est protégé/)).toBeVisible();
  quote = await db.document.findUniqueOrThrow({ where: { id: quoteId } });
  expect(quote.status).toBe("CONVERTED");
});
test("private customers receive the individual document design", async ({
  page,
}) => {
  await login(page);
  await page.goto("/clients/nouveau");
  await page.getByLabel("Type de client").selectOption("Particulier");
  await page.getByLabel("Raison sociale / Nom").fill("Client particulier QA");
  await page.getByLabel("Téléphone").fill("0600000000");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page).toHaveURL(/\/clients\/c[a-z0-9]{20,}$/);
  const privateClientId = page.url().split("/").pop()!;
  await page.goto("/devis/nouveau?client=" + privateClientId);
  await page
    .getByLabel("Désignation ligne 1", { exact: true })
    .fill("Service de vérification");
  await page.getByLabel("Prix HT ligne 1", { exact: true }).fill("250");
  await page
    .getByRole("button", { name: "Enregistrer le brouillon", exact: true })
    .click();
  await expect(page).toHaveURL(/\/devis\/c[a-z0-9]{20,}$/);
  const privateQuoteId = page.url().split("/").pop()!;
  await page.goto("/devis/" + privateQuoteId + "/imprimer");
  await expect(page.locator(".client-card--individual")).toBeVisible();
  await expect(
    page.locator(".client-card--individual .detail-label"),
  ).toHaveText("Client particulier");
  await expect(
    page.locator(".client-card--individual").getByText(/ICE|IF|RC/),
  ).toHaveCount(0);
  const privatePdf = await page.request.get(
    "/api/documents/" + privateQuoteId + "/pdf",
  );
  expect(privatePdf.status()).toBe(200);
});
test("partial and concurrent payments cannot exceed the invoice balance", async ({
  page,
  browser,
}) => {
  await login(page);
  await page.goto("/factures/" + invoiceId);
  await page
    .getByRole("button", { name: "Enregistrer un paiement", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel(/^Montant MAD/)
    .fill("200");
  const submitted = page.waitForRequest(
    (r) => r.method() === "POST" && !!r.headers()["next-action"],
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Enregistrer le paiement", exact: true })
    .click();
  await expect(
    page.getByText("Paiement enregistré. Le solde a été actualisé.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(
    (await db.document.findUniqueOrThrow({ where: { id: invoiceId } })).status,
  ).toBe("PARTIAL");
  const submission = await submitted;
  const actionHeaders = submission.headers();
  const replay = await page.request.post(submission.url(), {
    headers: {
      "next-action": actionHeaders["next-action"],
      "content-type": actionHeaders["content-type"],
      accept: "text/x-component",
      origin: base,
    },
    data: submission.postData()!,
  });
  expect(replay.status()).toBe(200);
  expect(await db.payment.count({ where: { invoiceId } })).toBe(1);
  const state = await page.context().storageState(),
    contexts = await Promise.all([
      browser.newContext({ storageState: state }),
      browser.newContext({ storageState: state }),
    ]);
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  await Promise.all(
    pages.map(async (p) => {
      await p.goto("/paiements/nouveau");
      await p.getByLabel("Facture *", { exact: true }).selectOption(invoiceId);
      await p.getByLabel(/^Montant MAD/).fill("400");
    }),
  );
  await Promise.all(
    pages.map((p) =>
      p
        .getByRole("button", { name: "Enregistrer le paiement", exact: true })
        .click(),
    ),
  );
  await expect
    .poll(async () => db.payment.count({ where: { invoiceId } }))
    .toBe(2);
  const paid = (await db.payment.findMany({ where: { invoiceId } })).reduce(
    (s, p) => s + Number(p.amount),
    0,
  );
  expect(paid).toBe(600);
  await Promise.all(contexts.map((c) => c.close()));
  await page.goto("/factures/" + invoiceId);
  await page
    .getByRole("button", { name: "Enregistrer un paiement", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel(/^Montant MAD/)
    .fill("120");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Enregistrer le paiement", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await db.document.findUniqueOrThrow({ where: { id: invoiceId } }))
          .status,
    )
    .toBe("PAID");
});
test("concurrent document creation uses unique sequential numbers", async ({
  page,
  browser,
}) => {
  await login(page);
  const state = await page.context().storageState(),
    contexts = await Promise.all(
      Array.from({ length: 5 }, () =>
        browser.newContext({ storageState: state }),
      ),
    );
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  await Promise.all(
    pages.map(async (p, n) => {
      await p.goto("/devis/nouveau?client=" + clientId);
      await p
        .getByLabel("Désignation ligne 1", { exact: true })
        .fill("Devis simultané " + n);
      await p.getByLabel("Prix HT ligne 1", { exact: true }).fill("10");
    }),
  );
  await Promise.all(
    pages.map(async (p) => {
      await p
        .getByRole("button", { name: "Enregistrer le brouillon", exact: true })
        .click();
      await expect(p).toHaveURL(/\/devis\/c[a-z0-9]{20,}$/);
    }),
  );
  const docs = await db.document.findMany({
    where: { kind: "QUOTE" },
    orderBy: { number: "asc" },
  });
  expect(docs).toHaveLength(6);
  expect(new Set(docs.map((d) => d.number)).size).toBe(6);
  const sequence = await db.documentSequence.findUniqueOrThrow({
    where: { id: "DEV-" + new Date().getFullYear() },
  });
  expect(sequence.value).toBe(6);
  await Promise.all(contexts.map((c) => c.close()));
});
test("snapshots, archive preservation, and invoice permissions", async ({
  page,
  browser,
}) => {
  await login(page);
  const original = await db.document.findUniqueOrThrow({
    where: { id: invoiceId },
  });
  await page.goto("/clients/" + clientId + "/modifier");
  await page
    .getByLabel("Raison sociale / Nom")
    .fill("Client renommé après facture");
  const clientSubmission = page.waitForRequest(
    (r) => r.method() === "POST" && !!r.headers()["next-action"],
  );
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page).toHaveURL(base + "/clients/" + clientId);
  const savedRequest = await clientSubmission;
  const unchanged = await db.document.findUniqueOrThrow({
    where: { id: invoiceId },
  });
  expect(unchanged.clientSnapshot).toEqual(original.clientSnapshot);
  expect(unchanged.companySnapshot).toEqual(original.companySnapshot);
  await page.getByRole("button", { name: "Archiver", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmer", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await db.client.findUniqueOrThrow({ where: { id: clientId } }))
          .archived,
    )
    .toBe(true);
  expect(await db.document.count({ where: { clientId } })).toBeGreaterThan(0);
  const staff = await db.user.create({
    data: {
      name: "Comptable de test",
      email: "accountant@ironz.invalid",
      role: "COMPTABILITE",
      passwordHash: await hashPassword(password),
    },
  });
  const context = await browser.newContext();
  const limited = await context.newPage();
  await login(limited, staff.email, password);
  await limited.goto("/utilisateurs");
  await expect(limited).toHaveURL(base + "/acces-refuse");
  await limited.goto("/clients/nouveau");
  await expect(limited).toHaveURL(base + "/acces-refuse");
  const deniedHeaders = savedRequest.headers();
  const deniedPayload = savedRequest
    .postData()!
    .replace("Client renommé après facture", "Modification interdite");
  const denied = await limited.request.post(savedRequest.url(), {
    headers: {
      "next-action": deniedHeaders["next-action"],
      "content-type": deniedHeaders["content-type"],
      accept: "text/x-component",
      origin: base,
    },
    data: deniedPayload,
  });
  expect(denied.status()).toBe(200);
  expect(await denied.text()).toContain("autorisation");
  expect(
    (await db.client.findUniqueOrThrow({ where: { id: clientId } })).name,
  ).toBe("Client renommé après facture");
  await limited.goto("/factures");
  await expect(
    limited.getByRole("heading", { name: "Factures.", exact: true }),
  ).toBeVisible();
  await context.close();
});
test("mobile layout adapts and navigation remains usable", async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Ouvrir la navigation", exact: true })
    .click();
  await page
    .locator("aside")
    .getByRole("link", { name: "Factures", exact: true })
    .click();
  await expect(page).toHaveURL(base + "/factures");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("administrator can create a collaborator and reset their password", async ({
  page,
  browser,
}) => {
  await login(page);
  await page.goto("/utilisateurs/nouveau");
  await page.getByLabel("Nom complet").fill("Commercial de vérification");
  await page
    .getByLabel("Email professionnel")
    .fill("commercial.qa@ironz.invalid");
  await page.getByLabel("Rôle").selectOption("COMMERCIAL");
  await page
    .getByLabel("Mot de passe initial (12 caractères minimum)")
    .fill("mot-de-passe-initial-test");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page).toHaveURL(base + "/utilisateurs");

  const row = page.getByRole("row").filter({
    hasText: "commercial.qa@ironz.invalid",
  });
  await row.getByRole("button", { name: "Mot de passe", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel(/Nouveau mot de passe/)
    .fill("mot-de-passe-remplace-test");
  await dialog
    .getByRole("button", { name: "Réinitialiser", exact: true })
    .click();
  await expect(page.getByText(/Mot de passe réinitialisé/)).toBeVisible();

  const context = await browser.newContext();
  const collaborator = await context.newPage();
  await login(
    collaborator,
    "commercial.qa@ironz.invalid",
    "mot-de-passe-remplace-test",
  );
  await collaborator.goto("/utilisateurs");
  await expect(collaborator).toHaveURL(base + "/acces-refuse");
  await context.close();
});
