// Orchestre la construction de l’installeur (mono-poste, offline).
// Usage : node desktop/build.mjs
//  1. génère le client Prisma SQLite
//  2. crée la base template vierge (desktop/template/ironz.db) :
//     aucun utilisateur, aucune donnée — l’administrateur est créé
//     au premier démarrage via la page /premiere-installation
//  3. build Next en mode standalone desktop
//  4. assemble desktop/pack + package avec electron-builder (installeur NSIS)
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const PORT = "4380";
const BASE_URL = "http://127.0.0.1:" + PORT;

function run(cmd, args, env = {}) {
  console.log("\n[desktop] " + cmd + " " + args.join(" "));
  const r = spawnSync(cmd, args, {
    cwd: root,
    shell: true,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) throw new Error("Échec : " + cmd + " " + args.join(" "));
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name),
      d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// 1. Client Prisma SQLite.
run("npx", ["prisma", "generate", "--schema", "prisma/schema.sqlite.prisma"]);

// 2. Base template 100 % vierge (aucun identifiant par défaut).
const templateDir = path.join(root, "desktop", "template");
fs.rmSync(templateDir, { recursive: true, force: true });
fs.mkdirSync(templateDir, { recursive: true });
const templateDb = path.join(templateDir, "ironz.db");
const templateUrl = "file:" + templateDb.replace(/\\/g, "/");
run(
  "npx",
  ["prisma", "db", "push", "--schema", "prisma/schema.sqlite.prisma", "--skip-generate"],
  { DATABASE_URL: templateUrl },
);

// 3. Moteur Prisma embarqué (utilisé via PRISMA_QUERY_ENGINE_LIBRARY).
const engineCandidates = [];
for (const dir of [
  path.join(root, "src", "generated", "prisma-desktop"),
  path.join(root, "node_modules", ".prisma", "client"),
]) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir))
    if (/query_engine|libquery_engine/i.test(f) && !f.endsWith(".node.gz"))
      engineCandidates.push(path.join(dir, f));
}
if (!engineCandidates.length)
  throw new Error("Moteur Prisma introuvable après generate.");
fs.copyFileSync(
  engineCandidates[0],
  path.join(templateDir, "prisma-engine.node"),
);
console.log("[desktop] moteur : " + engineCandidates[0]);

// 4. Échange du client Prisma : le bundle desktop doit contenir le client
// SQLite (même API que le client Mongo, seul le moteur change).
const mongoBackup = path.join(root, "desktop", ".mongo-backup");
const prismaDir = path.join(root, "src", "generated", "prisma");
const sqliteDir = path.join(root, "src", "generated", "prisma-desktop");
if (!fs.existsSync(prismaDir)) run("npx", ["prisma", "generate"]);
fs.rmSync(mongoBackup, { recursive: true, force: true });
copyDir(prismaDir, mongoBackup);

try {
  for (const f of fs.readdirSync(sqliteDir))
    fs.cpSync(path.join(sqliteDir, f), path.join(prismaDir, f), {
      recursive: true,
    });
  console.log("[desktop] client SQLite en place pour le bundle.");

  run("npx", ["next", "build", "--webpack"], {
    DESKTOP_BUILD: "1",
    IRONZ_SQLITE: "1",
    APP_URL: BASE_URL,
  });
} finally {
  fs.rmSync(prismaDir, { recursive: true, force: true });
  copyDir(mongoBackup, prismaDir);
  fs.rmSync(mongoBackup, { recursive: true, force: true });
  console.log("[desktop] client Prisma initial restauré.");
}

// 5. Assemblage du dossier à empaqueter.
const pack = path.join(root, "desktop", "pack");
fs.rmSync(pack, { recursive: true, force: true });
copyDir(path.join(root, ".next", "standalone"), path.join(pack, "standalone"));
copyDir(
  path.join(root, ".next", "static"),
  path.join(pack, "standalone", ".next", "static"),
);
copyDir(path.join(root, "public"), path.join(pack, "standalone", "public"));
fs.copyFileSync(
  path.join(root, "desktop", "main.cjs"),
  path.join(pack, "main.cjs"),
);
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
// Le serveur standalone embarque ses node_modules ; on déclare un module
// factice local pour que la collecte des dépendances s'arrête au pack
// (sinon electron-builder remonte le node_modules du projet → +13 000
// fichiers inutiles dans l'installateur, très lents à extraire).
fs.writeFileSync(
  path.join(pack, "package.json"),
  JSON.stringify(
    {
      name: "ironz-gestion-desktop",
      version: pkg.version,
      main: "main.cjs",
      dependencies: { "ironz-desktop-placeholder": "0.0.1" },
    },
    null,
    2,
  ),
);
const placeholderDir = path.join(pack, "node_modules", "ironz-desktop-placeholder");
fs.mkdirSync(placeholderDir, { recursive: true });
fs.writeFileSync(
  path.join(placeholderDir, "package.json"),
  JSON.stringify({ name: "ironz-desktop-placeholder", version: "0.0.1", main: "index.js" }),
);
fs.writeFileSync(path.join(placeholderDir, "index.js"), "// placeholder\n");
// Patch du serveur standalone : process.chdir(__dirname) échoue quand le
// serveur tourne depuis app.asar (un chemin virtuel). On redirige le chdir
// vers un dossier réel fourni par main.cjs (IRONZ_STANDALONE_DIR).
const serverJs = path.join(pack, "standalone", "server.js");
fs.writeFileSync(
  serverJs,
  fs
    .readFileSync(serverJs, "utf8")
    .replace(
      "process.chdir(__dirname)",
      "process.chdir(process.env.IRONZ_STANDALONE_DIR || __dirname)",
    ),
);
console.log("[desktop] server.js patché (chdir asar-safe).");

// 6. Packaging installeur Windows (NSIS).
run("npx", [
  "electron-builder",
  "--config",
  "desktop/electron-builder.json",
  "--win",
  "nsis",
  "--publish",
  "never",
]);

console.log("\n[desktop] Terminé : desktop/dist/IRONZ-Gestion-Setup-*.exe");
console.log("[desktop] Aucun identifiant par défaut : compte admin créé au premier lancement.");
