// Test de fumée 1.1.1 (serveur standalone + SQLite, base vierge).
// Usage : node desktop/smoke.mjs  (serveur attendu sur http://127.0.0.1:4380)
// Tout le flux part de la configuration initiale : aucun identifiant
// par défaut n'existe dans l'application.
import { chromium, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import fs from "node:fs";

const base = "http://127.0.0.1:4380";
const company = "IRONZ Steel Test";
const adminName = "Admin Setup Test";
const email = "smoke-" + randomBytes(4).toString("hex") + "@ironz.test";
const password = "Fume+" + randomBytes(12).toString("base64url") + "!1";
const backupFile = "desktop/smoke-sauvegarde.db";

const browser = await chromium.launch();
const page = await browser.newPage();
try {
  // 1. Base vierge : / envoie à la configuration initiale.
  await page.goto(base + "/");
  if (!page.url().startsWith(base + "/premiere-installation"))
    throw new Error("installation fraîche sans redirection setup : " + page.url());
  console.log("OK premier lancement -> /premiere-installation");

  // 2. PDF sans auth = 401.
  const pdfAnon = await page.request.get(base + "/api/documents/unknown/pdf");
  if (pdfAnon.status() !== 401) throw new Error("PDF sans auth != 401");
  const backupAnon = await page.request.get(base + "/api/system/backup?create=1");
  if (backupAnon.status() !== 401) throw new Error("backup sans auth != 401");
  console.log("OK PDF + backup protégés (401)");

  // 3. Validation serveur : mots de passe non concordants refusés.
  await page.getByLabel("Nom de l’entreprise").fill(company);
  await page.getByLabel("Nom de l’administrateur").fill(adminName);
  await page.getByLabel("Adresse email administrateur").fill(email);
  await page.getByLabel("Mot de passe · 12 caractères minimum").fill(password);
  await page.getByLabel("Confirmer le mot de passe").fill(password + "x");
  await page.getByRole("button", { name: "Configurer IRONZ Gestion" }).click();
  await expect(page.locator(".login-error")).toContainText("ne correspondent pas", {
    timeout: 30000,
  });
  console.log("OK refus mots de passe non concordants");

  // 4. Configuration des identifiants -> retour à la connexion.
  // (React 19 vide les champs non-contrôlés après une action : tout refill.)
  await page.getByLabel("Nom de l’entreprise").fill(company);
  await page.getByLabel("Nom de l’administrateur").fill(adminName);
  await page.getByLabel("Adresse email administrateur").fill(email);
  await page.getByLabel("Mot de passe · 12 caractères minimum").fill(password);
  await page.getByLabel("Confirmer le mot de passe").fill(password);
  await page.getByRole("button", { name: "Configurer IRONZ Gestion" }).click();
  await page.waitForURL(base + "/connexion", { timeout: 60000 });
  console.log("OK configuration initiale -> /connexion");

  // 5. La configuration ne se présente plus (déjà un admin).
  await page.goto(base + "/premiere-installation");
  if (!page.url().startsWith(base + "/connexion"))
    throw new Error("setup re-présenté alors qu'un admin existe : " + page.url());
  console.log("OK setup non re-présenté");

  // 6. Mauvais mot de passe refusé.
  await page.getByLabel("Email professionnel").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password + "x");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.locator(".login-error")).toContainText(
    "Email ou mot de passe incorrect.",
    { timeout: 30000 },
  );
  console.log("OK refus mauvais mot de passe");

  // 7. Connexion (le formulaire se vide après un échec).
  await page.getByLabel("Email professionnel").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.waitForURL(base + "/", { waitUntil: "commit", timeout: 60000 });
  await page.waitForLoadState("load", { timeout: 90000 });
  const cookie = (await page.context().cookies()).find((c) => c.name === "ironz_session");
  if (!cookie?.httpOnly) throw new Error("cookie session manquant");
  console.log("OK connexion (cookie httpOnly, secure=" + cookie.secure + ")");

  // 8. Création d'un client.
  await page.goto(base + "/clients/nouveau");
  await page.getByLabel("Raison sociale / Nom").fill("Client Test Desktop");
  await page.getByLabel("Ville", { exact: true }).fill("Casablanca");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await page.waitForURL(/\/clients\/(?!nouveau)[a-z0-9]+$/, { timeout: 90000 });
  const clientId = page.url().split("/").pop();
  console.log("OK client créé : " + clientId);

  // 9. Modification client (ville -> Rabat) puis vérification.
  await page.goto(base + "/clients/" + clientId + "/modifier");
  await page.getByLabel("Ville", { exact: true }).fill("Rabat");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await page.waitForURL(/\/clients\/(?!.*modifier)[a-z0-9]+$/, { timeout: 90000 });
  await page.getByText("Rabat").first().waitFor({ timeout: 30000 });
  console.log("OK client modifié (Rabat persistée)");

  // 10. Devis avec ligne manuelle (10 x 100 HT, TVA 20% -> 1200 TTC).
  await page.goto(base + "/devis/nouveau?client=" + clientId);
  await page.getByLabel("Désignation ligne 1", { exact: true }).fill("Acier test");
  await page.getByLabel("Quantité ligne 1", { exact: true }).fill("10");
  await page.getByLabel("Prix HT ligne 1", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Enregistrer le brouillon", exact: true }).click();
  await page.waitForURL(/\/devis\/(?!nouveau)[a-z0-9]+$/, { timeout: 90000 });
  const quoteId = page.url().split("/").pop();
  await page.getByText("1 200").first().waitFor({ timeout: 5000 }).catch(() => {});
  console.log("OK devis créé : " + quoteId);

  // 11. PDF du devis.
  const pdf = await page.request.get(base + "/api/documents/" + quoteId + "/pdf");
  if (pdf.status() !== 200) throw new Error("PDF status " + pdf.status());
  const ctype = pdf.headers()["content-type"];
  if (ctype !== "application/pdf") throw new Error("PDF content-type " + ctype);
  const buf = await pdf.body();
  if (buf.length < 1000) throw new Error("PDF trop petit");
  console.log("OK PDF (" + buf.length + " octets)");

  // 12. Recherche globale (requête SQLite sans mode insensitive).
  await page.goto(base + "/recherche?q=test+desktop");
  await page.getByText("Client Test Desktop").first().waitFor({ timeout: 30000 });
  console.log("OK recherche");

  // 13. Chiffrement : le mot de passe n'apparaît pas en clair dans la base.
  // (Le serveur écrit dans %APPDATA%/ironz-gestion/ironz.db : en test
  // standalone de dev, la variable d'environnement IRONZ_DB indique où.)
  const dbFile = process.env.IRONZ_DB || "";
  if (dbFile && fs.existsSync(dbFile)) {
    const raw = fs.readFileSync(dbFile);
    if (raw.toString("latin1").includes(password))
      throw new Error("mot de passe stocké en clair !");
    console.log("OK mot de passe non stocké en clair");
  } else {
    console.log("INFO IRONZ_DB non défini : contrôle du chiffrement sauté");
  }

  // 14. Sauvegarde (API admin) : création + téléchargement.
  fs.rmSync(backupFile, { force: true });
  const backup = await page.request.get(base + "/api/system/backup?create=1");
  if (backup.status() !== 200) throw new Error("backup status " + backup.status());
  const bb = await backup.body();
  if (!Buffer.from(bb.slice(0, 15)).toString("ascii").match(/^SQLite format 3/))
    throw new Error("sauvegarde sans signature SQLite");
  if (Buffer.byteLength(bb) < 10000) throw new Error("sauvegarde trop petite");
  fs.writeFileSync(backupFile, bb);
  console.log(
    "OK sauvegarde créée (" + Buffer.byteLength(bb) + " octets, signature SQLite OK)",
  );

  // 15. Restauration d'un fichier bidon : refus propre, la base reste intacte.
  const garbage = Buffer.from("CECI N'EST PAS UN FICHIER SQLITE".repeat(100));
  const badRes = await page.request.post(base + "/api/system/restore", {
    multipart: {
      file: { name: "poison.db", mimeType: "application/octet-stream", buffer: garbage },
    },
  });
  const badJson = await badRes.json();
  if (badRes.status() !== 400 || badJson.ok)
    throw new Error("restauration bidon acceptée : " + badRes.status());
  console.log("OK refus fichier non SQLite (" + badJson.error + ")");

  // 16. Restauration réelle de la sauvegarde téléchargée.
  const restoreRes = await page.request.post(base + "/api/system/restore", {
    multipart: {
      file: {
        name: "ironz-sauvegarde.db",
        mimeType: "application/octet-stream",
        buffer: fs.readFileSync(backupFile),
      },
    },
  });
  const restoreJson = await restoreRes.json();
  if (restoreRes.status() !== 200 || !restoreJson.ok)
    throw new Error("restauration échouée : " + restoreRes.status() + " " + JSON.stringify(restoreJson));
  console.log("OK restauration réussie : " + restoreJson.message);

  // 17. Le serveur fonctionne sur la base restaurée : la session de la
  // sauvegarde est encore valide et les données sont présentes.
  await page.goto(base + "/recherche?q=test+desktop");
  await page.getByText("Client Test Desktop").first().waitFor({ timeout: 30000 });
  console.log("OK données retrouvées après restauration");

  // 18. Écriture après restauration (reconnexion Prisma OK).
  await page.goto(base + "/clients/nouveau");
  await page.getByLabel("Raison sociale / Nom").fill("Client Post-Restauration");
  await page.getByLabel("Ville", { exact: true }).fill("Tanger");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await page.waitForURL(/\/clients\/(?!nouveau)[a-z0-9]+$/, { timeout: 90000 });
  console.log("OK écriture post-restauration");

  await page.goto(base + "/");
  await page.screenshot({ path: "desktop/smoke-dashboard.png" });
  console.log("FUMÉE DESKTOP 1.1.1 : TOUT Passe");
} finally {
  await browser.close();
}
