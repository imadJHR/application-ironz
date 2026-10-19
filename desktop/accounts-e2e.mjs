// Test e2e : base multi-comptes héritée -> panneau de conflit ->
// fusion validée par le mot de passe admin -> réaffectation intégrale ->
// compte hérité supprimé -> ses identifiants refusés à la connexion.
import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const project = "C:/Users/imadj/Desktop/app-ironz/application-ironz";
const { PrismaClient } = require(
  path.resolve(project + "/src/generated/prisma-desktop/index.js"),
);
const dir = "C:/Users/imadj/AppData/Local/Temp/opencode";
const base = "http://127.0.0.1:4380";
const file = dir + "/two-users.db";
const adminEmail = "admin@ironz.test";
const adminPass = fs.readFileSync(dir + "/two-users-admin-pass.txt", "utf8");
const extraEmail = fs.readFileSync(dir + "/two-users-extra-email.txt", "utf8");
const extraPass = fs.readFileSync(dir + "/two-users-extra-pass.txt", "utf8");
const db = new PrismaClient({
  datasources: { db: { url: "file:" + file.replace(/\\/g, "/") } },
});
const browser = await chromium.launch();
let page;
try {
  page = await browser.newPage();

  // 1. La base multi-comptes ne déclenche PAS la configuration initiale
  //    (un admin existe déjà) : connexion directe.
  await page.goto(base + "/");
  if (!page.url().endsWith("/connexion"))
    throw new Error("setup présenté alors qu'un admin existe : " + page.url());
  console.log("OK base deux comptes : connexion directe (pas de setup)");

  // 2. Le compte hérité ne peut PAS se connecter (refus générique).
  await page.getByLabel("Email professionnel").fill(extraEmail);
  await page.getByLabel("Mot de passe", { exact: true }).fill(extraPass);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.waitForLoadState("load", { timeout: 60000 });
  await expect(
    page.locator(".login-error, .login-banner"),
  ).toContainText(/identifiants|incorrect/i, { timeout: 30000 });
  console.log("OK compte hérité refusé à la connexion (message générique)");

  // 3. L'administrateur se connecte : son mot de passe fonctionne.
  await page.getByLabel("Email professionnel").fill(adminEmail);
  await page.getByLabel("Mot de passe", { exact: true }).fill(adminPass);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.waitForURL(base + "/", { waitUntil: "commit", timeout: 60000 });
  await page.waitForLoadState("load", { timeout: 90000 });
  console.log("OK admin connecté sur base deux comptes");

  // 4. La route /utilisateurs n'existe plus (notFound streamé : le corps
  //    porte la page 404).
  await page.goto(base + "/utilisateurs");
  await page.waitForLoadState("load", { timeout: 90000 });
  await expect(page.getByText("Cette page est introuvable.")).toBeVisible({
    timeout: 30000,
  });
  console.log("OK /utilisateurs supprimé (page 404)");
  await page.goto(base + "/");

  // 5. Paramètres : panneau de conflit présent avec le compte hérité.
  await page.goto(base + "/parametres");
  await page.waitForLoadState("load", { timeout: 90000 });
  await expect(page.getByText("Comptes hérités détectés")).toBeVisible({
    timeout: 60000,
  });
  await expect(page.getByText(extraEmail)).toBeVisible();
  await expect(page.locator("table").getByText("Slimane Commercial")).toBeVisible();
  console.log("OK panneau de conflit listé avec historique (1/1/1)");

  // 6. Mot de passe admin erroné : la fusion est refusée, compte intact.
  await page
    .getByRole("button", { name: "Fusionner dans mon compte" })
    .click();
  await page.getByLabel("Votre mot de passe actuel").fill("Mauvais+Pass123!");
  await page.getByRole("button", { name: "Confirmer la fusion" }).click();
  await expect(page.getByText("Mot de passe actuel incorrect.")).toBeVisible({
    timeout: 30000,
  });
  const stillThere = await db.user.findUnique({
    where: { email: extraEmail },
  });
  if (!stillThere) throw new Error("compte hérité supprimé malgré mot de passe erroné");
  console.log("OK fusion refusée avec mot de passe erroné ( données intactes )");

  // 7. Fusion avec le bon mot de passe.
  await page.getByLabel("Votre mot de passe actuel").fill(adminPass);
  await page.getByRole("button", { name: "Confirmer la fusion" }).click();
  await page.waitForLoadState("load", { timeout: 90000 });
  await expect(page.getByText("Comptes hérités détectés")).toHaveCount(0, {
    timeout: 60000,
  });
  console.log("OK fusion confirmée : panneau disparu");

  // 8. Vérification base : plus qu'un utilisateur, tout est réaffecté.
  const users = await db.user.findMany();
  if (users.length !== 1 || users[0].email !== adminEmail)
    throw new Error("users = " + JSON.stringify(users.map((u) => u.email)));
  const doc = await db.document.findUnique({ where: { id: "facturex1" } });
  const pay = await db.payment.findUnique({ where: { id: "paiementx1" } });
  const acts = await db.activityLog.findMany();
  if (doc?.createdById !== "adminbase1" || pay?.createdById !== "adminbase1")
    throw new Error("réaffectation document/paiement manquante");
  if (!acts.every((a) => a.userId === "adminbase1"))
    throw new Error("réaffectation journal manquante");
  if (!acts.some((a) => a.action === "Compte fusionné dans le compte administrateur"))
    throw new Error("entrée de journal de fusion absente");
  console.log("OK base : 1 utilisateur, historique 100 % réaffecté à l'admin");

  // 9. Les données restent visibles dans l'interface (document conservé).
  await page.goto(base + "/factures");
  await page.waitForLoadState("load", { timeout: 90000 });
  await expect(page.getByText("FA-2026-0001")).toBeVisible({
    timeout: 60000,
  });
  console.log("OK document hérité visible côté admin (aucune perte)");

  // 10. L'identité du compte fusionné ne fonctionne plus du tout.
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Menu du compte" })
    .click();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.waitForURL(base + "/connexion", { timeout: 60000 });
  await page.getByLabel("Email professionnel").fill(extraEmail);
  await page.getByLabel("Mot de passe", { exact: true }).fill(extraPass);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.waitForLoadState("load", { timeout: 60000 });
  await expect(
    page.locator(".login-error, .login-banner"),
  ).toContainText(/identifiants|incorrect/i, { timeout: 30000 });
  console.log("OK compte fusionné : identifiants définitivement invalides");

  console.log("COMPTE UNIQUE : TOUT PASSE");
} finally {
  await browser.close();
  await db.$disconnect().catch(() => {});
}
