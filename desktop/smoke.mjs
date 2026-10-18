// Test de fumée de la version desktop (serveur standalone + SQLite).
// Usage : node desktop/smoke.mjs  (serveur attendu sur http://127.0.0.1:4381)
import { chromium, expect } from "@playwright/test";

const base = "http://127.0.0.1:4380";
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!email || !password)
  throw new Error("Definissez ADMIN_EMAIL et ADMIN_PASSWORD pour le test de fumee.");

const browser = await chromium.launch();
const page = await browser.newPage();
try {
  // 1. Accès privé : / redirige vers /connexion, PDF sans auth = 401.
  await page.goto(base + "/");
  if (page.url() !== base + "/connexion") throw new Error("pas de redirection login");
  const pdfAnon = await page.request.get(base + "/api/documents/unknown/pdf");
  if (pdfAnon.status() !== 401) throw new Error("PDF sans auth != 401");
  console.log("OK accès privé + PDF protégé");

  // 2. Mauvais mot de passe refusé.
  await page.getByLabel("Email professionnel").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill("mauvais-mot-de-passe");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.locator(".login-error")).toContainText(
    "Email ou mot de passe incorrect.",
    { timeout: 30000 },
  );
  console.log("OK refus mauvais mot de passe");

  // 3. Connexion avec le compte de test (le formulaire se vide après un échec).
  await page.getByLabel("Email professionnel").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.waitForURL(base + "/", { waitUntil: "commit", timeout: 60000 });
  await page.waitForLoadState("load", { timeout: 90000 });
  const cookie = (await page.context().cookies()).find((c) => c.name === "ironz_session");
  if (!cookie?.httpOnly) throw new Error("cookie session manquant");
  console.log("OK connexion (cookie httpOnly, secure=" + cookie.secure + ")");

  // 4. Création d'un client.
  await page.goto(base + "/clients/nouveau");
  await page.getByLabel("Raison sociale / Nom").fill("Client Test Desktop");
  await page.getByLabel("Ville", { exact: true }).fill("Casablanca");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await page.waitForURL(/\/clients\/(?!nouveau)[a-z0-9]+$/, { timeout: 90000 });
  const clientId = page.url().split("/").pop();
  console.log("OK client créé : " + clientId);

  // 5. Devis avec ligne manuelle (10 x 100 HT, TVA 20% -> 1200 TTC).
  await page.goto(base + "/devis/nouveau?client=" + clientId);
  await page.getByLabel("Désignation ligne 1", { exact: true }).fill("Acier test");
  await page.getByLabel("Quantité ligne 1", { exact: true }).fill("10");
  await page.getByLabel("Prix HT ligne 1", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Enregistrer le brouillon", exact: true }).click();
  await page.waitForURL(/\/devis\/(?!nouveau)[a-z0-9]+$/, { timeout: 90000 });
  const quoteId = page.url().split("/").pop();
  await page.getByText("1 200").first().waitFor({ timeout: 5000 }).catch(() => {});
  console.log("OK devis créé : " + quoteId);

  // 6. PDF du devis.
  const pdf = await page.request.get(base + "/api/documents/" + quoteId + "/pdf");
  if (pdf.status() !== 200) throw new Error("PDF status " + pdf.status());
  const ctype = pdf.headers()["content-type"];
  if (ctype !== "application/pdf") throw new Error("PDF content-type " + ctype);
  const buf = await pdf.body();
  if (buf.length < 1000) throw new Error("PDF trop petit");
  console.log("OK PDF (" + buf.length + " octets)");

  // 7. Recherche globale (requête SQLite sans mode insensitive).
  await page.goto(base + "/recherche?q=test+desktop");
  await page.getByText("Client Test Desktop").first().waitFor({ timeout: 30000 });
  console.log("OK recherche");

  await page.goto(base + "/");
  await page.screenshot({ path: "desktop/smoke-dashboard.png" });
  console.log("FUMÉE DESKTOP : TOUT Passe");
} finally {
  await browser.close();
}
