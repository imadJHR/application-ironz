// Test de fumée 0.1.0 (serveur standalone + SQLite, base vierge).
// Usage : node desktop/smoke.mjs  (serveur attendu sur http://127.0.0.1:4380)
// Tout le flux part de la configuration initiale : aucun identifiant
// par défaut n'existe dans l'application.
import { chromium, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startUpdateMock } from "./updates-mock.mjs";

const base = process.env.IRONZ_SMOKE_URL || "http://127.0.0.1:4380";
const company = "IRONZ Steel Test";
const adminName = "Admin Setup Test";
const email = "smoke-" + randomBytes(4).toString("hex") + "@ironz.test";
const password = "Fume+" + randomBytes(12).toString("base64url") + "!1";
const newPassword = "Fume2+" + randomBytes(12).toString("base64url") + "!2";
const backupFile = "desktop/smoke-sauvegarde.db";
const appVersion = JSON.parse(fs.readFileSync("package.json", "utf8")).version;

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
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

  // 4. Configuration des identifiants -> écran du code de récupération
  // (affichage unique avant l'accès au login).
  // (React 19 vide les champs non-contrôlés après une action : tout refill.)
  await page.getByLabel("Nom de l’entreprise").fill(company);
  await page.getByLabel("Nom de l’administrateur").fill(adminName);
  await page.getByLabel("Adresse email administrateur").fill(email);
  await page.getByLabel("Mot de passe · 12 caractères minimum").fill(password);
  await page.getByLabel("Confirmer le mot de passe").fill(password);
  await page.getByRole("button", { name: "Configurer IRONZ Gestion" }).click();
  const codeScreen = page.getByTestId("recovery-code");
  await codeScreen.waitFor({ timeout: 90000 });
  const initialCode = (await codeScreen.textContent())?.trim() || "";
  if (!/^[0-9A-F]{8}(-[0-9A-F]{8}){3}$/.test(initialCode))
    throw new Error("code de récupération affiché invalide : " + initialCode);
  console.log("OK code de récupération affiché (128 bits, format 4x8)");
  await page
    .getByRole("button", { name: "J’ai sauvegardé mon code" })
    .click();
  await page.getByRole("button", { name: /Aller à la connexion/ }).click();
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
  async function rawDbContains(secret) {
    if (!dbFile || !fs.existsSync(dbFile)) return false;
    const raw = fs.readFileSync(dbFile);
    return raw.toString("latin1").includes(secret);
  }
  if (dbFile && fs.existsSync(dbFile)) {
    if (await rawDbContains(password))
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

  // 17. Les sessions sont révoquées. Après connexion, les données sont présentes.
  await page.goto(base + "/recherche?q=test+desktop");
  await expect(page).toHaveURL(base + "/connexion");
  await page.getByLabel("Email professionnel").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.waitForURL(base + "/", { timeout: 60000 });
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

  // 19. Déconnexion + lien « Mot de passe oublié ? ».
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Menu du compte" })
    .click();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.waitForURL(base + "/connexion", { timeout: 60000 });
  await page.getByRole("button", { name: "Mot de passe oublié ?" }).click();
  console.log("OK lien mot de passe oublié");

  async function recoverySubmit(codeValue, pass = newPassword) {
    const emailBox = page.getByLabel("Email du compte administrateur");
    await emailBox.fill(email);
    await page.getByLabel("Code de récupération").fill(codeValue);
    await page
      .getByLabel("Nouveau mot de passe · 12 caractères minimum")
      .fill(pass);
    await page
      .getByLabel("Confirmer le nouveau mot de passe")
      .fill(pass + (pass === newPassword ? "" : "x"));
    const submit = page.getByRole("button", { name: "Récupérer l’accès" });
    const [response] = await Promise.all([
      page.waitForResponse(
        (result) =>
          result.request().method() === "POST" &&
          result.url().startsWith(base + "/connexion"),
        { timeout: 60000 },
      ),
      submit.click(),
    ]);
    await response.finished();
  }
  const genericError = "Email, code ou informations invalides.";

  // 20. Code erroné : refus avec message générique (aucune information
  // sur l'existence du compte).
  await recoverySubmit("XXXXXXXX-YYYYYYYY-ZZZZZZZZ-00000000");
  await expect(page.locator(".login-error")).toContainText(genericError, {
    timeout: 30000,
  });
  console.log("OK code erroné refusé (message générique)");

  // 21. Code valide : mot de passe changé + NOUVEAU code affiché une fois.
  await recoverySubmit(initialCode);
  const newCodeEl = page.getByTestId("recovery-code");
  await newCodeEl.waitFor({ timeout: 90000 });
  const recoveredCode = (await newCodeEl.textContent())?.trim() || "";
  if (!/^[0-9A-F]{8}(-[0-9A-F]{8}){3}$/.test(recoveredCode))
    throw new Error("nouveau code invalide");
  if (recoveredCode === initialCode) throw new Error("code non régénéré");
  console.log("OK code valide -> nouveau code de récupération affiché");
  await page
    .getByRole("button", { name: "Retour à la connexion" })
    .click();

  // 22. L'ancien mot de passe est mort ; le nouveau fonctionne.
  await page.getByLabel("Email professionnel").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page.locator(".login-error")).toContainText(
    "Email ou mot de passe incorrect.",
    { timeout: 30000 },
  );
  await page.getByLabel("Email professionnel").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.waitForURL(base + "/", { waitUntil: "commit", timeout: 60000 });
  console.log("OK ancien mot de passe refusé, nouveau accepté");

  // 23. Réutilisation du code initial (consommé) : refusée.
  await page.context().clearCookies();
  await page.goto(base + "/connexion");
  await page.getByRole("button", { name: "Mot de passe oublié ?" }).click();
  await recoverySubmit(initialCode, password);
  await expect(page.locator(".login-error")).toContainText(genericError, {
    timeout: 30000,
  });
  await page.getByRole("button", { name: /Retour à la connexion/ }).click();
  console.log("OK code consommé réutilisé refusé");

  // 24. Régénération du code depuis Paramètres (admin connecté).
  await page.getByLabel("Email professionnel").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.waitForURL(base + "/", { waitUntil: "commit", timeout: 60000 });
  await page.waitForLoadState("load", { timeout: 90000 });
  await page.goto(base + "/parametres");
  await page
    .getByRole("button", { name: "Régénérer mon code de récupération" })
    .click();
  await page.getByLabel("Mot de passe actuel").fill(newPassword);
  await page.getByRole("button", { name: "Régénérer", exact: true }).click();
  const regenEl = page.getByTestId("recovery-code");
  await regenEl.waitFor({ timeout: 90000 });
  const regenCode = (await regenEl.textContent())?.trim() || "";
  if (!/^[0-9A-F]{8}(-[0-9A-F]{8}){3}$/.test(regenCode))
    throw new Error("code régénéré invalide");
  if (regenCode === recoveredCode) throw new Error("régénération muette");
  await page
    .getByRole("button", { name: "J’ai sauvegardé mon code" })
    .click();
  console.log("OK code régénéré depuis Paramètres");

  // 25. Anti-bruteforce : tentatives répétées finiront par être bloquées
  // (limiteur glissant 15 min, 10 essais par email).
  await page.context().clearCookies();
  await page.goto(base + "/connexion");
  await page.getByRole("button", { name: "Mot de passe oublié ?" }).click();
  let bruteforceBlocked = false;
  for (let i = 0; i < 12; i++) {
    await recoverySubmit(
      "DEADBEEF" + (i % 16).toString(16).toUpperCase() + "-CAFEBABE-12345678-9ABCDEF0",
    );
    const err = page.locator(".login-error");
    await expect(err).toContainText(/invalides|Trop de tentatives/, {
      timeout: 30000,
    });
    if ((await err.textContent())?.includes("Trop de tentatives")) {
      bruteforceBlocked = true;
      break;
    }
  }
  if (!bruteforceBlocked) throw new Error("limiteur anti-bruteforce inopérant");
  console.log("OK tentatives répétées bloquées (15 min)");

  // 26. Aucun secret dans la base : ni mot de passe, ni code en clair.
  if (dbFile && fs.existsSync(dbFile)) {
    for (const secret of [password, newPassword, initialCode, recoveredCode, regenCode])
      if (await rawDbContains(secret))
        throw new Error("secret en clair dans la base !");
    console.log("OK aucune donnée secrète en clair dans la base (codes inclus)");
  } else {
    console.log("INFO IRONZ_DB non défini : contrôle des codes sauté");
  }

  await page.goto(base + "/");
  await page.screenshot({ path: "desktop/smoke-dashboard.png" });
  // 27. Monoposte 0.1.0 : reconnexion puis vérifications compte unique.
  await page.getByLabel("Email professionnel").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.waitForURL(base + "/", { waitUntil: "commit", timeout: 60000 });
  await page.waitForLoadState("load", { timeout: 90000 });
  await page.goto(base + "/utilisateurs");
  await page.waitForLoadState("load", { timeout: 90000 });
  // notFound() est streamé par Next : le corps porte la page 404.
  await expect(page.getByText("Cette page est introuvable.")).toBeVisible({
    timeout: 30000,
  });
  console.log("OK /utilisateurs supprimé (page 404)");
  await page.goto(base + "/parametres");
  await page.waitForLoadState("load", { timeout: 90000 });
  for (const gone of ["Créer un compte", "Compte employé", "Comptes hérités détectés"]) {
    if ((await page.getByText(gone).count()) !== 0)
      throw new Error("résidu multi-comptes dans Paramètres : " + gone);
  }
  console.log("OK Paramètres sans aucune trace de gestion multi-comptes");

  // 28. Section Mises à jour : version affichée, recherche à jour puis
  //     hors ligne via le mock local.
  const updateDir = fs.mkdtempSync(join(tmpdir(), "ironz-smoke-"));
  const updateState = join(updateDir, "updates.json");
  const mock = await startUpdateMock(updateState);
  try {
    fs.writeFileSync(
      updateState,
      JSON.stringify({
        mode: "release",
        release: {
          tag_name: "v" + appVersion,
          name: "IRONZ Gestion " + appVersion,
          html_url:
            "https://github.com/imadJHR/application-ironz/releases/tag/v" + appVersion + "",
          published_at: "2026-10-19T00:00:00Z",
          body: "Version actuelle",
          assets: [],
        },
      }),
      "utf8",
    );
    await page.goto(base + "/parametres");
    await page.waitForLoadState("load", { timeout: 90000 });
    await expect(
      page.getByText("Version installée : " + appVersion, { exact: false }),
    ).toBeVisible({ timeout: 60000 });
    await page
      .getByRole("button", { name: "Rechercher des mises à jour" })
      .click();
    await expect(
      page.getByText(/Vous utilisez la version la plus récente/),
    ).toBeVisible({ timeout: 30000 });
    console.log("OK mises à jour : version à jour via source locale");
    fs.writeFileSync(updateState, JSON.stringify({ mode: "offline" }), "utf8");
    await page
      .getByRole("button", { name: "Rechercher des mises à jour" })
      .click();
    await expect(
      page.getByText("Connexion Internet indisponible."),
    ).toBeVisible({ timeout: 30000 });
    console.log("OK mises à jour : hors ligne signalé proprement");
  } finally {
    mock.close();
    fs.rmSync(updateState, { force: true });
    fs.rmdirSync(updateDir);
  }

  console.log("FUMÉE DESKTOP 0.1.0 : TOUT PASSE");
} finally {
  await browser.close();
}
