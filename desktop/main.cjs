// IRONZ Gestion — processus principal de l'application desktop (.exe).
// Démarre le serveur Next local (base SQLite du poste) puis ouvre la fenêtre.
// Aucune connexion internet requise.
const { app, BrowserWindow, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { fork } = require("node:child_process");
const http = require("node:http");

const PORT = Number(process.env.IRONZ_PORT || "4380");
const BASE_URL = "http://127.0.0.1:" + PORT;
const isDev = process.env.IRONZ_DESKTOP_DEV === "1";

// Dossier de données sans espace (évite les soucis d'URL SQLite).
app.setPath("userData", path.join(app.getPath("appData"), "ironz-gestion"));

let serverProcess = null;
const logFile = () => path.join(app.getPath("userData"), "launch.log");
function log(message) {
  try {
    fs.appendFileSync(
      logFile(),
      new Date().toISOString() + " " + message + "\n",
    );
  } catch {
    // Journalisation best-effort.
  }
}

function resourcePath(name) {
  if (isDev) return path.join(__dirname, "template", name);
  return path.join(process.resourcesPath, name);
}

function ensureDatabase() {
  const dest = path.join(app.getPath("userData"), "ironz.db");
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const source = resourcePath("ironz-template.db");
    log("copie base : " + source + " -> " + dest);
    fs.copyFileSync(source, dest);
  }
  return dest;
}

function startLocalServer(dbFile) {
  // En build empaqueté (asar), le serveur runtime est exécuté depuis
  // l'archive ; le chdir du serveur est redirigé vers un vrai dossier
  // (IRONZ_STANDALONE_DIR) car process.chdir refuse un chemin asar.
  const root = __dirname.includes("app.asar")
    ? __dirname.replace("app.asar.unpacked", "app.asar")
    : __dirname;
  const standaloneDir = isDev
    ? path.join(__dirname, "..", ".next", "standalone")
    : path.join(root, "standalone");
  const env = {
    ...process.env,
    PORT: String(PORT),
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
    IRONZ_SQLITE: "1",
    // Origine autorisée pour le login (lue au runtime par le serveur).
    APP_URL: BASE_URL,
    DATABASE_URL: "file:" + dbFile.replace(/\\/g, "/"),
  };
  const engine = resourcePath("prisma-engine.node");
  if (fs.existsSync(engine)) env.PRISMA_QUERY_ENGINE_LIBRARY = engine;
  const entry = path.join(standaloneDir, "server.js");
  const realCwd = isDev ? standaloneDir : process.resourcesPath;
  // Processus principal empaqueté : le chdir du serveur passe par un
  // dossier réel du disque (l'app.asar n'est pas un vrai répertoire).
  env.IRONZ_STANDALONE_DIR = realCwd;
  log("démarrage serveur : " + entry + " (exists=" + fs.existsSync(entry) + ")");
  serverProcess = fork(entry, [], {
    env,
    cwd: realCwd,
    stdio: "ignore",
  });
  log("fork lancé, pid=" + serverProcess.pid);
  serverProcess.on("error", (e) => log("fork error : " + String(e)));
  serverProcess.on("exit", (code, signal) =>
    log("serveur quitté : code=" + code + " signal=" + signal),
  );
}

function waitForServer(tries = 120) {
  return new Promise((resolve, reject) => {
    const attempt = (left) => {
      const req = http.get(BASE_URL + "/connexion", (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) resolve();
        else if (left <= 0) reject(new Error("Serveur local indisponible."));
        else setTimeout(() => attempt(left - 1), 300);
      });
      req.on("error", () => {
        if (left <= 0) reject(new Error("Serveur local indisponible."));
        else setTimeout(() => attempt(left - 1), 300);
      });
    };
    attempt(tries);
  });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "IRONZ Gestion",
    autoHideMenuBar: true,
    backgroundColor: "#111111",
  });
  await win.loadURL(BASE_URL);
}

app.whenReady().then(async () => {
  try {
    const dbFile = ensureDatabase();
    startLocalServer(dbFile);
    await waitForServer();
    await createWindow();
  } catch (error) {
    dialog.showErrorBox(
      "IRONZ Gestion",
      String((error && error.message) || error),
    );
    app.quit();
  }
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  if (serverProcess) serverProcess.kill();
});
