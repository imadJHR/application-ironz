// Remplace le contenu de la Release v0.1.0 par la version 0.1.0 finale
// (toutes fonctionnalités, renumérotées). Historique Git conservé.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

const repo = "imadJHR/application-ironz";
function token() {
  const out = execSync("git credential fill", {
    input: "protocol=https\nhost=github.com\n\n",
  }).toString();
  return out.split("\n").find((l) => l.startsWith("password="))?.slice(9);
}
const t = token();
const api = "https://api.github.com/repos/" + repo;
const H = () => ({
  Authorization: "Bearer " + t,
  Accept: "application/vnd.github+json",
  "User-Agent": "ironz-release-helper",
});
const shaFile = (p) =>
  createHash("sha256").update(fs.readFileSync(p)).digest("hex").toUpperCase();

const exe = path.resolve("desktop/dist/IRONZ-Gestion-Setup-0.1.0.exe");
const notice = path.resolve("distribution/IRONZ-Notice-Installation.txt");
const exeSha = shaFile(exe);
const noticeSha = shaFile(notice);
const sums = `${exeSha}  IRONZ-Gestion-Setup-0.1.0.exe\n${noticeSha}  IRONZ-Notice-Installation.txt\n`;
const sumsBuf = Buffer.from(sums, "utf8");

const get = await (await fetch(api + "/releases/tags/v0.1.0", { headers: H() })).json();
if (!get?.id) throw new Error("release introuvable : " + get?.message);
const relId = get.id;

const body = `Première version publique de **IRONZ Gestion** — application de gestion commerciale Windows, 100 % hors ligne (base SQLite sur votre poste, aucun serveur ni abonnement).

> Cette version intègre toutes les fonctionnalités développées : elle est la seule référence publique.
> Aucun identifiant par défaut : le compte administrateur unique est créé au premier lancement.

## Télécharger
- **\`IRONZ-Gestion-Setup-0.1.0.exe\`** — Windows 64 bits (installateur NSIS, ~136 Mo)
- **SHA-256** : \`${exeSha}\` (voir aussi \`SHA256SUMS.txt\`)
- [Notice d'installation complète](https://github.com/${repo}/releases/download/v0.1.0/IRONZ-Notice-Installation.txt)

L'installateur n'est **pas signé numériquement** : Windows SmartScreen peut afficher un avertissement — **Informations complémentaires** puis **Exécuter quand même**.

## Principales fonctionnalités
- Clients, catalogue de produits et services.
- Devis, commandes, bons de livraison, factures + PDF générés localement.
- Suivi des paiements et encaissements.
- Recherche globale depuis l'en-tête de l'application.
- **Compte administrateur unique** créé au premier lancement (aucun identifiant livré), code de récupération 128 bits affiché une seule fois, régénérable.
- **Comptes hérités d'essais antérieurs** : signalés dans « Paramètres » ▸ « Comptes hérités détectés » ; fusion décidée par l'administrateur (mot de passe requis), jamais automatique ; les comptes non administrateur ne peuvent plus se connecter (refus générique).
- **Mises à jour** (Paramètres ▸ Mises à jour) : vérification volontaire sur le dépôt GitHub officiel — version installée, nouveautés, lien direct de l'installateur. Aucune installation automatique, aucune donnée transmise, hors ligne propre.
- **Sauvegarde et restauration** SQLite intégrées (contrôle d'intégrité, copie de sécurité datée avant restauration).
- Journaux de diagnostic dans le dossier de données (launch.log, server-err.log, server-out.log).

## Sécurité
- Mot de passe chiffré (scrypt, 12 caractères minimum, jamais en clair).
- Vérification des mises à jour : GET public uniquement, liens filtrés vers ce dépôt officiel.
- Protections anti-bruteforce (fenêtre glissante).

Vos données SQLite ne sont jamais supprimées ni modifiées par l'installation : l'installateur ne touche qu'aux fichiers de l'application.`;

const patch = await fetch(api + "/releases/" + relId, {
  method: "PATCH",
  headers: { ...H(), "Content-Type": "application/json" },
  body: JSON.stringify({
    tag_name: "v0.1.0",
    target_commitish: undefined,
    name: "IRONZ Gestion 0.1.0 — Première version publique",
    draft: false,
    prerelease: false,
    body,
  }),
});
if (!patch.ok) throw new Error("PATCH KO " + patch.status + " " + (await patch.text()).slice(0, 200));
console.log("release mise à jour (id " + relId + ")");

for (const a of get.assets ?? []) {
  const del = await fetch(api + "/releases/assets/" + a.id, { method: "DELETE", headers: H() });
  console.log("delete", a.name, del.status);
}

const assets = [
  ["IRONZ-Gestion-Setup-0.1.0.exe", fs.readFileSync(exe)],
  ["IRONZ-Notice-Installation.txt", fs.readFileSync(notice, "utf8")],
  ["SHA256SUMS.txt", sumsBuf],
];
for (const [name, data] of assets) {
  const up = await fetch(
    `https://uploads.github.com/repos/${repo}/releases/${relId}/assets?name=${encodeURIComponent(name)}`,
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + t,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/octet-stream",
        "Content-Length": String(data.length),
        "User-Agent": "ironz-release-helper",
      },
      body: data,
    },
  );
  const j = await up.json();
  console.log("upload", name, up.status, j?.state ?? j?.message);
}
console.log("SHA exe :", exeSha);
fs.writeFileSync(path.resolve("desktop/release-final-sha.txt"), exeSha + "\n", "utf8");
