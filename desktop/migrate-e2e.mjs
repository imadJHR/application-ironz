// Monte de version réelle : serveur 1.1.2 sur une base héritée sans
// RecoveryCode. L'admin se connecte avec son ancien mot de passe, crée
// son code de récupération depuis Paramètres (migration runtime), puis
// le code est utilisable (récupération complète).
import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
import { randomBytes } from "node:crypto";
const base = "http://127.0.0.1:4380";
const email = "heritage@ironz.test";
const oldPass = fs.readFileSync(
  "C:/Users/imadj/AppData/Local/Temp/opencode/legacy-pass.txt",
  "utf8",
);
const newPass = "Her2+" + randomBytes(12).toString("base64url") + "!2a";
const browser = await chromium.launch();
const page = await browser.newPage();
try {
  // 1. La base héritée ne déclenche PAS la configuration initiale.
  await page.goto(base + "/");
  if (!page.url().endsWith("/connexion"))
    throw new Error("setup représenté sur base héritée : " + page.url());
  console.log("OK base héritée : connexion directe (pas de setup)");

  // 2. Lien récupération : sans code existant, le message est générique.
  await page.getByRole("button", { name: "Mot de passe oublié ?" }).click();
  await page.getByLabel("Email du compte administrateur").fill(email);
  await page
    .getByLabel("Code de récupération")
    .fill("AAAAAAAA-BBBBBBBB-CCCCCCCC-DDDDDDDD");
  await page
    .getByLabel("Nouveau mot de passe · 12 caractères minimum")
    .fill(newPass);
  await page
    .getByLabel("Confirmer le nouveau mot de passe")
    .fill(newPass);
  await page.getByRole("button", { name: "Récupérer l’accès" }).click();
  await expect(page.locator(".login-error")).toContainText(
    "Email, code ou informations invalides.",
    { timeout: 30000 },
  );
  console.log("OK récupération sans code refusée (message générique)");
  await page.getByRole("button", { name: /Retour à la connexion/ }).click();

  // 3. L'ancien mot de passe fonctionne toujours (1.1.1 → 1.1.2 sans perte).
  await page.getByLabel("Email professionnel").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(oldPass);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.waitForURL(base + "/", { waitUntil: "commit", timeout: 60000 });
  await page.waitForLoadState("load", { timeout: 90000 });
  console.log("OK ancien mot de passe accepté sur base héritée");

  // 4. Paramètres : création du code (migration runtime de la table).
  await page.goto(base + "/parametres");
  await page
    .getByRole("button", { name: "Créer mon code de récupération" })
    .click();
  await page.getByLabel("Mot de passe actuel").fill(oldPass);
  await page.getByRole("button", { name: "Régénérer", exact: true }).click();
  const codeEl = page.getByTestId("recovery-code");
  await codeEl.waitFor({ timeout: 90000 });
  const newCode = (await codeEl.textContent())?.trim() || "";
  if (!/^[0-9A-F]{8}(-[0-9A-F]{8}){3}$/.test(newCode))
    throw new Error("code créé invalide");
  await page.getByRole("button", { name: "J’ai sauvegardé mon code" }).click();
  console.log("OK code créé depuis Paramètres (table migrée au runtime)");

  // 5. Le code fonctionne : récupération complète sur la base migrée.
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Menu du compte" })
    .click();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.waitForURL(base + "/connexion", { timeout: 60000 });
  await page.getByRole("button", { name: "Mot de passe oublié ?" }).click();
  await page.getByLabel("Email du compte administrateur").fill(email);
  await page.getByLabel("Code de récupération").fill(newCode);
  await page
    .getByLabel("Nouveau mot de passe · 12 caractères minimum")
    .fill(newPass);
  await page
    .getByLabel("Confirmer le nouveau mot de passe")
    .fill(newPass);
  await page.getByRole("button", { name: "Récupérer l’accès" }).click();
  const newCodeEl = page.getByTestId("recovery-code");
  await newCodeEl.waitFor({ timeout: 90000 });
  if (!/^[0-9A-F]{8}(-[0-9A-F]{8}){3}$/.test((await newCodeEl.textContent())?.trim() || ""))
    throw new Error("code de roulement invalide");
  console.log("OK récupération complète sur base héritée (mot de passe changé)");
  console.log("MONTE DE VERSION 1.1.1 -> 1.1.2 : TOUT PASSE");
} finally {
  await browser.close();
}
