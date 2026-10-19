// Test e2e : section Paramètres ▸ Mises à jour (version dynamique).
// Scénarios : version à jour, nouvelle version, lien GitHub invalide,
// absence d'Internet, erreur réseau, réponse illisible, zéro release.
// Aucune donnée commerciale ne doit quitter le poste, la base ne doit
// pas être modifiée, rien ne doit être installé/executé automatiquement.
import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
import { createRequire } from "node:module";
import { startUpdateMock } from "./updates-mock.mjs";

const require = createRequire(import.meta.url);
const project = "C:/Users/imadj/Desktop/app-ironz/application-ironz";
const { PrismaClient } = require(
  path.join(project, "src/generated/prisma-desktop/index.js"),
);
import path from "node:path";
import { createHash } from "node:crypto";
const dir = "C:/Users/imadj/AppData/Local/Temp/opencode";
const base = "http://127.0.0.1:4380";
const file = dir + "/single-user.db";
const stateFile = dir + "/updates-mock-state.json";
const adminEmail = fs.readFileSync(dir + "/single-email.txt", "utf8");
const adminPass = fs.readFileSync(dir + "/single-pass.txt", "utf8");
const db = new PrismaClient({
  datasources: { db: { url: "file:" + file.replace(/\\/g, "/") } },
});
const mkState = (obj) =>
  fs.writeFileSync(stateFile, JSON.stringify(obj), "utf8");
const version = JSON.parse(
  fs.readFileSync(path.join(project, "package.json"), "utf8"),
).version;

const DOWNLOAD_URL =
  "https://github.com/imadJHR/application-ironz/releases/download/v0.1.3/IRONZ-Gestion-Setup-0.1.3.exe";
const OFFICIAL_OVERVIEW =
  "https://github.com/imadJHR/application-ironz/releases/latest";

function hashDb() {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

let mock;
const browser = await chromium.launch();
let page;
try {
  mock = await startUpdateMock(stateFile);
  page = await browser.newPage();

  // 1. Connexion admin.
  await page.goto(base + "/");
  if (!page.url().endsWith("/connexion"))
    throw new Error("base à un admin : setup présenté : " + page.url());
  await page.getByLabel("Email professionnel").fill(adminEmail);
  await page.getByLabel("Mot de passe", { exact: true }).fill(adminPass);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.waitForURL(base + "/", { waitUntil: "commit", timeout: 60000 });
  await page.waitForLoadState("load", { timeout: 90000 });
  console.log("OK connexion admin (base single-user)");
  // Toute écriture (session, tentatives de connexion) est faite : la suite
  // (vérifications de mises à jour) doit laisser la base inchangée.
  const hashBefore = hashDb();

  // 2. Section Mises à jour visible + version installée.
  await page.goto(base + "/parametres");
  await page.waitForLoadState("load", { timeout: 90000 });
  await expect(
    page.getByText("Version installée :", { exact: false })).toBeVisible({
    timeout: 60000,
  });
  await expect(
    page.getByText("Version installée : " + version, { exact: false }),
  ).toBeVisible();
  console.log("OK section Mises à jour + version installée affichée");

  // 3. Version à jour (mock tag v(version)).
  mkState({
    mode: "release",
    release: {
      tag_name: "v" + version,
      name: "IRONZ Gestion " + version,
      html_url:
        "https://github.com/imadJHR/application-ironz/releases/tag/v" + version,
      published_at: "2026-10-25T00:00:00Z",
      body: "Version actuelle",
      assets: [],
    },
  });
  await page
    .getByRole("button", { name: "Rechercher des mises à jour" })
    .click();
  await expect(
    page.getByText(/Vous utilisez la version la plus récente/),
  ).toBeVisible({ timeout: 30000 });
  console.log("OK version à jour signalée (aucun lien de téléchargement)");
  if ((await page.locator('a[href^="https://github.com"]').count()) !== 0)
    throw new Error("lien de téléchargement présent alors qu'à jour");

  // 4. Nouvelle version disponible + détails + lien officiel.
  mkState({
    mode: "release",
    release: {
      tag_name: "v0.1.3",
      name: "IRONZ Gestion 0.1.3",
      html_url:
        "https://github.com/imadJHR/application-ironz/releases/tag/v0.1.3",
      published_at: "2026-10-25T00:00:00Z",
      body: "Nouvelles fonctions :\n- Vérification des mises à jour dans Paramètres\n- Installateur exécuté manuellement, jamais automatiquement",
      assets: [
        {
          name: "IRONZ-Gestion-Setup-0.1.3.exe",
          browser_download_url: DOWNLOAD_URL,
        },
      ],
    },
  });
  await page
    .getByRole("button", { name: "Rechercher des mises à jour" })
    .click();
  const download = page.locator('a.btn:has-text("Télécharger la mise à jour")');
  await download.waitFor({ timeout: 60000 });
  const href = await download.getAttribute("href");
  if (href !== DOWNLOAD_URL)
    throw new Error("lien téléchargement inattendu : " + href);
  if ((await download.getAttribute("target")) !== "_blank")
    throw new Error("pas d'ouverture navigateur (target _blank)");
  await expect(page.getByText("Nouvelle version 0.1.3")).toBeVisible();
  await expect(page.getByText(/Vérification des mises à jour/)).toBeVisible();
  console.log("OK nouvelle version : numéro + nouveautés + lien officiel exact");

  // 5. Lien GitHub invalide : remplacé par la page officielle.
  mkState({
    mode: "release",
    release: {
      tag_name: "v0.1.3",
      name: "IRONZ Gestion 0.1.3",
      html_url:
        "https://github.com/imadJHR/application-ironz/releases/tag/v0.1.3",
      published_at: "2026-10-25T00:00:00Z",
      body: "Notes",
      assets: [
        {
          name: "IRONZ-Gestion-Setup-0.1.3.exe",
          browser_download_url: "https://evil.example.com/payload.exe",
        },
      ],
    },
  });
  await page
    .getByRole("button", { name: "Rechercher des mises à jour" })
    .click();
  const safe = page.locator('a.btn:has-text("Télécharger la mise à jour")');
  await safe.waitFor({ timeout: 60000 });
  const href2 = await safe.getAttribute("href");
  if (href2 !== OFFICIAL_OVERVIEW)
    throw new Error("lien non filtré : " + href2);
  const html = await page.content();
  if (html.includes("evil.example.com"))
    throw new Error("lien dangereux présent dans la page");
  console.log("OK lien invalide refusé (retour page officielle uniquement)");

  // 6. Absence d'Internet : socket coupée -> message hors ligne.
  mkState({ mode: "offline" });
  await page
    .getByRole("button", { name: "Rechercher des mises à jour" })
    .click();
  await expect(
    page.getByText("Connexion Internet indisponible."),
  ).toBeVisible({ timeout: 30000 });
  await page.goto(base + "/");
  await page.waitForLoadState("load", { timeout: 90000 });
  console.log("OK absence d'Internet : message propre, application non bloquée");

  // 7. Erreur réseau (500) : message d'échec générique.
  mkState({ mode: "neterror" });
  await page.goto(base + "/parametres");
  await page.waitForLoadState("load", { timeout: 90000 });
  await page
    .getByRole("button", { name: "Rechercher des mises à jour" })
    .click();
  await expect(page.getByText(/Vérification impossible pour le moment/)).toBeVisible({
    timeout: 30000,
  });
  console.log("OK erreur réseau 500 : échec générique sans donneurs");

  // 8. Réponse illisible : échec générique (aucun détail technique).
  mkState({ mode: "badjson" });
  await page
    .getByRole("button", { name: "Rechercher des mises à jour" })
    .click();
  await expect(
    page.getByText(/Vérification impossible pour le moment/),
  ).toBeVisible({ timeout: 30000 });
  console.log("OK réponse illisible : échec générique");

  // 9. Dépôt sans version publiée (404) : installation à jour.
  mkState({ mode: "none" });
  await page
    .getByRole("button", { name: "Rechercher des mises à jour" })
    .click();
  await expect(page.getByText(/la plus récente/)).toBeVisible({
    timeout: 30000,
  });
  console.log("OK dépôt sans releases : considérée à jour");

  // 10. Aucune donnée commerciale transmise / base intacte.
  if (mock.counters.post !== 0 || mock.counters.other !== 0)
    throw new Error(
      "requêtes non GET vers la source de mises à jour : " +
        JSON.stringify(mock.counters),
    );
  await page.goto(base + "/recherche?q=zzeaucun");
  await page.waitForLoadState("load", { timeout: 90000 });
  if (hashDb() !== hashBefore)
    throw new Error("base SQLite modifiée par les vérifications de mises à jour");
  const secrets = ["evil.example.com", adminPass];
  const raw = fs.readFileSync(file).toString("latin1");
  for (const secret of secrets)
    if (raw.includes(secret)) throw new Error("secret en clair dans la base");
  console.log(
    "OK protection : " + mock.counters.get + " GET émis, aucune écriture base, aucune donnée transmise",
  );

  console.log("MISES A JOUR : TOUT PASSE");
} finally {
  if (mock) mock.close();
  await browser.close();
  await db.$disconnect().catch(() => {});
}
